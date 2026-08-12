/**
 * 날짜가 박힌 촬영 계획.
 *
 * ── 왜 이게 점수보다 중요한가 ────────────────────────────
 * `3.2×` 를 보고 4시간을 운전하는 사람은 없다. 크리에이터가 실제로 움직이는
 * 조건은 다르다:
 *
 *   · 헛걸음 위험이 낮다 — 가면 뭐가 있는지 안다
 *   · 날짜가 박혀 있다   — 안 가면 놓친다
 *   · 찍을 그림이 그려진다
 *
 * 점수는 목록 **순서**를 정하는 데 쓰고, 사람을 움직이는 건 이 블록이다.
 * 그리고 이건 소재 점수가 검증에 실패해도 그대로 살아남는다 —
 * 장날과 일출은 예측이 아니라 **사실**이라서.
 *
 * ── 재료는 전부 실측이다 ─────────────────────────────────
 *   장날  전국전통시장표준데이터 `개설주기`  (정기장 402곳 · 인구감소 217곳)
 *   해    천문연 20지점 주 1회 + 보간        (실측 오차 평균 0.1분)
 *   좌표  100%
 */
import SHOOTDAYS_JSON from "@/data/real/shootdays.json";
import { sunTimeFor } from "./suntime";

export interface MarketCalendar {
  key: string;
  name: string;
  sido: string;
  sigungu: string;
  /** 끝자리. `[4, 9]` = 4·9·14·19·24·29일 */
  days: number[];
  cycle_label: string;
  lat: number;
  lng: number;
  is_declining: boolean;
  shop_count: number | null;
}

const CALENDARS = SHOOTDAYS_JSON as MarketCalendar[];

const BY_KEY = new Map(CALENDARS.map((c) => [c.key, c]));

/** `export-shootdays.ts` 의 normalize 와 **같은 규칙이어야 한다** */
function normalize(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, "")
    .replace(/(전통시장|상설시장|공설시장|시장|장터|오일장|\d일장)$/g, "")
    .toLowerCase();
}

/**
 * 이 장소가 애초에 **시장인가.**
 *
 * ⚠️ 이 관문이 없으면 등대·염전·기차역에 장날이 붙는다. 실제로 그랬다 —
 *    `어청도 등대`·`증도 태평염전`·`임피역`에 "다음 장날 8월 16일"이 붙어 나왔다.
 *    시군구에 정기장이 하나뿐이면 그걸 가져다 붙였기 때문이다.
 *
 * 이름으로만 판정한다. 소재 태그를 보는 게 더 정확하겠지만, 태그는 아직
 * 전량이 아니라서 (규칙 태깅 47.6%) 없는 장소가 조용히 빠진다.
 */
function isMarketLike(name: string): boolean {
  return /시장|장터|오일장|\d일장/.test(name);
}

/** 같은 시군구 안의 정기장들 */
const BY_SIGUNGU = (() => {
  const m = new Map<string, MarketCalendar[]>();
  for (const c of CALENDARS) {
    if (!m.has(c.sigungu)) m.set(c.sigungu, []);
    m.get(c.sigungu)!.push(c);
  }
  return m;
})();

/** 어떻게 붙였는가. 추정을 원본인 척 섞지 않는다 (지역코드와 같은 원칙) */
export type MatchTier = "이름" | "이름부분";

/**
 * 장소 이름과 시군구로 장날 달력을 찾는다.
 *
 * ⚠️ **시군구를 빼고 이름만으로 찾으면 안 된다.** `중앙시장` 은 전국에 수십 개다
 *    (중복 정리에서 겪은 것과 같은 함정). 모든 단계가 시군구 안에서만 돈다.
 *
 * 2단으로 내려간다. 부르는 이름과 표준데이터의 등록명이 서로 다르기 때문이다:
 *
 *   ① 이름 일치      `순창 오일장` → `순창시장`   (접미사를 떼면 둘 다 `순창`)
 *   ② 이름 부분 일치  `강구항 어시장` → `강구시장`, 후보가 **하나뿐일 때만**
 *
 * ── 왜 "시군구에 정기장이 하나뿐이면 그것" 단계를 뺐는가 ──
 * 처음엔 3단으로 뒀는데 실측에서 `통영 서호시장 골목` 에 `통영중앙전통시장` 의
 * 장날이 붙었다. 둘은 다른 시장이다. 서호시장이 정기장 목록에 없는 건
 * **상설시장이라서**지, 다른 장의 장날을 쓴다는 뜻이 아니다.
 *
 * 못 붙이면 블록이 안 나올 뿐이다. **틀리게 붙이면 4시간을 버리게 만든다.**
 * 중복 정리와 같은 판단 — 정밀도가 재현율보다 중요하다.
 */
export function findCalendar(
  name: string,
  sigungu: string,
): { cal: MarketCalendar; tier: MatchTier } | null {
  // 시장이 아닌 곳에는 애초에 붙이지 않는다
  if (!isMarketLike(name)) return null;

  const n = normalize(name);
  if (n.length === 0) return null;

  const exact = BY_KEY.get(`${n}|${sigungu}`);
  if (exact) return { cal: exact, tier: "이름" };

  const local = BY_SIGUNGU.get(sigungu);
  if (!local || local.length === 0) return null;

  // ② 한쪽이 다른 쪽을 품고 있고, 그런 후보가 하나뿐일 때만
  const partial = local.filter((c) => {
    const cn = normalize(c.name);
    return cn.length > 0 && (cn.includes(n) || n.includes(cn));
  });
  if (partial.length === 1) return { cal: partial[0], tier: "이름부분" };

  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 끝자리가 장날인가.
 *
 * `10` 은 끝자리 0 을 뜻한다 (10·20·30일). 이걸 놓치면 `5일+10일` 장이
 * 한 달에 세 번밖에 안 잡힌다.
 */
function isMarketDay(dayOfMonth: number, days: number[]): boolean {
  const last = dayOfMonth % 10;
  return days.some((d) => (d === 10 ? last === 0 : last === d));
}

export interface ShootDay {
  /** `20260903` */
  date: string;
  /** `9월 3일 (목)` */
  label: string;
  /** 오늘로부터 며칠 뒤 */
  in_days: number;
  /** 해 관련 시각. 표본 밖 날짜면 null */
  sun: {
    /** 시민박명 시작 — 좌판이 펴지기 시작하는 어스름 */
    dawn: string | null;
    sunrise: string | null;
    sunset: string | null;
    /** 시민박명 끝 */
    dusk: string | null;
    /** 어느 관측 지점 기준인지. 그 장소에서 직접 잰 값이 아니다 */
    site: string;
  } | null;
}

/**
 * 다음 장날 몇 개와 그날의 해 시각.
 *
 * `from` 을 인자로 받는 이유: 서버와 브라우저가 서로 다른 순간에 `new Date()`
 * 를 부르면 자정 근처에서 날짜가 갈려 하이드레이션이 깨진다.
 * **호출부가 기준 날짜를 정해서 넘긴다.**
 */
export function nextShootDays(cal: MarketCalendar, from: Date, count = 3): ShootDay[] {
  const out: ShootDay[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  // 두 달치를 넘겨 보지 않는다. 끝자리가 유효하면 5일에 한 번은 반드시 걸린다
  for (let i = 0; i < 62 && out.length < count; i++) {
    if (isMarketDay(cursor.getDate(), cal.days)) {
      const date = ymd(cursor);
      const s = sunTimeFor(cal.lat, cal.lng, date);
      out.push({
        date,
        label: `${cursor.getMonth() + 1}월 ${cursor.getDate()}일 (${WEEKDAY[cursor.getDay()]})`,
        in_days: i,
        sun: s
          ? { dawn: s.dawn, sunrise: s.sunrise, sunset: s.sunset, dusk: s.dusk, site: s.site }
          : null,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface ShootPlan {
  calendar: MarketCalendar;
  days: ShootDay[];
  /**
   * 어떻게 붙였는가. 이름이 정확히 맞은 게 아니면 화면이 **등록명을 함께 보여준다** —
   * 크리에이터가 "내가 아는 그 장이 맞나"를 스스로 확인할 수 있어야 한다.
   */
  tier: MatchTier;
}

/** 장소에 붙일 촬영 계획. 정기장이 아니면 null → 화면이 블록을 안 그린다 */
export function shootPlanFor(name: string, sigungu: string, from: Date): ShootPlan | null {
  const found = findCalendar(name, sigungu);
  if (!found) return null;
  const days = nextShootDays(found.cal, from);
  return days.length === 0 ? null : { calendar: found.cal, days, tier: found.tier };
}
