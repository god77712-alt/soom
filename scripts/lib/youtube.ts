/**
 * YouTube Data API v3 접근층.
 *
 * ── 이 파일의 존재 이유는 쿼터다 ──────────────────────────
 * 기본 한도가 하루 10,000 units 인데 `search.list` 한 번이 **100 units** 다.
 * 즉 검색만 하면 하루 100번이 끝이다. 반면 다른 호출은 대부분 1 unit 이다.
 *
 *   search.list          100      ← 이것만 비싸다
 *   videos.list            1      (id 50개 묶음)
 *   playlistItems.list     1      (50개 묶음)
 *   channels.list          1
 *   commentThreads.list    1
 *
 * → **채널 분석은 search 를 쓰지 않는다.** 업로드 재생목록을 타면 3 units 로 끝난다.
 *   search 로 하면 같은 일이 100 units 다. 33배 차이다.
 *
 * ── 소비량을 DB 에 적는다 ────────────────────────────────
 * 프로세스가 기억하면 재실행할 때마다 0 부터 세서 한도를 넘긴다.
 * 쿼터 초과는 403 으로 오는데, 넘긴 뒤에는 그날 아무것도 못 한다.
 * → 날짜별 누계를 표에 남기고, 호출 **전에** 남은 양을 확인한다.
 *
 * ⚠️ 쿼터는 태평양 시간 자정에 초기화된다. 한국 시간이 아니다.
 */
import type { DatabaseSync } from "node:sqlite";

const API = "https://www.googleapis.com/youtube/v3";

/** 오퍼레이션당 비용(units). 공식 문서 기준. */
export const COST = {
  search: 100,
  videos: 1,
  playlistItems: 1,
  channels: 1,
  commentThreads: 1,
} as const;

export type Op = keyof typeof COST;

/** 개발 기본 한도. 상향 승인되면 .env 의 YOUTUBE_DAILY_QUOTA 로 올린다. */
export const DAILY_QUOTA = Number(process.env.YOUTUBE_DAILY_QUOTA ?? 10000);

/** 쿼터 리셋은 태평양 시간 자정 기준이다. 그 기준의 '오늘'을 구한다. */
export function quotaDay(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export class Quota {
  private used: number;

  constructor(private db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS yt_quota (
        day        TEXT PRIMARY KEY,   -- 태평양 시간 기준 날짜
        units      INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
    this.used = (
      (db.prepare("select units from yt_quota where day = ?").get(quotaDay()) as
        | { units: number }
        | undefined) ?? { units: 0 }
    ).units;
  }

  get spent(): number {
    return this.used;
  }
  get left(): number {
    return DAILY_QUOTA - this.used;
  }

  /** 이 호출을 할 여유가 있는가. 없으면 호출자가 멈춰야 한다. */
  canAfford(op: Op, times = 1): boolean {
    return this.left >= COST[op] * times;
  }

  charge(op: Op, times = 1): void {
    this.used += COST[op] * times;
    this.db
      .prepare(
        `INSERT INTO yt_quota (day, units, updated_at) VALUES (?,?,?)
         ON CONFLICT(day) DO UPDATE SET units = excluded.units, updated_at = excluded.updated_at`,
      )
      .run(quotaDay(), this.used, new Date().toISOString());
  }
}

export class QuotaExceeded extends Error {
  constructor(op: Op) {
    super(`쿼터 부족: ${op} (${COST[op]} units) 를 할 여유가 없습니다`);
    this.name = "QuotaExceeded";
  }
}

export type ApiResult<T> = {
  items: T[];
  nextPageToken?: string;
  pageInfo?: { totalResults: number };
};

/**
 * API 호출 한 번.
 *
 * 403 은 두 가지 뜻이라 구분해야 한다:
 *   quotaExceeded    → 오늘은 끝. 멈춘다
 *   forbidden 그 외  → 키·권한 문제. 재시도해도 소용없다
 */
export async function call<T>(
  quota: Quota,
  op: Op,
  params: Record<string, string | number>,
): Promise<ApiResult<T>> {
  if (!quota.canAfford(op)) throw new QuotaExceeded(op);

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY 가 없습니다");

  const qs = new URLSearchParams({ key, ...Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ) });

  const res = await fetch(`${API}/${op}?${qs}`);
  // 응답이 오면 쿼터는 이미 소비됐다. 성공 여부와 무관하게 기록한다.
  quota.charge(op);

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    const reason = body.error?.errors?.[0]?.reason ?? String(res.status);
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new QuotaExceeded(op);
    }
    throw new Error(`${op} 실패 [${reason}] ${body.error?.message ?? ""}`.trim());
  }

  return (await res.json()) as ApiResult<T>;
}

// ═══════════════════════════════════════════════════════
//  파생 정보
// ═══════════════════════════════════════════════════════

/**
 * 설명란의 타임스탬프 목록을 챕터로 뽑는다.
 *
 * 여행 브이로그 절반쯤이 `00:00 순창 / 08:12 남원` 형태로 적어 둔다.
 * 이건 **자막보다 정확하다** — 요약은 지명을 뭉개지만 챕터는 순서까지 남는다.
 * (자막은 애초에 못 받는다. captions.download 는 영상 소유자만 호출할 수 있다)
 */
export function parseChapters(description: string): { at: number; title: string }[] {
  const out: { at: number; title: string }[] = [];
  const re = /^\s*\(?(\d{1,2}):(\d{2})(?::(\d{2}))?\)?\s*[-–—.|)\]]?\s*(.+?)\s*$/gm;

  for (const m of description.matchAll(re)) {
    const [, a, b, c, title] = m;
    // 2단(mm:ss) 과 3단(hh:mm:ss) 을 구분한다
    const at = c ? +a * 3600 + +b * 60 + +c : +a * 60 + +b;
    const clean = title.replace(/^[-–—:|)\]\s]+/, "").trim();
    if (clean.length >= 2 && clean.length <= 80) out.push({ at, title: clean });
  }

  // 첫 항목이 0초 근처에서 시작하고 3개 이상이어야 챕터로 인정한다.
  // 안 그러면 "3:1 로 이겼다" 같은 문장이 챕터로 잡힌다.
  if (out.length < 3 || out[0].at > 60) return [];
  return out;
}

/** ISO 8601 재생시간(PT1H2M3S) → 초 */
export function parseDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (+(d ?? 0) * 86400) + (+(h ?? 0) * 3600) + (+(mi ?? 0) * 60) + +(s ?? 0);
}

/**
 * 언어 판정.
 *
 * ⚠️ 언어별 점수판을 나누는 기준이라 여기가 틀리면 6단계가 통째로 틀어진다
 *    (재래시장: 영어권 4.1배 / 한국어권 0.6배 — 섞이면 둘 다 평균으로 수렴한다).
 * 제목만 보면 "Korea Vlog" 같은 한국 채널을 영어로 오판하므로 설명란까지 함께 본다.
 */
export function detectLanguage(title: string, description: string): "ko" | "en" {
  const text = `${title}\n${description.slice(0, 500)}`;
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (hangul === 0) return "en";
  return hangul * 3 >= latin ? "ko" : "en";
}

/** SPEC 4장 구독자 구간. 점수판을 이 단위로 나눈다. */
export function subBand(subscribers: number): string {
  if (subscribers < 1_000) return "u1k";
  if (subscribers < 10_000) return "1k_10k";
  if (subscribers < 100_000) return "10k_100k";
  if (subscribers < 1_000_000) return "100k_1m";
  return "o1m";
}

/** 채널 URL·핸들·ID 중 무엇을 넣어도 받아낸다. */
export function parseChannelInput(input: string): { kind: "id" | "handle"; value: string } {
  const s = input.trim();
  const byUrl = /youtube\.com\/(?:channel\/(UC[\w-]{20,})|@([\w.-]+))/i.exec(s);
  if (byUrl?.[1]) return { kind: "id", value: byUrl[1] };
  if (byUrl?.[2]) return { kind: "handle", value: byUrl[2] };
  if (/^UC[\w-]{20,}$/.test(s)) return { kind: "id", value: s };
  return { kind: "handle", value: s.replace(/^@/, "") };
}
