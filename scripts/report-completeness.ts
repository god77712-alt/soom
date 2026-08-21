/**
 * 카드 완성도 — **화면이 실제로 받는 것**이 얼마나 채워져 있는가.
 *
 * 실행: npm run report:completeness
 *
 * ── report:inventory 와 무엇이 다른가 ────────────────────
 * `report:inventory` 는 **DB 안의 장소**를 센다 — 전국 5,268곳 중 사진 79%.
 * 이 리포트는 **화면에 실제로 나가는 카드**를 센다 (`places.json`).
 *
 * 둘은 다르다. 카탈로그는 소재당 240곳까지만 담고, 담을 때 사진 있는 것을 앞으로
 * 보낸다. 그래서 DB 사진 보유율이 48% 여도 카드 보유율은 76% 가 된다.
 * **크리에이터가 보는 건 후자다.**
 *
 * ⚠️ 총량만 보면 안 된다. 소개글이 몇 주째 쇼핑만 갈고 있던 걸 못 본 이유가
 *    총량 리포트였다 — "소개글 2,995건" 으로 찍혀서 잘 되는 것처럼 보였다.
 *    여기서는 **소재별 · 항목별**로 갈라서 본다.
 *
 * ── 카드 완성도를 어떻게 정의하는가 ──────────────────────
 * 🚨 **가중치를 지어내지 않는다.** "사진 0.4 + 키워드 0.3 + 운영정보 0.3" 같은
 *    합성 점수는 근거가 없다 — 근거 없는 임계값·계수는 지어낸 점수와 같다는
 *    원칙(CLAUDE.md 3항)이 여기에도 적용된다.
 *
 * → 대신 **항목별 채움률을 그대로 나열하고**, 카드가 실제로 어떤 모양으로
 *   그려지는지를 단계로 센다. 단계는 화면 코드가 실제로 하는 판정과 같다:
 *
 *     사진+키워드   썸네일도 있고 칩도 있다 — 카드가 온전히 그려진다
 *     키워드만      회색 도트 썸네일 + 칩
 *     사진만        썸네일은 있는데 이름·지역 말고 할 말이 없다
 *     이름만        가장 약한 카드. 옆 카드와 구분되지 않는다
 */
import { readFileSync } from "node:fs";

const PATH = "./src/data/real/places.json";

interface Place {
  name: string;
  image: string | null;
  photos: string[];
  keywords: string[];
  info: Record<string, string | null> | null;
  videos: unknown[];
  coord_estimated: boolean;
}
interface Subject {
  slug: string;
  label: string;
  total: number;
  declining: number;
  cover: string | null;
  can_show_multiplier: boolean;
  score_sample: number;
  places: Place[];
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);
const bar = (p: number) => "█".repeat(Math.round(p / 10)) + "·".repeat(10 - Math.round(p / 10));

function main(): void {
  const subjects = JSON.parse(readFileSync(PATH, "utf8")) as Subject[];

  console.log(`\n${"═".repeat(92)}`);
  console.log(`카드 완성도 — 화면이 실제로 받는 것 (${PATH})`);
  console.log(`${"═".repeat(92)}\n`);

  // ── 소재별 ────────────────────────────────────────────
  console.log(
    `  ${"소재".padEnd(16)}${"카드".padStart(6)}${"사진".padStart(7)}${"사진2+".padStart(8)}` +
      `${"키워드".padStart(8)}${"운영정보".padStart(9)}${"장날".padStart(7)}${"영상".padStart(7)}  표지`,
  );
  console.log(`  ${"─".repeat(88)}`);

  const totals = { n: 0, img: 0, multi: 0, kw: 0, info: 0, fair: 0, vid: 0 };
  const stage = { full: 0, kwOnly: 0, imgOnly: 0, bare: 0 };

  for (const s of subjects) {
    const n = s.places.length;
    const img = s.places.filter((p) => p.image).length;
    const multi = s.places.filter((p) => p.photos.length > 1).length;
    const kw = s.places.filter((p) => p.keywords.length > 0).length;
    const info = s.places.filter((p) => p.info).length;
    const fair = s.places.filter((p) => p.info?.fairday).length;
    const vid = s.places.filter((p) => p.videos.length > 0).length;

    totals.n += n;
    totals.img += img;
    totals.multi += multi;
    totals.kw += kw;
    totals.info += info;
    totals.fair += fair;
    totals.vid += vid;

    for (const p of s.places) {
      const hasImg = Boolean(p.image);
      const hasKw = p.keywords.length > 0;
      if (hasImg && hasKw) stage.full++;
      else if (hasKw) stage.kwOnly++;
      else if (hasImg) stage.imgOnly++;
      else stage.bare++;
    }

    console.log(
      `  ${s.label.slice(0, 15).padEnd(16)}${String(n).padStart(6)}` +
        `${(pct(img, n) + "%").padStart(7)}${(pct(multi, n) + "%").padStart(8)}` +
        `${(pct(kw, n) + "%").padStart(8)}${(pct(info, n) + "%").padStart(9)}` +
        `${(pct(fair, n) + "%").padStart(7)}${(pct(vid, n) + "%").padStart(7)}  ` +
        (s.cover ? "있음" : "⚠️ 없음"),
    );
  }

  console.log(`  ${"─".repeat(88)}`);
  console.log(
    `  ${"합계".padEnd(16)}${String(totals.n).padStart(6)}` +
      `${(pct(totals.img, totals.n) + "%").padStart(7)}${(pct(totals.multi, totals.n) + "%").padStart(8)}` +
      `${(pct(totals.kw, totals.n) + "%").padStart(8)}${(pct(totals.info, totals.n) + "%").padStart(9)}` +
      `${(pct(totals.fair, totals.n) + "%").padStart(7)}${(pct(totals.vid, totals.n) + "%").padStart(7)}`,
  );

  // ── 카드가 실제로 그려지는 모양 ───────────────────────
  console.log(`\n\n카드가 실제로 그려지는 모양\n`);
  const rows: Array<[string, number, string]> = [
    ["사진 + 키워드", stage.full, "온전히 그려진다"],
    ["키워드만", stage.kwOnly, "회색 도트 썸네일 + 칩"],
    ["사진만", stage.imgOnly, "이름·지역 말고 할 말이 없다"],
    ["이름만", stage.bare, "옆 카드와 구분되지 않는다"],
  ];
  for (const [label, n, note] of rows) {
    const p = pct(n, totals.n);
    console.log(
      `  ${label.padEnd(14)}${String(n).padStart(6)}  ${String(p).padStart(3)}%  ${bar(p)}  ${note}`,
    );
  }

  // ── 항목별 — 무엇을 더 받아야 하는가 ──────────────────
  console.log(`\n\n항목별 채움률 — 다음에 무엇을 받아야 하는가\n`);
  const fields: Array<[string, number, string]> = [
    ["이름·좌표·지역", totals.n, "카드의 최소 조건. 이건 다 있다"],
    ["사진 1장", totals.img, "목록 서비스의 실질. 없으면 안 눌린다"],
    ["대표 키워드", totals.kw, "카드끼리 달라지는 유일한 자리"],
    ["운영정보", totals.info, "detailIntro2 · 매일 1,000건씩 찬다"],
    ["사진 2장 이상", totals.multi, "상세 갤러리용. detailImage2"],
    ["언급 영상", totals.vid, "0 은 없다가 아니라 코퍼스에서 안 잡혔다"],
  ];
  for (const [label, n, note] of fields) {
    const p = pct(n, totals.n);
    console.log(`  ${label.padEnd(16)}${String(p).padStart(4)}%  ${bar(p)}  ${note}`);
  }

  // ── 가장 아픈 자리 ────────────────────────────────────
  console.log(`\n\n가장 아픈 자리\n`);
  const pains = subjects
    .map((s) => ({
      label: s.label,
      n: s.places.length,
      bare: s.places.filter((p) => !p.image).length,
      p: pct(s.places.filter((p) => !p.image).length, s.places.length),
    }))
    .filter((x) => x.p >= 20)
    .sort((a, b) => b.p - a.p);

  if (pains.length === 0) {
    console.log(`  사진이 20% 넘게 빈 소재가 없다.\n`);
  } else {
    for (const x of pains) {
      console.log(`  ${x.label.padEnd(16)}사진 없는 카드 ${String(x.bare).padStart(4)} / ${x.n}  (${x.p}%)`);
    }
  }

  console.log(
    `\n  ⚠️ 폐교는 TourAPI 에 없어서 detailImage2 로 못 메운다 (contentId 자체가 없다).\n` +
      `     관광사진 갤러리도 실측 매칭 0곳 — 갤러리의 "학교" 42장은 전부 대학교다.\n`,
  );
}

main();
