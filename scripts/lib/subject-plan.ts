/**
 * 소재 검색 계획 — **검색어와 태그의 유일한 짝표**
 *
 * 예전에 `collect-youtube.ts` 와 `export-tagscores.ts` 가 이 표를 각자 들고 있었다.
 * 수집기에 영어 검색어를 12개 넣었는데 점수 쪽 사본에 안 넣어서, **영상 3,450편을
 * 받아 놓고 점수가 0편으로 나왔다.** 오류가 안 뜬다 — 그냥 표본이 안 늘 뿐이다.
 * (CLAUDE.md 「판정은 한 곳에」 와 같은 원칙)
 *
 * → 이 파일 하나만 고친다. 양쪽이 여기서 읽는다.
 *
 * ⚠️ **검색어를 바꾸면 이미 받은 영상이 고아가 된다.** `yt_video.found_by` 에
 *    검색어 문자열이 그대로 박혀 있어서, 문자열이 달라지는 순간 그 표본은
 *    태그에 안 붙는다. 새 소재는 추가하되 기존 줄은 고치지 말 것.
 */

export type SubjectQuery = { tag: string; query: string; note: string };

/**
 * 국문 — 사람이 실제로 검색하는 말로 (`5일장` 이 아니라 `오일장`).
 * 인구감소지역 보유 수 순. 쿼터가 마르면 뒤가 잘리니 주력을 앞에 둔다.
 */
export const SUBJECT_PLAN: SubjectQuery[] = [
  { tag: "야영장,오토캠핑장", query: "차박 캠핑 브이로그", note: "감소지역 849 — 가장 두껍다" },
  { tag: "유적지/사적지", query: "유적지 여행 브이로그", note: "감소지역 640" },
  { tag: "사찰", query: "사찰 여행 브이로그", note: "감소지역 327" },
  { tag: "5일장", query: "오일장 여행 브이로그", note: "감소지역 244 · 장날 달력 보유" },
  { tag: "폐교", query: "폐교 브이로그", note: "감소지역 194 · TourAPI 에 없는 소재" },
  { tag: "해수욕장", query: "해수욕장 여행 브이로그", note: "감소지역 148" },
  { tag: "상설시장", query: "전통시장 여행 브이로그", note: "감소지역 131" },
  { tag: "계곡", query: "계곡 여행 브이로그", note: "감소지역 125" },
  { tag: "항구/포구", query: "항구 여행 브이로그", note: "감소지역 106" },
  { tag: "고택", query: "고택 한옥 스테이 브이로그", note: "감소지역 75" },
  { tag: "섬", query: "섬 여행 브이로그", note: "감소지역 62" },
  { tag: "자연휴양림", query: "자연휴양림 브이로그", note: "감소지역 60" },
];

/**
 * 영어 — 같은 12개 소재. 언어별 점수판은 절대 합치지 않으므로(CLAUDE.md 1항)
 * 영어 표본은 영어로 따로 모은다.
 *
 * ⚠️ **여행 맥락을 박는다.** `Korean market` 만 넣으면 먹방·식재료 리뷰가 오고,
 *    `templestay`·`port` 처럼 다른 업계가 쓰는 말은 숙박 후기·항만 물류를 물어온다.
 */
export const EN_SUBJECT_PLAN: SubjectQuery[] = [
  { tag: "야영장,오토캠핑장", query: "Korea camping vlog", note: "감소지역 849" },
  { tag: "유적지/사적지", query: "Korea historic site travel vlog", note: "감소지역 640" },
  { tag: "사찰", query: "Korea temple travel vlog", note: "감소지역 327" },
  { tag: "5일장", query: "Korea five day market vlog", note: "감소지역 244" },
  { tag: "폐교", query: "Korea abandoned school travel", note: "감소지역 194" },
  { tag: "해수욕장", query: "Korea beach travel vlog", note: "감소지역 148" },
  { tag: "상설시장", query: "Korea traditional market travel vlog", note: "감소지역 131" },
  { tag: "계곡", query: "Korea valley travel vlog", note: "감소지역 125" },
  { tag: "항구/포구", query: "Korea fishing village travel vlog", note: "감소지역 106" },
  { tag: "고택", query: "Korea hanok stay vlog", note: "감소지역 75" },
  { tag: "섬", query: "Korea island travel vlog", note: "감소지역 62" },
  { tag: "자연휴양림", query: "Korea forest recreation travel vlog", note: "감소지역 60" },
];

/** 검색어 → 태그. 점수 계산이 이 표를 거꾸로 탄다 */
export const QUERY_TO_TAG = new Map(
  [...SUBJECT_PLAN, ...EN_SUBJECT_PLAN].map((s) => [s.query, s.tag] as const),
);
