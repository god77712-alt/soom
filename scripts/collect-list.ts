/**
 * 1단계-A · TourAPI 장소 목록 전수 수집.
 *
 *   npm run collect:list
 *
 * 지역코드 → 국문 목록 → 영문 목록 순으로 받아 SQLite 에 쌓는다.
 * 여기서 받는 건 좌표·주소·분류·대표이미지까지다. **소개글은 여기 없다** —
 * 소개글은 contentId 당 1호출이라 규모가 100배라서 collect-overview.ts 로 분리했다.
 *
 * ⚠️ **시도(areaCode)로 나눠 돌면 안 된다.** 실측(2026-08-05):
 *
 *      필터 없음 전체      48,929
 *      콘텐츠 타입별 합계  48,929   ← 맞다
 *      시도별 합계         22,298   ← 절반이 사라진다
 *
 *    `areacode` 가 빈 항목이 대량으로 있다. 주소와 좌표는 멀쩡한데 지역코드만 안 붙어 있어서
 *    지역 필터에 안 걸린다. 그 안에 쇼핑(12,248)·음식점(13,518)이 들어 있고,
 *    **오일장·재래시장이 쇼핑이고 노포가 음식점**이라 이 서비스의 주력 소재가 통째로 빠진다.
 *
 *    그래서 콘텐츠 타입으로 나눠 돈다. 타입 하나당 최대 136페이지라 깊은 페이징 위험도 없다
 *    (p135 정상 동작 확인). 빈 지역코드는 2단계에서 주소·좌표로 채운다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";
import { nowIso, openDb, toCoord } from "./lib/db";

const PAGE_SIZE = 100;

/**
 * 콘텐츠 타입. 이 8개의 합이 전체와 정확히 일치한다 (48,929).
 *
 * 쇼핑·음식점을 빼고 싶어지겠지만 **빼면 안 된다.**
 * 오일장·재래시장이 쇼핑(38)이고 노포·국밥집이 음식점(39)이다. 숨의 주력 소재가 거기 있다.
 */
const CONTENT_TYPES: Array<{ id: string; name: string }> = [
  { id: "12", name: "관광지" },
  { id: "14", name: "문화시설" },
  { id: "15", name: "축제공연행사" },
  { id: "25", name: "여행코스" },
  { id: "28", name: "레포츠" },
  { id: "32", name: "숙박" },
  { id: "38", name: "쇼핑" },
  { id: "39", name: "음식점" },
];

/**
 * ⚠️ 영문 서비스는 **콘텐츠 타입 코드가 다르다.** 국문 코드(12·38·39…)를 넣으면 0건이 온다.
 *    실측 합계 15,108 로 전체와 정확히 일치한다 (레포츠 77 은 0건).
 *    두 서비스가 같은 코드를 쓸 거라고 가정하지 말 것.
 */
const CONTENT_TYPES_EN: Array<{ id: string; name: string }> = [
  { id: "76", name: "관광지" },
  { id: "78", name: "문화시설" },
  { id: "85", name: "축제공연행사" },
  { id: "75", name: "여행코스" },
  { id: "77", name: "레포츠" },
  { id: "80", name: "숙박" },
  { id: "79", name: "쇼핑" },
  { id: "82", name: "음식점" },
];

interface AreaItem {
  code: string;
  name: string;
  rnum?: number;
}

interface ListItem {
  contentid: string;
  contenttypeid?: string;
  title: string;
  addr1?: string;
  addr2?: string;
  areacode?: string;
  sigungucode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
  firstimage2?: string;
  tel?: string;
  createdtime?: string;
  modifiedtime?: string;
}

const db = openDb();

// ── 지역코드 ──────────────────────────────────────────────

async function collectAreaCodes(): Promise<AreaItem[]> {
  const sido = await callTourApi<AreaItem>(SERVICES.kor, "areaCode2", { numOfRows: 50 });
  if (!sido.ok) {
    console.error(`지역코드 실패 [${sido.code}] ${sido.message}`);
    process.exit(1);
  }

  const insSido = db.prepare("INSERT OR REPLACE INTO area_code (code, name) VALUES (?, ?)");
  const insSgg = db.prepare(
    "INSERT OR REPLACE INTO sigungu_code (area_code, code, name) VALUES (?, ?, ?)",
  );

  for (const a of sido.items) insSido.run(a.code, a.name);

  let sggCount = 0;
  for (const a of sido.items) {
    // areaCode 를 넘기면 그 시도의 시군구 목록이 온다
    const sgg = await callTourApi<AreaItem>(SERVICES.kor, "areaCode2", {
      areaCode: a.code,
      numOfRows: 100,
    });
    if (!sgg.ok) {
      console.log(`   ! ${a.name} 시군구 실패 [${sgg.code}] ${sgg.message}`);
      continue;
    }
    for (const s of sgg.items) insSgg.run(a.code, s.code, s.name);
    sggCount += sgg.items.length;
  }

  console.log(`지역코드  시도 ${sido.items.length} · 시군구 ${sggCount}`);
  return sido.items;
}

// ── 장소 목록 ─────────────────────────────────────────────

/**
 * 한 콘텐츠 타입의 목록을 끝까지 받는다.
 *
 * arrange=C(수정일순)를 쓰지 않고 A(제목순)를 쓴다. 수정일순은 수집 도중 원본이 바뀌면
 * 페이지 경계가 밀려서 빠지는 항목이 생긴다. 제목순은 그 사이에 안 바뀐다.
 */
async function collectType(
  service: string,
  typeId: string,
  typeName: string,
  onItems: (items: ListItem[]) => void,
): Promise<{ got: number; total: number; failed: boolean }> {
  let page = 1;
  let got = 0;
  let total = 0;

  while (true) {
    const r = await callTourApi<ListItem>(service, "areaBasedList2", {
      contentTypeId: typeId,
      numOfRows: PAGE_SIZE,
      pageNo: page,
      arrange: "A",
    });

    if (!r.ok) {
      console.log(`   ! ${typeName} p${page} 실패 [${r.code}] ${r.message}`);
      return { got, total, failed: true };
    }

    total = r.totalCount;
    if (r.items.length === 0) break;

    onItems(r.items);
    got += r.items.length;

    if (got >= total) break;
    page += 1;
  }

  return { got, total, failed: false };
}

async function collectKor(): Promise<void> {
  const ins = db.prepare(`
    INSERT INTO tour_place (
      content_id, content_type_id, title, addr1, addr2,
      area_code, sigungu_code, cat1, cat2, cat3,
      lat, lng, first_image, first_image2, tel,
      created_time, modified_time, fetched_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(content_id) DO UPDATE SET
      content_type_id = excluded.content_type_id,
      title           = excluded.title,
      addr1           = excluded.addr1,
      addr2           = excluded.addr2,
      area_code       = excluded.area_code,
      sigungu_code    = excluded.sigungu_code,
      cat1            = excluded.cat1,
      cat2            = excluded.cat2,
      cat3            = excluded.cat3,
      lat             = excluded.lat,
      lng             = excluded.lng,
      first_image     = excluded.first_image,
      first_image2    = excluded.first_image2,
      tel             = excluded.tel,
      created_time    = excluded.created_time,
      modified_time   = excluded.modified_time,
      fetched_at      = excluded.fetched_at
  `);

  const at = nowIso();
  let sum = 0;

  console.log("\n국문 장소 목록");
  for (const t of CONTENT_TYPES) {
    const { got, total, failed } = await collectType(SERVICES.kor, t.id, t.name, (items) => {
      // 페이지 단위 트랜잭션. 중간에 끊겨도 받은 페이지까지는 남는다.
      db.exec("BEGIN");
      try {
        for (const it of items) {
          if (!it.contentid) continue;
          ins.run(
            it.contentid,
            it.contenttypeid ? Number(it.contenttypeid) : Number(t.id),
            it.title ?? "",
            it.addr1 ?? null,
            it.addr2 ?? null,
            // 빈 문자열이 오는 경우가 많다. null 로 통일해야 2단계에서 채울 대상을 셀 수 있다.
            it.areacode || null,
            it.sigungucode || null,
            it.cat1 ?? null,
            it.cat2 ?? null,
            it.cat3 ?? null,
            toCoord(it.mapy), // mapy = 위도
            toCoord(it.mapx), // mapx = 경도
            it.firstimage ?? null,
            it.firstimage2 ?? null,
            it.tel ?? null,
            it.createdtime ?? null,
            it.modifiedtime ?? null,
            at,
          );
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    });

    sum += got;
    console.log(`  ${t.name.padEnd(7)} ${String(got).padStart(6)} / ${total}${failed ? "  (중단)" : ""}`);
  }

  console.log(`  ── 합계 ${sum}`);
}

async function collectEng(): Promise<void> {
  const ins = db.prepare(`
    INSERT INTO tour_place_en (
      content_id, content_type_id, title, addr1,
      area_code, sigungu_code, lat, lng, first_image, fetched_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(content_id) DO UPDATE SET
      content_type_id = excluded.content_type_id,
      title           = excluded.title,
      addr1           = excluded.addr1,
      area_code       = excluded.area_code,
      sigungu_code    = excluded.sigungu_code,
      lat             = excluded.lat,
      lng             = excluded.lng,
      first_image     = excluded.first_image,
      fetched_at      = excluded.fetched_at
  `);

  const at = nowIso();
  let sum = 0;

  console.log("\n영문 장소 목록");
  for (const t of CONTENT_TYPES_EN) {
    const { got, total, failed } = await collectType(SERVICES.eng, t.id, t.name, (items) => {
      db.exec("BEGIN");
      try {
        for (const it of items) {
          if (!it.contentid) continue;
          ins.run(
            it.contentid,
            it.contenttypeid ? Number(it.contenttypeid) : Number(t.id),
            it.title ?? "",
            it.addr1 ?? null,
            it.areacode || null,
            it.sigungucode || null,
            toCoord(it.mapy),
            toCoord(it.mapx),
            it.firstimage ?? null,
            at,
          );
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    });

    sum += got;
    console.log(`  ${t.name.padEnd(7)} ${String(got).padStart(6)} / ${total}${failed ? "  (중단)" : ""}`);
  }

  console.log(`  ── 합계 ${sum}`);
}

// ── 실행 ──────────────────────────────────────────────────

async function main() {
  const runId = db
    .prepare("INSERT INTO collect_run (phase, started_at) VALUES ('list', ?) RETURNING id")
    .get(nowIso()) as { id: number };

  const t0 = Date.now();
  console.log("1단계-A · TourAPI 목록 전수 수집\n");

  await collectAreaCodes();
  await collectKor();
  await collectEng();

  const ko = db.prepare("SELECT COUNT(*) AS n FROM tour_place").get() as { n: number };
  const en = db.prepare("SELECT COUNT(*) AS n FROM tour_place_en").get() as { n: number };

  db.prepare("UPDATE collect_run SET ok_count = ?, ended_at = ?, note = ? WHERE id = ?").run(
    ko.n + en.n,
    nowIso(),
    `ko=${ko.n} en=${en.n}`,
    runId.id,
  );

  const mins = ((Date.now() - t0) / 60_000).toFixed(1);
  console.log(`\n═══════════════════════════════`);
  console.log(` 국문 ${ko.n.toLocaleString()}건 · 영문 ${en.n.toLocaleString()}건  (${mins}분)`);
  console.log(`═══════════════════════════════`);
  console.log(` 다음: npm run collect:overview\n`);

  db.close();
}

main();
