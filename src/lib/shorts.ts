/**
 * 롱폼 한 편에서 **쇼츠로 떼어낼 구간**을 고른다.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────
 * 채널 성적을 롱폼·쇼츠로 나눠 보니 두 형식이 채널마다 정반대로 갈렸다
 * (은윤이행님: 롱폼 0.05× / 쇼츠 2.168×). 롱폼 촬영지를 추천하면서
 * "쇼츠가 훨씬 잘 되는 채널"에게 롱폼만 쥐여주면 추천이 반쪽이 된다.
 * → 한 번 가서 찍은 것을 두 형식으로 쓰는 길을 같이 준다.
 *
 * ── 무엇을 근거로 고르는가 ───────────────────────────────
 * **길이뿐이다.** 우리에게는 구간별 시청 유지율이 없다 — 그건 영상 주인만
 * 볼 수 있는 데이터다. 그러니 "여기가 제일 재미있다"고 말하면 거짓말이 된다.
 *
 * 말할 수 있는 것은 "이 구간은 쇼츠 길이에 그대로 들어간다" 뿐이고,
 * 화면도 딱 그만큼만 말한다. 판단은 크리에이터가 한다.
 */

/** 쇼츠 최대 길이. 2024년 10월에 60초에서 180초로 늘었다 */
export const SHORTS_MAX_SEC = 180;

/**
 * 너무 짧은 구간은 뺀다. 20초 아래는 챕터라기보다 전환 지점이라
 * 떼어내도 한 편이 되지 않는다.
 */
const MIN_SPAN_SEC = 20;

export interface ShortsCut {
  /** chapters 배열에서의 위치 */
  index: number;
  /** 시작 초 */
  at: number;
  /** 끝 초 (다음 챕터 시작, 마지막이면 영상 끝) */
  end: number;
  /** 구간 길이 */
  span: number;
  label: string;
}

/**
 * 챕터가 있는 롱폼에서 쇼츠 후보 구간을 하나 고른다.
 *
 * 규칙:
 *  1. 길이가 20~180초인 구간만 후보
 *  2. **양 끝 챕터는 뺀다**
 *     - 첫 챕터는 거의 항상 인사·예고라 그것만 떼면 내용이 없다
 *     - 마지막 챕터는 마무리·인사이고, 게다가 끝 시각이 **추정치다**
 *       (다음 챕터가 없어서 영상 길이를 쓴다). 실제로는 엔딩 크레딧까지
 *       포함돼 있어서 길이를 믿을 수 없다.
 *     첫 시도에서 이걸 안 걸렀더니 4편 중 2편이 `돌아가는 길` 같은
 *     아웃트로를 골랐다 — 끝 구간은 짧게 잡히는 경향이 있어서 3번 규칙에 계속 이긴다.
 *  3. 남은 것 중 가장 짧은 것 — 짧을수록 앞뒤를 안 잘라도 한 덩어리로 선다
 *
 * 후보가 없으면 null. 그러면 화면은 이 블록을 그리지 않는다
 * (빈 자리를 문장으로 채우지 않는다).
 */
export function pickShortsCut(
  chapters: Array<{ at: number; label: string }>,
  durationSec: number,
): ShortsCut | null {
  // 양 끝을 빼고 나면 가운데가 남아야 한다
  if (chapters.length < 3) return null;

  const spans = chapters.map((c, i) => {
    const end = i + 1 < chapters.length ? chapters[i + 1].at : durationSec;
    return { index: i, at: c.at, end, span: end - c.at, label: c.label };
  });

  const candidates = spans
    .slice(1, -1) // 인트로·아웃트로 제외
    .filter((s) => s.span >= MIN_SPAN_SEC && s.span <= SHORTS_MAX_SEC);

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.span < a.span ? b : a));
}
