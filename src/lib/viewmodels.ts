/**
 * 화면이 필요로 하지만 DB 테이블은 아닌 것들.
 *
 * types.ts 는 "저장되는 것"(SPEC 3장), 여기는 "계산되거나 온디맨드로 불러오는 것"이다.
 * 둘을 섞으면 7단계에서 뭘 DB에서 읽고 뭘 실시간으로 부르는지 헷갈린다.
 */

/** S2. 4-5 채널 분석의 결과물 */
export interface ChannelProfile {
  channel_id: string;
  /** 분석한 영상 수 (SPEC: 최근 50편) */
  analyzed_count: number;
  /** 그중 VSR 상위 영상 수. S2 근거 문구에 그대로 나간다 */
  top_performer_count: number;
  /** 강한 순서. 첫 번째가 S3 추천의 기준 태그가 된다 */
  tag_ids: string[];
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
