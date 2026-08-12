/**
 * 출몰시각 수집 (한국천문연구원 RiseSetInfoService).
 *
 * ── 왜 필요한가 ──────────────────────────────────────────
 * S4 ⑤ "몇 시에 찍어야 하나" 의 근거다.
 * 등대·해안·산지는 시각이 결과를 좌우한다. "일출 05:46" 만으로는 부족하고,
 * **시민박명(골든아워)** 이 실제로 카메라를 드는 시간이다.
 *
 * ── 왜 매일이 아니라 주 1회인가 ──────────────────────────
 * 20지점 × 365일 = 7,300회. 개발계정 하루 1,000회로는 8일이 걸린다.
 * 일출 시각은 하루 1~2분씩 매끄럽게 움직이므로 **주 1회만 받고 사이를 보간**한다.
 *   20지점 × 53주 = 1,060회 → 이틀이면 끝난다.
 *   보간 오차는 ±2분 안쪽이다. 골든아워 안내에 충분하다.
 *
 * ⚠️ `location` 은 좌표가 아니라 지역명 문자열이다. 응답에 위경도가 함께 오므로
 *    장소 좌표에서 최근접 지점을 골라 쓴다 (`sunTimeFor`).
 * ⚠️ `getLCRiseSetInfo` 는 같은 파라미터로 빈 배열이 온다. `getAreaRiseSetInfo` 를 쓸 것.
 *
 * 실행: npm run collect:sunrise [-- --year 2026]
 */
import { openDb, nowIso } from "./lib/db";

const BASE = "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService";
const OP = "getAreaRiseSetInfo";

/**
 * 천문연이 받는 지역명. 20곳 전부 실호출로 확인했다.
 * 전국을 고르게 덮도록 골랐다 — 최북단 춘천/강릉부터 최남단 제주까지.
 */
const LOCATIONS = [
  "서울", "인천", "수원", "춘천", "강릉",
  "청주", "세종", "대전", "홍성", "안동",
  "포항", "대구", "울산", "부산", "창원",
  "전주", "광주", "무안", "목포", "제주",
];

const argv = process.argv.slice(2);
const argOf = (k: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const YEAR = Number(argOf("year") ?? new Date().getFullYear());
/** 연속 실패가 이만큼 쌓이면 멈춘다. 코드 파싱을 못 믿는 경우 대비 (TourAPI 에서 겪음) */
const MAX_FAIL_STREAK = 30;

const db = openDb();
db.exec(`
  CREATE TABLE IF NOT EXISTS sun_time (
    location   TEXT NOT NULL,
    locdate    TEXT NOT NULL,   -- YYYYMMDD
    sunrise    TEXT,            -- "0546" 형식
    sunset     TEXT,
    civilm     TEXT,            -- 시민박명 시작 = 아침 골든아워 시작
    civile     TEXT,            -- 시민박명 끝  = 저녁 골든아워 끝
    naute      TEXT,
    aste       TEXT,
    moonrise   TEXT,
    moonset    TEXT,
    lat        REAL,
    lng        REAL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (location, locdate)
  );
  CREATE INDEX IF NOT EXISTS idx_sun_time_date ON sun_time (locdate);
`);

const ins = db.prepare(`
  INSERT INTO sun_time (location, locdate, sunrise, sunset, civilm, civile,
                        naute, aste, moonrise, moonset, lat, lng, fetched_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(location, locdate) DO UPDATE SET
    sunrise = excluded.sunrise, sunset = excluded.sunset,
    civilm = excluded.civilm, civile = excluded.civile,
    fetched_at = excluded.fetched_at
`);

/** 주 1회. 1월 1일부터 7일 간격. */
function sampleDates(year: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(year, 0, 1));
  while (d.getUTCFullYear() === year) {
    out.push(
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`,
    );
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}>(.*?)</${name}>`));
  const v = m?.[1]?.trim();
  return v ? v : null;
};

async function main(): Promise<void> {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) {
    console.log("\nDATA_GO_KR_API_KEY 가 없습니다.\n");
    return;
  }

  const dates = sampleDates(YEAR);
  const todo: { loc: string; date: string }[] = [];
  const has = db.prepare("select 1 from sun_time where location=? and locdate=? and sunrise is not null");

  for (const date of dates) {
    for (const loc of LOCATIONS) {
      if (!has.get(loc, date)) todo.push({ loc, date });
    }
  }

  console.log(`\n출몰시각 수집 (${YEAR})\n`);
  console.log(`  지점 ${LOCATIONS.length} × 주 1회 ${dates.length}주 = ${(LOCATIONS.length * dates.length).toLocaleString()}건`);
  console.log(`  남은 것 ${todo.length.toLocaleString()}건\n`);
  if (todo.length === 0) {
    console.log("  받을 게 없습니다.\n");
    return;
  }

  let ok = 0;
  let fail = 0;
  let streak = 0;
  const started = nowIso();

  for (const t of todo) {
    const qs = new URLSearchParams({ serviceKey: key, locdate: t.date, location: t.loc });
    let xml: string;
    try {
      const r = await fetch(`${BASE}/${OP}?${qs}`);
      xml = await r.text();
    } catch {
      fail++;
      streak++;
      if (streak >= MAX_FAIL_STREAK) break;
      continue;
    }

    const code = tag(xml, "resultCode") ?? tag(xml, "returnReasonCode") ?? "?";
    if (code !== "00") {
      fail++;
      streak++;
      // 22 = 쿼터 초과. 더 두드려봐야 소용없다.
      if (code === "22" || code === "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR") {
        console.log(`\n  중단: 일일 한도 소진 [${code}]`);
        console.log(`  받은 만큼은 저장됨. 내일 같은 명령으로 이어받으세요.\n`);
        break;
      }
      if (streak >= MAX_FAIL_STREAK) {
        console.log(`\n  중단: 연속 실패 ${MAX_FAIL_STREAK}회 [${code}] ${tag(xml, "resultMsg") ?? ""}\n`);
        break;
      }
      continue;
    }
    streak = 0;

    ins.run(
      t.loc,
      t.date,
      tag(xml, "sunrise"),
      tag(xml, "sunset"),
      tag(xml, "civilm"),
      tag(xml, "civile"),
      tag(xml, "naute"),
      tag(xml, "aste"),
      tag(xml, "moonrise"),
      tag(xml, "moonset"),
      Number(tag(xml, "latitudeNum") ?? 0) || null,
      Number(tag(xml, "longitudeNum") ?? 0) || null,
      nowIso(),
    );
    ok++;
    if (ok % 100 === 0) console.log(`  ${ok} / ${todo.length}`);
  }

  db.prepare(
    `INSERT INTO collect_run (phase, scope, ok_count, fail_count, note, started_at, ended_at)
     VALUES ('sunrise', ?, ?, ?, ?, ?, ?)`,
  ).run(String(YEAR), ok, fail, `${LOCATIONS.length}지점 주1회`, started, nowIso());

  const total = (db.prepare("select count(*) c from sun_time").get() as { c: number }).c;
  console.log(`\n  받음 ${ok} · 실패 ${fail}`);
  console.log(`  누적 ${total.toLocaleString()}건\n`);

  for (const r of db
    .prepare(
      `select location, min(locdate) a, max(locdate) b, count(*) n
         from sun_time group by location order by location limit 4`,
    )
    .all() as { location: string; a: string; b: string; n: number }[]) {
    console.log(`  ${r.location.padEnd(4)} ${r.a}~${r.b}  ${r.n}건`);
  }
  console.log("");
}

main();
