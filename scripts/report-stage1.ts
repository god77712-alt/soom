/**
 * 1단계 완료 판정 리포트.
 *
 *   npm run report:stage1
 *
 * SPEC 7장 1단계의 완료 판정은 단 하나다 — **소개글 채워진 비율**.
 * 소개글이 4단계 LLM 태깅의 유일한 원료라서, 이게 낮으면 4단계 계획을 통째로 바꿔야 한다.
 *
 * 수집 중에도 언제든 돌릴 수 있다. 진행률을 보는 용도로도 쓴다.
 */

import { openDb } from "./lib/db";

const db = openDb();

const TYPE_NAMES: Record<number, string> = {
  12: "관광지", 14: "문화시설", 15: "축제공연행사", 25: "여행코스",
  28: "레포츠", 32: "숙박", 38: "쇼핑", 39: "음식점",
};

function q<T>(sql: string, ...args: unknown[]): T[] {
  return db.prepare(sql).all(...(args as never[])) as T[];
}

function one<T>(sql: string, ...args: unknown[]): T {
  return db.prepare(sql).get(...(args as never[])) as T;
}

const pct = (n: number, d: number) => (d === 0 ? "  -  " : `${((n / d) * 100).toFixed(1)}%`.padStart(6));

console.log("\n1단계 수집 현황\n");

// ── 목록 ──────────────────────────────────────────────────

const ko = one<{ n: number }>("SELECT COUNT(*) AS n FROM tour_place").n;
const en = one<{ n: number }>("SELECT COUNT(*) AS n FROM tour_place_en").n;

console.log(`국문 ${ko.toLocaleString()}건 · 영문 ${en.toLocaleString()}건\n`);

console.log("콘텐츠 타입별");
const byType = q<{ content_type_id: number; n: number; coord: number; img: number; area: number }>(`
  SELECT content_type_id,
         COUNT(*)                                      AS n,
         SUM(CASE WHEN lat IS NOT NULL THEN 1 ELSE 0 END)         AS coord,
         SUM(CASE WHEN first_image IS NOT NULL
                   AND first_image <> '' THEN 1 ELSE 0 END)       AS img,
         SUM(CASE WHEN area_code IS NOT NULL THEN 1 ELSE 0 END)   AS area
  FROM tour_place GROUP BY content_type_id ORDER BY n DESC
`);
console.log("  타입           건수     좌표     이미지    지역코드");
for (const r of byType) {
  const name = TYPE_NAMES[r.content_type_id] ?? String(r.content_type_id);
  console.log(
    `  ${name.padEnd(12)} ${String(r.n).padStart(6)}  ${pct(r.coord, r.n)}  ${pct(r.img, r.n)}  ${pct(r.area, r.n)}`,
  );
}

// ── 소개글 (완료 판정) ────────────────────────────────────

const ov = one<{ done: number; ok: number; empty: number; fail: number; avg: number }>(`
  SELECT COUNT(*)                                            AS done,
         SUM(CASE WHEN status = 'ok'    THEN 1 ELSE 0 END)    AS ok,
         SUM(CASE WHEN status = 'empty' THEN 1 ELSE 0 END)    AS empty,
         SUM(CASE WHEN status = 'fail'  THEN 1 ELSE 0 END)    AS fail,
         COALESCE(AVG(CASE WHEN status = 'ok'
                           THEN LENGTH(overview) END), 0)     AS avg
  FROM tour_overview
`);

/**
 * ⚠️ 확보율의 분모는 **응답을 받은 건수(ok + empty)** 다. 실패는 빼야 한다.
 *    실패는 "소개글이 없다"가 아니라 "아직 못 받았다"이고, 대부분 쿼터 소진이다.
 *    이걸 분모에 넣으면 수집이 덜 끝났을 뿐인데 "소개글 부족 — 4단계 계획 변경"이 뜬다.
 */
const answered = ov.ok + ov.empty;

console.log(`\n소개글  응답 ${answered.toLocaleString()} · 미수신 ${ov.fail.toLocaleString()} / 전체 ${ko.toLocaleString()}`);
if (ov.done > 0) {
  console.log(`  있음   ${ov.ok.toLocaleString().padStart(7)}  (응답분의 ${pct(ov.ok, answered).trim()})  평균 ${Math.round(ov.avg)}자`);
  console.log(`  없음   ${ov.empty.toLocaleString().padStart(7)}`);
  console.log(`  미수신 ${ov.fail.toLocaleString().padStart(7)}  ← 재실행하면 이것부터 다시 받는다`);

  // 타입별 확보율 — 쇼핑·음식점이 낮으면 오일장·노포 태깅이 흔들린다
  const ovByType = q<{ content_type_id: number; answered: number; ok: number }>(`
    SELECT p.content_type_id,
           SUM(CASE WHEN o.status IN ('ok','empty') THEN 1 ELSE 0 END) AS answered,
           SUM(CASE WHEN o.status = 'ok' THEN 1 ELSE 0 END)            AS ok
    FROM tour_overview o JOIN tour_place p ON p.content_id = o.content_id
    GROUP BY p.content_type_id HAVING answered > 0 ORDER BY p.content_type_id
  `);
  if (ovByType.length > 0) {
    console.log("\n  타입별 소개글 확보율 (응답분 기준)");
    for (const r of ovByType) {
      const name = TYPE_NAMES[r.content_type_id] ?? String(r.content_type_id);
      console.log(`    ${name.padEnd(12)} ${String(r.ok).padStart(6)} / ${String(r.answered).padStart(6)}  ${pct(r.ok, r.answered)}`);
    }
  }

  const rate = answered ? (ov.ok / answered) * 100 : 0;
  const partial = ov.fail > 0;

  console.log("\n═══════════════════════════════════════");
  if (partial) {
    // 아직 다 못 받았으면 판정을 내리지 않는다. 표본이 치우쳐 있을 수 있다.
    console.log(` 수집 진행 중 — ${ov.fail.toLocaleString()}건 남음. 판정은 전량 수집 후.`);
    console.log(` 지금까지 응답 ${answered.toLocaleString()}건 기준 확보율 ${rate.toFixed(1)}%`);
  } else if (rate >= 80) console.log(" → 태그 추출 가능. 4단계 계획대로.");
  else if (rate >= 50) console.log(" → 절반만 채워진다. 빈 곳은 규칙 기반 태깅으로 보완 필요.");
  else console.log(" → 소개글 부족. SPEC 4단계(LLM 태깅) 계획을 바꿔야 한다.");
  console.log("═══════════════════════════════════════");
} else {
  console.log("  아직 수집 전 — npm run collect:overview");
}

// ── 수집 이력 ─────────────────────────────────────────────

const runs = q<{ phase: string; ok_count: number; fail_count: number; note: string | null; started_at: string; ended_at: string | null }>(
  "SELECT phase, ok_count, fail_count, note, started_at, ended_at FROM collect_run ORDER BY id DESC LIMIT 5",
);
if (runs.length > 0) {
  console.log("\n최근 수집");
  for (const r of runs) {
    const when = r.started_at.slice(5, 16).replace("T", " ");
    const state = r.ended_at ? "완료" : "중단/진행중";
    console.log(`  ${when}  ${r.phase.padEnd(9)} ok ${String(r.ok_count).padStart(6)}  실패 ${String(r.fail_count).padStart(5)}  ${state}  ${r.note ?? ""}`);
  }
}

console.log("");
db.close();
