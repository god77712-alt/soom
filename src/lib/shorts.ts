/**
 * 롱폼 한 편에서 **쇼츠로 떼어낼 구간**을 고른다.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────
 * 채널 성적을 롱폼·쇼츠로 나눠 보니 두 형식이 채널마다 정반대로 갈렸다
 * (은윤이행님: 롱폼 0.05× / 쇼츠 2.168×). 롱폼 촬영지를 추천하면서
 * "쇼츠가 훨씬 잘 되는 채널"에게 롱폼만 쥐여주면 추천이 반쪽이 된다.
 * → 한 번 가서 찍은 것을 두 형식으로 쓰는 길을 같이 준다.
 *
 * ── 근거는 두 가지고, 둘의 격이 다르다 ───────────────────
 *
 *   comment  댓글이 몰린 지점.  "여러 명이 여기를 짚었다"
 *   length   챕터 길이.         "여기가 쇼츠 길이에 들어간다"
 *
 * 앞엣것이 훨씬 강하다. **어느 쪽인지 화면에 반드시 밝힌다** —
 * 길이로 고른 것을 반응으로 고른 것처럼 보이게 하면, 크리에이터가
 * 없는 근거를 믿고 편집 순서를 바꾼다.
 *
 * 구간별 시청 유지율은 영상 주인만 볼 수 있다. 댓글 타임스탬프가 우리가
 * 가질 수 있는 유일한 구간별 반응 신호다.
 */

/** 쇼츠 최대 길이. 2024년 10월에 60초에서 180초로 늘었다 */
export const SHORTS_MAX_SEC = 180;

/**
 * 너무 짧은 구간은 뺀다. 20초 아래는 챕터라기보다 전환 지점이라
 * 떼어내도 한 편이 되지 않는다.
 */
const MIN_SPAN_SEC = 20;

/** 화제 지점 앞을 이만큼 붙인다. 맥락 없이 절정부터 시작하면 무슨 상황인지 모른다 */
const LEAD_IN_SEC = 15;

/** 화제 지점 뒤를 이만큼 붙인다. 반응이 끝나기 전에 끊기면 허무하다 */
const TAIL_SEC = 30;

/** 화면용 화제 구간. `build:hotspots` 가 구운 JSON 의 한 항목 */
export interface Hotspot {
  at: number;
  from: number;
  to: number;
  mentions: number;
  likes: number;
  top_comment: string;
}

export interface ShortsCut {
  /** 시작 초 */
  at: number;
  /** 끝 초 */
  end: number;
  /** 구간 길이 */
  span: number;
  /** 이 구간에 해당하는 챕터 제목. 챕터가 없으면 null */
  label: string | null;
  /** 겹치는 챕터의 위치. 목록에 표시를 붙이는 데 쓴다. 없으면 -1 */
  index: number;
  /**
   * 무엇을 보고 골랐는가. 화면이 이 값으로 문구를 바꾼다.
   * `comment` 는 반응, `length` 는 길이일 뿐이다.
   */
  reason: "comment" | "length";
  /** reason 이 comment 일 때만. 이 지점을 짚은 댓글 수 */
  mentions?: number;
  /** reason 이 comment 일 때만. 가장 많은 좋아요를 받은 댓글 */
  top_comment?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 초 t 를 품고 있는 챕터의 위치. 없으면 -1 */
function chapterAt(chapters: Array<{ at: number; label: string }>, t: number): number {
  let found = -1;
  for (let i = 0; i < chapters.length; i++) if (chapters[i].at <= t) found = i;
  return found;
}

/**
 * 댓글이 몰린 지점을 감싸는 구간.
 *
 * 군집 자체가 이미 180초를 넘으면(드물지만 긴 영상에서 나온다) 앞에서 자른다 —
 * 가장 많이 짚힌 지점 `at` 이 반드시 들어가게.
 */
function fromHotspot(
  h: Hotspot,
  chapters: Array<{ at: number; label: string }>,
  durationSec: number,
): ShortsCut {
  let at = clamp(h.from - LEAD_IN_SEC, 0, durationSec);
  let end = clamp(h.to + TAIL_SEC, at + MIN_SPAN_SEC, durationSec);
  if (end - at > SHORTS_MAX_SEC) {
    at = clamp(h.at - LEAD_IN_SEC, 0, durationSec);
    end = clamp(at + SHORTS_MAX_SEC, at + MIN_SPAN_SEC, durationSec);
  }
  const index = chapterAt(chapters, h.at);
  return {
    at: Math.round(at),
    end: Math.round(end),
    span: Math.round(end - at),
    label: index >= 0 ? chapters[index].label : null,
    index,
    reason: "comment",
    mentions: h.mentions,
    top_comment: h.top_comment,
  };
}

/**
 * 챕터 길이만 보고 고르는 폴백.
 *
 * 규칙:
 *  1. 길이가 20~180초인 구간만 후보
 *  2. **양 끝 챕터는 뺀다**
 *     - 첫 챕터는 거의 항상 인사·예고라 그것만 떼면 내용이 없다
 *     - 마지막 챕터는 마무리·인사이고, 게다가 끝 시각이 **추정치다**
 *       (다음 챕터가 없어서 영상 길이를 쓴다). 엔딩 크레딧까지 포함돼 있다.
 *     첫 시도에서 이걸 안 걸렀더니 4편 중 2편이 `돌아가는 길` 같은
 *     아웃트로를 골랐다 — 끝 구간은 짧게 잡히는 경향이 있어서 3번 규칙에 계속 이긴다.
 *  3. 남은 것 중 가장 짧은 것 — 짧을수록 앞뒤를 안 잘라도 한 덩어리로 선다
 */
function fromChapters(
  chapters: Array<{ at: number; label: string }>,
  durationSec: number,
): ShortsCut | null {
  if (chapters.length < 3) return null;

  const spans = chapters.map((c, i) => {
    const end = i + 1 < chapters.length ? chapters[i + 1].at : durationSec;
    return { index: i, at: c.at, end, span: end - c.at, label: c.label };
  });

  const candidates = spans
    .slice(1, -1) // 인트로·아웃트로 제외
    .filter((s) => s.span >= MIN_SPAN_SEC && s.span <= SHORTS_MAX_SEC);

  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (b.span < a.span ? b : a));
  return { ...best, reason: "length" };
}

/**
 * 쇼츠 후보 구간 하나. 없으면 null — 그러면 화면은 이 블록을 안 그린다
 * (빈 자리를 문장으로 채우지 않는다).
 *
 * **댓글 근거가 있으면 그걸 쓴다.** 챕터는 폴백이다.
 * 화제 구간은 챕터가 아예 없는 영상에서도 나온다 — 챕터를 적는 여행 브이로그는
 * 실측 12% 뿐이라, 챕터에만 기대면 대부분의 영상에서 이 블록이 사라진다.
 */
export function pickShortsCut(
  chapters: Array<{ at: number; label: string }>,
  durationSec: number,
  hotspot?: Hotspot | null,
): ShortsCut | null {
  if (durationSec <= SHORTS_MAX_SEC) return null; // 이미 쇼츠다
  if (hotspot) return fromHotspot(hotspot, chapters, durationSec);
  return fromChapters(chapters, durationSec);
}
