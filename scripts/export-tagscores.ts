/**
 * 6단계 · **실제 태그 점수**를 화면용 JSON 으로 굽는다.
 *
 * 실행: npm run export:tagscores   (`build:videoplace` 다음)
 * 출력: src/data/real/tagscores.json
 *
 * 지금까지 화면의 `3.2×` 는 전부 시연값이었다. 이제 실제 수집 영상에서 낸다.
 *
 * ── 계산 규칙 (SPEC 4장 + 실측으로 바뀐 것) ──────────────
 *   vsr        = 조회수 ÷ 구독자        채널 규모를 지운다
 *   집계       = **기하평균**            중앙값보다 2.5배 효율적 (eval:hypothesis)
 *   구간       = 언어 × 구독자 밴드      절대 합치지 말 것 (CLAUDE.md 1항)
 *   배수 표시  = 기하평균 95%CI 가 4배 안일 때만  (표본 수가 아니다 · 아래 주석)
 *
 * ⚠️ 언어와 밴드를 나누면 칸이 잘게 쪼개져 대부분 표본이 얇다. 그게 정상이다 —
 *    억지로 합쳐서 숫자를 만들면 "모든 태그가 평균으로 수렴" 하는 바로 그 실패가 난다.
 *    얇은 칸은 `can_show_multiplier: false` 로 두고 화면이 숫자를 감춘다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";

const OUT = "./src/data/real/tagscores.json";

/** 검색어 → 태그. `collect-youtube.ts` SUBJECT_PLAN 과 같은 표여야 한다 */
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

/**
 * 배수를 그릴 자격은 **`score.ts` `canShowMultiplier` 하나로만** 판정한다.
 * 여기에 사본을 두지 말 것 — 예전에 그래서 화면끼리 말이 어긋났다 (그 주석 참조).
 *
 * 숫자를 쓸 때는 **반드시 범위를 함께** 낸다. 점 추정만 두면 확정된 사실로 읽힌다.
 */
import { canShowMultiplier } from "../src/lib/score";

/** 구독자 1,000 미만은 뺀다. 배수가 폭발해 통계를 망친다 (`score.ts`) */
const MIN_SUBS = 1000;

/** 기하평균. 0 이하는 버린다 — log(0) 하나로 점수 전체가 무너진다 */
function geoMean(xs: number[]): number | null {
  const pos = xs.filter((v) => v > 0);
  if (pos.length === 0) return null;
  return Math.exp(pos.reduce((s, v) => s + Math.log(v), 0) / pos.length);
}

/** 기하평균의 95% 신뢰구간 (부트스트랩). 이게 배수를 그릴 자격을 정한다 */
function geoCI(xs: number[], n = 1500): [number, number] | null {
  const pos = xs.filter((v) => v > 0);
  if (pos.length < 3) return null;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < pos.length; j++) s += Math.log(pos[(Math.random() * pos.length) | 0]);
    out.push(Math.exp(s / pos.length));
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(n * 0.025)], out[Math.floor(n * 0.975)]];
}

/** 로그 공간에서 분위수를 낸 뒤 되돌린다. 예상 도달 범위(SPEC 4-4)에 쓴다 */
function geoQuantile(xs: number[], q: number): number | null {
  const pos = xs.filter((v) => v > 0).sort((a, b) => a - b);
  if (pos.length === 0) return null;
  return pos[Math.min(pos.length - 1, Math.floor(pos.length * q))];
}

const bandOf = (s: number): 1 | 2 | 3 | 4 =>
  s < 10_000 ? 1 : s < 100_000 ? 2 : s < 1_000_000 ? 3 : 4;

function main(): void {
  const db = openDb();

  /**
   * ── 표본이 두 갈래다. 둘 다 쓴다 ─────────────────────────
   *
   * ① 검색 표본 (`found_by like 'search:%'`)
   *    "오일장 여행 브이로그" 로 검색해서 나온 영상. 라벨은 검색어에서 온다.
   *    ⚠️ **성과 편향이 있다.** 유튜브가 반응 좋은 영상을 위에 올려 주기 때문에,
   *       이 표본만 쓰면 그 소재의 전형값이 아니라 **잘 된 것들의 값**이 나온다.
   *
   * ② 채널 표본 (`yt_video_subject`, LLM 분류)
   *    채널을 훑어서 모은 영상에 소재를 붙인 것. **소재로 고른 표본이 아니라
   *    채널로 고른 표본**이라 위의 편향이 없다. 화면이 말하는 "이 소재의
   *    전형값" 에는 오히려 이쪽이 정직하다.
   *
   * 겹치지 않는다 — LLM 분류는 `found_by = 'channel'` 에만 돌렸다.
   */
  interface Row {
    tag: string;
    language: string;
    view_count: number;
    subs: number;
    src: "search" | "channel";
  }

  const searchRows = db
    .prepare(
      `select v.found_by, v.language, v.view_count, c.subscriber_count subs
         from yt_video v
         join yt_channel c on c.channel_id = v.channel_id
        where v.found_by like 'search:%'
          and c.subscriber_count >= ?
          and v.view_count > 0
          and v.duration_sec > 180`,
    )
    .all(MIN_SUBS) as {
    found_by: string;
    language: string;
    view_count: number;
    subs: number;
  }[];

  const channelRows = db
    .prepare(
      `select vs.subject tag, v.language, v.view_count, c.subscriber_count subs
         from yt_video_subject vs
         join yt_video v on v.video_id = vs.video_id
         join yt_channel c on c.channel_id = v.channel_id
        where c.subscriber_count >= ?
          and v.view_count > 0
          and v.duration_sec > 180`,
    )
    .all(MIN_SUBS) as { tag: string; language: string; view_count: number; subs: number }[];

  const rows: Row[] = [
    ...searchRows.flatMap((r) => {
      const tag = QUERY_TO_TAG[r.found_by.replace("search:", "")];
      return tag ? [{ ...r, tag, src: "search" as const }] : [];
    }),
    ...channelRows.map((r) => ({ ...r, src: "channel" as const })),
  ];

  /** tag|language|band → vsr 목록 */
  const cells = new Map<string, number[]>();
  /** tag|language → vsr 목록. 밴드 표본이 얇을 때 빌려 쓴다 */
  const langCells = new Map<string, number[]>();

  for (const r of rows) {
    const tag = r.tag;
    const lang = r.language === "en" ? "en" : "ko";
    const vsr = r.view_count / r.subs;
    const k = `${tag}|${lang}|${bandOf(r.subs)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(vsr);
    const lk = `${tag}|${lang}`;
    if (!langCells.has(lk)) langCells.set(lk, []);
    langCells.get(lk)!.push(vsr);
  }

  interface Score {
    tag: string;
    language: string;
    sub_band: number | null;
    video_count: number;
    geo_vsr: number | null;
    p25_vsr: number | null;
    p75_vsr: number | null;
    /** 기하평균 자체의 95% 신뢰구간 */
    ci_low: number | null;
    ci_high: number | null;
    can_show_multiplier: boolean;
  }

  const out: Score[] = [];

  const push = (tag: string, language: string, band: number | null, xs: number[]) => {
    const ci = geoCI(xs);
    const ok = canShowMultiplier({
      video_count: xs.length,
      ci_low: ci ? ci[0] : null,
      ci_high: ci ? ci[1] : null,
    });
    out.push({
      tag,
      language,
      sub_band: band,
      video_count: xs.length,
      geo_vsr: geoMean(xs) === null ? null : Number(geoMean(xs)!.toFixed(3)),
      p25_vsr: geoQuantile(xs, 0.25) === null ? null : Number(geoQuantile(xs, 0.25)!.toFixed(3)),
      p75_vsr: geoQuantile(xs, 0.75) === null ? null : Number(geoQuantile(xs, 0.75)!.toFixed(3)),
      ci_low: ci ? Number(ci[0].toFixed(3)) : null,
      ci_high: ci ? Number(ci[1].toFixed(3)) : null,
      can_show_multiplier: ok,
    });
  };

  for (const [k, xs] of cells) {
    const [tag, lang, band] = k.split("|");
    push(tag, lang, Number(band), xs);
  }
  // 밴드 무관 점수 (sub_band: null). 밴드 칸이 얇을 때 화면이 여기로 떨어진다
  for (const [k, xs] of langCells) {
    const [tag, lang] = k.split("|");
    push(tag, lang, null, xs);
  }

  mkdirSync("./src/data/real", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const nSearch = rows.filter((r) => r.src === "search").length;
  const nChannel = rows.length - nSearch;

  console.log(`\n6단계 · 태그 점수\n`);
  console.log(`  롱폼 ${rows.length.toLocaleString()}편 → ${out.length}칸  ·  ${OUT}`);
  console.log(`  검색 표본 ${nSearch.toLocaleString()} + 채널 표본 ${nChannel.toLocaleString()} (LLM 분류)\n`);
  console.log(`  ${"소재".padEnd(18)}${"언어".padStart(5)}${"편수".padStart(6)}${"기하평균".padStart(9)}${"기하평균 95%CI".padStart(14)}   배수`);
  console.log(`  ${"─".repeat(64)}`);
  for (const s of out
    .filter((x) => x.sub_band === null)
    .sort((a, b) => (b.geo_vsr ?? 0) - (a.geo_vsr ?? 0))) {
    console.log(
      `  ${s.tag.slice(0, 16).padEnd(18)}${s.language.padStart(5)}${String(s.video_count).padStart(6)}` +
        `${String(s.geo_vsr ?? "-").padStart(9)}${`${s.ci_low}~${s.ci_high}`.padStart(14)}   ` +
        (s.can_show_multiplier ? "표시" : "감춤"),
    );
  }
  const shown = out.filter((s) => s.can_show_multiplier).length;
  console.log(`\n  배수를 그릴 수 있는 칸 ${shown} / ${out.length}\n`);
}

main();
