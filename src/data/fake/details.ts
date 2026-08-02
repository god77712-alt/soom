/**
 * 0단계용 가짜 상세 데이터 (S4 ③⑤⑥, S5).
 *
 * 여기 있는 것들은 DB 테이블이 아니라 온디맨드로 만들어지는 값이다.
 *   ③ 은 2단계(공공데이터)와 6단계(집계) 결과에서 나온다
 *   ⑤ 는 천문연 일출시각 + LLM 구성안
 *   ⑥ 은 TourAPI 숙박/축제 조회
 */

import type {
  AdminGapRow,
  AdminImpact,
  AdminMatchRow,
  PlaceEvidence,
  PlaceOperation,
  PlaceShot,
  ShootingPlan,
  StayPlan,
} from "@/lib/viewmodels";
import { FAKE_PLACE_STATS } from "./stats";
import { FAKE_PLACES, FAKE_PLACE_TAGS } from "./places";

// ─── 촬영 컷 (사진 + 설명) ───────────────────────────────

/**
 * "여기서 뭘 찍을 수 있나"에 대한 답.
 * 7단계에서 photo_url 에 TourAPI 갤러리 이미지가 들어오면 사진으로 바뀐다.
 */
const SHOTS: Record<string, PlaceShot[]> = {
  p_sunchang_market: [
    { caption: "장 서기 전 새벽 좌판", photo_url: null, best_time: "05:30~07:00", tag_code: "oil_market" },
    { caption: "고추장·발효식품 매대", photo_url: null, best_time: "08:00~11:00", tag_code: "oil_market" },
    { caption: "상인 인터뷰 — 30년 넘은 단골 매대", photo_url: null, best_time: "09:00~11:00", tag_code: "merchant" },
    { caption: "장터 안쪽 국밥집 골목", photo_url: null, best_time: "11:00~13:00", tag_code: "oil_market" },
  ],
  p_gokseong_market: [
    { caption: "섬진강 기차마을에서 걸어오는 길", photo_url: null, best_time: "07:00~09:00", tag_code: "oil_market" },
    { caption: "장날 아침 좌판 펴는 장면", photo_url: null, best_time: "06:00~08:00", tag_code: "oil_market" },
    { caption: "구 곡성역 근대 역사", photo_url: null, best_time: null, tag_code: "oil_market" },
  ],
  p_school_uiseong: [
    { caption: "칠판이 남아 있는 교실", photo_url: null, best_time: "10:00~15:00", tag_code: "abandoned_school" },
    { caption: "운동장에서 본 교사 정면", photo_url: null, best_time: "16:00~18:00", tag_code: "abandoned_school" },
    { caption: "급식실과 복도", photo_url: null, best_time: "10:00~15:00", tag_code: "abandoned_school" },
  ],
  p_station_simcheon: [
    { caption: "1934년 역사 외관", photo_url: null, best_time: "07:00~09:00", tag_code: "unmanned_station" },
    { caption: "무궁화호 진입 — 하루 4회", photo_url: null, best_time: "시간표 확인 필요", tag_code: "unmanned_station" },
    { caption: "금강 철교와 함께 잡히는 각도", photo_url: null, best_time: "17:00~19:00", tag_code: "modern_building" },
  ],
};

/** 명시적으로 안 적은 곳은 태그에서 만들어낸다. 4단계 LLM 태깅 결과를 흉내낸 것. */
export function fakePlaceShots(placeId: string): PlaceShot[] {
  const explicit = SHOTS[placeId];
  if (explicit) return explicit;

  const tagCodes = FAKE_PLACE_TAGS.filter((pt) => pt.place_id === placeId).map((pt) =>
    pt.tag_id.replace("t_", ""),
  );
  const place = FAKE_PLACES.find((p) => p.id === placeId);
  return tagCodes.slice(0, 3).map((code, i) => ({
    caption: i === 0 ? `${place?.name_ko ?? ""} 전경` : `${code} 관련 컷`,
    photo_url: null,
    best_time: i === 0 ? "일출 직후" : null,
    tag_code: code,
  }));
}

// ─── 운영 정보 ───────────────────────────────────────────

const OPERATIONS: Record<string, Partial<PlaceOperation>> = {
  p_sunchang_market: { open_cycle: "매월 1일 · 6일", open_hours: "06:00~14:00", parking: "공영주차장 무료", source: "market" },
  p_gokseong_market: { open_cycle: "매월 3일 · 8일", open_hours: "06:00~14:00", parking: "장터 옆 주차장", source: "market" },
  p_muju_market: { open_cycle: "매월 1일 · 6일", open_hours: "07:00~15:00", parking: "터미널 주차장 이용", source: "market" },
  p_bonghwa_market: { open_cycle: "매월 2일 · 7일", open_hours: "05:00~13:00", parking: "장날 혼잡", source: "market" },
  p_cheongsong_market: { open_cycle: "매월 4일 · 9일", open_hours: "07:00~14:00", parking: "노상 주차", source: "market" },
  p_jeongseon_market: { open_cycle: "매월 2일 · 7일", open_hours: "08:00~17:00", parking: "전용 주차장", source: "market" },
  p_yeongju_dawn: { open_cycle: "매일", open_hours: "04:00~08:00", parking: "인근 공영주차장", source: "market" },
  p_school_uiseong: {
    open_cycle: null, open_hours: "상시 (외부)", closed_days: null, parking: "교문 앞 공터",
    filming_note: "사유지 구간 있음 — 군청 재산관리부서 사전 협의 권장",
    source: "estimate",
  },
  p_station_simcheon: {
    open_cycle: null, open_hours: "역사 개방 06:00~20:00",
    filming_note: "승강장 진입 시 역무 협의 필요 · 열차 시간표 확인",
    source: "estimate",
  },
  p_taepyeong_salt: { open_hours: "09:00~18:00", entrance_fee: "성인 3,000원", filming_note: "소금 채취는 오후 늦게", source: "tourapi" },
  p_jusanji: { open_hours: "상시", filming_note: "물안개는 해뜨기 직전에만 · 삼각대 필수", source: "tourapi" },
  p_mindungsan: { open_hours: "상시", filming_note: "정상까지 도보 1시간 20분", source: "tourapi" },
};

export function fakePlaceOperation(placeId: string): PlaceOperation {
  return {
    place_id: placeId,
    open_cycle: null,
    open_hours: null,
    closed_days: null,
    parking: null,
    entrance_fee: null,
    filming_note: null,
    source: "estimate",
    ...OPERATIONS[placeId],
  };
}

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
