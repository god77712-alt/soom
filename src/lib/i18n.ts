/**
 * 화면 문구 모음.
 *
 * 지금은 한국어만 채워져 있고, en 은 비어 있다. (ko 로 자동 폴백)
 * 그래도 처음부터 이 구조로 두는 이유:
 *   1. 나중에 영어를 넣을 때 화면 파일을 안 건드리고 이 파일만 채우면 된다.
 *   2. SPEC 9장의 표시 원칙("데이터 없음" 금지 등)을 한 곳에서 감시할 수 있다.
 *      문구가 화면마다 흩어지면 언젠가 한 곳에서 반드시 샌다.
 */

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

const ko = {
  // 서비스
  appName: "숨",
  appTagline: "여기서 찍으면 잘 된다를, 데이터로",
  demoBanner: "데모 데이터로 동작 중입니다 — 아래 수치는 실제 값이 아닙니다 (0단계)",

  // SPEC 9장 — 표시 원칙. 이 5개는 문구를 임의로 바꾸지 말 것.
  uncharted: "미개척",
  unchartedKo: "국내 채널 촬영 기록 없음 — 미개척",
  unchartedEn: "해외 채널 촬영 기록 없음 — 미개척",
  insufficientSample: "표본 부족",
  insufficientSampleHelp: "표본이 5편 미만이라 점수를 내지 않습니다",
  fallbackNote: "상위 소재 기준",
  fallbackHelp: (parentName: string) => `세부 표본이 부족해 상위 소재 '${parentName}' 점수를 사용했습니다`,
  lowReliabilityNote: "공공데이터 기준, 현장 확인 권장",
  reachDisclaimer: "과거 영상 데이터 기반 추정입니다. 결과는 콘텐츠 완성도에 따라 달라집니다.",

  // 공통 단위
  videoCount: (n: number) => `영상 ${n}편`,
  multiplier: (n: number) => `${n.toFixed(1)}배`,
  subscribers: (n: number) => `구독자 ${formatCount(n)}`,
  decliningArea: "인구감소지역",
  channelKo: "국내 채널",
  channelEn: "해외 채널",

  // 계절 태그
  seasonNow: "NOW",
  seasonFrom: (month: number) => `${month}월부터`,

  // S1 온보딩
  s1Title: "당신 채널에 맞는 촬영지를 찾습니다",
  s1UrlLabel: "유튜브 채널 URL",
  s1UrlPlaceholder: "https://youtube.com/@yourchannel",
  s1Submit: "분석하기",
  s1NoUrl: "채널이 아직 없으신가요?",
  s1PickTags: "관심 있는 소재 3개를 골라주세요",

  // S2 채널 프로필
  s2Title: "당신 채널의 색깔",
  s2Basis: (total: number, top: number) => `최근 ${total}편 중 상위 성과 영상 ${top}편에서 공통 추출`,
  s2Next: "이 색깔로 촬영지 찾기",

  // S3 추천 결과
  s3Title: (tagName: string) => `${tagName} — 당신에게 유리한 5곳`,
  s3ExpandTitle: "다른 태그로도 찾아보시겠어요?",
  s3TravelTime: (from: string, text: string) => `${from}에서 ${text}`,

  // S4 상세 — 6단 구조. 순서와 제목을 바꾸지 말 것.
  s4Step1: "이 소재는 먹힌다",
  s4Step2: "그런데 여긴 비어 있다",
  s4Step3: "별로라서가 아니다",
  s4Step4: "당신이면 이 정도",
  s4Step5: "이렇게 찍으면 된다",
  s4Step6: "이렇게 머물면 된다",
  s4Step1Basis: (tagName: string, n: number, m: number) =>
    `${tagName} 소재 영상 ${n}편 · 구독자 대비 중앙값 ${m.toFixed(1)}배`,
  s4Step2Basis: (placeName: string) => `${placeName} 관련 영상 (전체)`,
  s4Step5Basis: (n: number) => `잘 된 영상 ${n}편의 공통 구성에서 추출했습니다`,
  s4ReachLabel: (subs: number) => `구독자 ${formatCount(subs)} 기준 예상 도달`,

  // S5 어드민
  s5Title: "어드민 콘솔",
  s5RankTitle: "시군구별 미개척 소재 랭킹",
  s5MatchTitle: "채널 ↔ 지역 매칭 (팸투어 대상자)",
  s5ImpactTitle: "누적 추천 → 예상 체류 → 생활인구 환산",
  s5KpiTitle: "인구감소지역 신규 생성 영상 수",
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
