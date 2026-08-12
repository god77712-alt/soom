/**
 * 소재별로 **실제로 고를 수 있는 지역만** 화면에 넘긴다.
 *
 * 실행: npm run export:availability  →  src/data/real/availability.json
 *
 * ── 왜 필요한가 (`npm run report:grid` 실측) ─────────────
 * 소재를 고른 뒤 지역으로 좁히는 경로를 재봤더니 이랬다:
 *
 *   소재 × 시군구   1곳 이상 52%  ·  3곳+ 29%  ·  5곳+ 17%
 *   소재 × 시도     5곳+ 67%
 *   지역만 (소재 무관, 12종 합계)   5곳+ 98%
 *
 * **시군구 칩을 그냥 다 뿌리면 절반이 0곳이다.** 눌렀는데 빈 화면이 나오면
 * 크리에이터는 데이터가 없다고 판단하고 이탈한다 — 실제로는 옆 시군구에 있는데도.
 *
 * → 지역 칩을 코드에 하드코딩하지 않고 **여기서 구운 목록으로만** 그린다.
 *   0곳인 지역은 선택지에 아예 없다. 그러면 빈 화면이 구조적으로 안 나온다.
 *
 * ── 빈 칸에는 두 종류가 있다 ─────────────────────────────
 * 섞어서 다루면 안 된다.
 *
 *   ① 사실   내륙 시군구에 해수욕장이 없는 건 데이터 결함이 아니다.
 *            해수욕장 22% · 섬 17% · 항구 25% 는 지형이 그런 것이다.
 *   ② 결함   폐교 50% 는 전국에 있는데 우리가 미활용분만 골라서 그렇다.
 *
 * ①은 고칠 게 없고 ②는 수집으로 메운다. 이 파일은 둘을 구분하지 않고
 * "지금 보여줄 수 있는 것"만 담는다 — 화면이 필요한 건 그거다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";

const OUT = "./src/data/real/availability.json";

/** 지역 칩으로 내보낼 최소 장소 수. 1곳짜리 칩은 눌러도 목록이 안 된다 */
const MIN_PER_REGION = 3;

interface RegionCount {
  name: string;
  count: number;
  /** 그중 인구감소지역 */
  declining: number;
}

interface TagAvailability {
  tag: string;
  total: number;
  declining: number;
  /** 장소가 있는 시도. 많은 순 */
  sido: RegionCount[];
  /** MIN_PER_REGION 이상인 시군구만. 많은 순 */
  sigungu: RegionCount[];
}

function main(): void {
  const db = openDb();

  const tags = db
    .prepare(
      `select t.name_ko name, count(*) n
         from place_tag pt
         join tag t    on t.id = pt.tag_id
         join place pl on pl.id = pt.place_id
        where t.axis = 'subject' and t.level = 2
        group by t.id
       having n >= 20
        order by n desc`,
    )
    .all() as { name: string; n: number }[];

  const byRegion = db.prepare(
    `select pl.sido, pl.sigungu,
            count(*) n,
            sum(case when pl.is_declining_area = 1 then 1 else 0 end) d
       from place_tag pt
       join tag t    on t.id = pt.tag_id
       join place pl on pl.id = pt.place_id
      where t.name_ko = ? and pl.sido is not null and pl.sido <> ''
      group by pl.sido, pl.sigungu`,
  );

  const out: TagAvailability[] = [];

  for (const t of tags) {
    const cells = byRegion.all(t.name) as {
      sido: string;
      sigungu: string | null;
      n: number;
      d: number;
    }[];
    if (cells.length === 0) continue;

    const sidoMap = new Map<string, RegionCount>();
    for (const c of cells) {
      const cur = sidoMap.get(c.sido) ?? { name: c.sido, count: 0, declining: 0 };
      cur.count += c.n;
      cur.declining += c.d;
      sidoMap.set(c.sido, cur);
    }

    out.push({
      tag: t.name,
      total: cells.reduce((s, c) => s + c.n, 0),
      declining: cells.reduce((s, c) => s + c.d, 0),
      sido: [...sidoMap.values()].sort((a, b) => b.count - a.count),
      sigungu: cells
        .filter((c) => c.sigungu && c.n >= MIN_PER_REGION)
        .map((c) => ({ name: c.sigungu!, count: c.n, declining: c.d }))
        .sort((a, b) => b.count - a.count),
    });
  }

  mkdirSync("./src/data/real", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`\n소재별 선택 가능 지역\n`);
  console.log(`  소재 ${out.length}종  ·  ${OUT}\n`);
  console.log(`  ${"소재".padEnd(18)}${"장소".padStart(6)}${"시도칩".padStart(7)}${"시군구칩".padStart(9)}`);
  console.log(`  ${"─".repeat(44)}`);
  for (const a of out.slice(0, 14)) {
    console.log(
      `  ${a.tag.slice(0, 16).padEnd(18)}${String(a.total).padStart(6)}` +
        `${String(a.sido.length).padStart(7)}${String(a.sigungu.length).padStart(9)}`,
    );
  }
  const noSigungu = out.filter((a) => a.sigungu.length === 0);
  if (noSigungu.length > 0) {
    console.log(
      `\n  시군구 칩이 하나도 없는 소재 ${noSigungu.length}종 — 전국·시도 목록으로만 쓴다`,
    );
    console.log(`    ${noSigungu.slice(0, 8).map((a) => a.tag).join(" · ")}`);
  }
  console.log("");
}

main();
