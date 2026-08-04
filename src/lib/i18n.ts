/**
 * 화면 문구 모음.
 *
 * 원칙
 *   · 문장보다 명사. "이렇게 됐습니다" 대신 "표본 47편 · 중앙값 3.2×"
 *   · 형용사·부사 금지. 숫자가 대신한다
 *   · 설명하지 않는다. 라벨만 붙이고 판단은 사용자가 한다
 *   · 배수는 × 기호로 쓴다 (3.2배 → 3.2×)
 *
 * 지금은 한국어만 채워져 있고 en 은 비어 있다. (ko 로 자동 폴백)
 */

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

const ko = {
  // 서비스
  appName: "숨",
  appTagline: "채널 → 소재 → 좌표",
  demoBanner: "데모 데이터 · 실제 값 아님",

  // SPEC 9장 — 표시 원칙
  //
  // ⚠️ "미개척"은 쓰지 않는다. 같은 사실을 경쟁 영상 수로 말한다.
  competition: (n: number) => `경쟁 ${n}편`,
  competitionPeers: (peers: string) => peers,
  unchartedKo: "국내 0편",
  unchartedEn: "해외 0편",
  insufficientSample: "표본 부족",
  insufficientSampleHelp: "n < 5",
  fallbackNote: "상위 소재 기준",
  fallbackHelp: (parentName: string) => `상위 소재 ${parentName} 기준`,
  lowReliabilityNote: "공공데이터 기준 · 현장 확인",
  reachDisclaimer: "과거 데이터 기반 추정",

  // 단위
  videoCount: (n: number) => `${n}편`,
  multiplier: (n: number) => `${n.toFixed(1)}×`,
  subscribers: (n: number) => `구독 ${formatCount(n)}`,
  decliningArea: "인구감소",
  channelKo: "국내",
  channelEn: "해외",

  // 계절
  seasonNow: "NOW",
  seasonFrom: (month: number) => `${month}월~`,

  // 입력
  s1Title: "채널을 넣으면 좌표가 나옵니다",
  s1UrlLabel: "채널 주소",
  s1UrlPlaceholder: "youtube.com/@channel",
  s1Submit: "계산",
  s1NoUrl: "채널 없이",
  s1PickTags: "소재 선택 · 최대 3",

  // 프로필
  s2Title: "프로필",
  s2Basis: (total: number, top: number) => `${total}편 중 상위 ${top}편에서 추출`,
  s2Next: "좌표 보기",

  // 결과
  s3ProvenTitle: (tagName: string) => tagName,
  s3ProvenBasis: (n: number, m: number) => `표본 ${n}편 · 중앙값 ${m.toFixed(1)}×`,
  s3OccupiedTitle: "촬영 완료",
  s3OccupiedHelp: "",
  s3RecommendTitle: "결과",
  s3RecommendHelp: (n: number) => `경쟁 오름차순 · ${n}곳`,
  s3TagPerformance: (tagName: string, x: number) => `${tagName} ${x.toFixed(1)}×`,
  s3TagBasis: (n: number) => `n=${n}`,
  s3ExpandTitle: "소재 변경",
  s3ExploreLabel: "다른 분류",
  s3TravelTime: (from: string, text: string) => `${from} ${text}`,

  // S4 — 6단 구조. 순서와 제목을 바꾸지 말 것 (SPEC S4)
  s4Step1: "이 소재는 먹힌다",
  s4Step2: "그런데 여긴 비어 있다",
  s4Step3: "별로라서가 아니다",
  s4Step4: "당신이면 이 정도",
  s4Step5: "이렇게 찍으면 된다",
  s4Step6: "이렇게 머물면 된다",
  s4Step1Basis: (tagName: string, n: number, m: number) =>
    `${tagName} · n=${n} · 중앙값 ${m.toFixed(1)}×`,
  s4Step2Basis: (placeName: string) => `${placeName} 촬영 이력`,
  s4Step5Basis: (n: number) => `n=${n} 공통 구성에서 추출`,
  s4ReachLabel: (subs: number) => `구독 ${formatCount(subs)} 기준`,

  // 어드민
  s5Title: "어드민",
  s5RankTitle: "시군구별 미개척 소재",
  s5MatchTitle: "채널 ↔ 지역 매칭",
  s5ImpactTitle: "추천 → 체류 → 생활인구",
  s5KpiTitle: "인구감소지역 신규 영상",
} as const;

export type Strings = typeof ko;

/** 아직 번역하지 않았다. 비어 있는 키는 ko 로 폴백된다. */
const en: Partial<Strings> = {};

const dicts: Record<Locale, Partial<Strings>> = { ko, en };

export function getStrings(locale: Locale = DEFAULT_LOCALE): Strings {
  return { ...ko, ...dicts[locale] };
}

/** 12345 → "1.2만", 890 → "890" */
export function formatCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`;
  return String(n);
}
