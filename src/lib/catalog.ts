/**
 * 소재별 촬영 가능 장소 **목록**.
 *
 * ── 이 파일이 존재하는 이유 ──────────────────────────────
 * 서비스의 어필을 예측에서 목록으로 옮겼다.
 *
 *   (X) 여기 가면 잘 된다
 *   (O) 이 소재를 찍을 수 있는 곳은 이만큼 있다. 영상이 적던 곳도 선택지가 된다
 *
 * 예측은 근거가 약하다 — 소재 효과는 실재해도(p=0.0007) 채널이 74% 를 설명하고,
 * 개별 소재 쌍은 BH 보정을 하나도 통과 못 한다.
 * **목록은 근거가 필요 없다. 있으면 있는 것이다.**
 *
 * `repo.ts` 와 달리 여기는 처음부터 실데이터만 읽는다 (`npm run export:places`).
 * 시연 데이터로 폴백하지 않는다 — 목록에 가짜를 섞으면 "몇 곳 있다"는
 * 이 화면의 유일한 주장이 무너진다.
 */
import PLACES_JSON from "@/data/real/places.json";

export interface CatalogPlace {
  id: string;
  name: string;
  sido: string;
  sigungu: string;
  addr: string | null;
  lat: number;
  lng: number;
  declining: boolean;
  image: string | null;
  /** 폐교·간이역은 현장이 자주 바뀐다 (SPEC 9장) */
  low_reliability: boolean;
  /** 좌표가 읍면·시군구 중심 추정값이다. 실제 위치와 km 단위로 다를 수 있다 */
  coord_estimated: boolean;
}

export interface Subject {
  slug: string;
  /** 관광공사 소분류명 그대로 */
  tag: string;
  /** 화면에 쓰는 이름 (`5일장` → `오일장`) */
  label: string;
  /** 전국 실제 총계 */
  total: number;
  declining: number;
  sigungu_count: number;
  /** 이 소재로 수집한 영상 수 */
  video_count: number;
  /** 표본이 100편 이상이라 배수를 숫자로 써도 되는가 */
  can_show_multiplier: boolean;
  /** 화면에 담은 장소 (전량이 아니다 — total 과 다르다) */
  places: CatalogPlace[];
}

export const SUBJECTS = PLACES_JSON as Subject[];

export function getSubject(slug: string): Subject | null {
  return SUBJECTS.find((s) => s.slug === slug) ?? null;
}

export interface RegionChip {
  sido: string;
  count: number;
  declining: number;
}

/**
 * 시도 칩 — **장소가 실제로 있는 시도만.**
 *
 * ⚠️ 17개 시도를 하드코딩해서 뿌리면 안 된다. 실측(`report:grid`)에서
 *    소재 × 시군구는 절반이 0곳, 시도로 올려도 소재당 평균 11개만 5곳을 채운다.
 *    없는 칩을 그려두면 눌렀을 때 빈 화면이 나오고, 크리에이터는
 *    "데이터가 없구나" 하고 이탈한다 — 실제로는 옆 지역에 있는데도.
 *
 * 시군구 칩은 아예 안 만든다. 1곳짜리가 절반이라 목록이 성립하지 않는다.
 */
export function regionChips(subject: Subject): RegionChip[] {
  const m = new Map<string, RegionChip>();
  for (const p of subject.places) {
    const cur = m.get(p.sido) ?? { sido: p.sido, count: 0, declining: 0 };
    cur.count++;
    if (p.declining) cur.declining++;
    m.set(p.sido, cur);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export interface CatalogFilter {
  /** null 이면 전국 */
  sido?: string | null;
  /** 인구감소지역만 */
  decliningOnly?: boolean;
}

export function filterPlaces(subject: Subject, f: CatalogFilter): CatalogPlace[] {
  return subject.places.filter(
    (p) => (!f.sido || p.sido === f.sido) && (!f.decliningOnly || p.declining),
  );
}

/** 시도 이름을 칩에 짧게 (`전라남도` → `전남`) */
export function shortSido(sido: string): string {
  return sido
    .replace(/특별자치도|특별자치시|특별시|광역시|도$/g, "")
    .replace(/^(강원|전북|제주)$/, "$1")
    .replace("경상남", "경남")
    .replace("경상북", "경북")
    .replace("전라남", "전남")
    .replace("전라북", "전북")
    .replace("충청남", "충남")
    .replace("충청북", "충북");
}
