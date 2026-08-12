/**
 * 4번 · 장날 달력을 화면용 JSON 으로 굽는다.
 *
 * 실행: npm run export:shootdays   →  src/data/real/shootdays.json
 *
 * ── 왜 이걸 따로 굽는가 ──────────────────────────────────
 * 점수(`3.2×`)를 보고 4시간을 운전하는 사람은 없다. 사람을 움직이는 건
 * **날짜가 박힌 계획**이다 — 안 가면 놓치니까.
 *
 * 그 재료가 이미 다 있는데 흩어져 있었다:
 *   장날    전국전통시장표준데이터 `개설주기` (정기장 411곳)
 *   해      천문연 실측 20지점 · 주 1회 표본 + 보간 (오차 0.1분)
 *   좌표    100%
 *   경쟁    YouTube 수집
 *
 * ⚠️ **날짜를 여기서 계산해 굽지 않는다.** 굽는 순간 그 날짜가 박제돼서
 *    다음 배포까지 지난 날짜를 보여준다. 여기서는 `끝자리` 만 넘기고
 *    실제 날짜는 화면이 그릴 때 계산한다 (`src/lib/shootday.ts`).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";

const OUT = "./src/data/real/shootdays.json";

/**
 * 이름 대조용. 공백·괄호·`전통시장` 류 접미사를 떼고 비교한다.
 *
 * ⚠️ **`src/lib/shootday.ts` 의 normalize 와 글자 하나까지 같아야 한다.**
 *    여기서 만든 key 를 화면이 그대로 찾기 때문에, 한쪽만 고치면
 *    오류 없이 조용히 0건이 된다.
 */
function normalize(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .replace(/(전통시장|상설시장|공설시장|시장|장터|오일장|\d일장)$/g, "")
    .toLowerCase();
}

function main(): void {
  const db = openDb();

  const rows = db
    .prepare(
      `select name, open_cycle, market_days, lat, lng, sido, sigungu,
              is_declining, shop_count
         from raw_market
        where is_periodic = 1
          and market_days is not null and market_days <> ''
          and lat is not null and lat <> 0`,
    )
    .all() as {
    name: string;
    open_cycle: string;
    market_days: string;
    lat: number;
    lng: number;
    sido: string;
    sigungu: string;
    is_declining: number;
    shop_count: number;
  }[];

  const out = rows.map((r) => ({
    /** 이름+시군구로 찾는다. 시군구를 빼면 `중앙시장` 이 전국에서 충돌한다 */
    key: `${normalize(r.name)}|${r.sigungu}`,
    name: r.name,
    sido: r.sido,
    sigungu: r.sigungu,
    /** 끝자리. `4,9` = 4·9·14·19·24·29일 */
    days: r.market_days.split(",").map(Number).filter(Boolean),
    cycle_label: r.open_cycle,
    lat: r.lat,
    lng: r.lng,
    is_declining: r.is_declining === 1,
    shop_count: r.shop_count || null,
  }));

  mkdirSync("./src/data/real", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const decl = out.filter((o) => o.is_declining).length;
  console.log(`\n4번 · 장날 달력\n`);
  console.log(`  정기장 ${out.length}곳  (인구감소지역 ${decl}곳)`);
  console.log(`  ${OUT}\n`);

  const byCycle = new Map<string, number>();
  for (const o of out) byCycle.set(o.cycle_label, (byCycle.get(o.cycle_label) ?? 0) + 1);
  for (const [k, v] of [...byCycle].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`    ${k.padEnd(10)} ${v}곳`);
  }
  console.log("");
}

main();
