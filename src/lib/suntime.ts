/**
 * 출몰시각 조회 (S4 ⑤ "몇 시에 찍어야 하나").
 *
 * 천문연에서 20지점 × 주 1회만 받아뒀다 (`npm run collect:sunrise`).
 * 매일 받으면 7,300회라 개발계정으로 8일이 걸리는데, 일출 시각은 하루 1~2분씩
 * 매끄럽게 움직여서 **주 1회 + 보간**으로 충분하다.
 *
 * ⚠️ 화면에서 천문연 API 를 직접 부르지 않는다 (SPEC 6장 절대원칙 1).
 *    빌드 시점 JSON 만 읽는다.
 */
import SUN_JSON from "@/data/real/suntime.json";

export type SunRow = {
  location: string;
  locdate: string;
  sunrise: string | null;
  sunset: string | null;
  civilm: string | null;
  civile: string | null;
  lat: number;
  lng: number;
};

const ROWS = SUN_JSON as SunRow[];

/** 지점 목록 (좌표 포함). 같은 지점이 여러 날짜로 들어 있으므로 한 번만 추린다. */
const SITES = (() => {
  const m = new Map<string, { location: string; lat: number; lng: number }>();
  for (const r of ROWS) if (!m.has(r.location)) m.set(r.location, r);
  return [...m.values()];
})();

const BY_SITE = (() => {
  const m = new Map<string, SunRow[]>();
  for (const r of ROWS) (m.get(r.location) ?? m.set(r.location, []).get(r.location)!).push(r);
  for (const v of m.values()) v.sort((a, b) => a.locdate.localeCompare(b.locdate));
  return m;
})();

/** "0546" → 346 (자정부터 분). 시각 계산은 분으로 해야 자릿수 실수가 안 난다. */
function toMinutes(hhmm: string | null): number | null {
  if (!hhmm || hhmm.length < 3) return null;
  const s = hhmm.padStart(4, "0");
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(2, 4));
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function toHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const dayNum = (yyyymmdd: string): number =>
  Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8)) / 86400000;

/** 좌표에서 가장 가까운 관측 지점. 위경도 1도의 실제 거리 차이를 보정한다. */
function nearestSite(lat: number, lng: number): string {
  let best = SITES[0]?.location ?? "서울";
  let bestSq = Infinity;
  const kmPerLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (const s of SITES) {
    const dy = (s.lat - lat) * 111.32;
    const dx = (s.lng - lng) * kmPerLng;
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = s.location;
    }
  }
  return best;
}

export type SunTime = {
  /** 어느 관측 지점을 썼는가. 화면에 밝힌다 — 그 장소에서 직접 잰 값이 아니다 */
  site: string;
  sunrise: string | null;
  sunset: string | null;
  /** 아침 골든아워 시작 (시민박명). 실제로 카메라를 드는 시각 */
  dawn: string | null;
  /** 저녁 골든아워 끝 */
  dusk: string | null;
};

/**
 * 좌표와 날짜로 출몰시각을 구한다.
 *
 * 주 단위 표본 사이는 선형 보간한다. 일출은 하루 1~2분씩 단조롭게 움직여서
 * 일주일 구간 안에서는 직선으로 봐도 오차가 작다.
 */
export function sunTimeFor(lat: number, lng: number, yyyymmdd: string): SunTime | null {
  const site = nearestSite(lat, lng);
  const rows = BY_SITE.get(site);
  if (!rows || rows.length === 0) return null;

  const target = dayNum(yyyymmdd);

  // 표본 범위 밖이면 가장 가까운 표본을 그대로 쓴다 (연말·연초)
  let lo = rows[0];
  let hi = rows[rows.length - 1];
  if (target <= dayNum(lo.locdate)) hi = lo;
  else if (target >= dayNum(hi.locdate)) lo = hi;
  else {
    for (let i = 0; i < rows.length - 1; i++) {
      if (dayNum(rows[i].locdate) <= target && target <= dayNum(rows[i + 1].locdate)) {
        lo = rows[i];
        hi = rows[i + 1];
        break;
      }
    }
  }

  const a = dayNum(lo.locdate);
  const b = dayNum(hi.locdate);
  const t = b === a ? 0 : (target - a) / (b - a);

  const lerp = (x: string | null, y: string | null): string | null => {
    const mx = toMinutes(x);
    const my = toMinutes(y);
    if (mx === null) return my === null ? null : toHHMM(my);
    if (my === null) return toHHMM(mx);
    return toHHMM(mx + (my - mx) * t);
  };

  return {
    site,
    sunrise: lerp(lo.sunrise, hi.sunrise),
    sunset: lerp(lo.sunset, hi.sunset),
    dawn: lerp(lo.civilm, hi.civilm),
    dusk: lerp(lo.civile, hi.civile),
  };
}
