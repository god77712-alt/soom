/**
 * 1단계-D · 운영 정보 수집 (detailIntro2).
 *
 *   npm run collect:intro
 *   npm run collect:intro -- --en
 *   npm run collect:intro -- --dry
 *
 * ── 무엇을 받는가 ─────────────────────────────────────────
 * 운영시간·휴무일·주차·이용요금·문의처. **카드 내용의 재료**다.
 *
 * 순위로 장소를 가를 근거는 우리에게 없다(CLAUDE.md 3항). 차이는 카드 내용으로
 * 낸다 — 그런데 지금 카드가 쓸 수 있는 건 볼거리 933곳뿐이다. 운영 정보는
 * 크리에이터가 실제로 움직이기 전에 반드시 확인하는 것이고, 없으면 그 칸을
 * 안 그리게 되어 카드가 빈다.
 *
 * ⚠️ 5일장 장날은 **전통시장 표준데이터가 더 정확하다** (411곳). 여기서 받는 건
 *    그 파일에 없는 곳을 메우는 용도다. 두 출처가 어긋나면 표준데이터가 이긴다.
 *
 * ── 왜 JSON 통째로 넣는가 ─────────────────────────────────
 * 🚨 `detailIntro2` 는 **콘텐츠 타입마다 응답 필드 이름이 전부 다르다.**
 *
 *    관광지(12)  usetime · restdate · parking · expguide
 *    문화시설(14) usetimeculture · restdateculture · parkingculture
 *    음식점(39)  opentimefood · restdatefood · parkingfood · firstmenu
 *    숙박(32)    checkintime · checkouttime · roomcount · subfacility
 *
 * 타입별 컬럼을 미리 못 박으면 8종을 전부 매핑해야 하고, 하나라도 틀리면
 * **오류 없이 그 타입만 조용히 빈다.** 소개글이 몇 주째 쇼핑만 갈고 있던 것과
 * 같은 종류의 실패다 — 총량 리포트에는 잘 되는 것처럼 찍힌다.
 *
 * → 원문을 그대로 보관하고, 화면에 쓸 때 타입별로 꺼낸다. 쿼터는 하루 1,000건
 *   뿐이라 **다시 받는 비용이 크다.** 받을 때는 버리지 않는 게 원칙이다.
 *
 * ── 쿼터 ──────────────────────────────────────────────────
 * `detailIntro2` 는 `detailCommon2`·`detailImage2` 와 **또 다른 1,000/일 버킷**이다.
 * 어느 게 살아 있는지는 `npm run probe:quota` 로 본다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";
import { nowIso, openDb } from "./lib/db";

// ── 인자 ──────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const isEn = argv.includes("--en");
const DRY = argv.includes("--dry");
const LIMIT = Number(flag("limit") ?? 0) || Infinity;
const CONCURRENCY = Math.max(1, Number(flag("concurrency") ?? 4));

/** `collect-overview.ts`·`collect-image.ts` 와 **같은 목록이어야 한다** */
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
const service = isEn ? SERVICES.eng : SERVICES.kor;

// ── 대상 뽑기 ─────────────────────────────────────────────

/**
 * 국문은 소재 우선(화면에 실제로 나올 곳부터), 영문은 순서대로.
 * 영문은 콘텐츠 타입 코드 체계가 달라 우선순위표가 안 맞는다.
 */
const targets = (
  isEn
    ? db
        .prepare(
          `SELECT p.content_id, p.content_type_id FROM tour_place_en p
            LEFT JOIN tour_intro i ON i.content_id = p.content_id AND i.lang = 'en'
            WHERE i.content_id IS NULL OR i.status = 'fail'
            ORDER BY p.content_id`,
        )
        .all()
    : db
        .prepare(
          `SELECT p.content_id, p.content_type_id FROM tour_place p
            LEFT JOIN tour_intro i ON i.content_id = p.content_id AND i.lang = 'ko'
            LEFT JOIN place pl ON pl.source_id = p.content_id AND pl.source = 'tourapi'
            WHERE i.content_id IS NULL OR i.status = 'fail'
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
              p.content_id`,
        )
        .all(...TARGET_SUBJECTS)
) as Array<{ content_id: string; content_type_id: number }>;

const queue = targets.slice(0, LIMIT === Infinity ? undefined : LIMIT);
const already = (
  db
    .prepare("SELECT COUNT(*) AS n FROM tour_intro WHERE lang = ? AND status <> 'fail'")
    .get(isEn ? "en" : "ko") as { n: number }
).n;

console.log(`\n1단계-D · ${isEn ? "영문" : "국문"} 운영정보 수집 (detailIntro2)`);
console.log(
  `  이미 조회 ${already.toLocaleString()} · 남은 ${targets.length.toLocaleString()} · 이번 실행 ${queue.length.toLocaleString()}`,
);
console.log(`  동시 ${CONCURRENCY}\n`);

if (DRY) {
  console.log(`  --dry · 쿼터를 쓰지 않았습니다.`);
  console.log(`  앞 10건: ${queue.slice(0, 10).map((q) => q.content_id).join(", ")}\n`);
  db.close();
  process.exit(0);
}

if (queue.length === 0) {
  console.log("받을 게 없습니다. 이미 전부 조회했습니다.\n");
  db.close();
  process.exit(0);
}

// ── 저장 ──────────────────────────────────────────────────

const upsert = db.prepare(`
  INSERT INTO tour_intro (content_id, lang, content_type_id, payload, status, fail_code, fetched_at)
  VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(content_id, lang) DO UPDATE SET
    content_type_id = excluded.content_type_id,
    payload         = excluded.payload,
    status          = excluded.status,
    fail_code       = excluded.fail_code,
    fetched_at      = excluded.fetched_at
`);

// ── 실행 ──────────────────────────────────────────────────

const runId = (
  db
    .prepare("INSERT INTO collect_run (phase, scope, started_at) VALUES (?, ?, ?) RETURNING id")
    .get(isEn ? "intro_en" : "intro", `${queue.length}건`, nowIso()) as { id: number }
).id;

let ok = 0;
let empty = 0;
let fail = 0;
let done = 0;
let stopped: string | null = null;
const t0 = Date.now();

const QUOTA_CODES = new Set(["22", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"]);
const FAIL_STREAK_LIMIT = 50;
let failStreak = 0;

/** 응답에서 알맹이가 있는 필드만 센다. contentid·contenttypeid 는 알맹이가 아니다 */
function meaningfulKeys(o: Record<string, unknown>): number {
  return Object.entries(o).filter(
    ([k, v]) =>
      k !== "contentid" &&
      k !== "contenttypeid" &&
      typeof v === "string" &&
      v.trim().length > 0,
  ).length;
}

async function worker(items: typeof queue): Promise<void> {
  for (const it of items) {
    if (stopped) return;

    const r = await callTourApi<Record<string, unknown>>(service, "detailIntro2", {
      contentId: it.content_id,
      contentTypeId: it.content_type_id,
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
    const n = d ? meaningfulKeys(d) : 0;
    const status = !r.ok ? "fail" : n > 0 ? "ok" : "empty";

    upsert.run(
      it.content_id,
      isEn ? "en" : "ko",
      it.content_type_id,
      d ? JSON.stringify(d) : null,
      status,
      r.ok ? null : r.code,
      nowIso(),
    );

    if (!r.ok) fail += 1;
    else if (n > 0) ok += 1;
    else empty += 1;

    done += 1;
    if (done % 250 === 0) {
      const rate = done / ((Date.now() - t0) / 1000);
      const left = ((queue.length - done) / rate / 60).toFixed(0);
      console.log(
        `  ${String(done).padStart(6)} / ${queue.length}  ` +
          `있음 ${ok} · 없음 ${empty} · 실패 ${fail}  ${rate.toFixed(1)}/s  남은 ${left}분`,
      );
    }
  }
}

async function main() {
  const lanes: Array<typeof queue> = Array.from({ length: CONCURRENCY }, () => []);
  queue.forEach((it, i) => lanes[i % CONCURRENCY].push(it));

  await Promise.all(lanes.map(worker));

  const mins = ((Date.now() - t0) / 60_000).toFixed(1);
  db.prepare(
    "UPDATE collect_run SET ok_count = ?, fail_count = ?, note = ?, ended_at = ? WHERE id = ?",
  ).run(ok + empty, fail, stopped ?? `${mins}분`, stopped ? null : nowIso(), runId);

  console.log(`\n═══════════════════════════════════════`);
  if (stopped) {
    console.log(` 중단: ${stopped}`);
    console.log(` 받은 만큼은 저장됨. 내일 같은 명령으로 이어받으세요.`);
  } else {
    console.log(` 완료  ${done.toLocaleString()}건  (${mins}분)`);
  }
  console.log(
    ` 있음 ${ok.toLocaleString()} · 없음 ${empty.toLocaleString()} · 실패 ${fail.toLocaleString()}`,
  );
  console.log(`═══════════════════════════════════════\n`);

  db.close();
}

main();
