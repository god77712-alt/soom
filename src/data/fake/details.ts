/**
 * 0단계용 가짜 상세 데이터 (S4 ③⑤⑥, S5).
 *
 * 여기 있는 것들은 DB 테이블이 아니라 온디맨드로 만들어지는 값이다.
 *   ③ 은 2단계(공공데이터)와 6단계(집계) 결과에서 나온다
 *   ⑤ 는 천문연 일출시각 + LLM 구성안
 *   ⑥ 은 TourAPI 숙박/축제 조회
 */

import type { AdminGapRow, AdminImpact, AdminMatchRow, PlaceEvidence, ShootingPlan, StayPlan } from "@/lib/viewmodels";
import { FAKE_PLACE_STATS } from "./stats";
import { FAKE_PLACES } from "./places";

// ─── S4 ③ "별로라서가 아니다" ────────────────────────────

const EVIDENCE_OVERRIDES: Record<string, Partial<PlaceEvidence>> = {
  p_sunchang_market: { photo_count: 8, access_note: "군내버스 정류장 도보 3분 · 주차장 있음", peer_avg_video_count: 14 },
  p_gokseong_market: { photo_count: 11, access_note: "곡성역 도보 12분 · 주차장 있음", peer_avg_video_count: 14 },
  p_muju_market: { photo_count: 5, access_note: "무주공용버스터미널 도보 6분", peer_avg_video_count: 14 },
  p_bonghwa_market: { photo_count: 4, access_note: "봉화역 도보 15분 · 장날 주차 혼잡", peer_avg_video_count: 14 },
  p_cheongsong_market: { photo_count: 3, access_note: "청송터미널 도보 8분", peer_avg_video_count: 14 },
  p_school_uiseong: { photo_count: 2, access_note: "포장도로 접근 가능 · 사전 협의 필요", peer_avg_video_count: 9 },
  p_station_simcheon: { photo_count: 6, access_note: "무궁화호 정차 · 역사 내부 개방", peer_avg_video_count: 7 },
};

/** 명시적으로 적어두지 않은 장소는 실제 데이터에서 만들어낸다. */
export function fakePlaceEvidence(placeId: string, language: "ko" | "en"): PlaceEvidence {
  const place = FAKE_PLACES.find((p) => p.id === placeId);
  const stat = FAKE_PLACE_STATS.find((s) => s.place_id === placeId && s.language === language);
  const override = EVIDENCE_OVERRIDES[placeId] ?? {};
  return {
    place_id: placeId,
    has_tourapi_record: place?.source === "tourapi",
    photo_count: 6,
    access_note: "접근 가능 (공공데이터 기준)",
    peer_avg_video_count: 12,
    own_video_count: stat?.video_count ?? 0,
    ...override,
  };
}

// ─── S4 ⑤ "이렇게 찍으면 된다" ──────────────────────────

const PLANS: Record<string, ShootingPlan> = {
  p_sunchang_market: {
    place_id: "p_sunchang_market",
    // 순창 오일장은 1일·6일에 선다. 오늘(8/2) 기준 가장 가까운 장날.
    date_label: "8월 6일 (장날)",
    sunrise: "05:44",
    sunset: "19:33",
    steps: [
      "05:44 일출 — 장터로 들어오는 트럭과 좌판 펴는 장면",
      "07:00 장이 서는 모습 — 넓은 앵글 1컷 고정",
      "08:30 상인 인터뷰 — 고추장·발효식품 매대 중심",
      "11:00 국밥 — 장터 안쪽 노포에서 마무리",
    ],
    title_examples: [
      "The Korean market tourists never find",
      "I woke up at 5AM for a market that only opens 6 days a month",
    ],
    based_on_video_count: 47,
  },
};

const DEFAULT_PLAN = (placeId: string): ShootingPlan => ({
  place_id: placeId,
  date_label: "8월 6일",
  sunrise: "05:44",
  sunset: "19:33",
  steps: [
    "05:44 일출 — 넓은 앵글 고정 1컷",
    "07:00 사람이 들어오는 시간대 — 움직임 위주",
    "09:00 인물·디테일 컷",
    "11:00 인근 식당에서 마무리",
  ],
  title_examples: ["The Korea nobody films", "왜 아무도 여기를 안 찍었을까"],
  based_on_video_count: 47,
});

export const fakeShootingPlan = (placeId: string): ShootingPlan => PLANS[placeId] ?? DEFAULT_PLAN(placeId);

// ─── S4 ⑥ "이렇게 머물면 된다" ─────────────────────────

const STAYS: Record<string, StayPlan> = {
  p_sunchang_market: {
    place_id: "p_sunchang_market",
    lodgings: [
      { name: "강천산 아래 민박", type: "민박", distance: "차로 12분" },
      { name: "순창읍 게스트하우스", type: "게스트하우스", distance: "도보 9분" },
      { name: "옥천골 한옥체험관", type: "한옥", distance: "차로 6분" },
    ],
    festivals: [{ name: "순창 장류축제", period: "10월 중순 (4일간)" }],
    route: "1일차 장날 촬영 → 강천산 계곡 → 2일차 고추장민속마을 → 남원 이동",
  },
};

const DEFAULT_STAY = (placeId: string): StayPlan => ({
  place_id: placeId,
  lodgings: [
    { name: "읍내 모텔", type: "모텔", distance: "도보 10분" },
    { name: "인근 민박", type: "민박", distance: "차로 10분" },
    { name: "군 운영 숙박시설", type: "공공숙박", distance: "차로 15분" },
  ],
  festivals: [],
  route: "1일차 촬영 → 인근 소재 1곳 → 2일차 이동",
});

export const fakeStayPlan = (placeId: string): StayPlan => STAYS[placeId] ?? DEFAULT_STAY(placeId);

// ─── S5 어드민 ───────────────────────────────────────────

export const FAKE_ADMIN_GAPS: AdminGapRow[] = [
  { sido: "경북", sigungu: "의성군", uncharted_count: 14, top_tag_id: "t_abandoned_school", tag_median_vsr: 3.3, is_declining_area: true },
  { sido: "전남", sigungu: "고흥군", uncharted_count: 12, top_tag_id: "t_abandoned_school", tag_median_vsr: 3.3, is_declining_area: true },
  { sido: "전북", sigungu: "순창군", uncharted_count: 11, top_tag_id: "t_oil_market", tag_median_vsr: 3.2, is_declining_area: true },
  { sido: "경북", sigungu: "봉화군", uncharted_count: 10, top_tag_id: "t_oil_market", tag_median_vsr: 3.2, is_declining_area: true },
  { sido: "충북", sigungu: "영동군", uncharted_count: 9, top_tag_id: "t_unmanned_station", tag_median_vsr: 4.0, is_declining_area: true },
  { sido: "전남", sigungu: "신안군", uncharted_count: 8, top_tag_id: "t_salt_farm", tag_median_vsr: 3.5, is_declining_area: true },
  { sido: "경북", sigungu: "청송군", uncharted_count: 7, top_tag_id: "t_dawn_fog", tag_median_vsr: 2.7, is_declining_area: true },
  { sido: "경남", sigungu: "남해군", uncharted_count: 6, top_tag_id: "t_terraced_field", tag_median_vsr: 3.2, is_declining_area: true },
];

export const FAKE_ADMIN_MATCHES: AdminMatchRow[] = [
  { channel_title: "Wander Korea", subscriber_count: 21_000, language: "en", sigungu: "순창군", matched_tag_id: "t_oil_market", reason: "상위 성과 영상 12편 중 8편이 시장 소재" },
  { channel_title: "Offbeat Korea", subscriber_count: 30_000, language: "en", sigungu: "의성군", matched_tag_id: "t_abandoned_school", reason: "폐허·근대유산 태그 비중 41%" },
  { channel_title: "Slow Trip Korea", subscriber_count: 12_000, language: "en", sigungu: "영동군", matched_tag_id: "t_unmanned_station", reason: "철도 소재 단독 시리즈 운영" },
  { channel_title: "떠나요 브이로그", subscriber_count: 48_000, language: "ko", sigungu: "영덕군", matched_tag_id: "t_fish_market", reason: "수산시장 영상 VSR 국내 상위 10%" },
];

export const FAKE_ADMIN_IMPACT: AdminImpact = {
  recommended_places: 1_240,
  estimated_visits: 96,
  avg_stay_days: 2.4,
  estimated_population_days: 230,
  new_videos_in_declining_areas: 38,
};
