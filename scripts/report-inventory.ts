/**
 * 소재별 **촬영 가능 장소 목록**이 실제로 얼마나 채워져 있는가.
 *
 * 실행: npm run report:inventory
 *
 * ── 왜 이 리포트가 필요한가 ──────────────────────────────
 * 서비스의 어필을 "여기 가면 잘 된다"(예측)에서
 * "이 소재를 찍을 수 있는 곳은 이만큼 있다"(목록)로 옮기기로 했다.
 *
 * 예측은 근거가 약하다 — 소재 효과는 실재하지만(p=0.0007) 채널이 74% 를 설명하고,
 * 개별 소재끼리는 BH 보정을 통과하는 쌍이 0개다.
 * 반면 **목록은 근거가 필요 없다. 있으면 있는 것이다.**
 *
 * 그래서 이제 중요한 질문이 바뀐다:
 *   (전) 이 소재가 몇 배 잘 되는가
 *   (후) **이 소재를 고르면 실제로 보여줄 곳이 몇 곳이고, 카드가 채워지는가**
 *
 * 카드 한 장을 그리려면 최소한 이게 있어야 한다:
 *   좌표(지도·거리·일출) · 이름 · 시군구
 * 있으면 훨씬 좋은 것:
 *   사진 · 소개글(태깅 원료) · 장날
 *
 * ⚠️ 답을 정해놓고 맞추지 말 것. 숫자가 나쁘면 나쁜 대로 보고 소재를 바꾼다.
 */
import { openDb } from "./lib/db";

type Row = {
  tag: string;
  parent: string;
  places: number;
  declining: number;
  sigungu: number;
  coord: number;
  image: number;
  overview: number;
  est_coord: number;
  low_rel: number;
};

function main(): void {
  const db = openDb();

  const rows = db
    .prepare(
      `select c.name_ko                          as tag,
              p.name_ko                          as parent,
              count(distinct pl.id)              as places,
              sum(case when pl.is_declining_area = 1 then 1 else 0 end) as declining,
              count(distinct pl.sigungu)         as sigungu,
              sum(case when pl.lat is not null and pl.lat <> 0 then 1 else 0 end) as coord,
              sum(case when pl.image_url is not null and pl.image_url <> '' then 1 else 0 end) as image,
              -- ⚠️ place.description_ko 만 보면 안 된다. TourAPI 소개글은
              --    tour_overview 에 따로 있고 place 로 안 옮겨져 있다.
              --    처음 이 리포트를 돌렸을 때 소개글이 전부 0% 로 찍혔는데,
              --    데이터가 없는 게 아니라 조인을 안 한 것이었다.
              sum(case when (pl.description_ko is not null and pl.description_ko <> '')
                         or (ov.overview is not null and ov.overview <> '')
                       then 1 else 0 end) as overview,
              sum(case when pl.coord_source in ('읍면추정','시군구추정') then 1 else 0 end) as est_coord,
              sum(case when pl.data_reliability = 'low' then 1 else 0 end) as low_rel
         from tag c
         join tag p       on p.id = c.parent_id
         join place_tag pt on pt.tag_id = c.id
         join place pl     on pl.id = pt.place_id
         left join tour_overview ov on ov.content_id = pl.source_id and pl.source = 'tourapi'
        where c.axis = 'subject' and c.level = 2
        group by c.id
       having places >= 20
        order by declining desc`,
    )
    .all() as Row[];

  /** 소재별로 실제 수집한 영상 수 (검색 코퍼스). 없으면 0 */
  const videoByQuery = new Map(
    (
      db
        .prepare(
          `select replace(found_by, 'search:', '') q, count(*) n
             from yt_video where found_by like 'search:%' group by found_by`,
        )
        .all() as { q: string; n: number }[]
    ).map((r) => [r.q, r.n]),
  );

  /** 검색어 → 태그. collect-youtube 의 SUBJECT_PLAN 과 같은 표 */
  const QUERY_TO_TAG: Record<string, string> = {
    "차박 캠핑 브이로그": "야영장,오토캠핑장",
    "유적지 여행 브이로그": "유적지/사적지",
    "사찰 여행 브이로그": "사찰",
    "오일장 여행 브이로그": "5일장",
    "폐교 브이로그": "폐교",
    "해수욕장 여행 브이로그": "해수욕장",
    "전통시장 여행 브이로그": "상설시장",
    "계곡 여행 브이로그": "계곡",
    "항구 여행 브이로그": "항구/포구",
    "고택 한옥 스테이 브이로그": "고택",
    "섬 여행 브이로그": "섬",
    "자연휴양림 브이로그": "자연휴양림",
  };
  const videoByTag = new Map<string, number>();
  for (const [q, t] of Object.entries(QUERY_TO_TAG)) {
    videoByTag.set(t, videoByQuery.get(q) ?? 0);
  }

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((100 * n) / d));

  console.log(`\n${"═".repeat(96)}`);
  console.log(`소재별 촬영 가능 장소 목록 — 실제로 채워진 정도`);
  console.log("═".repeat(96));
  console.log(
    `\n  ${"소재".padEnd(18)}${"장소".padStart(6)}${"감소지역".padStart(8)}${"시군구".padStart(7)}` +
      `${"좌표".padStart(7)}${"사진".padStart(7)}${"소개글".padStart(7)}${"영상".padStart(7)}${"추정좌표".padStart(9)}   카드`,
  );
  console.log(`  ${"─".repeat(92)}`);

  for (const r of rows.slice(0, 30)) {
    const v = videoByTag.get(r.tag) ?? 0;
    /**
     * 카드를 그릴 수 있는가.
     * 좌표가 없으면 지도·거리·일출이 전부 빈다 — 그 소재는 화면이 안 된다.
     */
    const ok = pct(r.coord, r.places) >= 90;
    const verdict = !ok
      ? "좌표 부족"
      : v >= 100
        ? "배수까지"
        : v > 0
          ? "순위만"
          : "목록만";

    console.log(
      `  ${r.tag.slice(0, 16).padEnd(18)}${String(r.places).padStart(6)}${String(r.declining).padStart(8)}` +
        `${String(r.sigungu).padStart(7)}${(pct(r.coord, r.places) + "%").padStart(7)}` +
        `${(pct(r.image, r.places) + "%").padStart(7)}${(pct(r.overview, r.places) + "%").padStart(7)}` +
        `${String(v).padStart(7)}${(r.est_coord ? pct(r.est_coord, r.places) + "%" : "-").padStart(9)}   ${verdict}`,
    );
  }

  // ── 목록으로 팔 수 있는 소재가 몇 개인가 ────────────────
  const usable = rows.filter((r) => pct(r.coord, r.places) >= 90 && r.declining >= 30);
  console.log(`\n  ${"─".repeat(92)}`);
  console.log(
    `  좌표 90% 이상 + 인구감소지역 30곳 이상인 소재  ${usable.length}종` +
      `  ·  장소 합계 ${usable.reduce((s, r) => s + r.places, 0).toLocaleString()}곳` +
      `  (감소지역 ${usable.reduce((s, r) => s + r.declining, 0).toLocaleString()}곳)`,
  );

  /**
   * ⚠️ 사진이 없으면 목록 화면이 글자만 남는다.
   *    "목록으로 어필한다"는 전략에서 사진 확보율은 점수보다 중요한 지표다.
   */
  const noImage = rows.filter((r) => pct(r.image, r.places) < 30);
  console.log(
    `\n  사진 30% 미만인 소재  ${noImage.length}종  ← 목록 화면이 글자만 남는다`,
  );
  for (const r of noImage.slice(0, 6)) {
    console.log(`    ${r.tag.slice(0, 16).padEnd(18)} 사진 ${pct(r.image, r.places)}%  (${r.places}곳)`);
  }

  console.log(`\n${"═".repeat(96)}\n`);
}

main();
