/**
 * 소재 × 지역 격자 — **빈 목록이 얼마나 나오는가.**
 *
 * 실행: npm run report:grid
 *
 * ── 왜 이걸 먼저 보는가 ──────────────────────────────────
 * 서비스를 "이 소재를 찍을 수 있는 곳 목록" 으로 바꾸기로 했다. 그런데
 * 크리에이터는 소재만 고르지 않는다. **"오일장인데 강원도" 처럼 지역과 함께 좁힌다.**
 *
 * 전국 합계만 보면 오일장 458곳이라 넉넉해 보인다. 하지만 149개 시군구에
 * 퍼져 있으면 평균 3곳이고, 편중돼 있으면 **절반 넘는 지역에서 빈 화면이 나온다.**
 * 목록 화면을 만들기 전에 그걸 먼저 알아야 한다.
 *
 * ⚠️ 답을 정해놓고 맞추지 말 것. 빈 칸이 많으면 많은 대로 보고,
 *    지역 필터를 시군구가 아니라 시도로 올리든 소재를 묶든 설계를 바꾼다.
 */
import { openDb } from "./lib/db";

/** 성과가 검증된 12개 주력 소재 (`eval:hypothesis`) */
const TARGET = [
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

/** 카드 한 화면을 채우는 데 필요한 곳 수 (SPEC S3 추천 5곳) */
const CARDS = 5;

function main(): void {
  const db = openDb();

  const totalSigungu = (
    db
      .prepare(`select count(distinct sigungu) n from place where sigungu is not null and sigungu <> ''`)
      .get() as { n: number }
  ).n;
  const decliningSigungu = (
    db
      .prepare(
        `select count(distinct sigungu) n from place
          where is_declining_area = 1 and sigungu is not null and sigungu <> ''`,
      )
      .get() as { n: number }
  ).n;
  const totalSido = (
    db.prepare(`select count(distinct sido) n from place where sido is not null and sido <> ''`).get() as {
      n: number;
    }
  ).n;

  console.log(`\n${"═".repeat(94)}`);
  console.log(`소재 × 지역 격자 — 빈 목록이 얼마나 나오는가`);
  console.log(`전국 시군구 ${totalSigungu}개 (인구감소 ${decliningSigungu}개) · 시도 ${totalSido}개`);
  console.log("═".repeat(94));

  const cells = db.prepare(
    `select pl.sido, pl.sigungu, count(*) n
       from place_tag pt
       join tag t   on t.id = pt.tag_id
       join place pl on pl.id = pt.place_id
      where t.name_ko = ? and pl.sigungu is not null and pl.sigungu <> ''
      group by pl.sido, pl.sigungu`,
  );

  const cellsDecl = db.prepare(
    `select pl.sigungu, count(*) n
       from place_tag pt
       join tag t   on t.id = pt.tag_id
       join place pl on pl.id = pt.place_id
      where t.name_ko = ? and pl.is_declining_area = 1
        and pl.sigungu is not null and pl.sigungu <> ''
      group by pl.sigungu`,
  );

  console.log(
    `\n  ${"소재".padEnd(18)}${"장소".padStart(6)}` +
      `${"시군구".padStart(7)}${"5곳+".padStart(7)}` +
      `${"시도".padStart(6)}${"5곳+".padStart(7)}` +
      `${"상위3집중".padStart(11)}   감소지역 시군구`,
  );
  console.log(`  ${"─".repeat(90)}`);

  const rows: { tag: string; sidoOk: number; sigunguOk: number; total: number }[] = [];

  for (const tag of TARGET) {
    const cs = cells.all(tag) as { sido: string; sigungu: string; n: number }[];
    if (cs.length === 0) {
      console.log(`  ${tag.slice(0, 16).padEnd(18)}     0   — 태그에 붙은 장소가 없다`);
      continue;
    }
    const total = cs.reduce((s, c) => s + c.n, 0);

    // 시군구 단위
    const sigunguOk = cs.filter((c) => c.n >= CARDS).length;

    // 시도 단위로 접었을 때
    const bySido = new Map<string, number>();
    for (const c of cs) bySido.set(c.sido, (bySido.get(c.sido) ?? 0) + c.n);
    const sidoOk = [...bySido.values()].filter((n) => n >= CARDS).length;

    /**
     * 상위 3개 시군구가 전체의 몇 %인가. 높을수록 특정 지역에 쏠려 있고,
     * 나머지 지역을 고르면 빈 화면이 나온다.
     */
    const top3 = [...cs].sort((a, b) => b.n - a.n).slice(0, 3).reduce((s, c) => s + c.n, 0);

    const dcs = cellsDecl.all(tag) as { sigungu: string; n: number }[];

    console.log(
      `  ${tag.slice(0, 16).padEnd(18)}${String(total).padStart(6)}` +
        `${String(cs.length).padStart(7)}${String(sigunguOk).padStart(7)}` +
        `${String(bySido.size).padStart(6)}${String(sidoOk).padStart(7)}` +
        `${(Math.round((100 * top3) / total) + "%").padStart(11)}` +
        `   ${dcs.length}곳 · 5곳+ ${dcs.filter((d) => d.n >= CARDS).length}`,
    );

    rows.push({ tag, sidoOk, sigunguOk, total });
  }

  // ── 결론 ────────────────────────────────────────────────
  console.log(`\n  ${"─".repeat(90)}`);
  console.log(`\n  【지역 필터를 시군구로 두면】`);
  const avgSigungu = rows.reduce((s, r) => s + r.sigunguOk, 0) / rows.length;
  console.log(
    `    소재당 평균 ${avgSigungu.toFixed(1)}개 시군구에서만 ${CARDS}곳을 채운다` +
      `  (전체 ${totalSigungu}개 중 ${Math.round((100 * avgSigungu) / totalSigungu)}%)`,
  );
  console.log(`    → 나머지 ${Math.round(100 - (100 * avgSigungu) / totalSigungu)}% 에서는 목록이 ${CARDS}곳을 못 채운다`);

  console.log(`\n  【시도로 올리면】`);
  const avgSido = rows.reduce((s, r) => s + r.sidoOk, 0) / rows.length;
  console.log(
    `    소재당 평균 ${avgSido.toFixed(1)}개 시도에서 ${CARDS}곳을 채운다` +
      `  (전체 ${totalSido}개 중 ${Math.round((100 * avgSido) / totalSido)}%)`,
  );

  /**
   * 12개 소재를 다 합치면 어떤가. 크리에이터가 소재를 안 고르고
   * 지역만 고르는 경로(`이 근처에서 찍을 만한 곳`)가 이걸로 돌아간다.
   */
  const anyTag = db
    .prepare(
      `select pl.sigungu, count(distinct pl.id) n
         from place_tag pt
         join tag t   on t.id = pt.tag_id
         join place pl on pl.id = pt.place_id
        where t.name_ko in (${TARGET.map(() => "?").join(",")})
          and pl.sigungu is not null and pl.sigungu <> ''
        group by pl.sigungu`,
    )
    .all(...TARGET) as { sigungu: string; n: number }[];

  console.log(`\n  【소재를 안 고르고 지역만 고르면 (12종 합계)】`);
  console.log(
    `    ${anyTag.filter((a) => a.n >= CARDS).length} / ${totalSigungu} 시군구에서 ${CARDS}곳을 채운다` +
      `  (${Math.round((100 * anyTag.filter((a) => a.n >= CARDS).length) / totalSigungu)}%)`,
  );
  const thin = anyTag.filter((a) => a.n < CARDS).sort((a, b) => a.n - b.n);
  console.log(`    못 채우는 시군구 ${thin.length}개 · 예: ${thin.slice(0, 6).map((t) => `${t.sigungu}(${t.n})`).join(" ")}`);

  console.log(`\n${"═".repeat(94)}\n`);
}

main();
