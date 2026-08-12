/**
 * 화면이 필요로 하지만 DB 테이블은 아닌 것들.
 *
 * types.ts 는 "저장되는 것"(SPEC 3장), 여기는 "계산되거나 온디맨드로 불러오는 것"이다.
 * 둘을 섞으면 7단계에서 뭘 DB에서 읽고 뭘 실시간으로 부르는지 헷갈린다.
 */
import type { ShortsCut } from "./shorts";

/**
 * S2. 채널 분석의 결과물.
 *
 * 소재만 뽑으면 "당신은 시장을 찍는군요"에서 끝난다. 그건 크리에이터가 이미 아는 사실이다.
 * 형식·성향·무드·시청자까지 맞춰야 "내 채널을 봤구나" 소리가 나온다.
 */
export interface ChannelProfile {
  channel_id: string;
  /** 분석한 영상 수 (SPEC: 최근 50편) */
  analyzed_count: number;
  /** 그중 VSR 상위 영상 수. S2 근거 문구에 그대로 나간다 */
  top_performer_count: number;
  /** 강한 순서. 첫 번째가 S3 추천의 기준 태그가 된다 (subject 축) */
  tag_ids: string[];
  /**
   * 축별 태그. subject 는 tag_ids 와 겹친다.
   * audience 는 추정값이다 — 시청자 인구통계는 채널 소유자만 볼 수 있어서
   * 우리는 댓글 언어와 영상 언어로 역추정한다. 화면에 "추정"이라고 밝힌다.
   */
  axes: Partial<Record<"subject" | "mood" | "format" | "persona" | "audience", string[]>>;
}

/**
 * 이 장소에서 찍을 수 있는 컷.
 *
 * 사진만 있으면 관광지 소개고, 컷 설명이 붙어야 촬영 계획이 된다.
 * "여기서 뭘 찍을 수 있나"에 대한 답이라 크리에이터가 가장 먼저 보는 정보다.
 * 출처: 관광사진 갤러리 + 소개글 기반 LLM 추출.
 */
export interface PlaceShot {
  caption: string;
  /** 0단계에서는 null. 7단계에 TourAPI 갤러리 이미지가 들어온다 */
  photo_url: string | null;
  /** "06:00~08:00" — 없으면 상시 */
  best_time: string | null;
  /** 이 컷이 속한 태그 code */
  tag_code: string | null;
}

/**
 * 운영 정보.
 *
 * 오일장은 1일·6일에만 선다. 이걸 모르고 가면 헛걸음이고, 한 번 헛걸음한 크리에이터는
 * 서비스를 다시 안 쓴다. 추천보다 이게 먼저 맞아야 한다.
 * 출처: TourAPI 상세정보 + 전통시장 표준데이터(개설주기).
 */
export interface PlaceOperation {
  place_id: string;
  /** "매월 1일·6일" 같은 개장 주기. 상설이면 null */
  open_cycle: string | null;
  open_hours: string | null;
  closed_days: string | null;
  parking: string | null;
  entrance_fee: string | null;
  /** 드론 금지, 사전 협의 필요 등 촬영 특이사항 */
  filming_note: string | null;
  /** estimate = 공공데이터에 없어서 추정한 값. 화면에 그렇게 밝힌다 */
  source: "tourapi" | "market" | "estimate";
}

/**
 * 잘 된 영상 한 편을 뜯어 놓은 것.
 *
 * 크리에이터는 "여기 좋습니다"로 움직이지 않는다. 잘 된 영상이 **어떻게 생겼는지**를 봐야
 * 자기 영상을 머릿속에 그린다. 그래서 점수가 아니라 구성을 보여준다.
 *
 * 7단계 조달 경로 (전부 실제로 얻을 수 있는 것만 넣었다)
 *   title · duration · view_count   YouTube API
 *   chapters                        영상 설명란의 타임스탬프 목록을 파싱
 *   hook                            자막 앞 30초 → LLM 한 줄 요약
 *
 * chapters 가 비어 있는 영상이 많다. 그때는 억지로 만들지 말고 빈 배열로 둔다 —
 * 화면이 구성 블록 자체를 그리지 않는다.
 */
export interface VideoBreakdown {
  video_id: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  subscriber_count: number;
  view_count: number;
  /** 조회수 ÷ 구독자 */
  vsr: number;
  /** 초 단위 */
  duration: number;
  /** 이 영상이 찍은 장소 (추천 장소가 아니라 다른 곳일 수 있다 — 그 사실을 화면에 밝힌다) */
  place_id: string;
  place_name: string;
  /** 초반 30초에 무엇이 나오는가. 없으면 null */
  hook: string | null;
  /** 설명란 타임스탬프에서 나온 구성. 없으면 빈 배열 */
  chapters: Array<{ at: number; label: string }>;
  /** chapters 의 출처. 화면에 그대로 밝힌다 */
  chapter_source: "description" | "llm";
  /**
   * 이 롱폼에서 쇼츠로 떼어낼 만한 구간. 챕터가 없거나 후보가 없으면 null.
   *
   * ⚠️ **길이만 보고 고른 것이다.** 구간별 시청 유지율은 영상 주인만 볼 수 있어
   *    "여기가 제일 재미있다"고는 말할 수 없다. 화면도 그만큼만 말해야 한다.
   */
  shorts_cut: ShortsCut | null;
}

/** 근처에 묶어 찍을 수 있는 소재. 좌표로 실제 계산한다 */
export interface NearbySpot {
  place_id: string;
  name_ko: string;
  sigungu: string;
  distance_km: number;
  drive_minutes: number;
  /** 대표 태그 이름 */
  tag_names: string[];
  /** 해당 언어권 영상 수 */
  video_count: number;
  is_declining_area: boolean;
}

/** S4 ③ "별로라서가 아니다" — 크리에이터의 첫 의심을 푸는 재료 */
export interface PlaceEvidence {
  place_id: string;
  /** 관광공사 등록 정보 존재 여부 */
  has_tourapi_record: boolean;
  /** 관광사진 갤러리 장수 */
  photo_count: number;
  access_note: string;
  /** 비슷한 규모 동일 소재 장소의 평균 영상 수 */
  peer_avg_video_count: number;
  /** 여기의 영상 수 */
  own_video_count: number;
}

/** S4 ⑤ "이렇게 찍으면 된다" — 온디맨드 LLM + 천문연 일출시각 */
export interface ShootingPlan {
  place_id: string;
  date_label: string;
  sunrise: string;
  sunset: string;
  steps: string[];
  title_examples: string[];
  /** 반드시 함께 표시한다. 출처 없이 내보내면 앞의 데이터까지 신뢰를 잃는다 */
  based_on_video_count: number;
}

/** S4 ⑥ "이렇게 머물면 된다" — 온디맨드 TourAPI 숙박/축제 */
export interface StayPlan {
  place_id: string;
  lodgings: Array<{ name: string; type: string; distance: string }>;
  festivals: Array<{ name: string; period: string }>;
  route: string;
}

// ─── S5 어드민 ───────────────────────────────────────────

export interface AdminGapRow {
  sido: string;
  sigungu: string;
  /** 미개척(해외 영상 0편) 장소 수 */
  uncharted_count: number;
  /** 대표 소재 */
  top_tag_id: string;
  /** 해당 소재의 해외 태그 점수 */
  tag_median_vsr: number;
  is_declining_area: boolean;
}

export interface AdminMatchRow {
  channel_title: string;
  subscriber_count: number;
  language: "ko" | "en";
  sigungu: string;
  matched_tag_id: string;
  /** 매칭 근거 한 줄 */
  reason: string;
}

export interface AdminImpact {
  recommended_places: number;
  estimated_visits: number;
  /** 크리에이터 1인당 평균 체류일 */
  avg_stay_days: number;
  /** 체류일 × 방문 → 생활인구 환산 */
  estimated_population_days: number;
  /** 성공 지표: 인구감소지역에서 신규 생성된 영상 수 */
  new_videos_in_declining_areas: number;
}
