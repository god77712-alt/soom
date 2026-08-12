/**
 * 2단계-C · 장소 마스터 생성 (SPEC 3장 `places`).
 *
 * ── 왜 필요한가 ────────────────────────────────────────
 * 3단계 태깅을 돌려보니 폐교·간이역이 9건밖에 안 붙었다.
 * 미활용 폐교 334곳이 **TourAPI 에 아예 없어서** 태그를 붙일 대상 자체가 없었다.
 * 하필 이게 이 서비스의 주력 소재다 — 경쟁 영상이 없는 게 아니라
 * 아무도 데이터로 만들지 않은 소재라서 값어치가 있는 것인데, 목록에 없으면 추천이 안 된다.
 *
 *   → TourAPI 에 없는 보강 데이터를 **자체 장소로 승격**해 한 표에 모은다.
 *     이미 이어둔 짝(place_link)은 승격하지 않는다. 같은 곳이 두 번 들어간다.
 *
 * ── data_reliability 를 반드시 남긴다 ──────────────────
 * 폐교·간이역은 현장 상태가 자주 바뀐다 (SPEC 9장: "공공데이터 기준, 현장 확인 권장").
 * 출처를 지우고 한 표에 섞으면 그 경고를 띄울 근거가 사라진다.
 *
 * 실행: npm run build:places   (dedup 이후에 돌릴 것)
 */
import { openDb, nowIso, stripHtml } from "./lib/db";
import { RegionResolver } from "./lib/region";

const db = openDb();
const now = nowIso();
const region = new RegionResolver(db);

db.exec(`
  CREATE TABLE IF NOT EXISTS place (
    id                TEXT PRIMARY KEY,
    source            TEXT NOT NULL,   -- tourapi | market | school | station
    source_id         TEXT NOT NULL,
    name_ko           TEXT NOT NULL,
    name_en           TEXT,
    description_ko    TEXT,
    description_en    TEXT,
    sido              TEXT,
    sigungu           TEXT,
    area_code         TEXT,
    sigungu_code      TEXT,
    region_source     TEXT,            -- 원본 | 주소복원 | 좌표추정 | 미상
    addr              TEXT,
    lat               REAL,
    lng               REAL,
    is_declining_area INTEGER NOT NULL DEFAULT 0,
    image_url         TEXT,
    content_type_id   INTEGER,
    /** high=tourapi | medium=market | low=school,station — 화면 경고 문구의 근거 */
    data_reliability  TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    UNIQUE (source, source_id)
  );
  CREATE INDEX IF NOT EXISTS idx_place_region ON place (area_code, sigungu_code);
  CREATE INDEX IF NOT EXISTS idx_place_source ON place (source);
`);
db.exec("DELETE FROM place");

const ins = db.prepare(`
  INSERT INTO place
    (id, source, source_id, name_ko, name_en, description_ko, description_en,
     sido, sigungu, area_code, sigungu_code, region_source, addr, lat, lng,
     is_declining_area, image_url, content_type_id, data_reliability, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

/** 이미 TourAPI 장소와 이어진 보강 데이터. 승격하면 중복이 된다. */
function linkedIds(source: string): Set<string> {
  return new Set(
    (
      db.prepare("select source_id from place_link where source = ?").all(source) as {
        source_id: string;
      }[]
    ).map((r) => String(r.source_id)),
  );
}

// ── 좌표 추정 기준점을 심는다 (신설 자치구 대응) ──────────
const tourRows = db
  .prepare(
    `select p.content_id, p.content_type_id, p.title, p.addr1, p.addr2,
            p.area_code, p.sigungu_code, p.lat, p.lng, p.first_image,
            o.overview, e.title AS title_en, e.addr1 AS addr_en
       from tour_place p
       left join tour_overview o  on o.content_id = p.content_id
       left join tour_place_en e  on e.content_id = p.content_id`,
  )
  .all() as {
  content_id: string;
  content_type_id: number;
  title: string;
  addr1: string | null;
  addr2: string | null;
  area_code: string | null;
  sigungu_code: string | null;
  lat: number | null;
  lng: number | null;
  first_image: string | null;
  overview: string | null;
  title_en: string | null;
  addr_en: string | null;
}[];

region.seedSpatial(
  tourRows
    .map((r) => ({
      lat: r.lat,
      lng: r.lng,
      hit: region.resolve(r.area_code, r.sigungu_code, r.addr1, r.addr2).hit,
    }))
    .filter((p): p is { lat: number | null; lng: number | null; hit: NonNullable<typeof p.hit> } =>
      Boolean(p.hit),
    ),
);

// ═══════════════════════════════════════════════════════
//  1. TourAPI — 기준이 되는 장소
// ═══════════════════════════════════════════════════════
let nTour = 0;
for (const r of tourRows) {
  const { hit, source } = region.resolveWithCoord(
    r.area_code,
    r.sigungu_code,
    r.lat,
    r.lng,
    r.addr1,
    r.addr2,
  );
  ins.run(
    `t${r.content_id}`,
    "tourapi",
    r.content_id,
    r.title,
    r.title_en,
    r.overview ? stripHtml(r.overview) : null,
    null,
    hit?.sido ?? null,
    hit?.sigungu ?? null,
    hit?.area_code ?? null,
    hit?.sigungu_code ?? null,
    source,
    r.addr1,
    r.lat,
    r.lng,
    region.isDeclining(hit) ? 1 : 0,
    r.first_image || null,
    r.content_type_id,
    "high",
    now,
  );
  nTour++;
}

// ═══════════════════════════════════════════════════════
//  2. 전통시장 — TourAPI 에 없는 것만
// ═══════════════════════════════════════════════════════
const linkedMarkets = linkedIds("market");
let nMarket = 0;
let nMarketPeriodic = 0;
for (const r of db
  .prepare(
    `select id, name, road_addr, jibun_addr, lat, lng, area_code, sigungu_code,
            sido, sigungu, region_source, is_declining, is_periodic
       from raw_market`,
  )
  .all() as Record<string, any>[]) {
  if (linkedMarkets.has(String(r.id))) continue;
  ins.run(
    `m${r.id}`,
    "market",
    String(r.id),
    r.name,
    null,
    null,
    null,
    r.sido,
    r.sigungu,
    r.area_code,
    r.sigungu_code,
    r.region_source,
    r.road_addr || r.jibun_addr,
    r.lat,
    r.lng,
    r.is_declining,
    null,
    38, // 쇼핑
    "medium",
    now,
  );
  nMarket++;
  if (r.is_periodic) nMarketPeriodic++;
}

// ═══════════════════════════════════════════════════════
//  3. 폐교 — 미활용만. 대부·자체활용은 이미 남이 쓰고 있다
// ═══════════════════════════════════════════════════════
const linkedSchools = linkedIds("school");
let nSchool = 0;
for (const r of db
  .prepare(
    `select id, name, road_addr, jibun_addr, area_code, sigungu_code,
            sido, sigungu, region_source, is_declining, closed_year, school_level
       from raw_school where usable = 1`,
  )
  .all() as Record<string, any>[]) {
  if (linkedSchools.has(String(r.id))) continue;
  ins.run(
    `s${r.id}`,
    "school",
    String(r.id),
    r.name,
    null,
    // 소개글이 없다. 지어내지 않고, 공공데이터에 있는 사실만 한 줄 남긴다.
    [r.closed_year ? `${r.closed_year}년 폐교` : null, r.school_level]
      .filter(Boolean)
      .join(" · ") || null,
    null,
    r.sido,
    r.sigungu,
    r.area_code,
    r.sigungu_code,
    r.region_source,
    r.road_addr || r.jibun_addr,
    null, // 폐교재산 표준데이터에는 좌표가 없다
    null,
    r.is_declining,
    null,
    null,
    "low",
    now,
  );
  nSchool++;
}

// ═══════════════════════════════════════════════════════
//  4. 간이역 — 정차 10회 이하만
// ═══════════════════════════════════════════════════════
const linkedStations = linkedIds("station");
let nStation = 0;
for (const r of db
  .prepare(
    `select id, name, addr, lat, lng, area_code, sigungu_code, sido, sigungu,
            region_source, is_declining, stop_text, lines
       from raw_station where is_small = 1`,
  )
  .all() as Record<string, any>[]) {
  if (linkedStations.has(String(r.id))) continue;
  ins.run(
    `r${r.id}`,
    "station",
    String(r.id),
    r.name,
    null,
    [r.lines, r.stop_text].filter(Boolean).join(" · ") || null,
    null,
    r.sido,
    r.sigungu,
    r.area_code,
    r.sigungu_code,
    r.region_source,
    r.addr,
    r.lat,
    r.lng,
    r.is_declining,
    null,
    null,
    "low",
    now,
  );
  nStation++;
}

// ═══════════════════════════════════════════════════════
const total = (db.prepare("select count(*) c from place").get() as { c: number }).c;
const declining = (
  db.prepare("select count(*) c from place where is_declining_area = 1").get() as { c: number }
).c;
const withDesc = (
  db.prepare("select count(*) c from place where description_ko is not null and description_ko <> ''").get() as {
    c: number;
  }
).c;
const noCoord = (db.prepare("select count(*) c from place where lat is null").get() as { c: number })
  .c;

db.prepare(
  `INSERT INTO collect_run (phase, scope, ok_count, fail_count, note, started_at, ended_at)
   VALUES ('build_places', 'master', ?, 0, ?, ?, ?)`,
).run(total, `승격 ${nMarket + nSchool + nStation}`, now, nowIso());

console.log(`
2단계-C · 장소 마스터

  TourAPI          ${nTour.toLocaleString()}  (high)
  전통시장 승격      ${nMarket.toLocaleString()}  (medium · 정기장 ${nMarketPeriodic})
  폐교 승격           ${nSchool}  (low · 미활용만)
  간이역 승격          ${nStation}  (low · 정차 10회 이하)
  ─────────────────────────────
  합계             ${total.toLocaleString()}

  인구감소지역 소재  ${declining.toLocaleString()}  (${((declining / total) * 100).toFixed(1)}%)
  소개글 있음       ${withDesc.toLocaleString()}
  좌표 없음          ${noCoord}  ← 폐교재산 표준데이터에 좌표가 없다. 주소로 채울 것
`);
