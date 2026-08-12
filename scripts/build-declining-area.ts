/**
 * 인구감소지역 89곳을 TourAPI 시군구 코드에 붙인다.
 *
 *   npm run build:declining
 *
 * 출처: 행정안전부 「인구감소지역 지정 현황」
 *       https://www.mois.go.kr/frt/sub/a06/b06/populationDecline/screen.do
 *       확인일 2026-08-05 · 최초 지정 2021.10 · **지정주기 5년**
 *
 * ⚠️ 5년마다 재지정된다. 다음 재지정 때 이 표를 반드시 다시 확인할 것.
 *    숫자(89)가 맞는지도 함께 본다 — 아래 검증에서 89가 아니면 멈춘다.
 *
 * ⚠️ 코드가 아니라 **이름으로 붙인다.** 행안부 고시에는 TourAPI 코드가 없다.
 *    동명 시군구가 있어서(강원 고성군 / 경남 고성군) 시도까지 함께 봐야 유일해진다.
 *    군위군은 2023년 경북 → 대구로 넘어갔고 TourAPI 도 이미 대구로 잡고 있다.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { openDb } from "./lib/db";

/** 행안부 표기 시도명 → TourAPI area_code.name */
const SIDO_ALIAS: Record<string, string> = {
  부산: "부산",
  대구: "대구",
  인천: "인천",
  경기: "경기도",
  강원: "강원특별자치도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전북특별자치도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
};

/** 행정안전부 고시 원문 그대로. 손대지 말 것 — 고칠 일이 생기면 출처를 다시 볼 것. */
const DECLINING: Record<string, string[]> = {
  부산: ["동구", "서구", "영도구"],
  대구: ["남구", "서구", "군위군"],
  인천: ["강화군", "옹진군"],
  경기: ["가평군", "연천군"],
  강원: ["고성군", "삼척시", "양구군", "양양군", "영월군", "정선군", "철원군", "태백시", "평창군", "홍천군", "화천군", "횡성군"],
  충북: ["괴산군", "단양군", "보은군", "영동군", "옥천군", "제천시"],
  충남: ["공주시", "금산군", "논산시", "보령시", "부여군", "서천군", "예산군", "청양군", "태안군"],
  전북: ["고창군", "김제시", "남원시", "무주군", "부안군", "순창군", "임실군", "장수군", "정읍시", "진안군"],
  전남: ["강진군", "고흥군", "곡성군", "구례군", "담양군", "보성군", "신안군", "영광군", "영암군", "완도군", "장성군", "장흥군", "진도군", "함평군", "해남군", "화순군"],
  경북: ["고령군", "문경시", "봉화군", "상주시", "성주군", "안동시", "영덕군", "영양군", "영주시", "영천시", "울릉군", "울진군", "의성군", "청도군", "청송군"],
  경남: ["거창군", "고성군", "남해군", "밀양시", "산청군", "의령군", "창녕군", "하동군", "함안군", "함양군", "합천군"],
};

const EXPECTED_TOTAL = 89;

// ── 검증: 고시 건수부터 맞는지 본다 ────────────────────────

const pairs: Array<{ sidoShort: string; sigungu: string }> = [];
for (const [sido, list] of Object.entries(DECLINING)) {
  for (const sigungu of list) pairs.push({ sidoShort: sido, sigungu });
}

if (pairs.length !== EXPECTED_TOTAL) {
  console.error(`고시 건수 불일치: ${pairs.length}건 (기대 ${EXPECTED_TOTAL}건). 목록을 다시 확인하세요.`);
  process.exit(1);
}

// ── TourAPI 코드에 붙이기 ─────────────────────────────────

const db = openDb();

const areas = db.prepare("SELECT code, name FROM area_code").all() as Array<{ code: string; name: string }>;
const sggs = db
  .prepare("SELECT area_code, code, name FROM sigungu_code")
  .all() as Array<{ area_code: string; code: string; name: string }>;

if (areas.length === 0) {
  console.error("지역코드가 비어 있습니다. 먼저 npm run collect:list 를 돌리세요.");
  process.exit(1);
}

const areaByName = new Map(areas.map((a) => [a.name, a.code]));

const matched: Array<{ area_code: string; sigungu_code: string; sido: string; sigungu: string }> = [];
const unmatched: string[] = [];

for (const { sidoShort, sigungu } of pairs) {
  const sidoFull = SIDO_ALIAS[sidoShort];
  const areaCode = sidoFull ? areaByName.get(sidoFull) : undefined;

  if (!areaCode) {
    unmatched.push(`${sidoShort} ${sigungu}  (시도 '${sidoFull ?? "?"}' 를 못 찾음)`);
    continue;
  }

  const hit = sggs.find((s) => s.area_code === areaCode && s.name === sigungu);
  if (!hit) {
    unmatched.push(`${sidoShort} ${sigungu}  (${sidoFull} 안에 해당 시군구 없음)`);
    continue;
  }

  matched.push({ area_code: areaCode, sigungu_code: hit.code, sido: sidoFull!, sigungu });
}

// ── 저장 ──────────────────────────────────────────────────

db.exec("BEGIN");
try {
  db.exec("DELETE FROM declining_area");
  const ins = db.prepare(
    "INSERT INTO declining_area (area_code, sigungu_code, sido, sigungu) VALUES (?,?,?,?)",
  );
  for (const m of matched) ins.run(m.area_code, m.sigungu_code, m.sido, m.sigungu);
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

// .env 의 RAW_DECLINING_AREA_FILE 이 가리키는 자리에도 남긴다.
// DB 를 지우고 다시 만들 때 이 파일만 있으면 API 없이 복구된다.
const csvPath = process.env.RAW_DECLINING_AREA_FILE ?? "./data/raw/declining_area.csv";
mkdirSync(dirname(csvPath), { recursive: true });
writeFileSync(
  csvPath,
  "area_code,sigungu_code,sido,sigungu\n" +
    matched.map((m) => `${m.area_code},${m.sigungu_code},${m.sido},${m.sigungu}`).join("\n") +
    "\n",
  "utf8",
);

// ── 결과 ──────────────────────────────────────────────────

console.log(`\n인구감소지역 ${matched.length} / ${EXPECTED_TOTAL} 매칭`);

if (unmatched.length > 0) {
  console.log(`\n못 붙인 것 ${unmatched.length}건 — 이름이 다르거나 관할이 바뀐 곳입니다:`);
  for (const u of unmatched) console.log(`  · ${u}`);
}

const bySido = db
  .prepare("SELECT sido, COUNT(*) n FROM declining_area GROUP BY sido ORDER BY n DESC")
  .all() as Array<{ sido: string; n: number }>;
console.log("\n시도별");
for (const r of bySido) console.log(`  ${r.sido.padEnd(10)} ${r.n}`);

// 실제로 장소가 몇 곳이나 여기 걸리는지 — 이게 서비스의 대상 규모다
const placeCount = db
  .prepare(`
    SELECT COUNT(*) n FROM tour_place p
    JOIN declining_area d ON d.area_code = p.area_code AND d.sigungu_code = p.sigungu_code
  `)
  .get() as { n: number };
const total = (db.prepare("SELECT COUNT(*) n FROM tour_place").get() as { n: number }).n;

console.log(`\n인구감소지역에 있는 장소  ${placeCount.n.toLocaleString()} / ${total.toLocaleString()}`);
console.log(`  ⚠️ 지역코드가 빈 장소는 여기 안 잡힌다. 주소로 채우는 2단계 후 다시 셀 것.`);
console.log(`\n저장: ${csvPath}\n`);

db.close();
