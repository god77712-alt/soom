/**
 * 0단계용 가짜 점수 데이터.
 *
 * 6단계에서 계산으로 만들어질 두 테이블(tag_scores, 장소별 언어 집계)을 미리 손으로 채운 것.
 * 화면은 이 테이블만 보므로, 7단계에서 진짜 계산 결과로 갈아끼우면 화면은 그대로 돈다.
 *
 * ⚠️ 수치를 임의로 바꾸지 말 것. 아래 값들은 서로 맞물려 있다.
 *   · oil_market en = 47편 / 3.2배      → S4 ① 문구
 *   · oil_market en p25/p75 = 1.43/4.29 → 구독자 2.1만 × = 3만~9만 (S4 ④)
 *   · market en 4.1배 / ko 0.6배        → CLAUDE.md 의 "언어별 점수판을 합치지 말라"는 근거
 *   · old_diner ko 2.4배 / en 0.9배     → 반대 방향 역전. 합치면 둘 다 평균으로 죽는다
 */

import type { Language, PlaceLanguageStat, SubBand, TagScore } from "@/lib/types";

/** [영상수, 중앙값, p25, p75] */
type S = [number, number, number, number];

/** 구독자 규모대(band 2 = 1만~10만)를 기준값으로 두고 나머지 밴드를 파생시킨다. */
const BASE: Record<string, { ko: S; en: S }> = {
  // ── 대분류 ──
  market: { ko: [210, 0.6, 0.3, 1.4], en: [96, 4.1, 1.9, 7.0] },
  ruin: { ko: [74, 1.4, 0.7, 2.9], en: [31, 2.6, 1.2, 4.4] },
  transit: { ko: [48, 1.2, 0.6, 2.3], en: [40, 3.4, 1.6, 5.8] },
  coast: { ko: [88, 1.0, 0.5, 2.0], en: [35, 2.1, 1.0, 3.6] },
  farm: { ko: [52, 1.1, 0.5, 2.2], en: [27, 2.9, 1.3, 4.9] },
  alley: { ko: [63, 1.2, 0.6, 2.4], en: [44, 3.0, 1.4, 5.1] },
  flora: { ko: [96, 1.3, 0.6, 2.7], en: [22, 1.9, 0.9, 3.2] },
  food: { ko: [140, 1.6, 0.8, 3.3], en: [88, 3.7, 1.7, 6.2] },
  labor: { ko: [21, 1.2, 0.6, 2.4], en: [11, 2.8, 1.3, 4.7] },
  island: { ko: [33, 1.4, 0.7, 2.8], en: [14, 2.5, 1.2, 4.2] },
  craft: { ko: [17, 0.9, 0.4, 1.8], en: [9, 2.2, 1.0, 3.7] },
  // ⑤ 표본 부족 검증용 — 대분류인데도 5편 미만이다. 이 경우 폴백조차 못 한다.
  bath: { ko: [3, 1.1, 0.5, 2.2], en: [2, 1.4, 0.7, 2.3] },

  // ── 시장·상권 세부 ──
  oil_market: { ko: [60, 1.1, 0.5, 2.2], en: [47, 3.2, 1.43, 4.29] },
  fish_market: { ko: [38, 1.2, 0.6, 2.5], en: [22, 3.6, 1.7, 5.9] },
  permanent_market: { ko: [41, 0.7, 0.3, 1.5], en: [18, 2.4, 1.1, 4.0] },
  night_market: { ko: [55, 0.9, 0.4, 1.9], en: [34, 2.8, 1.3, 4.7] },
  dawn_market: { ko: [12, 1.5, 0.7, 3.1], en: [6, 3.9, 1.8, 6.6] },
  market_alley: { ko: [20, 1.0, 0.5, 2.1], en: [9, 3.1, 1.4, 5.2] },
  herb_market: { ko: [8, 0.8, 0.4, 1.6], en: [5, 2.2, 1.0, 3.7] },
  // ④ 폴백 검증용 — ko/en 모두 5편 미만. 상위(market) 점수를 빌려 쓰게 된다.
  flea_market: { ko: [3, 0.9, 0.4, 1.8], en: [3, 2.0, 0.9, 3.4] },
  seasonal_market: { ko: [6, 1.3, 0.6, 2.7], en: [2, 2.5, 1.2, 4.2] },

  // ── 그 외 세부 ──
  abandoned_school: { ko: [19, 1.8, 0.9, 3.7], en: [7, 3.3, 1.5, 5.6] },
  modern_building: { ko: [26, 1.1, 0.5, 2.2], en: [12, 2.4, 1.1, 4.0] },
  small_station: { ko: [22, 1.6, 0.8, 3.3], en: [9, 3.8, 1.8, 6.4] },
  unmanned_station: { ko: [4, 1.9, 0.9, 3.9], en: [3, 4.0, 1.9, 6.8] },
  lighthouse: { ko: [14, 1.3, 0.6, 2.7], en: [4, 2.6, 1.2, 4.4] },
  salt_farm: { ko: [9, 1.7, 0.8, 3.5], en: [6, 3.5, 1.6, 5.9] },
  terraced_field: { ko: [16, 1.5, 0.7, 3.1], en: [8, 3.2, 1.5, 5.4] },
  stone_wall: { ko: [11, 1.3, 0.6, 2.7], en: [7, 2.8, 1.3, 4.7] },
  silver_grass: { ko: [13, 1.5, 0.7, 3.1], en: [3, 1.8, 0.8, 3.0] },
  cherry_blossom: { ko: [71, 1.9, 0.9, 3.9], en: [15, 2.4, 1.1, 4.0] },
  dawn_fog: { ko: [9, 2.1, 1.0, 4.3], en: [5, 2.7, 1.3, 4.6] },
  // ko > en 역전 케이스. 한국 노포·국밥은 국내 채널에서 훨씬 잘 먹힌다.
  old_diner: { ko: [44, 2.4, 1.2, 4.9], en: [19, 0.9, 0.4, 1.5] },
  gukbap: { ko: [27, 2.6, 1.3, 5.3], en: [8, 1.1, 0.5, 1.8] },
  merchant: { ko: [9, 1.4, 0.7, 2.9], en: [6, 3.6, 1.7, 6.1] },
  // ⑤ 상위(bath)도 5편 미만이라 폴백이 불가능 → 화면에 "표본 부족"
  old_bathhouse: { ko: [2, 1.9, 0.9, 3.9], en: [1, 2.1, 1.0, 3.6] },
};

/** 구독자가 적을수록 구독자 대비 배수가 크게 나온다. band 2 를 1.0 기준으로 둔다. */
const BAND_VSR: Record<SubBand, number> = { 1: 1.6, 2: 1.0, 3: 0.7, 4: 0.45 };
/** 밴드별 표본 분포. 큰 채널일수록 영상 수가 적다. */
const BAND_COUNT: Record<SubBand, number> = { 1: 0.5, 2: 1.0, 3: 0.6, 4: 0.25 };

const COMPUTED_AT = "2026-08-02T03:00:00+09:00";

function expand(tagCode: string, language: Language, base: S, band: SubBand): TagScore {
  const [count, med, p25, p75] = base;
  const v = BAND_VSR[band];
  return {
    tag_id: `t_${tagCode}`,
    language,
    sub_band: band,
    video_count: Math.max(0, Math.round(count * BAND_COUNT[band])),
    median_vsr: Number((med * v).toFixed(2)),
    p25_vsr: Number((p25 * v).toFixed(2)),
    p75_vsr: Number((p75 * v).toFixed(2)),
    // 폴백 여부는 저장값이 아니라 조회 시점에 resolveTagScore() 가 판정한다.
    is_fallback: false,
    computed_at: COMPUTED_AT,
  };
}

const BANDS: SubBand[] = [1, 2, 3, 4];

export const FAKE_TAG_SCORES: TagScore[] = Object.entries(BASE).flatMap(([code, { ko, en }]) =>
  BANDS.flatMap((b) => [expand(code, "ko", ko, b), expand(code, "en", en, b)]),
);

// ─── 장소별 언어 집계 ────────────────────────────────────

/** [ko영상수, ko중앙값, en영상수, en중앙값] — null 은 표본 없음 */
const PLACE_STATS: Record<string, [number, number | null, number, number | null]> = {
  // ① 대표 케이스: 국내는 찼고 해외는 비었다
  p_sunchang_market: [34, 1.2, 2, 4.1],
  p_gokseong_market: [12, 1.6, 0, null],
  p_muju_market: [8, 0.9, 0, null],
  p_bonghwa_market: [5, 2.1, 1, 6.3],
  p_cheongsong_market: [3, 1.4, 0, null],
  // ⑨ 이미 포화. 태그 점수는 같아도 희소성이 낮아 추천 5곳에서 밀려야 정상이다.
  p_jeongseon_market: [88, 1.9, 14, 2.2],
  p_hwagae_market: [76, 1.5, 9, 1.8],

  p_ganggu_market: [21, 1.3, 1, 3.6],
  p_samcheonpo_market: [44, 1.1, 6, 1.9],
  p_guryongpo_market: [58, 1.4, 11, 2.4],
  p_bupyeong_market: [92, 1.0, 31, 1.7],
  p_seomun_market: [67, 0.9, 12, 1.5],
  p_yeongju_dawn: [4, 1.7, 0, null],
  p_seoho_market: [19, 1.2, 3, 2.9],
  p_hwanghak_flea: [15, 0.8, 4, 2.1],
  p_yangnyeong_market: [11, 0.7, 2, 2.6],

  p_school_goheung: [2, 2.3, 0, null],
  // ② 양쪽 다 0편
  p_school_uiseong: [0, null, 0, null],
  p_school_jeongseon: [1, 1.1, 0, null],

  p_station_imp: [7, 1.5, 0, null],
  p_station_hwabon: [13, 1.8, 1, 3.1],
  // ③ 국내 0편 / 해외 2편 — 반대 방향
  p_station_simcheon: [0, null, 2, 3.3],

  p_eocheong_light: [3, 2.7, 0, null],
  p_ongdo_light: [6, 1.6, 0, null],
  p_taepyeong_salt: [24, 1.9, 5, 3.4],
  p_darangyi: [41, 1.6, 8, 2.6],
  p_cheongsando: [9, 2.0, 1, 3.9],
  p_mindungsan: [17, 1.4, 2, 2.2],
  p_jusanji: [28, 1.7, 6, 3.0],
  p_gunsan_bath: [2, 1.9, 0, null],
};

export const FAKE_PLACE_STATS: PlaceLanguageStat[] = Object.entries(PLACE_STATS).flatMap(
  ([place_id, [koN, koM, enN, enM]]) => [
    { place_id, language: "ko" as const, video_count: koN, median_vsr: koM },
    { place_id, language: "en" as const, video_count: enN, median_vsr: enM },
  ],
);
