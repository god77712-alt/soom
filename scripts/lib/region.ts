/**
 * 주소 문자열 → 시도·시군구 코드 복원.
 *
 * 왜 필요한가:
 *   TourAPI 는 지역코드가 대량으로 비어 있다 (48,929 중 26,635건).
 *   보강 데이터(전통시장·폐교·철도역)는 아예 지역코드가 없고 주소만 있다.
 *   양쪽을 같은 기준으로 시군구에 붙여야 "인구감소지역에 이 소재가 몇 개" 를 셀 수 있다.
 *
 * ⚠️ DB 의 area_code / sigungu_code 컬럼은 TEXT 다. 숫자로 다루지 말 것.
 */
import type { DatabaseSync } from "node:sqlite";

/** 주소 앞머리의 시도 표기는 흔들린다. 전부 정식 명칭으로 모은다. */
export const SIDO_ALIAS: Record<string, string> = {
  서울: "서울특별시",
  서울시: "서울특별시",
  서울특별시: "서울특별시",
  부산: "부산광역시",
  부산시: "부산광역시",
  부산광역시: "부산광역시",
  대구: "대구광역시",
  대구시: "대구광역시",
  대구광역시: "대구광역시",
  인천: "인천광역시",
  인천시: "인천광역시",
  인천광역시: "인천광역시",
  광주: "광주광역시",
  광주시: "광주광역시",
  광주광역시: "광주광역시",
  대전: "대전광역시",
  대전시: "대전광역시",
  대전광역시: "대전광역시",
  울산: "울산광역시",
  울산시: "울산광역시",
  울산광역시: "울산광역시",
  세종: "세종특별자치시",
  세종시: "세종특별자치시",
  세종특별자치시: "세종특별자치시",
  경기: "경기도",
  경기도: "경기도",
  강원: "강원특별자치도",
  강원도: "강원특별자치도",
  강원특별자치도: "강원특별자치도",
  충북: "충청북도",
  충청북도: "충청북도",
  충남: "충청남도",
  충청남도: "충청남도",
  전북: "전북특별자치도",
  전라북도: "전북특별자치도",
  전북특별자치도: "전북특별자치도",
  // 전통시장 표준데이터에 '자치'가 '차치'로 들어간 행이 61건 있다. 원본 오타다.
  전북특별차치도: "전북특별자치도",
  전남: "전라남도",
  전라남도: "전라남도",
  경북: "경상북도",
  경상북도: "경상북도",
  경남: "경상남도",
  경상남도: "경상남도",
  제주: "제주특별자치도",
  제주도: "제주특별자치도",
  제주특별자치도: "제주특별자치도",
};

/**
 * 통합으로 사라진 시도명 → 옛 시도 후보들.
 *
 * TourAPI 주소는 통합 후 이름을 쓰는데 지역코드표(areaCode2)는 아직 옛 체계다.
 * 후보를 순서대로 대보면 시군구 이름으로 어느 쪽인지 갈린다
 * (여수시·구례군은 전남, 광산구는 광주).
 */
export const MERGED_SIDO: Record<string, string[]> = {
  전남광주통합특별시: ["전라남도", "광주광역시"],
};

/** 시군구를 어떻게 알아냈는가. 추정값을 원본인 척 섞지 않으려고 끝까지 들고 다닌다. */
export type RegionSource = "원본" | "주소복원" | "좌표추정" | "미상";

export type RegionHit = {
  area_code: string;
  sigungu_code: string;
  sido: string;
  sigungu: string;
};

export class RegionResolver {
  /** "정식시도명|시군구명" → 코드 */
  private byName = new Map<string, RegionHit>();
  /** "areaCode-sigunguCode" → 이름 */
  private byCode = new Map<string, RegionHit>();
  /** 시군구명 → 후보들. 전국에서 유일한 이름일 때만 시도를 무시하고 쓴다 */
  private bySigunguName = new Map<string, RegionHit[]>();
  /** 시도명 자체가 시군구인 곳 (세종). "세종특별자치시 전의면" 을 받아내려면 필요하다 */
  private sidoAsSigungu = new Map<string, RegionHit>();
  private decliningKeys = new Set<string>();

  constructor(db: DatabaseSync) {
    const sidoByCode = new Map<string, string>();
    for (const r of db.prepare("select code, name from area_code").all() as {
      code: string;
      name: string;
    }[]) {
      sidoByCode.set(String(r.code), r.name);
    }

    for (const r of db
      .prepare("select area_code, code, name from sigungu_code")
      .all() as { area_code: string; code: string; name: string }[]) {
      const rawSido = sidoByCode.get(String(r.area_code));
      if (!rawSido) continue;
      const sido = SIDO_ALIAS[rawSido] ?? rawSido;
      const hit: RegionHit = {
        area_code: String(r.area_code),
        sigungu_code: String(r.code),
        sido,
        sigungu: r.name,
      };
      this.byName.set(`${sido}|${r.name}`, hit);
      this.byCode.set(`${hit.area_code}-${hit.sigungu_code}`, hit);

      const same = this.bySigunguName.get(r.name) ?? [];
      same.push(hit);
      this.bySigunguName.set(r.name, same);

      // 세종은 시군구 이름이 시도 이름과 같다 (세종특별자치시|세종특별자치시)
      if ((SIDO_ALIAS[r.name] ?? r.name) === sido) this.sidoAsSigungu.set(sido, hit);
    }

    for (const r of db
      .prepare("select area_code, sigungu_code from declining_area")
      .all() as { area_code: string; sigungu_code: string }[]) {
      this.decliningKeys.add(`${String(r.area_code)}-${String(r.sigungu_code)}`);
    }
  }

  fromCode(area: unknown, sigungu: unknown): RegionHit | null {
    if (area === null || area === undefined || area === "") return null;
    if (sigungu === null || sigungu === undefined || sigungu === "") return null;
    return this.byCode.get(`${String(area)}-${String(sigungu)}`) ?? null;
  }

  /**
   * 주소에서 시군구를 찾는다.
   *
   * "전라남도 곡성군 오곡면 ..." 이 기본형이지만 "경기도 성남시 분당구" 처럼
   * 시군구가 두 토큰인 경우가 있어 긴 쪽을 먼저 맞춰본다.
   */
  fromAddr(addr: string | null | undefined): RegionHit | null {
    if (!addr) return null;
    const parts = String(addr).trim().split(/\s+/);
    if (parts.length < 2) return null;

    const candidates = MERGED_SIDO[parts[0]] ?? [SIDO_ALIAS[parts[0]]].filter(Boolean);
    if (candidates.length === 0) return null;

    for (const sido of candidates) {
      if (parts.length >= 3) {
        const hit = this.byName.get(`${sido}|${parts[1]} ${parts[2]}`);
        if (hit) return hit;
      }
      const exact = this.byName.get(`${sido}|${parts[1]}`);
      if (exact) return exact;
    }

    // 세종처럼 시군구 계층이 없는 곳. "세종특별자치시 전의면" 의 둘째 토큰은 읍면이다.
    const flat = this.sidoAsSigungu.get(candidates[0]);
    if (flat) return flat;

    /**
     * 시도가 어긋나는 경우 — 행정구역 개편 때문이다.
     * (군위군은 2023년 경상북도에서 대구광역시로 편입됐는데 원본 데이터는 아직 경상북도다)
     * 시군구 이름이 **전국에서 유일할 때만** 시도를 무시하고 붙인다.
     * '중구'처럼 여러 시도에 있는 이름은 후보가 둘 이상이라 여기서 걸러진다.
     */
    const sameName = this.bySigunguName.get(parts[1]);
    if (sameName?.length === 1) return sameName[0];

    return null;
  }

  /** 코드가 있으면 코드로, 없으면 주소로. 어디서 왔는지도 함께 돌려준다. */
  resolve(
    area: unknown,
    sigungu: unknown,
    ...addrs: (string | null | undefined)[]
  ): { hit: RegionHit | null; source: RegionSource } {
    const byCode = this.fromCode(area, sigungu);
    if (byCode) return { hit: byCode, source: "원본" };
    for (const a of addrs) {
      const hit = this.fromAddr(a);
      if (hit) return { hit, source: "주소복원" };
    }
    return { hit: null, source: "미상" };
  }

  /** `resolve` 로 안 되면 좌표까지 써본다. `seedSpatial` 을 먼저 불러야 한다. */
  resolveWithCoord(
    area: unknown,
    sigungu: unknown,
    lat: number | null,
    lng: number | null,
    ...addrs: (string | null | undefined)[]
  ): { hit: RegionHit | null; source: RegionSource } {
    const r = this.resolve(area, sigungu, ...addrs);
    if (r.hit) return r;

    /**
     * 시군구만 새 이름이고 시도는 멀쩡한 경우가 대부분이다 (인천 검단구·제물포구).
     * 그럴 땐 같은 시도로 후보를 좁혀서 찾고, 그래도 없으면 전국에서 찾는다.
     */
    const sidoHint = addrs
      .map((a) => (a ?? "").trim().split(/\s+/)[0])
      .map((head) => MERGED_SIDO[head] ?? (SIDO_ALIAS[head] ? [SIDO_ALIAS[head]] : null))
      .find((v): v is string[] => v !== null);

    const byCoord =
      (sidoHint ? this.fromCoord(lat, lng, 30, sidoHint) : null) ?? this.fromCoord(lat, lng);
    return byCoord ? { hit: byCoord, source: "좌표추정" } : r;
  }

  /** 좌표 추정용 기준점. 주소로 이미 확정된 장소들을 그대로 쓴다. */
  private refPoints: { lat: number; lng: number; hit: RegionHit }[] = [];

  /**
   * 좌표 추정의 기준점을 심는다.
   *
   * 행정구역이 개편되면 새 이름은 옛 코드표에 없다 (인천 제물포구·영종구·서해구 등).
   * 이런 곳도 좌표는 멀쩡하므로, **주소로 이미 확정된 장소 중 가장 가까운 것**의
   * 시군구를 빌려온다. 개편 내용을 하드코딩하지 않아도 되고, 다음 개편에도 버틴다.
   */
  seedSpatial(points: { lat: number | null; lng: number | null; hit: RegionHit }[]): void {
    this.refPoints = points.filter(
      (p): p is { lat: number; lng: number; hit: RegionHit } =>
        typeof p.lat === "number" && typeof p.lng === "number",
    );
  }

  /**
   * 가장 가까운 기준점의 시군구를 돌려준다.
   * `maxKm` 를 넘으면 null — 엉뚱한 곳에 억지로 붙이지 않는다.
   */
  fromCoord(
    lat: number | null,
    lng: number | null,
    maxKm = 30,
    withinSido?: string[],
  ): RegionHit | null {
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    if (this.refPoints.length === 0) return null;

    // 위경도 1도의 실제 거리 차이를 보정한다. 이 위도대에서 경도 1도는 약 88km.
    const kmPerLat = 111.32;
    const kmPerLng = 111.32 * Math.cos((lat * Math.PI) / 180);

    let best: RegionHit | null = null;
    let bestSq = Infinity;
    for (const p of this.refPoints) {
      // 시도를 아는 경우엔 그 안에서만 찾는다. 인천 검단구를 바로 옆 김포시로 보내지 않으려고.
      if (withinSido && !withinSido.includes(p.hit.sido)) continue;
      const dy = (p.lat - lat) * kmPerLat;
      const dx = (p.lng - lng) * kmPerLng;
      const sq = dx * dx + dy * dy;
      if (sq < bestSq) {
        bestSq = sq;
        best = p.hit;
      }
    }
    return Math.sqrt(bestSq) <= maxKm ? best : null;
  }

  isDeclining(hit: RegionHit | null): boolean {
    if (!hit) return false;
    return this.decliningKeys.has(`${hit.area_code}-${hit.sigungu_code}`);
  }
}
