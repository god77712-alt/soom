/**
 * 영상 → 장소·지역 연결.
 *
 * `eval-video-place.ts` 로 실측해 다듬은 규칙을 여기 모았다.
 * **평가 스크립트와 실제 적재가 같은 코드를 써야 한다** — 규칙이 갈리면
 * "12.4% 붙는다"고 검증해 놓고 실제로는 다른 비율로 붙는다.
 *
 * ── 실측으로 정해진 것 ───────────────────────────────────
 *   상호명으로 찾기   12.4%
 *   지명으로 찾기     29.6%   ← 2.4배. 지역이 기본 단위여야 한다
 *   지명 중 장소 특정 34.6%
 *
 * 영상은 "곡성 오일장" 이라고 안 하고 "곡성 여행" 이라고 한다.
 *
 * ⚠️ **오탐이 미탐보다 나쁘다.** 틀린 장소에 성과를 몰아주면 추천이 조용히 망가진다.
 *    아래 규칙들은 전부 재현율을 깎아서 정밀도를 산 것이다.
 */

export interface PlaceRow {
  id: string;
  name: string;
  sido: string;
  sigungu: string;
}

/**
 * 장소 이름을 그대로 쓰면 안 된다.
 *   `정선 5일장` 은 영상에서 `정선오일장` 으로 쓰인다.
 *   `옛 봉래초등학교` 의 `옛` 은 우리가 붙인 말이다.
 * → 공백·기호를 지우고 접두어를 떼서 비교한다.
 */
export function norm(s: string): string {
  return s
    .replace(/^(옛|구)\s+/, "")
    .replace(/[()（）[\]{}·・,，.\-–—/'"]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * 너무 짧은 이름은 버린다.
 *   2글자 이름은 아무 문장에나 걸린다 (`정선` 은 `정선하다` 에도 걸린다).
 */
export const MIN_LEN = 4;

/**
 * ⚠️ 라틴 문자만으로 된 상호명은 버린다.
 *
 * TourAPI 음식점·카페에 `Scene`·`TINC`·`A.zel`·`Extraordinary` 같은 이름이 있다.
 * 이게 영어 설명란의 평범한 문장에 걸려서 **남극 다큐가 서울 카페를 찍은 것으로**
 * 잡혔다. 거르고 나니 적중률이 11.8% → 8.6% 로 내려갔지만 남은 건 전부 진짜였다.
 */
export const isLatinOnly = (s: string) => !/[가-힣]/.test(s);

export interface PlaceIndex {
  byName: Map<string, PlaceRow[]>;
  buckets: Map<string, string[]>;
}

/**
 * 이름 색인. 앞 2글자로 버킷을 나눈다 —
 * 안 나누면 영상 한 편마다 5만 개 이름을 전부 대조해야 해서 못 돌린다.
 */
export function buildIndex(places: PlaceRow[]): PlaceIndex {
  const byName = new Map<string, PlaceRow[]>();
  for (const p of places) {
    if (isLatinOnly(p.name)) continue;
    const n = norm(p.name);
    if (n.length < MIN_LEN) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n)!.push(p);
  }

  const buckets = new Map<string, string[]>();
  for (const n of byName.keys()) {
    const k = n.slice(0, 2);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(n);
  }
  return { byName, buckets };
}

export interface PlaceHit {
  place: PlaceRow;
  /** 어디서 찾았나. 제목이 설명란보다 강한 신호다 */
  where: "title" | "desc";
  name: string;
}

/** 텍스트에서 장소 이름을 찾는다 */
export function findPlaces(
  idx: PlaceIndex,
  text: string,
  where: "title" | "desc",
): PlaceHit[] {
  const t = norm(text);
  const out: PlaceHit[] = [];
  const seen = new Set<string>();

  for (let i = 0; i + 2 <= t.length; i++) {
    const cands = idx.buckets.get(t.slice(i, i + 2));
    if (!cands) continue;
    for (const n of cands) {
      if (seen.has(n)) continue;
      if (!t.startsWith(n, i)) continue;
      const rows = idx.byName.get(n)!;
      /**
       * 이름이 여러 곳에 있으면 **어느 곳인지 못 정한다. 버린다.**
       * `중앙시장` 은 전국에 수십 개다 — 아무 데나 고르면 틀린 지역에 성과가 간다.
       */
      if (rows.length !== 1) continue;
      seen.add(n);
      out.push({ place: rows[0], where, name: n });
    }
  }
  return out;
}

/**
 * 지명(시군구) 사전.
 *
 * 영상은 개별 상호명보다 **지명**을 훨씬 자주 말한다 (2.4배).
 * 행정 접미사를 뗀 형태로 찾는다 — 영상은 "곡성군" 이라고 안 한다.
 */
export function buildRegionIndex(sigungus: { sido: string; sigungu: string }[]): Map<string, { sido: string; sigungu: string }> {
  const m = new Map<string, { sido: string; sigungu: string }>();
  for (const r of sigungus) {
    const base = r.sigungu.replace(/(시|군|구)$/, "");
    /**
     * 2글자 미만은 안 쓴다. `중구`·`동구` 는 떼면 한 글자가 되고
     * 전국에 여러 개라 어차피 특정이 안 된다.
     */
    if (base.length < 2) continue;
    // 같은 이름이 여러 시도에 있으면 특정 불가 — 지우고 표시만 남긴다
    if (m.has(base) && m.get(base)!.sido !== r.sido) {
      m.set(base, { sido: "", sigungu: "" });
      continue;
    }
    m.set(base, r);
  }
  for (const [k, v] of [...m]) if (!v.sigungu) m.delete(k);
  return m;
}

/** 시도 축약형. 영상은 `전라남도` 라고 안 하고 `전남`·`여수` 라고 쓴다 */
export function sidoAliases(sido: string): string[] {
  const base = sido.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "");
  const short: Record<string, string[]> = {
    경상남: ["경남"],
    경상북: ["경북"],
    전라남: ["전남"],
    전라북: ["전북"],
    충청남: ["충남"],
    충청북: ["충북"],
  };
  return [base, ...(short[base] ?? [])].filter((s) => s.length >= 2);
}

/**
 * ⚠️ **장소가 자기 지역과 같이 언급됐는지 확인한다.** (2026-08-12 추가)
 *
 * 이 관문이 없으면 일반 명사가 상호명인 곳이 전부 걸린다. 실측에서 나온 것:
 *
 *   `제주여행` (포천시)   73편   ← "제주여행" 이라고 쓴 모든 영상
 *   `바다여행` (강릉시)   34편
 *   `파도소리` (여수시)   24편
 *   `포레스트` (당진시)   14편
 *
 * 전부 TourAPI 에 실제로 등록된 업소명이다. 이름만 보면 매칭이 맞는데
 * **영상은 그 업소를 말한 게 아니다.**
 *
 * 진짜 매칭은 자기 지역과 같이 나온다 — `해운대해수욕장` 영상은 `부산` 을 말하고,
 * `제주여행`(포천) 영상은 `포천` 도 `경기` 도 절대 말하지 않는다.
 *
 * → 장소의 시군구 또는 시도가 같은 텍스트에 없으면 버린다.
 *   재현율이 깎이지만 **오탐이 미탐보다 나쁘다.**
 */
export function mentionsOwnRegion(text: string, place: PlaceRow): boolean {
  const t = norm(text);
  const sigunguBase = place.sigungu?.replace(/(시|군|구)$/, "") ?? "";
  if (sigunguBase.length >= 2 && t.includes(norm(sigunguBase))) return true;
  return sidoAliases(place.sido ?? "").some((a) => t.includes(norm(a)));
}

export function findRegions(
  regionIdx: Map<string, { sido: string; sigungu: string }>,
  text: string,
): { sido: string; sigungu: string }[] {
  const t = norm(text);
  const out: { sido: string; sigungu: string }[] = [];
  const seen = new Set<string>();
  for (const [base, r] of regionIdx) {
    if (seen.has(base)) continue;
    if (t.includes(base)) {
      seen.add(base);
      out.push(r);
    }
  }
  return out;
}
