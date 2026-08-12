/**
 * SQLite 접근층 (1단계~6단계 수집 스크립트 공용).
 *
 * Node 24 내장 `node:sqlite` 를 쓴다. better-sqlite3 같은 네이티브 모듈을 넣지 않는 이유는
 * 공모전 심사에서 `npm install` 이 컴파일러 없이 끝나야 하기 때문이다.
 *
 * ⚠️ 여기 테이블은 **TourAPI 원문을 그대로 받는 자리**다. SPEC 3장의 `places` 가 아니다.
 *    원문을 먼저 그대로 쌓아두고, 2단계에서 병합·중복정리를 거쳐 places 를 만든다.
 *    수집과 가공을 한 테이블에서 하면 재수집할 때마다 가공 결과가 날아간다.
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/soom.db";

export function openDb(path: string = DB_PATH): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);

  // 수집 중 전원이 나가도 DB 가 깨지지 않게. 쓰기가 많은 작업이라 WAL 이 유리하다.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");

  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    -- ── 지역코드 ──────────────────────────────────────────
    -- areacode/sigungucode 는 숫자라서 이 표가 없으면 "전남 곡성군"을 만들 수 없다.
    CREATE TABLE IF NOT EXISTS area_code (
      code       TEXT PRIMARY KEY,
      name       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sigungu_code (
      area_code  TEXT NOT NULL,
      code       TEXT NOT NULL,
      name       TEXT NOT NULL,
      PRIMARY KEY (area_code, code)
    );

    -- ── 인구감소지역 (행정안전부 고시 89곳) ───────────────
    -- ★ 공모전 주제의 근거. 다만 **점수 가산점으로 쓰지 않는다** (SPEC 11장).
    --   희소성 가중치만으로 자연히 올라와야 "우리가 편애한 게 아니라 데이터가 그렇다"가 된다.
    --   여기 표는 화면 뱃지와 S5 어드민 집계에만 쓴다.
    CREATE TABLE IF NOT EXISTS declining_area (
      area_code    TEXT NOT NULL,
      sigungu_code TEXT NOT NULL,
      sido         TEXT NOT NULL,
      sigungu      TEXT NOT NULL,
      PRIMARY KEY (area_code, sigungu_code)
    );

    -- ── 국문 장소 원문 (KorService2 areaBasedList2) ───────
    CREATE TABLE IF NOT EXISTS tour_place (
      content_id      TEXT PRIMARY KEY,
      content_type_id INTEGER,
      title           TEXT NOT NULL,
      addr1           TEXT,
      addr2           TEXT,
      area_code       TEXT,
      sigungu_code    TEXT,
      cat1            TEXT,
      cat2            TEXT,
      cat3            TEXT,
      lat             REAL,
      lng             REAL,
      first_image     TEXT,
      first_image2    TEXT,
      tel             TEXT,
      created_time    TEXT,
      modified_time   TEXT,
      fetched_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tour_place_area
      ON tour_place (area_code, sigungu_code);
    CREATE INDEX IF NOT EXISTS idx_tour_place_type
      ON tour_place (content_type_id);

    -- ── 영문 장소 원문 (EngService2) ──────────────────────
    -- 국문의 31% 밖에 없다. 없는 곳은 2단계에서 로마자 변환으로 채운다.
    CREATE TABLE IF NOT EXISTS tour_place_en (
      content_id      TEXT PRIMARY KEY,
      content_type_id INTEGER,
      title           TEXT NOT NULL,
      addr1           TEXT,
      area_code       TEXT,
      sigungu_code    TEXT,
      lat             REAL,
      lng             REAL,
      first_image     TEXT,
      fetched_at      TEXT NOT NULL
    );

    -- ── 소개글 (detailCommon2) ────────────────────────────
    -- ★ 4단계 LLM 태깅의 유일한 원료. 1단계 완료 판정이 이 표의 채움 비율이다.
    --   status 를 따로 두는 이유: "아직 안 받음"과 "받았는데 비어 있음"은 전혀 다르다.
    --   구분하지 않으면 재실행할 때마다 빈 곳을 영원히 다시 두드린다.
    CREATE TABLE IF NOT EXISTS tour_overview (
      content_id  TEXT PRIMARY KEY,
      overview    TEXT,
      homepage    TEXT,
      overview_en TEXT,
      status      TEXT NOT NULL,   -- ok | empty | fail
      fail_code   TEXT,
      fetched_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tour_overview_status
      ON tour_overview (status);

    -- ── 관광사진 갤러리 (PhotoGalleryService1) ────────────
    -- S4 "어떤 그림이 나오나"의 사진.
    -- ★ 부수입이 더 크다: photography_month 는 **계절 태그의 근거**이고,
    --   search_keyword 는 관광공사가 직접 붙인 태그라 3단계 태그 체계의 실제 재료다.
    --   ("청설모, 동물" 처럼 온다 — 우리가 머리로 지어낸 태그보다 믿을 만하다)
    CREATE TABLE IF NOT EXISTS tour_photo (
      gal_content_id       TEXT PRIMARY KEY,
      gal_content_type_id  TEXT,
      title                TEXT,
      image_url            TEXT,
      photography_month    TEXT,
      photography_location TEXT,
      photographer         TEXT,
      search_keyword       TEXT,
      created_time         TEXT,
      modified_time        TEXT,
      fetched_at           TEXT NOT NULL
    );

    -- ── 관광공모전 수상작 사진 (PhokoAwrdService) ─────────
    -- 상 받은 앵글 = 검증된 구도. 95건뿐이지만 keyword 에 계절·피사체가 붙어 있다.
    CREATE TABLE IF NOT EXISTS tour_award_photo (
      content_id    TEXT PRIMARY KEY,
      ko_title      TEXT,
      en_title      TEXT,
      region_code   TEXT,
      ko_film_site  TEXT,
      en_film_site  TEXT,
      film_day      TEXT,
      photographer  TEXT,
      prize         TEXT,
      ko_keyword    TEXT,
      en_keyword    TEXT,
      org_image     TEXT,
      thumb_image   TEXT,
      fetched_at    TEXT NOT NULL
    );

    -- ── 두루누비 걷기길 (Durunubi) ────────────────────────
    -- 이미 완성된 촬영 동선. 거리·소요시간·난이도가 있어 하루 일정에 넣을 수 있는지 판단된다.
    CREATE TABLE IF NOT EXISTS tour_course (
      crs_idx       TEXT PRIMARY KEY,
      route_idx     TEXT,
      name          TEXT,
      distance_km   REAL,
      duration_min  INTEGER,
      level         TEXT,
      cycle         TEXT,
      contents      TEXT,
      summary       TEXT,
      tour_info     TEXT,
      traveler_info TEXT,
      sigun         TEXT,
      brd_div       TEXT,
      gpx_path      TEXT,
      fetched_at    TEXT NOT NULL
    );

    -- ── 전통시장 표준데이터 (파일 적재) ───────────────────
    -- ★ open_cycle 이 "2일+7일" 형태로 들어온다. 장날을 LLM 으로 뽑을 필요가 없다.
    --   market_days 는 거기서 뽑은 끝자리 배열("2,7"). 상설장이면 빈 값이다.
    CREATE TABLE IF NOT EXISTS raw_market (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      market_type   TEXT,
      road_addr     TEXT,
      jibun_addr    TEXT,
      open_cycle    TEXT,
      market_days   TEXT,         -- "2,7" · 상설장이면 빈 문자열
      is_periodic   INTEGER NOT NULL DEFAULT 0,
      lat           REAL,
      lng           REAL,
      shop_count    INTEGER,
      items         TEXT,
      opened_year   TEXT,
      tel           TEXT,
      area_code     TEXT,
      sigungu_code  TEXT,
      sido          TEXT,
      sigungu       TEXT,
      region_source TEXT,         -- 원본 | 주소복원 | 미상
      is_declining  INTEGER NOT NULL DEFAULT 0,
      loaded_at     TEXT NOT NULL
    );

    -- ── 폐교재산 (파일 적재) ──────────────────────────────
    -- ⚠️ 상태 필터링이 필수다. '대부'·'자체활용'은 이미 남이 쓰고 있어 촬영이 안 된다.
    --   usable=1 은 '미활용'만. 나머지도 버리지 않고 남겨 근거로 쓴다.
    CREATE TABLE IF NOT EXISTS raw_school (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      office        TEXT,
      closed_year   TEXT,
      school_level  TEXT,
      use_status    TEXT,         -- 미활용 | 대부 | 자체활용
      usable        INTEGER NOT NULL DEFAULT 0,
      building_area REAL,
      land_area     REAL,
      road_addr     TEXT,
      jibun_addr    TEXT,
      area_code     TEXT,
      sigungu_code  TEXT,
      sido          TEXT,
      sigungu       TEXT,
      region_source TEXT,
      is_declining  INTEGER NOT NULL DEFAULT 0,
      loaded_at     TEXT NOT NULL
    );

    -- ── 철도역 (파일 적재) ────────────────────────────────
    -- ★ stop_count 가 핵심이다. 간이역은 "하루 몇 번 서는지"가 촬영 성패를 가른다.
    CREATE TABLE IF NOT EXISTS raw_station (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      addr          TEXT,
      grade         TEXT,
      lines         TEXT,
      stop_text     TEXT,         -- "여객열차 257회" 원문
      stop_count    INTEGER,      -- 거기서 뽑은 숫자
      is_small      INTEGER NOT NULL DEFAULT 0,
      duties        TEXT,
      branch        TEXT,
      lat           REAL,
      lng           REAL,
      area_code     TEXT,
      sigungu_code  TEXT,
      sido          TEXT,
      sigungu       TEXT,
      region_source TEXT,
      is_declining  INTEGER NOT NULL DEFAULT 0,
      loaded_at     TEXT NOT NULL
    );

    -- ── 수집 로그 ─────────────────────────────────────────
    -- 어느 구간을 언제 얼마나 받았는지. 쿼터가 마르면 여기를 보고 이어받는다.
    CREATE TABLE IF NOT EXISTS collect_run (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      phase       TEXT NOT NULL,
      scope       TEXT,
      ok_count    INTEGER NOT NULL DEFAULT 0,
      fail_count  INTEGER NOT NULL DEFAULT 0,
      note        TEXT,
      started_at  TEXT NOT NULL,
      ended_at    TEXT
    );
  `);
}

/** TourAPI 소개글은 HTML 이 섞여 온다. LLM 에 넣기 전에 태그를 걷어낸다. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** TourAPI 좌표는 문자열이고 가끔 빈 문자열이 온다. 숫자로 못 바꾸면 null. */
export function toCoord(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function nowIso(): string {
  return new Date().toISOString();
}
