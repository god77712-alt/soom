/**
 * SPEC.md 4장 「점수 계산 규칙」.
 *
 * 0단계에서는 가짜 tag_scores 를 입력으로 받지만, 계산식 자체는 진짜다.
 * 6단계에서 이 함수들을 그대로 재사용하고, 상위 30개 육안 검증도 이 결과로 한다.
 */

import type { Language, SubBand, Tag, TagScore } from "./types";

// ─── 4-1. 영상 성과 지표 ─────────────────────────────────

/** VSR = 조회수 / 구독자 수 */
export function vsr(viewCount: number, subscriberCount: number): number {
  if (subscriberCount <= 0) return 0;
  return viewCount / subscriberCount;
}

/** 평균이 아니라 중앙값을 쓴다. 대박 영상 한 편이 태그 전체를 왜곡하는 걸 막는다. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 구독자 1,000 미만 채널은 점수 계산에서 제외한다 (배수가 폭발해 통계를 망침) */
export const MIN_SUBSCRIBER_COUNT = 1000;

export function subBandOf(subscriberCount: number): SubBand | null {
  if (subscriberCount < MIN_SUBSCRIBER_COUNT) return null;
  if (subscriberCount < 10_000) return 1;
  if (subscriberCount < 100_000) return 2;
  if (subscriberCount < 1_000_000) return 3;
  return 4;
}

// ─── 4-2. 태그 성과 점수 + 폴백 규칙 ─────────────────────

/** 표본이 이 미만이면 상위 태그 점수를 빌려온다 */
export const MIN_SAMPLE_SIZE = 5;

export type TagScoreStatus =
  /** 세부 태그 자체 표본이 충분함 */
  | "ok"
  /** 세부 태그 표본 부족 → 상위(level 1) 태그 점수를 사용 */
  | "fallback"
  /** 상위 태그도 표본 부족 → 점수 없음. 억지로 채우지 않는다 */
  | "insufficient";

export interface ResolvedTagScore {
  status: TagScoreStatus;
  /** insufficient 이면 null */
  score: TagScore | null;
  /** fallback 일 때 실제로 사용한 상위 태그 */
  fallback_from: Tag | null;
}

/**
 * SPEC 4-2 폴백 규칙.
 *
 *   video_count < 5           → 상위 태그 점수 사용, is_fallback = true
 *   상위 태그도 < 5           → 점수 없음, 화면에 "표본 부족"
 *
 * 이 규칙을 빼면 우연히 대박난 영상 2편이 태그 순위를 지배한다. 2단 태그 구조가
 * 존재하는 이유가 정확히 이것이다.
 */
export function resolveTagScore(
  tag: Tag,
  language: Language,
  band: SubBand,
  allScores: TagScore[],
  allTags: Tag[],
): ResolvedTagScore {
  const find = (tagId: string) =>
    allScores.find(
      (s) => s.tag_id === tagId && s.language === language && s.sub_band === band,
    ) ?? null;

  const own = find(tag.id);
  if (own && own.video_count >= MIN_SAMPLE_SIZE) {
    return { status: "ok", score: own, fallback_from: null };
  }

  const parent = tag.parent_id ? (allTags.find((t) => t.id === tag.parent_id) ?? null) : null;
  if (parent) {
    const parentScore = find(parent.id);
    if (parentScore && parentScore.video_count >= MIN_SAMPLE_SIZE) {
      return {
        status: "fallback",
        score: { ...parentScore, tag_id: tag.id, is_fallback: true },
        fallback_from: parent,
      };
    }
  }

  return { status: "insufficient", score: null, fallback_from: parent };
}

// ─── 4-3. 숨 스코어 ──────────────────────────────────────

/**
 * scarcity = 1 / log(1 + place_video_count + 1)
 *
 * 이 항이 없으면 서울·부산만 추천된다. 공모전 주제(인구감소지역)와 정반대 결과다.
 * 인구감소지역에 인위적 가산점은 주지 않는다 — 희소성만으로 자연히 위로 올라온다.
 */
export function scarcity(placeVideoCount: number): number {
  return 1 / Math.log(1 + placeVideoCount + 1);
}

/**
 * soom_score = tag_score × scarcity
 *
 * place_video_count 는 반드시 언어별로 따로 센다.
 * 국내 34편 / 해외 0편인 곳이 이 서비스의 핵심 타겟이기 때문이다.
 */
export function soomScore(tagMedianVsr: number, placeVideoCount: number): number {
  return tagMedianVsr * scarcity(placeVideoCount);
}

// ─── 4-4. 예상 도달 범위 ─────────────────────────────────

export interface ReachRange {
  low: number;
  high: number;
}

/**
 * 반드시 범위로 표시한다. 단일 숫자 금지 (SPEC 11장).
 * 표시 옆에는 항상 display.ts 의 REACH_DISCLAIMER 를 함께 붙인다.
 */
export function reachRange(subscriberCount: number, score: TagScore): ReachRange {
  return {
    low: Math.round(subscriberCount * score.p25_vsr),
    high: Math.round(subscriberCount * score.p75_vsr),
  };
}

// ─── 4-5. 채널 분석 ──────────────────────────────────────

/**
 * VSR 상위 영상에 가중치를 준다.
 * "평균 색깔"이 아니라 "잘 되는 색깔"을 찾는 것이 목적이기 때문이다.
 *
 * 0단계에서는 가짜 채널 프로필을 그대로 쓰고, 이 함수는 5단계 이후 실제 영상 목록에
 * 연결된다. 시그니처를 지금 고정해 두면 S2 화면을 다시 안 짜도 된다.
 */
export function topPerformerCut(videoVsrs: number[]): number {
  const m = median(videoVsrs);
  return m ?? 0;
}
