/**
 * S5 어드민을 **실데이터로.**
 *
 * ── 지어낼 수 없는 칸이 있다. 그건 안 그린다 ────────────────
 * 시연판 KPI 는 이랬다:
 *
 *   실제 방문 확인   96명      ← 측정 수단이 없다
 *   1인 평균 체류    2.4일     ← 없다
 *   생활인구 환산    230인·일  ← 위 둘을 곱한 값이라 같이 없다
 *
 * 기관에 내는 화면에서 이 숫자를 지어내면 **가장 나쁜 종류의 거짓말**이 된다.
 * 담당자가 그 수치로 예산을 짜기 때문이다. 방문·체류를 알려면 현장 설문이나
 * 통신사 유동인구 데이터가 있어야 하는데 우리에겐 없다.
 *
 * → 측정할 수 있는 것만 KPI 로 두고, **못 재는 것은 못 잰다고 화면이 말한다.**
 *   (`unmeasured` 목록)
 *
 * ── 실데이터로 채우는 것 ────────────────────────────────
 *   목록 규모      catalog (places.json)
 *   경쟁 0편 장소  영상→장소 연결 실측
 *   소재 성적      tagscores.json (기하평균 + 신뢰구간)
 *   채널 매칭      channels.json 의 LLM 소재 분류 × 지역 재고
 */
import { SUBJECTS, type CatalogPlace, type Subject } from "./catalog";
import { findTagScore, type RealTagScore } from "./realcards";
import CHANNELS_JSON from "@/data/real/channels.json";
import type { Language, SubBand } from "./types";

interface RawChannel {
  id: string;
  title: string;
  subscriber_count: number;
  sub_band: SubBand;
  language: Language;
  subjects?: Array<{ name: string; count: number }>;
  recent?: { sample: number } | null;
}

// JSON 은 sub_band 등이 넓은 string 으로 추론된다. 좁히려면 unknown 을 거쳐야 한다
const CHANNELS = CHANNELS_JSON as unknown as RawChannel[];

// ─── ① 지역별 재고 ────────────────────────────────────────

export interface RealGapRow {
  sido: string;
  sigungu: string;
  /** 우리 코퍼스에서 영상이 하나도 안 잡힌 장소 수 */
  openCount: number;
  /** 이미 잡힌 장소 수. 0 옆에 둬야 0 이 무슨 뜻인지 읽힌다 */
  filmedCount: number;
  totalCount: number;
  decliningArea: boolean;
  topSubject: string;
  /** 그 소재의 국내 성적. 신뢰구간이 넓으면 null → 화면이 숫자를 안 쓴다 */
  topSubjectScore: RealTagScore | null;
}

/**
 * 시군구별로 "아직 안 찍힌 장소"를 센다.
 *
 * ⚠️ 여기서는 `미개척` 이라고 써도 된다 (화면 주석 참조). 크리에이터에게 금지인
 *    이유는 "잘 될 증거가 없다"로 읽히기 때문인데, 기관 담당자에게는 정확히
 *    반대로 "우리 지역에 남은 몫"으로 읽힌다.
 *
 * ⚠️ 그래도 **모수를 반드시 함께** 낸다. `0편` 은 "세상에 영상이 없다"가 아니라
 *    "우리 코퍼스에서 안 잡혔다" 이므로, 전체 장소 수와 이미 찍힌 수를 같이 둔다.
 */
export function realGaps(limit = 10): RealGapRow[] {
  interface Acc {
    sido: string;
    sigungu: string;
    declining: boolean;
    open: number;
    filmed: number;
    total: number;
    /** 소재별 미촬영 장소 수 */
    bySubject: Map<string, number>;
  }
  const m = new Map<string, Acc>();

  for (const s of SUBJECTS) {
    for (const p of s.places) {
      const key = `${p.sido}|${p.sigungu}`;
      const cur =
        m.get(key) ??
        ({
          sido: p.sido,
          sigungu: p.sigungu,
          declining: p.declining,
          open: 0,
          filmed: 0,
          total: 0,
          bySubject: new Map(),
        } satisfies Acc);
      cur.total++;
      if (p.videos_ko + p.videos_en > 0) {
        cur.filmed++;
      } else {
        cur.open++;
        cur.bySubject.set(s.label, (cur.bySubject.get(s.label) ?? 0) + 1);
      }
      // 같은 시군구에 감소지역/비감소지역이 섞일 수 없다 — 하나라도 참이면 참
      cur.declining ||= p.declining;
      m.set(key, cur);
    }
  }

  return [...m.values()]
    // 공모전 주제가 인구감소지역이다. 기관 화면도 거기부터 본다
    .filter((a) => a.declining && a.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, limit)
    .map((a) => {
      const top = [...a.bySubject].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "";
      const subject = SUBJECTS.find((s) => s.label === top);
      return {
        sido: a.sido,
        sigungu: a.sigungu,
        openCount: a.open,
        filmedCount: a.filmed,
        totalCount: a.total,
        decliningArea: a.declining,
        topSubject: top,
        // 밴드를 풀고 언어는 국내로. 기관은 특정 채널이 아니라 지역을 본다
        topSubjectScore: subject ? (findTagScore(subject.tag, "ko", 2)?.score ?? null) : null,
      };
    });
}

// ─── ② 채널 ↔ 지역 매칭 ───────────────────────────────────

export interface RealMatchRow {
  channelTitle: string;
  subscriberCount: number;
  language: Language;
  sigungu: string;
  sido: string;
  subject: string;
  /** 지어낸 문장이 아니라 실제로 센 숫자 */
  reason: string;
  /** 그 지역에 아직 안 찍힌 그 소재 장소 수 */
  openCount: number;
  /** 지역이 겹칠 때 내려갈 후보. 화면은 안 쓴다 */
  _alts: Array<[string, { sido: string; open: number }]>;
}

/**
 * 섭외 대상을 고른다 — **채널이 실제로 찍는 소재**와 **그 소재가 남아 있는 지역**을 맞춘다.
 *
 * 채널 소재는 `tag:channel` LLM 분류 실측이다. 시연판의 "폐허·근대유산 태그 비중 41%"
 * 같은 문장은 지어낸 것이었다 — 여기서는 센 숫자만 쓴다.
 */
export function realMatches(limit = 6): RealMatchRow[] {
  const out: RealMatchRow[] = [];

  for (const ch of CHANNELS) {
    const top = ch.subjects?.[0];
    if (!top) continue;
    const subject = SUBJECTS.find((s) => s.label === top.name || s.tag === top.name);
    if (!subject) continue;

    // 그 소재가 가장 많이 남아 있는 인구감소지역 시군구
    const bySigungu = new Map<string, { sido: string; open: number }>();
    for (const p of subject.places) {
      if (!p.declining || p.videos_ko + p.videos_en > 0) continue;
      const cur = bySigungu.get(p.sigungu) ?? { sido: p.sido, open: 0 };
      cur.open++;
      bySigungu.set(p.sigungu, cur);
    }
    const ranked = [...bySigungu].sort((a, b) => b[1].open - a[1].open);
    if (ranked.length === 0) continue;

    out.push({
      channelTitle: ch.title,
      subscriberCount: ch.subscriber_count,
      language: ch.language,
      sigungu: ranked[0][0],
      sido: ranked[0][1].sido,
      subject: subject.label,
      /**
       * ⚠️ 분모를 붙이지 말 것. `recent.sample` 은 최근 50편이지만 소재 분류는
       *    채널 영상 전체에 돌았다 — 두 수의 모수가 다르다. 붙였더니
       *    "최근 롱폼 50편 중 55편" 같은 문장이 나왔다.
       */
      reason: `${subject.label} 영상 ${top.count}편 확인`,
      openCount: ranked[0][1].open,
      _alts: ranked,
    });
  }

  /**
   * ⚠️ **지역이 겹치지 않게 편다.** 그냥 정렬하면 캠핑 채널 6개가 전부
   *    "영월군" 을 가리킨다 — 담당자가 섭외 목록으로 쓸 수가 없다.
   *
   * 채널마다 1순위 지역이 이미 찬 곳이면 그 채널의 2·3순위로 내려간다.
   * 근거가 두꺼운 채널(남은 곳이 많은 쪽)부터 자리를 잡는다.
   */
  const takenSigungu = new Set<string>();
  const takenChannel = new Set<string>();
  const picked: RealMatchRow[] = [];

  for (const row of out.sort(
    (a, b) => b.openCount - a.openCount || b.subscriberCount - a.subscriberCount,
  )) {
    if (picked.length >= limit) break;
    if (takenChannel.has(row.channelTitle)) continue;
    const alt = row._alts.find(([sg]) => !takenSigungu.has(sg));
    if (!alt) continue;
    takenSigungu.add(alt[0]);
    takenChannel.add(row.channelTitle);
    picked.push({ ...row, sigungu: alt[0], sido: alt[1].sido, openCount: alt[1].open, _alts: [] });
  }

  return picked.map(({ _alts, ...r }) => ({ ...r, _alts: [] as never[] }));
}

// ─── ③ 규모 — 잴 수 있는 것만 ──────────────────────────────

export interface RealInventory {
  subjects: number;
  places: number;
  decliningPlaces: number;
  sigunguCount: number;
  /** 우리 코퍼스에서 영상이 잡힌 장소 */
  filmedPlaces: number;
  /** 그중 인구감소지역 */
  filmedDeclining: number;
  /** 지금은 못 재는 것. 화면이 이걸 그대로 말한다 */
  unmeasured: string[];
}

export function realInventory(): RealInventory {
  let places = 0;
  let declining = 0;
  let filmed = 0;
  let filmedDeclining = 0;
  const sigungu = new Set<string>();

  for (const s of SUBJECTS) {
    for (const p of s.places) {
      places++;
      sigungu.add(`${p.sido}|${p.sigungu}`);
      if (p.declining) declining++;
      if (p.videos_ko + p.videos_en > 0) {
        filmed++;
        if (p.declining) filmedDeclining++;
      }
    }
  }

  return {
    subjects: SUBJECTS.length,
    places,
    decliningPlaces: declining,
    sigunguCount: sigungu.size,
    filmedPlaces: filmed,
    filmedDeclining,
    /**
     * ⚠️ 이 목록을 숫자로 바꾸지 말 것. 측정 수단이 생기기 전까지는
     *    **못 잰다고 말하는 것이 유일하게 정직한 표시**다.
     */
    unmeasured: [
      "실제 방문 — 현장 설문이나 유동인구 데이터가 있어야 잽니다",
      "체류 일수 — 위와 같습니다",
      "추천 이후 새로 생긴 영상 — 추천 이력을 쌓고 나서 시점 비교로 잽니다",
    ],
  };
}

/** 카탈로그 장소 하나가 화면에 필요한 만큼만 */
export type { CatalogPlace, Subject };
