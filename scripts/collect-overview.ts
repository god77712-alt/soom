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
 * 수집 우선순위 — **콘텐츠 타입이 아니라 소재로 정한다.** (2026-08-12 전면 수정)
 *
 * ── 무엇이 잘못됐었나 ────────────────────────────────────
 * 원래는 타입 순서(38 쇼핑 먼저)였다. 하루 1,000건씩 몇 주를 돌린 뒤 확인해 보니
 * **받아둔 소개글 2,995건이 전부 타입 38 이었다.**
 *
 *   타입 38 전체 12,248곳 · 받은 것 2,996 · 남은 것 9,252
 *   → 관광지(12)로 넘어가려면 **9일을 더 쇼핑에만 써야 했다.**
 *
 * 게다가 쇼핑의 대부분은 대형마트·백화점·면세점이다. 검색 계획에서 이미
 * 제외한 것들이라(`SUBJECT_SKIP`) 이 서비스가 절대 추천하지 않는 곳이다.
 * 사찰·계곡·해수욕장은 소개글이 **한 건도** 없었다.
 *
 * ⚠️ 오류가 안 뜬다. 리포트에는 "소개글 2,995건" 으로 찍혀서 잘 되는 것처럼 보인다.
 *    소재별로 갈라 보고 나서야 드러났다 (`npm run report:inventory`).
 *
 * ── 그래서 순서를 이렇게 바꿨다 ──────────────────────────
 * 소개글은 4단계 LLM 태깅의 유일한 원료이고, 태깅은 추천 화면에 쓰인다.
 * 그러니 **화면에 실제로 나올 곳부터** 받는다.
 *
 *   ① 12개 주력 소재 × 인구감소지역   2,410곳
 *   ② 12개 주력 소재 나머지           2,097곳   → 여기까지 5일이면 끝난다
 *   ③ 태그가 붙은 곳 × 인구감소지역
 *   ④ 태그가 붙은 곳
 *   ⑤ 나머지 (타입 순서)
 */
const TYPE_PRIORITY = [12, 14, 38, 28, 39, 25, 15, 32];

/**
 * 성과가 검증된 12개 주력 소재 (`eval:hypothesis` · `collect-youtube.ts` SUBJECT_PLAN).
 * 이 이름들은 관광공사 소분류명 그대로다 — 바꾸면 조인이 조용히 0건이 된다.
 */
const TARGET_SUBJECTS = [
  "야영장,오토캠핑장",
  "유적지/사적지",
  "사찰",
  "5일장",
  "폐교",
  "해수욕장",
  "상설시장",
  "계곡",
  "항구/포구",
  "고택",
  "섬",
  "자연휴양림",
];

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
         WHERE o.content_id IS NULL OR o.status_en IS NULL OR o.status_en = 'fail'`
      : `SELECT p.content_id, p.content_type_id FROM tour_place p
         LEFT JOIN tour_overview o ON o.content_id = p.content_id
         LEFT JOIN place pl
                ON pl.source_id = p.content_id AND pl.source = 'tourapi'
         WHERE o.content_id IS NULL OR o.status IS NULL OR o.status = 'fail'
         ORDER BY
           CASE
             WHEN EXISTS (SELECT 1 FROM place_tag pt JOIN tag t ON t.id = pt.tag_id
                           WHERE pt.place_id = pl.id
                             AND t.name_ko IN (${TARGET_SUBJECTS.map(() => "?").join(",")}))
              THEN CASE WHEN pl.is_declining_area = 1 THEN 0 ELSE 1 END
             WHEN EXISTS (SELECT 1 FROM place_tag pt WHERE pt.place_id = pl.id)
              THEN CASE WHEN pl.is_declining_area = 1 THEN 2 ELSE 3 END
             ELSE 4
           END,
           CASE p.content_type_id
             ${TYPE_PRIORITY.map((t, i) => `WHEN ${t} THEN ${i}`).join(" ")}
             ELSE 99 END,
           p.content_id`,
  )
  .all(...(isEn ? [] : TARGET_SUBJECTS)) as Array<{ content_id: string }>;

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

/**
 * ⚠️ 영문은 `status_en` 에만 쓴다. `status` 를 건드리면 안 된다.
 *    한 칸을 같이 쓰던 시절, 영문이 먼저 넣은 행이 status='ok' 가 되는 바람에
 *    국문 큐에서 1,984건이 통째로 빠졌다. 화면에는 아무 오류도 안 뜬다.
 */
const upsertEn = db.prepare(`
  INSERT INTO tour_overview (content_id, overview_en, status_en, fetched_at)
  VALUES (?,?,?,?)
  ON CONFLICT(content_id) DO UPDATE SET
    overview_en = excluded.overview_en,
    status_en   = excluded.status_en,
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
