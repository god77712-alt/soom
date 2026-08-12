/**
 * 2단계-B · 중복 정리.
 *
 * 두 가지를 한다.
 *   ① 교차 연결 — 전통시장·폐교·철도역이 TourAPI 에 이미 있는지 찾아 잇는다.
 *   ② 내부 중복 — TourAPI 안에서 같은 곳이 두 번 들어간 경우를 찾는다.
 *
 * 왜 지워버리지 않는가:
 *   정선 5일장은 TourAPI 에도 있고 전통시장 표준데이터에도 있다. 어느 쪽도 버릴 수 없다.
 *   TourAPI 에는 소개글(태그 원료)이 있고, 표준데이터에는 장날·점포수가 있다.
 *   → 지우는 게 아니라 **잇는다.** place_link 에 짝을 남기고 원본은 둘 다 둔다.
 *
 * 실행: npm run dedup
 */
import { openDb, nowIso } from "./lib/db";
import {
  distanceMeters,
  bestNameSimilarity,
  fullNameSimilarity,
  normalizeName,
} from "./lib/match";

/** 같은 곳으로 볼 조건. 거리와 이름을 항상 함께 본다. */
const RULES = {
  /** 코앞이면 이름이 좀 달라도 같은 곳으로 본다 ("정선역" / "정선아리랑역") */
  near: { meters: 300, sim: 0.45 },
  /** 좀 떨어져 있으면 이름이 거의 같아야 한다 (시장 입구 좌표가 어긋나는 경우) */
  far: { meters: 1500, sim: 0.8 },
  /** 좌표가 아예 없으면(폐교) 같은 시군구 + 이름만으로 판정한다 */
  noCoord: { sim: 0.8 },
  /** TourAPI 내부 중복. 잘못 묶으면 한 곳이 통째로 사라지므로 가장 엄하다 */
  internal: { meters: 100, sim: 0.9, lengthRatio: 0.75 },
};

/** 후보를 좁히는 격자 크기(도). 0.02 도 ≈ 2.2km — far 규칙 1.5km 를 덮는다. */
const GRID = 0.02;

const db = openDb();
const now = nowIso();

db.exec(`
  CREATE TABLE IF NOT EXISTS place_link (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,      -- market | school | station | tour
    source_id    TEXT NOT NULL,
    content_id   TEXT NOT NULL,
    distance_m   REAL,
    name_sim     REAL NOT NULL,
    method       TEXT NOT NULL,      -- near | far | noCoord
    linked_at    TEXT NOT NULL,
    UNIQUE (source, source_id, content_id)
  );
  CREATE INDEX IF NOT EXISTS idx_place_link_content ON place_link (content_id);
`);
db.exec("DELETE FROM place_link");

const insLink = db.prepare(`
  INSERT OR IGNORE INTO place_link
    (source, source_id, content_id, distance_m, name_sim, method, linked_at)
  VALUES (?,?,?,?,?,?,?)
`);

// ── TourAPI 장소를 격자와 시군구로 색인해 둔다 ─────────────
type Place = {
  content_id: string;
  title: string;
  content_type_id: number;
  lat: number | null;
  lng: number | null;
  area_code: string | null;
  sigungu_code: string | null;
};

const places = db
  .prepare(
    `select content_id, title, content_type_id, lat, lng, area_code, sigungu_code from tour_place`,
  )
  .all() as Place[];

const byGrid = new Map<string, Place[]>();
const bySigungu = new Map<string, Place[]>();

const gridKey = (lat: number, lng: number) =>
  `${Math.floor(lat / GRID)}:${Math.floor(lng / GRID)}`;

for (const p of places) {
  if (p.lat !== null && p.lng !== null) {
    const k = gridKey(p.lat, p.lng);
    (byGrid.get(k) ?? byGrid.set(k, []).get(k)!).push(p);
  }
  if (p.area_code && p.sigungu_code) {
    const k = `${p.area_code}-${p.sigungu_code}`;
    (bySigungu.get(k) ?? bySigungu.set(k, []).get(k)!).push(p);
  }
}

/** 격자 3x3 을 모아 후보로 준다. 경계에 걸친 짝을 놓치지 않으려고. */
function nearbyPlaces(lat: number, lng: number): Place[] {
  const gx = Math.floor(lat / GRID);
  const gy = Math.floor(lng / GRID);
  const out: Place[] = [];
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) out.push(...(byGrid.get(`${gx + i}:${gy + j}`) ?? []));
  return out;
}

type Candidate = { place: Place; dist: number | null; sim: number; method: string };

/**
 * 콘텐츠 타입 조건.
 *
 * ⚠️ 축제공연행사(15)는 **장소가 아니라 행사다.** 빼지 않으면
 *    "정선아리랑시장" 이 359m 떨어진 "정선아리랑제"(축제)에 붙는다.
 *    이름이 비슷해서 유사도가 오히려 진짜 짝보다 높게 나온다.
 *
 * prefer 에 든 타입은 점수를 얹어, 같은 거리면 제 종류를 먼저 고르게 한다.
 */
const TYPE_RULES: Record<string, { exclude: number[]; prefer: number[] }> = {
  //                    축제 제외        쇼핑을 먼저
  market: { exclude: [15], prefer: [38] },
  //                    축제 제외        관광지·문화시설
  school: { exclude: [15], prefer: [12, 14] },
  station: { exclude: [15], prefer: [12, 14] },
};
const PREFER_BONUS = 0.15;

/** 가장 그럴듯한 짝 하나. 규칙에 못 미치면 null. */
function findMatch(
  name: string,
  lat: number | null,
  lng: number | null,
  areaCode: string | null,
  sigunguCode: string | null,
  rule: { exclude: number[]; prefer: number[] },
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  const scoreOf = (c: Candidate) =>
    c.sim -
    (c.dist ?? 0) / RULES.far.meters / 2 +
    (rule.prefer.includes(c.place.content_type_id) ? PREFER_BONUS : 0);

  if (lat !== null && lng !== null) {
    for (const p of nearbyPlaces(lat, lng)) {
      if (p.lat === null || p.lng === null) continue;
      if (rule.exclude.includes(p.content_type_id)) continue;
      const dist = distanceMeters(lat, lng, p.lat, p.lng);
      if (dist > RULES.far.meters) continue;

      const sim = bestNameSimilarity(name, p.title);
      const ok =
        (dist <= RULES.near.meters && sim >= RULES.near.sim) ||
        (dist <= RULES.far.meters && sim >= RULES.far.sim);
      if (!ok) continue;

      // 가까울수록·이름이 같을수록·제 종류일수록 좋다
      const cand: Candidate = {
        place: p,
        dist,
        sim,
        method: dist <= RULES.near.meters ? "near" : "far",
      };
      const score = scoreOf(cand);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (best) return best;
  }

  // 좌표가 없으면 같은 시군구 안에서 이름만 본다
  if (areaCode && sigunguCode) {
    for (const p of bySigungu.get(`${areaCode}-${sigunguCode}`) ?? []) {
      if (rule.exclude.includes(p.content_type_id)) continue;
      const sim = bestNameSimilarity(name, p.title);
      if (sim < RULES.noCoord.sim) continue;
      const cand: Candidate = { place: p, dist: null, sim, method: "noCoord" };
      const score = scoreOf(cand);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════
//  ① 교차 연결
// ═══════════════════════════════════════════════════════
type SourceSpec = {
  key: string;
  label: string;
  sql: string;
  /** 붙은 것 중 특별히 눈여겨볼 부분집합 (검증용) */
  highlight?: { sql: string; label: string };
};

const SOURCES: SourceSpec[] = [
  {
    key: "market",
    label: "전통시장",
    sql: `select id, name, lat, lng, area_code, sigungu_code, is_periodic from raw_market`,
    highlight: { sql: "is_periodic = 1", label: "정기장(장날 있음)" },
  },
  {
    key: "school",
    label: "폐교재산",
    sql: `select id, name, null as lat, null as lng, area_code, sigungu_code, usable from raw_school`,
    highlight: { sql: "usable = 1", label: "미활용" },
  },
  {
    key: "station",
    label: "철도역",
    sql: `select id, name, lat, lng, area_code, sigungu_code, is_small from raw_station`,
    highlight: { sql: "is_small = 1", label: "간이역급" },
  },
];

console.log("\n2단계-B · 중복 정리\n");
console.log("① 교차 연결 — 보강 데이터가 TourAPI 에 이미 있는가\n");

const samples: string[] = [];

for (const src of SOURCES) {
  const rows = db.prepare(src.sql).all() as Record<string, unknown>[];
  let matched = 0;
  const byMethod: Record<string, number> = {};

  for (const r of rows) {
    const hit = findMatch(
      String(r.name),
      r.lat as number | null,
      r.lng as number | null,
      r.area_code as string | null,
      r.sigungu_code as string | null,
      TYPE_RULES[src.key],
    );
    if (!hit) continue;

    matched++;
    byMethod[hit.method] = (byMethod[hit.method] ?? 0) + 1;
    insLink.run(
      src.key,
      String(r.id),
      hit.place.content_id,
      hit.dist,
      Number(hit.sim.toFixed(3)),
      hit.method,
      now,
    );

    if (samples.length < 12 && hit.sim < 0.95) {
      samples.push(
        `  ${src.label}  ${String(r.name).padEnd(22)} ↔ ${hit.place.title.padEnd(24)}` +
          `  ${hit.dist === null ? "좌표없음" : Math.round(hit.dist) + "m"}  유사도 ${hit.sim.toFixed(2)}`,
      );
    }
  }

  const pct = ((matched / rows.length) * 100).toFixed(1);
  console.log(
    `  ${src.label.padEnd(6)} ${String(rows.length).padStart(5)}건 중 ${String(matched).padStart(4)}건 연결 (${pct}%)  ` +
      Object.entries(byMethod)
        .map(([k, v]) => `${k} ${v}`)
        .join(" · "),
  );

  if (src.highlight) {
    const total = (
      db.prepare(`select count(*) c from raw_${src.key} where ${src.highlight.sql}`).get() as {
        c: number;
      }
    ).c;
    const linked = (
      db
        .prepare(
          `select count(*) c from raw_${src.key} r
             join place_link l on l.source = ? and l.source_id = cast(r.id as text)
            where ${src.highlight.sql}`,
        )
        .get(src.key) as { c: number }
    ).c;
    console.log(
      `           └ ${src.highlight.label} ${total}건 중 ${linked}건이 TourAPI 에도 있음 (나머지 ${total - linked}건은 우리만 가진 소재)`,
    );
  }
}

if (samples.length) {
  console.log("\n  붙은 예시 (이름이 다른 것만):");
  console.log(samples.join("\n"));
}

// ═══════════════════════════════════════════════════════
//  ② TourAPI 내부 중복
// ═══════════════════════════════════════════════════════
console.log("\n② 내부 중복 — TourAPI 안에서 같은 곳이 두 번\n");

let dupPairs = 0;
const seen = new Set<string>();
const dupSamples: string[] = [];

for (const p of places) {
  if (p.lat === null || p.lng === null) continue;
  for (const q of nearbyPlaces(p.lat, p.lng)) {
    if (q.content_id === p.content_id) continue;
    if (q.lat === null || q.lng === null) continue;

    const pairKey =
      p.content_id < q.content_id
        ? `${p.content_id}|${q.content_id}`
        : `${q.content_id}|${p.content_id}`;
    if (seen.has(pairKey)) continue;

    const dist = distanceMeters(p.lat, p.lng, q.lat, q.lng);
    if (dist > RULES.internal.meters) continue;
    /**
     * 내부 중복은 **정밀도가 재현율보다 중요하다.**
     * 다른 두 곳을 하나로 묶으면 추천에서 한 곳이 통째로 사라진다.
     * 반면 못 묶으면 비슷한 게 두 번 보일 뿐이다.
     * → 별칭을 빼고 이름 전체끼리만 보고, 길이 차가 크면 버린다
     *   (한 건물에 든 백화점과 그 안 매장이 0.88 로 붙었었다).
     */
    const sim = fullNameSimilarity(p.title, q.title);
    if (sim < RULES.internal.sim) continue;
    const na = normalizeName(p.title);
    const nb = normalizeName(q.title);
    if (Math.min(na.length, nb.length) / Math.max(na.length, nb.length, 1) < RULES.internal.lengthRatio)
      continue;

    /**
     * 한쪽 이름이 다른 쪽 **뒤에 통째로 붙어 있으면** 입점 매장이지 중복이 아니다.
     * ("반스 롯데백화점 건대스타시티점" 은 "롯데백화점 건대스타시티점" 이 아니다)
     * 앞에 붙은 브랜드명이 곧 다른 가게라는 뜻이다.
     */
    const [shortN, longN] = na.length <= nb.length ? [na, nb] : [nb, na];
    if (shortN !== longN && longN.endsWith(shortN)) continue;

    seen.add(pairKey);
    dupPairs++;
    insLink.run("tour", p.content_id, q.content_id, dist, Number(sim.toFixed(3)), "near", now);
    if (dupSamples.length < 8) {
      dupSamples.push(
        `  ${p.title.padEnd(26)} ↔ ${q.title.padEnd(26)}  ${Math.round(dist)}m  유사도 ${sim.toFixed(2)}`,
      );
    }
  }
}

console.log(`  중복 의심 ${dupPairs.toLocaleString()}쌍`);
if (dupSamples.length) console.log(dupSamples.join("\n"));

db.prepare(
  `INSERT INTO collect_run (phase, scope, ok_count, fail_count, note, started_at, ended_at)
   VALUES ('dedup', 'cross+internal', ?, 0, ?, ?, ?)`,
).run(
  (db.prepare("select count(*) c from place_link").get() as { c: number }).c,
  `내부중복 ${dupPairs}쌍`,
  now,
  nowIso(),
);

console.log(`\n총 연결 ${(db.prepare("select count(*) c from place_link").get() as { c: number }).c.toLocaleString()}건 → place_link\n`);
