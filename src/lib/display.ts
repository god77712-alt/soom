/**
 * SPEC.md 9장 「표시 원칙」을 코드로 고정한 곳.
 *
 * 화면 컴포넌트는 절대 직접 문구를 만들지 않고 여기 함수를 통해서만 라벨을 얻는다.
 * 특히 video_count === 0 을 화면에서 직접 다루지 말 것 — "데이터 없음"이 새어 나온다.
 */

import { getStrings, type Locale } from "./i18n";
import { resolveTagScore, type ResolvedTagScore } from "./score";
import type { Language, Place, PlaceLanguageStat, SubBand, Tag, TagScore } from "./types";

/** 화면에서 색을 결정하는 의미 단위. Tailwind 클래스는 toneClass() 에서만 만든다. */
export type Tone = "normal" | "uncharted" | "muted" | "warn";

export function toneClass(tone: Tone): string {
  switch (tone) {
    case "uncharted":
      // 금색. 이 색이 보이면 "비어 있다 = 기회"라는 뜻이다.
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
 * 그래서 같은 사실을 경쟁 영상 수로 말하고, 옆에 이미 찍힌 곳을 붙여 선점 이익으로 읽히게 한다.
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
