/**
 * TourAPI 호출 공통부.
 *
 * SPEC 2-1 경고: 오퍼레이션명이 버전별로 다르다(`searchKeyword2`, `areaBasedList2` 등).
 * 블로그 예제를 그대로 쓰면 404 가 난다. 그래서 진단 스크립트로 실제 이름을 먼저 확인한다.
 */

export const SERVICE_KEY = process.env.DATA_GO_KR_API_KEY ?? "";

if (!SERVICE_KEY) {
  console.error("DATA_GO_KR_API_KEY 가 비어 있습니다. .env 를 확인하세요.");
  process.exit(1);
}

/** 공공데이터포털 표준 응답 */
export interface TourApiResult<T = unknown> {
  ok: boolean;
  /** 성공 시 0000 */
  code: string;
  message: string;
  /** 전체 건수 */
  totalCount: number;
  items: T[];
  /** 진단용 원문 앞부분 */
  raw?: string;
}

const DELAY = Number(process.env.FETCH_DELAY_MS ?? 200);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 인증키는 디코딩 상태로 .env 에 저장하고, 여기서 URLSearchParams 가 인코딩한다.
 * 인코딩된 키를 넣으면 이중 인코딩되어 인증에 실패한다.
 */
export function buildUrl(
  endpoint: string,
  operation: string,
  params: Record<string, string | number> = {},
): string {
  const q = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    MobileOS: "ETC",
    MobileApp: "soom",
    _type: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  return `${endpoint}/${operation}?${q.toString()}`;
}

export async function callTourApi<T = unknown>(
  endpoint: string,
  operation: string,
  params: Record<string, string | number> = {},
): Promise<TourApiResult<T>> {
  await sleep(DELAY);

  let text: string;
  try {
    const res = await fetch(buildUrl(endpoint, operation, params), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    text = await res.text();
  } catch (e) {
    return {
      ok: false,
      code: "NETWORK",
      message: e instanceof Error ? e.message : String(e),
      totalCount: 0,
      items: [],
    };
  }

  // 인증 실패·잘못된 오퍼레이션은 JSON 이 아니라 XML 로 돌아온다.
  if (text.trimStart().startsWith("<")) {
    const code = text.match(/<returnReasonCode>(.*?)<\/returnReasonCode>/)?.[1]
      ?? text.match(/<resultCode>(.*?)<\/resultCode>/)?.[1]
      ?? "XML";
    const msg = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1]
      ?? text.match(/<errMsg>(.*?)<\/errMsg>/)?.[1]
      ?? text.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1]
      ?? "XML 응답";
    return { ok: false, code, message: msg, totalCount: 0, items: [], raw: text.slice(0, 300) };
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, code: "PARSE", message: "JSON 파싱 실패", totalCount: 0, items: [], raw: text.slice(0, 300) };
  }

  const header = json?.response?.header ?? {};
  const code = String(header.resultCode ?? "?");
  const message = String(header.resultMsg ?? "");
  if (code !== "0000") {
    return { ok: false, code, message, totalCount: 0, items: [], raw: text.slice(0, 300) };
  }

  const body = json?.response?.body ?? {};
  const rawItems = body?.items?.item;
  const items: T[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return { ok: true, code, message, totalCount: Number(body.totalCount ?? items.length), items };
}

/** 발급받은 서비스 목록 */
export const SERVICES = {
  kor: "https://apis.data.go.kr/B551011/KorService2",
  eng: "https://apis.data.go.kr/B551011/EngService2",
  photo: "https://apis.data.go.kr/B551011/PhotoGalleryService1",
  related: "https://apis.data.go.kr/B551011/TarRlteTarService1",
  award: "https://apis.data.go.kr/B551011/PhokoAwrdService",
  durunubi: "https://apis.data.go.kr/B551011/Durunubi",
  locgo: "https://apis.data.go.kr/B551011/LocgoHubTarService1",
  demand: "https://apis.data.go.kr/B551011/AreaTarResDemService",
  diversity: "https://apis.data.go.kr/B551011/AreaTarDivService",
} as const;
