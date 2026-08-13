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

/** 중앙값. 이상치에 안 흔들리지만 정보를 많이 버린다 — 아래 기하평균 주석 참조 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 기하평균 — **태그 점수는 이걸로 낸다.** (`npm run eval:hypothesis` 로 실측)
 *
 * vsr 은 꼬리가 극단적으로 길다. 같은 표본으로 두 방식의 검정력을 재봤다:
 *
 *   1.5배 차이를 80% 확률로 잡는 데 필요한 편수
 *     중앙값    약 800편
 *     기하평균  약 300편   ← 2.5배 효율적
 *
 * 중앙값이 이상치에 강한 건 맞지만 **정보를 너무 버린다.** 배수를 다루는 값이라
 * 로그를 씌우면 곱셈이 덧셈이 되고 분포도 정규에 가까워진다.
 *
 * 산술평균을 쓰지 않는 이유는 그대로다 — 대박 한 편이 태그 전체를 왜곡한다.
 * 기하평균은 그 왜곡 없이 중앙값보다 정확하다.
 *
 * 0 이하는 버린다. log(0) 이 -Infinity 라 하나만 섞여도 점수 전체가 무너진다.
 */
export function geoMean(values: number[]): number | null {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) return null;
  const meanLog = positive.reduce((s, v) => s + Math.log(v), 0) / positive.length;
  return Math.exp(meanLog);
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

/**
 * 표본이 이 미만이면 상위 태그 점수를 빌려온다.
 *
 * ⚠️ SPEC 은 5편으로 잡았는데 **그 숫자로는 순위밖에 못 쓴다.**
 *    `eval:hypothesis` 실측: 소재당 31편으로도 3배 차이가 겨우 잡힌다(69%).
 *    5편으로 낸 배수는 신뢰구간이 사실상 전 구간이라 장식이다.
 *
 * → 폴백 판정(순위를 쓸 자격)은 5편으로 두고, **배수를 화면에 그릴 자격**은
 *   따로 훨씬 높게 잡는다. 아래 `MIN_SAMPLE_FOR_MULTIPLIER`.
 */
export const MIN_SAMPLE_SIZE = 5;

/**
 * 🚨 **배수(`3.2×`)를 화면에 그려도 되는가 — 판정은 여기 하나뿐이다.**
 *
 * ⚠️ 예전에는 이 판정이 세 군데에 따로 있었고 서로 달랐다 (2026-08-13 발견):
 *      score.ts 100편 · export-places.ts 100편(복사본) · export-tagscores.ts CI 기준
 *    그래서 `/subject/hanggu` 는 "성과 비교 가능" 인데 같은 소재 카드는 "순위만" 이
 *    떴다. **판정을 늘리지 말 것.** 새 화면이 생기면 이 함수를 부른다.
 *
 * ── 왜 표본 수가 아니라 신뢰구간인가 ────────────────────
 * 처음엔 `100편 이상` 으로 잡았는데 79칸 중 1칸만 통과했다. 기준이 틀렸다.
 * 100편은 **"소재 A가 B보다 1.5배 낫다"** 를 말할 때 필요한 수다.
 * 화면이 하는 말은 그게 아니라 **"이 소재의 전형값은 0.9배"** 다 — 다른 주장이고
 * 필요한 표본도 훨씬 적다.
 *
 * → 기하평균 자체의 95% 신뢰구간이 **4배 안**이면 숫자를 쓴다. 그보다 넓으면
 *   `1.2×` 와 `2.4×` 를 구분해서 말할 수 없으니 감춘다.
 *
 * 표본 하한(20편)은 부트스트랩이 의미를 갖는 최소치일 뿐, 이게 판정의 본체가 아니다.
 */
export const MIN_SAMPLE_FOR_MULTIPLIER = 20;
export const MAX_CI_RATIO = 4;

/**
 * 신뢰구간을 낼 수 없는 점수(시연 `TagScore` 등)에 쓰는 **거친 대용치**.
 *
 * CI 를 못 재면 그 숫자가 말이 되는지 확인할 방법이 없다. 그럴 땐 보수적으로 —
 * 검정력 계산 기준 100편(1.5배 차이를 40% 확률로 잡는 수)을 요구한다.
 * 느슨하게 풀면 검증 안 된 배수가 화면에 뜬다.
 */
export const MIN_SAMPLE_WITHOUT_CI = 100;

export type TagScoreStatus =
  /** 세부 태그 자체 표본이 충분함 */
  | "ok"
  /** 세부 태그 표본 부족 → 상위(level 1) 태그 점수를 사용 */
  | "fallback"
  /** 상위 태그도 표본 부족 → 점수 없음. 억지로 채우지 않는다 */
  | "insufficient";

/**
 * 이 점수의 배수를 화면에 숫자로 써도 되는가. **판정은 이 함수 하나뿐이다.**
 *
 * 신뢰구간이 있으면 그걸로 판정하고, 없으면 표본 수 대용치로 떨어진다.
 */
export function canShowMultiplier(
  score: { video_count: number; ci_low?: number | null; ci_high?: number | null } | null,
): boolean {
  if (score === null) return false;
  const { video_count, ci_low, ci_high } = score;

  // CI 를 못 재는 점수 — 보수적으로 표본 수만 본다
  if (ci_low == null || ci_high == null || ci_low <= 0) {
    return video_count >= MIN_SAMPLE_WITHOUT_CI;
  }

  return video_count >= MIN_SAMPLE_FOR_MULTIPLIER && ci_high / ci_low <= MAX_CI_RATIO;
}

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
 * ── 🚨 이것은 예측이 아니라 **정책**이다 (2026-08-12 실측 후 재정의) ──
 *
 * 원래 주석은 "희소성만으로 자연히 위로 올라온다" 였는데, 그 표현이
 * **비어 있는 곳이 성과가 좋다는 뜻으로 읽힌다.** 실측은 그걸 뒷받침하지 않는다.
 *
 *   `npm run eval:hypothesis`
 *   곡성(인구감소·희소) 1.332  vs  국내여행 일반 1.681   →  0.79배
 *   구독자 3개 구간 전부 곡성이 낮다 (0.83 / 0.52 / 0.79)  우연이면 1/8
 *
 * 유의하진 않지만(p=0.486) **방향이 일관되게 불리하다.** 즉 "아무도 안 갔다"가
 * 아니라 "아무도 안 본다" 일 가능성을 배제할 수 없다.
 *
 * → 이 항을 **없애지는 않는다.** 없으면 서울·부산만 추천되고, 공모전 주제이자
 *   이 서비스의 존재 이유인 인구감소지역이 화면에서 사라진다.
 *
 * → 대신 **의미를 바꾼다.** 이건 "여기가 더 잘 된다" 는 예측이 아니라
 *   "우리는 안 찍힌 곳을 위로 올린다" 는 편집 방침이다.
 *
 * ⚠️ 그래서 화면은 이걸 **성과로 말하면 안 된다.**
 *    (X) 경쟁이 없어서 기회다 / 선점 이익
 *    (O) 경쟁 영상 0편 (정선 14편)   ← 사실만. 판단은 크리에이터가 한다
 *
 * 표본이 더 쌓이면 다시 잰다. 그때 방향이 뒤집히면 이 주석부터 고칠 것.
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
