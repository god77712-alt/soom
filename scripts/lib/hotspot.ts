/**
 * 댓글 타임스탬프 → **화제 구간**.
 *
 * ── 왜 이게 챕터보다 나은가 ──────────────────────────────
 * 쇼츠 후보를 처음엔 챕터 길이로만 골랐다. 그건 "이 구간이 쇼츠 길이에 들어간다"
 * 까지만 말할 수 있고, **왜 하필 거기냐**에는 답을 못 한다.
 *
 * 시청자는 재미있는 지점을 댓글에 초 단위로 적는다. 그게 우리가 가질 수 있는
 * 유일한 구간별 반응 신호다 — 시청 유지율 그래프는 영상 주인만 본다.
 *
 * 실제로 잡힌 것 (수집 댓글 21,867건):
 *   `23:50 eagle attack` · `23:51 eagle attack ☠️` · `23:52 Hamla achanak hua`
 *   → 독수리가 덮치는 3초에 댓글 5건이 몰렸다. 챕터에는 없는 지점이다.
 *
 * ── 반드시 걸러야 하는 것 ────────────────────────────────
 * 1. **목차 재게시** — 팬이 챕터 목록을 댓글로 다시 올린다. 타임스탬프가
 *    한 댓글에 3개 이상이면 목차로 보고 통째로 버린다. 안 버리면 챕터가
 *    "댓글이 몰린 지점"으로 둔갑해서, 근거를 바꾼 의미가 사라진다.
 * 2. **영상 길이를 넘는 값** — `1:30:00 짜리로 올려주세요` 같은 요청이
 *    타임스탬프로 잡힌다. 실측에서 실제로 나왔다.
 * 3. **광고 구간 제보** — `9:27 Ad start 9:58 end`. 화제가 아니라 회피 지점이다.
 */

/**
 * `1:23` / `1:23:45` 를 잡는다.
 *
 * 앞뒤로 숫자·콜론이 붙은 경우는 제외한다. 안 그러면 `경기 3:1 승리`,
 * 날짜, 버전 번호가 전부 타임스탬프가 된다 (챕터 파서에서 겪은 것과 같은 함정).
 */
const TS = /(?:^|[^\d:])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?![\d:])/g;

/** 한 댓글에 이만큼 있으면 목차 재게시로 본다 */
const TOC_THRESHOLD = 3;

/** 같은 장면을 가리키는 것으로 볼 간격. 사람마다 몇 초씩 어긋나게 적는다 */
const CLUSTER_GAP_SEC = 20;

/** 군집으로 인정할 최소 댓글 수. 2건은 우연일 수 있다 */
const MIN_MENTIONS = 3;

/** 광고 제보 — 화제 구간이 아니라 건너뛰는 지점이다 */
const AD_HINT = /\b(ad|광고)\s*(start|시작|끝|end)?\b/i;

export interface Mention {
  at: number;
  likes: number;
  text: string;
}

export interface Hotspot {
  /** 군집 중심 (가중 최빈값에 가장 가까운 실제 언급 지점) */
  at: number;
  /** 군집의 처음과 끝 */
  from: number;
  to: number;
  /** 이 지점을 짚은 댓글 수 */
  mentions: number;
  /** 그 댓글들이 받은 좋아요 합 */
  likes: number;
  /** 가장 많은 좋아요를 받은 댓글 한 줄. 화면에 근거로 그대로 보여준다 */
  top_comment: string;
}

/** 댓글 한 건에서 타임스탬프를 뽑는다. 목차·광고는 빈 배열 */
export function mentionsIn(text: string, likes: number, durationSec: number): Mention[] {
  const raw = [...text.matchAll(TS)];
  if (raw.length === 0 || raw.length >= TOC_THRESHOLD) return [];
  if (AD_HINT.test(text)) return [];

  const out: Mention[] = [];
  for (const m of raw) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = m[3] === undefined ? null : Number(m[3]);
    // 3자리면 시:분:초, 2자리면 분:초
    const at = c === null ? a * 60 + b : a * 3600 + b * 60 + c;
    if (at < 0 || at > durationSec) continue;
    out.push({ at, likes, text: text.replace(/\s+/g, " ").trim() });
  }
  return out;
}

/**
 * 언급들을 군집으로 묶고 센 순서로 돌려준다.
 *
 * 점수는 **댓글 수를 먼저** 본다. 좋아요는 동점일 때만 쓴다 —
 * 좋아요 3천짜리 댓글 하나가 서로 다른 사람 5명이 짚은 지점을 이기면,
 * "여러 명이 같은 곳을 짚었다"는 신호가 사라지고 그냥 인기 댓글 순위가 된다.
 */
export function clusterMentions(ms: Mention[]): Hotspot[] {
  if (ms.length === 0) return [];
  const sorted = [...ms].sort((a, b) => a.at - b.at);

  const groups: Mention[][] = [];
  let cur: Mention[] = [sorted[0]];
  for (const m of sorted.slice(1)) {
    if (m.at - cur[cur.length - 1].at <= CLUSTER_GAP_SEC) cur.push(m);
    else {
      groups.push(cur);
      cur = [m];
    }
  }
  groups.push(cur);

  return groups
    .filter((g) => g.length >= MIN_MENTIONS)
    .map((g) => {
      const top = g.reduce((a, b) => (b.likes > a.likes ? b : a));
      return {
        at: top.at,
        from: g[0].at,
        to: g[g.length - 1].at,
        mentions: g.length,
        likes: g.reduce((s, x) => s + x.likes, 0),
        top_comment: top.text.slice(0, 120),
      };
    })
    .sort((a, b) => b.mentions - a.mentions || b.likes - a.likes);
}
