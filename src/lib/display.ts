/**
 * SPEC.md 9장 「표시 원칙」을 코드로 고정한 곳.
 *
 * 화면 컴포넌트는 절대 직접 문구를 만들지 않고 여기 함수를 통해서만 라벨을 얻는다.
 * 특히 video_count === 0 을 화면에서 직접 다루지 말 것 — "데이터 없음"이 새어 나온다.
 */

import { getStrings, type Locale } from "./i18n";
import { MIN_SAMPLE_SIZE, canShowMultiplier, resolveTagScore, type ResolvedTagScore } from "./score";
import type { Language, Place, PlaceLanguageStat, SubBand, Tag, TagScore } from "./types";

/** 화면에서 색을 결정하는 의미 단위. Tailwind 클래스는 toneClass() 에서만 만든다. */
export type Tone = "normal" | "uncharted" | "muted" | "warn";

export function toneClass(tone: Tone): string {
  switch (tone) {
    case "uncharted":
      /**
       * 금색 — **"경쟁이 적다"는 사실을 강조하는 색이지 "기회"라는 뜻이 아니다.**
       *
       * 원래 주석이 "비어 있다 = 기회" 였는데 실측이 그걸 뒷받침하지 않는다
       * (`eval:hypothesis` · 희소 지역이 일반 대비 0.79배, 3개 구간 전부 낮음).
       * 색으로 "여기가 유리하다"고 말하면 안 된다. 눈에 띄게만 하고 판단은 넘긴다.
       */
      return "text-open font-semibold";
    case "muted":
      return "text-ink3";
    case "warn":
      return "text-open-d";
    default:
      return "text-ink";
  }
}

// ─── 장소 × 언어 한 줄 (S3 카드의 핵심) ──────────────────

export interface PlaceLanguageLine {
  /** "국내 채널" | "해외 채널" */
  channelLabel: string;
  /** "1.2배 · 영상 34편" 또는 "해외 채널 촬영 기록 없음 — 미개척" */
  text: string;
  tone: Tone;
  isUncharted: boolean;
}

/**
 * SPEC 9장: 한쪽 데이터가 없을 때 "데이터 없음"이라고 쓰지 말 것.
 * "없음"으로 표시하면 사용자가 좋은 후보를 스스로 걸러낸다.
 */
export function placeLanguageLine(
  stat: PlaceLanguageStat | undefined,
  language: Language,
  locale: Locale = "ko",
): PlaceLanguageLine {
  const S = getStrings(locale);
  const channelLabel = language === "ko" ? S.channelKo : S.channelEn;

  if (!stat || stat.video_count === 0) {
    return {
      channelLabel,
      text: language === "ko" ? S.unchartedKo : S.unchartedEn,
      tone: "uncharted",
      isUncharted: true,
    };
  }

  const parts: string[] = [];
  if (stat.median_vsr !== null) parts.push(S.multiplier(stat.median_vsr));
  parts.push(S.videoCount(stat.video_count));

  return {
    channelLabel,
    text: parts.join(" · "),
    // 영상이 5편 미만이면 아직 비어 있는 쪽이므로 함께 강조한다.
    tone: stat.video_count < 5 ? "uncharted" : "normal",
    isUncharted: false,
  };
}

// ─── 경쟁 상황 (S3 카드) ─────────────────────────────────

export interface CompetitionLine {
  /** "경쟁 영상 0편" */
  text: string;
  /** "정선 5일장 14편 · 화개장터 9편" — 비교군이 없으면 null */
  peers: string | null;
  tone: Tone;
  count: number;
}

/**
 * SPEC S3 / CLAUDE.md 7항.
 *
 * "미개척"이라고 쓰지 않는다. 크리에이터에게 "아무도 안 갔다"는 좋은 소식이 아니라
 * 잘 될 증거가 없다는 신호로 읽힌다. 실제로 크리에이터는 잘 된 영상을 따라 만든다.
 * 그래서 같은 사실을 **경쟁 영상 수**로 말하고, 옆에 이미 찍힌 곳을 나란히 둔다.
 *
 * ⚠️ 다만 **"선점 이익"이라고 읽히게 만들면 안 된다** (2026-08-12 실측 후 수정).
 *    희소 지역이 일반보다 잘 된다는 증거가 없다 — 오히려 0.79배로 낮고
 *    구독자 3개 구간 전부 같은 방향이다. 우리가 희소한 곳을 위로 올리는 건
 *    **편집 방침**이지 성과 예측이 아니다 (`score.ts` scarcity 주석).
 *    사실(`경쟁 영상 0편` + 비교군)만 적고 해석은 크리에이터에게 넘긴다.
 */
export function competitionLine(
  stat: PlaceLanguageStat | undefined,
  peerPlaces: Array<{ name: string; count: number }>,
  locale: Locale = "ko",
): CompetitionLine {
  const S = getStrings(locale);
  const count = stat?.video_count ?? 0;
  const peers = peerPlaces.length > 0
    ? peerPlaces.map((p) => `${p.name} ${S.videoCount(p.count)}`).join(" · ")
    : null;
  return {
    text: S.competition(count),
    peers,
    // 경쟁이 적을수록 강조한다. 이게 카드에서 가장 눈에 띄어야 할 숫자다.
    tone: count === 0 ? "uncharted" : count < 5 ? "warn" : "muted",
    count,
  };
}

// ─── 성과 한 줄 (S3 카드의 주인공) ───────────────────────

export interface PerformanceLine {
  /** "여기서 찍은 8편" | "재래시장 영상" */
  scope: string;
  /** "2.9×" | "표본 부족" */
  value: string;
  /** "정선 5일장 · 화개장터 기준" — 이 장소 성적일 때는 null */
  basis: string | null;
  /** 이 장소에서 실제로 찍힌 영상의 성적인가 */
  isOwn: boolean;
  tone: Tone;
}

/**
 * 카드에 적을 성과.
 *
 * 추천 상위는 대부분 경쟁 0편이다(희소성 가중치). 그래서 이 장소 자체의 성적은 거의 없다.
 * 그때 칸을 비우거나 "데이터 없음"이라 쓰면 크리에이터는 거기서 판단을 멈춘다.
 * 대신 **같은 소재가 다른 지역에서 낸 성적**을 출처와 함께 보여준다.
 *
 * 두 줄은 반드시 다르게 읽혀야 한다. 같은 모양으로 그리면 "여기서 4.1× 나왔다"는
 * 거짓말이 된다. scope 가 그 구분을 진다.
 */
export function performanceLine(
  stat: PlaceLanguageStat | undefined,
  tag: Tag,
  language: Language,
  band: SubBand,
  allScores: TagScore[],
  allTags: Tag[],
  /** 소재 성적으로 대체할 때 출처로 밝힐 장소 이름들 */
  sourcePlaces: string[] = [],
  locale: Locale = "ko",
): PerformanceLine {
  const S = getStrings(locale);

  // ① 여기서 찍힌 영상이 충분하면 그 성적을 그대로 쓴다
  if (stat && stat.video_count >= MIN_SAMPLE_SIZE && stat.median_vsr !== null) {
    return {
      scope: S.perfOwnScope(stat.video_count),
      value: S.multiplier(stat.median_vsr),
      basis: null,
      isOwn: true,
      tone: "normal",
    };
  }

  // ② 없으면 같은 소재의 다른 지역 성적. 어디서 온 숫자인지 반드시 함께 적는다
  const resolved = resolveTagScore(tag, language, band, allScores, allTags);
  const scope = S.perfTagScope(tag.name_ko);

  if (resolved.status === "insufficient" || !resolved.score) {
    return { scope, value: S.insufficientSample, basis: S.insufficientSampleHelp, isOwn: false, tone: "muted" };
  }

  /**
   * 표본이 얇으면 **배수를 숫자로 안 쓴다.** (`eval:hypothesis` 실측)
   *
   * 소재당 104편으로도 1.5배 차이의 검정력이 27% 다. 100편 미만에서 낸 배수는
   * 신뢰구간이 사실상 전 구간이라, `1.2×` 와 `2.4×` 를 구분해서 말할 수 없다.
   *
   * 그런데 화면에 `1.2×` 라고 찍히면 크리에이터는 그걸 확정된 사실로 읽고
   * 4시간을 운전한다. → 순위에는 계속 쓰되 **숫자는 감춘다.**
   * 없는 정밀도를 있는 척하는 것보다 덜 보여주는 쪽이 언제나 낫다.
   */
  if (!canShowMultiplier(resolved.score)) {
    return {
      scope,
      value: S.rankOnly,
      basis: S.rankOnlyHelp(resolved.score.video_count),
      isOwn: false,
      tone: "muted",
    };
  }

  const parts: string[] = [];
  if (sourcePlaces.length > 0) parts.push(S.perfSourcePlaces(sourcePlaces));
  else parts.push(S.s3TagBasis(resolved.score.video_count));
  if (resolved.status === "fallback" && resolved.fallback_from) {
    parts.push(S.fallbackHelp(resolved.fallback_from.name_ko));
  }

  return {
    scope,
    value: S.multiplier(resolved.score.median_vsr),
    basis: parts.join(" · "),
    isOwn: false,
    tone: resolved.status === "fallback" ? "warn" : "normal",
  };
}

// ─── 계절 태그 ───────────────────────────────────────────

export type SeasonState = "always" | "now" | "off";

export interface SeasonBadge {
  state: SeasonState;
  /** "NOW" | "10월부터" | null */
  label: string | null;
  tone: Tone;
}

/**
 * SPEC S3: 계절 태그를 숨기지 않는다. 크리에이터는 미리 준비하는 사람들이다.
 *   상시        → 기본색
 *   지금 시즌   → 강조색 + NOW
 *   시즌 아님   → 흐린색 + "N월부터"
 */
export function seasonBadge(tag: Tag, now: Date = new Date(), locale: Locale = "ko"): SeasonBadge {
  const S = getStrings(locale);
  if (!tag.is_seasonal || !tag.season_months || tag.season_months.length === 0) {
    return { state: "always", label: null, tone: "normal" };
  }

  const month = now.getMonth() + 1;
  if (tag.season_months.includes(month)) {
    return { state: "now", label: S.seasonNow, tone: "uncharted" };
  }

  // 다음 시즌 시작 월을 찾는다 (연말을 넘어가면 다시 앞으로 돌아온다)
  const sorted = [...tag.season_months].sort((a, b) => a - b);
  const next = sorted.find((m) => m > month) ?? sorted[0];
  return { state: "off", label: S.seasonFrom(next), tone: "muted" };
}

// ─── 데이터 신뢰도 ───────────────────────────────────────

/** 폐교·간이역 등 저신뢰 데이터에는 반드시 현장 확인 문구를 붙인다. */
export function reliabilityNote(place: Place, locale: Locale = "ko"): string | null {
  if (place.data_reliability !== "low") return null;
  return getStrings(locale).lowReliabilityNote;
}

// ─── 태그 점수 라벨 ──────────────────────────────────────

export interface TagScoreLabel {
  resolved: ResolvedTagScore;
  /** "3.2배" 또는 "표본 부족" */
  text: string;
  /** "상위 소재 기준" 같은 보조 설명. 없으면 null */
  note: string | null;
  tone: Tone;
}

export function tagScoreLabel(
  tag: Tag,
  language: Language,
  band: SubBand,
  allScores: TagScore[],
  allTags: Tag[],
  locale: Locale = "ko",
): TagScoreLabel {
  const S = getStrings(locale);
  const resolved = resolveTagScore(tag, language, band, allScores, allTags);

  if (resolved.status === "insufficient" || !resolved.score) {
    // 억지 점수를 만들지 않는다. 한계를 밝히는 쪽이 오히려 믿음직해 보인다.
    return {
      resolved,
      text: S.insufficientSample,
      note: S.insufficientSampleHelp,
      tone: "muted",
    };
  }

  return {
    resolved,
    text: S.multiplier(resolved.score.median_vsr),
    note:
      resolved.status === "fallback" && resolved.fallback_from
        ? S.fallbackHelp(resolved.fallback_from.name_ko)
        : null,
    tone: resolved.status === "fallback" ? "warn" : "normal",
  };
}

/** 예상 도달은 반드시 범위 + 고지 문구가 함께 나간다. 단일 숫자 금지. */
export function reachText(low: number, high: number, locale: Locale = "ko"): { range: string; disclaimer: string } {
  const S = getStrings(locale);
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return { range: `${fmt(low)} ~ ${fmt(high)}`, disclaimer: S.reachDisclaimer };
}
