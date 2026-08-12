/**
 * SPEC.md 3장 「데이터 모델」을 그대로 옮긴 타입 정의.
 *
 * 필드명을 camelCase 로 바꾸지 않고 snake_case 그대로 둔다.
 * 7단계에서 SQLite 컬럼과 1:1로 붙기 때문에, 여기서 이름을 바꾸면
 * DB ↔ 화면 사이에 변환 계층이 하나 더 생긴다.
 */

// ─── 공통 ────────────────────────────────────────────────

/** 영상/점수판 언어. SPEC 0장: ko/en 점수판은 절대 합치지 않는다. */
export type Language = "ko" | "en";

export type PlaceSource = "tourapi" | "market" | "school" | "station";

/** high=tourapi, medium=market, low=school|station (SPEC 3장) */
export type DataReliability = "high" | "medium" | "low";

/** 1: 1천~1만 / 2: 1만~10만 / 3: 10만~100만 / 4: 100만+ */
export type SubBand = 1 | 2 | 3 | 4;

// ─── places ──────────────────────────────────────────────

export interface Place {
  id: string;
  source: PlaceSource;
  source_id: string;
  name_ko: string;
  /** 없으면 로마자 변환 결과가 들어온다 */
  name_en: string;
  /** 태그 추출 원료. 1단계에서 이게 비어 있는 비율을 반드시 확인할 것 */
  description_ko: string;
  description_en: string;
  sido: string;
  sigungu: string;
  sigungu_code: string;
  lat: number;
  lng: number;
  /** 인구감소지역 여부. 가산점 용도가 아니라 표시(뱃지) 용도다 */
  is_declining_area: boolean;
  image_url: string | null;
  content_type_id: number | null;
  data_reliability: DataReliability;
  created_at: string;
}

// ─── tags ────────────────────────────────────────────────

/**
 * 태그 축.
 *
 * 태그를 하나의 나무로만 두면 "무엇을 찍나"밖에 표현하지 못한다.
 * 채널 분석은 영상의 컨셉, 만드는 사람의 성향, 장소의 성격, 보는 사람까지 덮어야 하므로
 * 축을 나눈다. 축마다 붙는 대상과 쓰임이 다르다.
 *
 *   subject   소재·장소   장소 O / 영상 O   → 어디로 갈지 결정한다 (숨 스코어의 입력)
 *   mood      무드·정서   장소 O / 영상 O   → 같은 소재 안에서 어느 곳이 맞는지 가른다
 *   time      시간대      장소 O / 영상 O   → 촬영 시각을 정한다
 *   format    영상 형식   영상만            → 촬영 구성안(S4 ⑤)의 형태를 바꾼다
 *   persona   화자 성향   영상만            → 구성안의 화법을 바꾼다
 *   audience  시청자      채널만            → 언어별 점수판을 더 잘게 쪼갠다
 */
export type TagAxis = "subject" | "mood" | "time" | "format" | "persona" | "audience";

export interface Tag {
  id: string;
  /** slug (예: oil_market) */
  code: string;
  name_ko: string;
  name_en: string;
  /** 어느 축에 속하는가 */
  axis: TagAxis;
  /** NULL 이면 대분류 */
  parent_id: string | null;
  /** 1=대분류 | 2=세부 */
  level: 1 | 2;
  is_seasonal: boolean;
  /** [4,5] 형태. 상시면 null */
  season_months: number[] | null;
}

/**
 * 태그의 근거.
 *
 * ⚠️ 이 필드가 이 설계의 핵심이다.
 * '정', '인간미' 같은 무형 태그를 TourAPI 소개글에서 뽑으면 안 된다. 그건 관광공사가 쓴
 * 홍보문이라 어디를 읽어도 따뜻하고 정겹다. 전부 같은 태그가 붙어 변별력이 0이 된다.
 *
 * 무형 태그는 **영상과 댓글에서 뽑아 장소로 역전파**한다.
 *   "the ajumma gave me extra" 같은 댓글이 그 장소에 '정' 태그를 붙일 유일한 근거다.
 */
export type TagEvidence =
  /** TourAPI 소개글에서 LLM 추출 — subject/time 에만 쓸 것 */
  | "overview"
  /** 공공데이터 규칙 (전통시장·폐교·역) */
  | "rule"
  /** 그 장소를 찍은 영상의 내용에서 */
  | "video"
  /** 그 영상에 달린 댓글에서 — 무형 태그의 근거 */
  | "comment";

export interface PlaceTag {
  place_id: string;
  tag_id: string;
  /** 0.0~1.0 추출 신뢰도 */
  confidence: number;
  method: "llm" | "rule";
  /** 어디서 나온 태그인가. 무형 태그는 video/comment 여야 한다 */
  evidence: TagEvidence;
  /** 근거가 된 영상/댓글 수. 적으면 화면에서 흐리게 */
  support: number;
}

// ─── videos / channels ───────────────────────────────────

export interface Video {
  id: string;
  youtube_id: string;
  channel_id: string;
  title: string;
  description: string;
  /** 3년 이내인 것만 저장한다 (SPEC 3장) */
  published_at: string;
  view_count: number;
  language: Language;
  /** 초 단위 */
  duration: number;
}

export interface Channel {
  id: string;
  youtube_channel_id: string;
  title: string;
  subscriber_count: number;
  sub_band: SubBand;
  language: Language;
  /**
   * YouTube API 로 실제 수집한 채널인가.
   *
   * ⚠️ 시연 채널과 섞이는 순간 화면이 거짓말을 하게 된다.
   *    실채널이면 구독자·최근 성과가 실측치이고, 시연 채널이면 전부 지어낸 값이다.
   *    화면은 이 값을 보고 출처를 밝혀야 한다.
   */
  is_real?: boolean;
  /** 실채널일 때만. 최근 영상 기준 조회수÷구독자 중앙값 */
  recent_median_vsr?: number;
  /** 실채널일 때만. 상위 영상 (원본 링크용) */
  top_videos?: { video_id: string; title: string; view_count: number; vsr: number }[];
}

/** 영상 한 편에 장소가 5~6곳 나온다. 조회수를 전부에게 100% 주면 데이터가 오염된다. */
export type VideoPlaceEvidence = "title" | "description" | "timestamp" | "comment";

export interface VideoPlace {
  video_id: string;
  place_id: string;
  /** 1.0=제목 | 0.5=설명란·타임스탬프 | 0.2=단순언급·댓글. 댓글 보너스 +0.3 (최대 1.0) */
  weight: number;
  evidence: VideoPlaceEvidence;
  /** 댓글 보너스가 붙었는지. S4에서 "그 장면이 먹혔다"는 근거로 쓴다 */
  comment_bonus: boolean;
}

export interface VideoTag {
  video_id: string;
  tag_id: string;
  /** 해당 장소들의 weight 승계 */
  weight: number;
}

// ─── tag_scores (핵심 테이블) ────────────────────────────

export interface TagScore {
  tag_id: string;
  /** 반드시 분리. 합치면 모든 태그가 평균으로 수렴한다 */
  language: Language;
  sub_band: SubBand;
  /** 표본 수. 5 미만이면 폴백 대상 */
  video_count: number;
  /** 조회수/구독자 중앙값 */
  median_vsr: number;
  /** 예상 도달 범위 표시용 */
  p25_vsr: number;
  p75_vsr: number;
  /** 상위 태그 점수를 빌려온 경우 true → 화면에 "상위 소재 기준" 표시 */
  is_fallback: boolean;
  computed_at: string;
}

/**
 * 장소별·언어별 영상 집계. 6단계에서 videos × video_places 로 산출된다.
 * 희소성 가중치와 S3 카드의 "🇰🇷 1.2배 · 영상 34편" 두 줄이 여기서 나온다.
 */
export interface PlaceLanguageStat {
  place_id: string;
  language: Language;
  /** 0 이면 "데이터 없음"이 아니라 "미개척"이다 (SPEC 9장) */
  video_count: number;
  /** 표본이 없으면 null */
  median_vsr: number | null;
}

// ─── recommendation_logs ─────────────────────────────────

/** 지금은 기록만 한다. "비슷한 채널이 많이 고른 태그" 기능의 재료 (발전성 근거) */
export interface RecommendationLog {
  channel_id: string;
  place_id: string;
  tag_id: string;
  shown_at: string;
  selected_tag_id: string | null;
}
