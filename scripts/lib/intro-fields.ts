/**
 * `detailIntro2` 응답 → 화면이 쓰는 공통 모양.
 *
 * 🚨 **콘텐츠 타입마다 필드 이름이 전부 다르다.** 같은 "운영시간" 이
 *    관광지는 `usetime`, 문화시설은 `usetimeculture`, 음식점은 `opentimefood`,
 *    쇼핑은 `opentime` 이다. 이 표가 이 프로젝트에서 그 사실을 아는 **유일한 곳**이다.
 *
 * ⚠️ 이 매핑을 화면 쪽에 복사하지 말 것. `canShowMultiplier`·`SUBJECT_PLAN`·
 *    `videoplace` matcher 와 같은 원칙 — **같은 판단이 두 곳에 있으면 반드시 어긋난다.**
 *    수집기에만 고치고 export 를 안 고쳐서 영상 3,450편이 점수에 안 붙은 적이 있다.
 *    여기선 더 조용하다: 타입 하나의 운영시간만 영영 빈 채로 남는다.
 *
 * ── 왜 필드를 골라 담는가 ────────────────────────────────
 * 원문 payload 는 타입당 10~20개 필드고 대부분은 화면에 못 쓴다
 * (`heritage1: "0"`, `chkcreditcardshopping: "없음"`). 카드가 실제로 그리는 건
 * **크리에이터가 출발 전에 확인하는 것들뿐**이다 — 여는 시간, 쉬는 날, 주차, 연락처.
 *
 * 원문은 `tour_intro.payload` 에 그대로 남아 있으니 나중에 더 꺼낼 수 있다.
 */

/** 화면이 쓰는 공통 모양. 값이 없는 칸은 `null` 이고, 화면은 그 칸을 안 그린다 */
export interface IntroFields {
  /** 운영시간 */
  usetime: string | null;
  /** 쉬는 날 */
  restdate: string | null;
  /** 주차 */
  parking: string | null;
  /** 이용요금 */
  fee: string | null;
  /** 문의처 */
  tel: string | null;
  /** 취급 품목 — 시장의 특산물. 카드 내용 재료로 값어치가 크다 */
  saleitem: string | null;
  /** 장날 — 쇼핑(38) 에만 있다. 5일장의 핵심 정보 */
  fairday: string | null;
  /** 대표 메뉴 */
  menu: string | null;
  /** 입실 / 퇴실 */
  checkin: string | null;
  checkout: string | null;
}

const EMPTY: IntroFields = {
  usetime: null,
  restdate: null,
  parking: null,
  fee: null,
  tel: null,
  saleitem: null,
  fairday: null,
  menu: null,
  checkin: null,
  checkout: null,
};

/**
 * 콘텐츠 타입별 필드명.
 *
 * 국문 기준이다 (영문 서비스는 타입 코드가 76·78·85… 로 다르지만 **필드명은 같다** —
 * `EngService2` 도 `usetime`·`opentimefood` 를 쓴다. 그래서 타입 코드를 못 찾으면
 * 아래 `FALLBACK` 으로 이름만 보고 집는다).
 */
const BY_TYPE: Record<number, Partial<Record<keyof IntroFields, string>>> = {
  // 관광지
  12: { usetime: "usetime", restdate: "restdate", parking: "parking", tel: "infocenter" },
  // 문화시설
  14: {
    usetime: "usetimeculture",
    restdate: "restdateculture",
    parking: "parkingculture",
    fee: "usefee",
    tel: "infocenterculture",
  },
  // 축제·공연·행사 — 기간이 곧 운영시간이다
  15: { usetime: "playtime", fee: "usetimefestival", tel: "sponsor1tel" },
  // 여행코스
  25: { usetime: "taketime", tel: "infocentertourcourse" },
  // 레포츠
  28: {
    usetime: "usetimeleports",
    restdate: "restdateleports",
    parking: "parkingleports",
    fee: "usefeeleports",
    tel: "infocenterleports",
  },
  // 숙박
  32: {
    checkin: "checkintime",
    checkout: "checkouttime",
    parking: "parkinglodging",
    tel: "infocenterlodging",
  },
  // 쇼핑 — 오일장·상설시장이 여기다. `fairday`(장날)·`saleitem`(취급품목) 이 있다
  38: {
    usetime: "opentime",
    restdate: "restdateshopping",
    parking: "parkingshopping",
    tel: "infocentershopping",
    saleitem: "saleitem",
    fairday: "fairday",
  },
  // 음식점
  39: {
    usetime: "opentimefood",
    restdate: "restdatefood",
    parking: "parkingfood",
    tel: "infocenterfood",
    menu: "firstmenu",
  },
};

/**
 * 타입 코드를 모를 때(영문 서비스 등) 이름만 보고 집는다.
 * 앞에 오는 것이 우선이다.
 */
const FALLBACK: Record<keyof IntroFields, string[]> = {
  usetime: ["usetime", "opentime", "usetimeculture", "opentimefood", "usetimeleports", "playtime"],
  restdate: ["restdate", "restdateshopping", "restdatefood", "restdateculture", "restdateleports"],
  parking: ["parking", "parkingshopping", "parkingfood", "parkingculture", "parkingleports", "parkinglodging"],
  fee: ["usefee", "usefeeleports"],
  tel: ["infocenter", "infocentershopping", "infocenterfood", "infocenterculture", "infocenterleports", "infocenterlodging"],
  saleitem: ["saleitem"],
  fairday: ["fairday"],
  menu: ["firstmenu", "treatmenu"],
  checkin: ["checkintime"],
  checkout: ["checkouttime"],
};

/**
 * 쓸모없는 값을 걸러낸다.
 *
 * ⚠️ TourAPI 는 "없음" 을 여러 방식으로 쓴다 — 빈 문자열, `"0"`, `"없음"`, `"-"`.
 *    `"0"` 을 그대로 그리면 카드에 **`주차 0`** 이 뜬다. 실제로 `heritage1: "0"` 처럼
 *    0 이 "해당 없음" 인 필드가 많다.
 *
 * "빈 자리를 문장으로 채우지 말 것" 이 이 프로젝트의 문구 원칙이다 —
 * 그러려면 **무엇이 빈 자리인지** 를 여기서 정확히 판정해야 한다.
 */
function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  if (!s) return null;
  if (s === "0" || s === "-" || s === "없음" || s === "해당없음") return null;
  return s;
}

/** `payload` JSON 문자열 → 공통 모양 */
export function extractIntro(payload: string | null, contentTypeId: number | null): IntroFields {
  if (!payload) return { ...EMPTY };

  let o: Record<string, unknown>;
  try {
    o = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { ...EMPTY };
  }

  const out = { ...EMPTY };
  const map = contentTypeId != null ? BY_TYPE[contentTypeId] : undefined;

  for (const key of Object.keys(EMPTY) as (keyof IntroFields)[]) {
    // ① 타입별 표에 있으면 그것만 본다 (가장 정확하다)
    const named = map?.[key];
    if (named) {
      out[key] = clean(o[named]);
      if (out[key]) continue;
    }
    // ② 없으면 이름 후보를 순서대로 대본다
    for (const cand of FALLBACK[key]) {
      const v = clean(o[cand]);
      if (v) {
        out[key] = v;
        break;
      }
    }
  }

  return out;
}

/** 값이 하나라도 있는가. 없으면 화면은 운영정보 블록 자체를 안 그린다 */
export function hasAnyIntro(f: IntroFields): boolean {
  return Object.values(f).some((v) => v !== null);
}
