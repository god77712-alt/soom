/**
 * 좌표 계산.
 *
 * 여기 있는 건 가짜 데이터가 아니라 진짜 계산이다. 0단계 30건 좌표로 돌려도 결과가 맞고,
 * 7단계에서 실제 4만 건이 들어와도 그대로 동작한다.
 *
 * 쓰는 곳
 *   · 근처 묶어 찍을 소재 찾기 (S4 ⑥)
 *   · 2단계 중복 판정 (좌표 300m 이내 + 이름 유사도)
 */

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이 직선거리 (km) */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * 직선거리 → 자동차 이동시간 어림값.
 *
 * 실제 값은 카카오맵 길찾기(온디맨드)로 대체된다. 여기는 그전까지 쓰는 근사치다.
 * 지방 국도 기준이라 직선거리의 1.4배를 실주행거리로 보고 평균 시속 55km 로 잡았다.
 * **어림값이라는 걸 화면에 반드시 밝힌다.**
 */
export function estimateDriveMinutes(straightKm: number): number {
  const roadKm = straightKm * 1.4;
  return Math.max(5, Math.round((roadKm / 55) * 60));
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
