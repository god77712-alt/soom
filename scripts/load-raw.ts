/**
 * 2단계-A · 보강 공공데이터 파일 적재 (전통시장 · 폐교재산 · 철도역).
 *
 * API 가 아니라 내려받은 파일을 읽는다. 쿼터와 무관하므로 언제든 다시 돌려도 된다.
 * 매 실행마다 해당 테이블을 비우고 다시 채운다 (파일이 원본이라 증분이 의미 없다).
 *
 * 실행: npm run load:raw
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { openDb, nowIso } from "./lib/db";
import { RegionResolver } from "./lib/region";

const RAW_DIR = "./data/raw";

/**
 * 파일 위치를 정한다.
 *
 * 표준데이터 파일명에는 내려받은 날짜가 붙는다 (`...표준데이터-20260811.xls`).
 * 다시 받으면 이름이 바뀌므로 .env 경로에만 의존하면 그때마다 깨진다.
 * → .env 경로가 실제로 있으면 그걸 쓰고, 없으면 폴더에서 키워드로 찾는다.
 */
function pick(envPath: string | undefined, ...keywords: string[]): string | null {
  if (envPath && existsSync(envPath)) return envPath;
  if (!existsSync(RAW_DIR)) return null;
  const hit = readdirSync(RAW_DIR)
    .filter((f) => keywords.every((k) => f.includes(k)))
    .sort()
    .pop();
  return hit ? join(RAW_DIR, hit) : null;
}

const MARKET_FILE = pick(process.env.RAW_MARKET_FILE, "전통시장");
const SCHOOL_FILE = pick(process.env.RAW_SCHOOL_FILE, "폐교");
const STATION_FILE = pick(process.env.RAW_STATION_FILE, "철도역");

const db = openDb();
const region = new RegionResolver(db);
const now = nowIso();

/**
 * 표준데이터 xls 는 첫 줄이 제목이고 둘째 줄이 헤더다.
 * range:1 로 한 줄 건너뛰지 않으면 열 이름이 전부 __EMPTY_n 이 된다.
 */
function readXls(path: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(path);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
    range: 1,
  }) as Record<string, unknown>[];
}

/** 국가철도공단 CSV 는 EUC-KR 이다. UTF-8 로 읽으면 전부 깨진다. */
function readEucKrCsv(path: string): Record<string, string>[] {
  const text = new TextDecoder("euc-kr").decode(readFileSync(path));
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h.trim()] = (cells[i] ?? "").trim()));
    return o;
  });
}

/** 역연혁 필드에 줄바꿈과 따옴표가 섞여 있어 split(',') 으로는 못 자른다. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v !== ""));
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

// ═══════════════════════════════════════════════════════
//  1. 전통시장
// ═══════════════════════════════════════════════════════
function loadMarkets(): void {
  if (!MARKET_FILE || !existsSync(MARKET_FILE)) {
    console.log(`  건너뜀 — 파일 없음: ${MARKET_FILE}`);
    return;
  }
  const rows = readXls(MARKET_FILE);
  db.exec("DELETE FROM raw_market");

  const ins = db.prepare(`
    INSERT INTO raw_market
      (name, market_type, road_addr, jibun_addr, open_cycle, market_days, is_periodic,
       lat, lng, shop_count, items, opened_year, tel,
       area_code, sigungu_code, sido, sigungu, region_source, is_declining, loaded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let periodic = 0;
  let declining = 0;
  let unknown = 0;

  for (const r of rows) {
    const name = str(r["시장명"]);
    if (!name) continue;

    const cycle = str(r["시장개설주기"]);
    // "2일+7일" → [2,7] · "매일" 이면 상설이라 장날이 없다
    const days = cycle.match(/(\d+)일/g)?.map((s) => s.replace("일", "")) ?? [];
    const isPeriodic = days.length > 0;
    if (isPeriodic) periodic++;

    const road = str(r["소재지도로명주소"]);
    const jibun = str(r["소재지지번주소"]);
    const { hit, source } = region.resolve(null, null, road, jibun);
    if (!hit) unknown++;
    const dec = region.isDeclining(hit);
    if (dec) declining++;

    ins.run(
      name,
      str(r["시장유형"]),
      road,
      jibun,
      cycle,
      days.join(","),
      isPeriodic ? 1 : 0,
      num(r["위도"]),
      num(r["경도"]),
      num(r["점포수"]),
      str(r["취급품목"]),
      str(r["개설연도"]),
      str(r["전화번호"]),
      hit?.area_code ?? null,
      hit?.sigungu_code ?? null,
      hit?.sido ?? null,
      hit?.sigungu ?? null,
      source,
      dec ? 1 : 0,
      now,
    );
  }

  console.log(`  전통시장   ${rows.length.toLocaleString()}건 적재`);
  console.log(
    `    정기장(장날 있음) ${periodic}  ·  상설장 ${rows.length - periodic}  ·  지역 미상 ${unknown}`,
  );
  console.log(`    인구감소지역 소재 ${declining}건`);
}

// ═══════════════════════════════════════════════════════
//  2. 폐교재산
// ═══════════════════════════════════════════════════════
function loadSchools(): void {
  if (!SCHOOL_FILE || !existsSync(SCHOOL_FILE)) {
    console.log(`  건너뜀 — 파일 없음: ${SCHOOL_FILE}`);
    return;
  }
  const rows = readXls(SCHOOL_FILE);
  db.exec("DELETE FROM raw_school");

  const ins = db.prepare(`
    INSERT INTO raw_school
      (name, office, closed_year, school_level, use_status, usable,
       building_area, land_area, road_addr, jibun_addr,
       area_code, sigungu_code, sido, sigungu, region_source, is_declining, loaded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const byStatus: Record<string, number> = {};
  let usableDeclining = 0;
  let unknown = 0;

  for (const r of rows) {
    const name = str(r["폐교명"]);
    if (!name) continue;

    const status = str(r["활용현황구분명"]);
    byStatus[status || "(빈값)"] = (byStatus[status || "(빈값)"] ?? 0) + 1;
    // '대부'·'자체활용'은 이미 남이 쓰고 있다. 촬영지로 제안할 수 있는 건 '미활용'뿐.
    const usable = status === "미활용";

    const road = str(r["소재지도로명주소"]);
    const jibun = str(r["소재지지번주소"]);
    // 폐교는 시도명·시군구명이 열로 들어 있어 그걸 먼저 쓴다
    const nameAddr = `${str(r["시도명"])} ${str(r["시군구명"])}`;
    const { hit, source } = region.resolve(null, null, nameAddr, road, jibun);
    if (!hit) unknown++;
    const dec = region.isDeclining(hit);
    if (usable && dec) usableDeclining++;

    ins.run(
      name,
      str(r["시도교육청명"]),
      str(r["폐교연도"]),
      str(r["학교급구분명"]),
      status,
      usable ? 1 : 0,
      num(r["건물연면적"]),
      num(r["대지"]),
      road,
      jibun,
      hit?.area_code ?? null,
      hit?.sigungu_code ?? null,
      hit?.sido ?? null,
      hit?.sigungu ?? null,
      source,
      dec ? 1 : 0,
      now,
    );
  }

  const usableCount = byStatus["미활용"] ?? 0;
  console.log(`  폐교재산   ${rows.length.toLocaleString()}건 적재`);
  console.log(
    `    ${Object.entries(byStatus)
      .map(([k, v]) => `${k} ${v}`)
      .join("  ·  ")}  ·  지역 미상 ${unknown}`,
  );
  console.log(`    촬영 가능(미활용) ${usableCount}건 중 인구감소지역 ${usableDeclining}건`);
}

// ═══════════════════════════════════════════════════════
//  3. 철도역
// ═══════════════════════════════════════════════════════
function loadStations(): void {
  if (!STATION_FILE || !existsSync(STATION_FILE)) {
    console.log(`  건너뜀 — 파일 없음: ${STATION_FILE}`);
    return;
  }
  const rows = readEucKrCsv(STATION_FILE);
  db.exec("DELETE FROM raw_station");

  const ins = db.prepare(`
    INSERT INTO raw_station
      (name, addr, grade, lines, stop_text, stop_count, is_small, duties, branch,
       lat, lng, area_code, sigungu_code, sido, sigungu, region_source, is_declining, loaded_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let small = 0;
  let declining = 0;
  let unknown = 0;

  for (const r of rows) {
    const name = str(r["역이름"]);
    if (!name) continue;

    const stopText = str(r["열차정차횟수"]);
    const stopCount = num(stopText.match(/(\d+)\s*회/)?.[1] ?? null);
    // 하루 정차 10회 이하면 사실상 간이역이다. 사람이 없어야 촬영이 된다.
    const isSmall = stopCount !== null && stopCount <= 10;
    if (isSmall) small++;

    const addr = str(r["주소"]);
    const { hit, source } = region.resolve(null, null, addr);
    if (!hit) unknown++;
    const dec = region.isDeclining(hit);
    if (dec) declining++;

    ins.run(
      name,
      addr,
      str(r["역등급"]),
      str(r["관련노선"]),
      stopText,
      stopCount,
      isSmall ? 1 : 0,
      str(r["취급업무"]),
      str(r["소속지사"]),
      num(r["위도좌표"]),
      num(r["경도좌표"]),
      hit?.area_code ?? null,
      hit?.sigungu_code ?? null,
      hit?.sido ?? null,
      hit?.sigungu ?? null,
      source,
      dec ? 1 : 0,
      now,
    );
  }

  console.log(`  철도역     ${rows.length.toLocaleString()}건 적재`);
  console.log(`    간이역급(정차 10회 이하) ${small}  ·  지역 미상 ${unknown}`);
  console.log(`    인구감소지역 소재 ${declining}건`);
}

console.log("\n2단계-A · 보강 데이터 파일 적재\n");
loadMarkets();
console.log("");
loadSchools();
console.log("");
loadStations();

const run = db.prepare(
  `INSERT INTO collect_run (phase, scope, ok_count, fail_count, note, started_at, ended_at)
   VALUES ('load_raw', 'file', ?, 0, ?, ?, ?)`,
);
const total =
  (db.prepare("select count(*) c from raw_market").get() as { c: number }).c +
  (db.prepare("select count(*) c from raw_school").get() as { c: number }).c +
  (db.prepare("select count(*) c from raw_station").get() as { c: number }).c;
run.run(total, "전통시장·폐교·철도역", now, nowIso());

console.log(`\n합계 ${total.toLocaleString()}건\n`);
