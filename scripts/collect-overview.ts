/**
 * 1단계-B · 소개글 전수 수집 (detailCommon2).
 *
 *   npm run collect:overview            국문 소개글
 *   npm run collect:overview -- --en    영문 소개글
 *   npm run collect:overview -- --limit 200 --concurrency 4
 *
 * ★ 소개글은 4단계 LLM 태깅의 **유일한 원료**다. SPEC 7장 1단계 완료 판정이 이 표의 채움 비율이다.
 *
 * ⚠️ detailCommon2 에는 **contentId 하나만 보낼 것.**
 *    defaultYN·overviewYN·firstImageYN·contentTypeId 를 붙이면 게이트웨이가 거부한다
 *    (NO_OPENAPI_SERVICE_ERROR). KorService2 에서 사라진 파라미터인데 블로그 예제엔 아직 있다.
 *
 * ── 이어받기 ──────────────────────────────────────────────
 * 별도 체크포인트 파일을 두지 않는다. `tour_overview` 에 행이 있으면 받은 것이다.
 * 파일과 DB 두 곳에 진행 상태를 두면 반드시 어긋나고, 어긋나면 뭘 믿을지 알 수 없게 된다.
 * 그래서 중단 지점 = "아직 tour_overview 에 없는 content_id". 재실행하면 거기서 이어간다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";
import { nowIso, openDb, stripHtml } from "./lib/db";

interface CommonDetail {
  contentid: string;
  title?: string;
  overview?: string;
  homepage?: string;
}

// ── 인자 ──────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const isEn = argv.includes("--en");
const LIMIT = Number(flag("limit") ?? 0) || Infinity;
const CONCURRENCY = Math.max(1, Number(flag("concurrency") ?? 4));

/**
 * 수집 우선순위.
 *
 * 전수를 받되 **순서를 정한다.** 2.7시간짜리 작업이라 중간에 쿼터가 마르거나 끊길 수 있는데,
 * 그때 주력 소재가 이미 들어와 있으면 그 상태로도 다음 단계를 시작할 수 있다.
 * 오일장·재래시장이 쇼핑(38), 노포가 음식점(39)이다. 숙박은 S4 ⑥ 에만 쓰여서 맨 뒤.
 */
const TYPE_PRIORITY = [38, 12, 39, 14, 28, 15, 25, 32];

const db = openDb();

// ── 대상 뽑기 ─────────────────────────────────────────────

const table = isEn ? "tour_place_en" : "tour_place";
const column = isEn ? "overview_en" : "overview";
const service = isEn ? SERVICES.eng : SERVICES.kor;

/**
 * 아직 안 받은 content_id.
 *
 * ⚠️ `status = 'fail'` 도 **다시 받아야 할 대상**이다. 행이 있다는 이유로 건너뛰면,
 *    쿼터가 말라서 실패한 수만 건이 영원히 빈 채로 남는다. 실제로 그렇게 18,000건이 박혔다.
 *    "받았는데 소개글이 없다(empty)"와 "못 받았다(fail)"는 전혀 다르다.
 *
 * 국문은 타입 우선순위대로, 영문은 그냥 순서대로 (영문은 타입 코드 체계가 달라 우선순위표가 안 맞는다).
 */
const targets = db
  .prepare(
    isEn
      ? `SELECT p.content_id FROM tour_place_en p
         LEFT JOIN tour_overview o ON o.content_id = p.content_id
         WHERE o.content_id IS NULL OR o.overview_en IS NULL`
      : `SELECT p.content_id, p.content_type_id FROM tour_place p
         LEFT JOIN tour_overview o ON o.content_id = p.content_id
         WHERE o.content_id IS NULL OR o.status = 'fail'
         ORDER BY CASE p.content_type_id
           ${TYPE_PRIORITY.map((t, i) => `WHEN ${t} THEN ${i}`).join(" ")}
           ELSE 99 END, p.content_id`,
  )
  .all() as Array<{ content_id: string }>;

const queue = targets.slice(0, LIMIT === Infinity ? undefined : LIMIT);

const totalInTable = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

console.log(`\n1단계-B · ${isEn ? "영문" : "국문"} 소개글 수집`);
console.log(`  전체 ${totalInTable.toLocaleString()} · 남은 ${targets.length.toLocaleString()} · 이번 실행 ${queue.length.toLocaleString()}`);
console.log(`  동시 ${CONCURRENCY}\n`);

if (queue.length === 0) {
  console.log("받을 게 없습니다. 이미 전부 조회했습니다.\n");
  db.close();
  process.exit(0);
}

// ── 저장 ──────────────────────────────────────────────────

const upsertKo = db.prepare(`
  INSERT INTO tour_overview (content_id, overview, homepage, status, fail_code, fetched_at)
  VALUES (?,?,?,?,?,?)
  ON CONFLICT(content_id) DO UPDATE SET
    overview   = excluded.overview,
    homepage   = excluded.homepage,
    status     = excluded.status,
    fail_code  = excluded.fail_code,
    fetched_at = excluded.fetched_at
`);

const upsertEn = db.prepare(`
  INSERT INTO tour_overview (content_id, overview_en, status, fetched_at)
  VALUES (?,?,?,?)
  ON CONFLICT(content_id) DO UPDATE SET
    overview_en = excluded.overview_en,
    fetched_at  = excluded.fetched_at
`);

// ── 실행 ──────────────────────────────────────────────────

const runId = (
  db
    .prepare("INSERT INTO collect_run (phase, scope, started_at) VALUES (?, ?, ?) RETURNING id")
    .get(isEn ? "overview_en" : "overview", `${queue.length}건`, nowIso()) as { id: number }
).id;

let ok = 0;
let empty = 0;
let fail = 0;
let done = 0;
let stopped: string | null = null;
const t0 = Date.now();

/**
 * 쿼터 소진은 반드시 **즉시 멈춘다.**
 * 계속 두드리면 수만 건이 status=fail 로 박히고, 다음 날 재실행해도 이미 행이 있어서
 * 건너뛰어 버린다. 그러면 영원히 빈 채로 남는다.
 */
const QUOTA_CODES = new Set(["22", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"]);

/**
 * 코드를 못 읽는 오류가 연달아 나도 멈춘다.
 *
 * 쿼터 코드만 믿으면 안 된다. 실제로 게이트웨이 오류 봉투를 못 읽어서 코드가 "?" 로 오는 버그가
 * 있었고, 그동안 한도를 넘긴 채로 계속 두드렸다. 파서는 고쳤지만 안전장치를 하나 더 둔다 —
 * **정상 응답이 하나도 없이 실패만 이어지면 그건 우리 쪽 문제가 아니라 저쪽이 막은 것이다.**
 */
const FAIL_STREAK_LIMIT = 50;
let failStreak = 0;

async function worker(items: Array<{ content_id: string }>): Promise<void> {
  for (const it of items) {
    if (stopped) return;

    const r = await callTourApi<CommonDetail>(service, "detailCommon2", {
      contentId: it.content_id,
    });

    if (!r.ok && QUOTA_CODES.has(r.code)) {
      stopped = `쿼터 소진 [${r.code}] ${r.message}`;
      return;
    }

    if (r.ok) {
      failStreak = 0;
    } else if ((failStreak += 1) >= FAIL_STREAK_LIMIT) {
      stopped = `연속 실패 ${failStreak}회 [${r.code}] ${r.message || r.raw?.slice(0, 120) || ""}`;
      return;
    }

    const d = r.items[0];
    const text = d?.overview ? stripHtml(d.overview) : "";

    if (isEn) {
      upsertEn.run(it.content_id, text || null, text.length >= 30 ? "ok" : "empty", nowIso());
    } else {
      // 30자 미만은 "있다"고 치지 않는다. 태그를 뽑을 수 없는 길이다.
      const status = !r.ok ? "fail" : text.length >= 30 ? "ok" : "empty";
      upsertKo.run(
        it.content_id,
        text || null,
        d?.homepage ? stripHtml(d.homepage) : null,
        status,
        r.ok ? null : r.code,
        nowIso(),
      );
    }

    if (!r.ok) fail += 1;
    else if (text.length >= 30) ok += 1;
    else empty += 1;

    done += 1;
    if (done % 500 === 0) {
      const rate = done / ((Date.now() - t0) / 1000);
      const left = ((queue.length - done) / rate / 60).toFixed(0);
      console.log(
        `  ${String(done).padStart(6)} / ${queue.length}  ` +
          `있음 ${ok} · 없음 ${empty} · 실패 ${fail}  ` +
          `${rate.toFixed(1)}/s  남은 ${left}분`,
      );
    }
  }
}

async function main() {
  // 라운드로빈으로 쪼갠다. 앞뒤로 자르면 우선순위 높은 타입이 한 워커에 몰린다.
  const lanes: Array<Array<{ content_id: string }>> = Array.from({ length: CONCURRENCY }, () => []);
  queue.forEach((it, i) => lanes[i % CONCURRENCY].push(it));

  await Promise.all(lanes.map(worker));

  const mins = ((Date.now() - t0) / 60_000).toFixed(1);
  db.prepare("UPDATE collect_run SET ok_count = ?, fail_count = ?, note = ?, ended_at = ? WHERE id = ?").run(
    ok + empty,
    fail,
    stopped ?? `${mins}분`,
    stopped ? null : nowIso(),
    runId,
  );

  console.log(`\n═══════════════════════════════════════`);
  if (stopped) {
    console.log(` 중단: ${stopped}`);
    console.log(` 받은 만큼은 저장됨. 내일 같은 명령으로 이어받으세요.`);
  } else {
    console.log(` 완료  ${done.toLocaleString()}건  (${mins}분)`);
  }
  console.log(` 있음 ${ok.toLocaleString()} · 없음 ${empty.toLocaleString()} · 실패 ${fail.toLocaleString()}`);
  console.log(`═══════════════════════════════════════`);
  console.log(` 확인: npm run report:stage1\n`);

  db.close();
}

main();
