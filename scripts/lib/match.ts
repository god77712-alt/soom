/**
 * 이름·좌표 유사도. 2단계 중복 판정에 쓴다.
 *
 * 왜 이름만으로는 안 되는가:
 *   "정선5일장" / "정선 아리랑시장(정선5일장)" / "정선전통시장" 이 전부 같은 곳이다.
 *   반대로 "중앙시장"은 전국에 수십 개라 이름이 같아도 다른 곳이다.
 *   → 이름 유사도와 거리를 **함께** 봐야 한다. 하나만 보면 반드시 틀린다.
 */

/** 지구 반지름(km). 300m 판정이라 구면 근사로 충분하다. */
const EARTH_KM = 6371;

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a)) * 1000;
}

/**
 * 이름에서 비교에 방해되는 것을 걷어낸다.
 *
 * 괄호 안 별칭("(정선5일장)")은 지우지 않고 **따로 후보로 쓴다** — 거기에 진짜 이름이
 * 들어 있는 경우가 많다. 여기서는 공백·기호·흔한 접미사만 정리한다.
 */
export function normalizeName(s: string): string {
  return s
    .replace(/[()（）[\]{}·・,，.]/g, " ")
    .replace(/\s+/g, "")
    .replace(/(전통시장|재래시장|상설시장|시장|장터)$/u, "")
    .replace(/(초등학교|중학교|고등학교|분교장|분교|학교)$/u, "")
    .replace(/(역사|역)$/u, "")
    .trim();
}

/**
 * 비교 후보와 그 신뢰도.
 *
 * 이름 전체와 "괄호를 걷어낸 이름" 은 둘 다 그 장소의 온전한 이름이라 가중치 1 이다.
 * 반면 **괄호 안 조각**은 이름의 일부일 뿐이라, 원래 이름에서 차지하는 만큼만 쳐준다.
 * 이 구분이 없으면 "숭례문(남대문) 수입상가" 가 "남대문시장" 과 1.00 으로 붙는다.
 */
export function nameVariants(s: string): { text: string; weight: number }[] {
  const base = s.trim();
  const full = normalizeName(base);
  const out = new Map<string, number>();

  const put = (text: string, weight: number) => {
    if (text.length < 2) return;
    out.set(text, Math.max(out.get(text) ?? 0, weight));
  };

  put(full, 1);
  put(normalizeName(base.replace(/\s*[(（][^)）]*[)）]\s*/g, " ")), 1);
  for (const m of base.matchAll(/[(（]([^)）]+)[)）]/g)) {
    const frag = normalizeName(m[1]);
    put(frag, Math.min(1, frag.length / Math.max(full.length, 1)));
  }
  return [...out].map(([text, weight]) => ({ text, weight }));
}

/**
 * 글자 2-gram Dice 계수 (0~1).
 * 한국어 지명은 어순이 흔들려서("아리랑정선시장") 편집거리보다 n-gram 이 안정적이다.
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ga = grams(a);
  const gb = grams(b);
  let shared = 0;
  for (const [g, n] of ga) shared += Math.min(n, gb.get(g) ?? 0);

  const total = a.length - 1 + (b.length - 1);
  return (2 * shared) / total;
}

/** 괄호를 무시하고 이름 전체끼리만 비교한다. 별칭 때문에 부풀지 않는다. */
export function fullNameSimilarity(a: string, b: string): number {
  return nameSimilarity(normalizeName(a), normalizeName(b));
}

/**
 * 별칭까지 포함해 가장 높은 유사도를 돌려준다.
 *
 * ⚠️ 별칭 한 조각이 통째로 일치하면 유사도가 1.0 이 되어버린다.
 *    "남대문시장" 과 "숭례문(남대문) 수입상가" 가 그렇게 1.00 으로 붙었었다.
 *    → 맞은 조각이 원래 이름에서 차지하는 비중만큼 깎는다.
 *      조각이 이름의 전부면 그대로, 3분의 1이면 3분의 1로.
 */
export function bestNameSimilarity(a: string, b: string): number {
  let best = 0;
  for (const va of nameVariants(a)) {
    for (const vb of nameVariants(b)) {
      const s = nameSimilarity(va.text, vb.text) * va.weight * vb.weight;
      if (s > best) best = s;
    }
  }
  return best;
}
