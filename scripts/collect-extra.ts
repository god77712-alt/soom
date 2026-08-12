/**
 * 1단계-C · 사진·코스 수집 (KorService2 가 아닌 서비스들).
 *
 *   npm run collect:extra
 *
 * ★ 이걸 따로 뗀 이유: **data.go.kr 한도는 서비스별로 따로 걸린다.**
 *   KorService2 가 코드 22 로 막혀도 PhotoGalleryService1·PhokoAwrdService·Durunubi 는
 *   멀쩡히 응답한다. 그래서 소개글이 막힌 날에도 이쪽은 받을 수 있다.
 *
 * 셋 다 규모가 작다 (6,118 + 95 + 152). 페이징 65회면 끝난다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";
import { nowIso, openDb, stripHtml } from "./lib/db";

const PAGE_SIZE = 100;
const db = openDb();

async function pageThrough<T>(
  service: string,
  operation: string,
  label: string,
  onItems: (items: T[]) => void,
  extra: Record<string, string | number> = {},
): Promise<number> {
  let page = 1;
  let got = 0;
  let total = 0;

  while (true) {
    const r = await callTourApi<T>(service, operation, {
      numOfRows: PAGE_SIZE,
      pageNo: page,
      ...extra,
    });

    if (!r.ok) {
      console.log(`  ${label.padEnd(12)} p${page} 실패 [${r.code}] ${r.message}`);
      return got;
    }

    total = r.totalCount;
    if (r.items.length === 0) break;

    db.exec("BEGIN");
    try {
      onItems(r.items);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }

    got += r.items.length;
    if (got >= total) break;
    page += 1;
  }

  console.log(`  ${label.padEnd(12)} ${String(got).padStart(6)} / ${total}`);
  return got;
}

// ── 관광사진 갤러리 ───────────────────────────────────────

interface GalleryItem {
  galContentId: string;
  galContentTypeId?: string;
  galTitle?: string;
  galWebImageUrl?: string;
  galPhotographyMonth?: string;
  galPhotographyLocation?: string;
  galPhotographer?: string;
  galSearchKeyword?: string;
  galCreatedtime?: string;
  galModifiedtime?: string;
}

async function collectGallery(): Promise<number> {
  const ins = db.prepare(`
    INSERT OR REPLACE INTO tour_photo (
      gal_content_id, gal_content_type_id, title, image_url,
      photography_month, photography_location, photographer, search_keyword,
      created_time, modified_time, fetched_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  const at = nowIso();

  return pageThrough<GalleryItem>(SERVICES.photo, "galleryList1", "관광사진", (items) => {
    for (const it of items) {
      if (!it.galContentId) continue;
      ins.run(
        it.galContentId,
        it.galContentTypeId ?? null,
        it.galTitle ?? null,
        it.galWebImageUrl ?? null,
        it.galPhotographyMonth ?? null,
        it.galPhotographyLocation ?? null,
        it.galPhotographer ?? null,
        it.galSearchKeyword ?? null,
        it.galCreatedtime ?? null,
        it.galModifiedtime ?? null,
        at,
      );
    }
  });
}

// ── 수상작 사진 ───────────────────────────────────────────

interface AwardItem {
  contentId: string;
  koTitle?: string;
  enTitle?: string;
  lDongRegnCd?: string;
  koFilmst?: string;
  enFilmst?: string;
  filmDay?: string;
  koCmanNm?: string;
  koWnprzDiz?: string;
  koKeyWord?: string;
  enKeyWord?: string;
  orgImage?: string;
  thumbImage?: string;
}

async function collectAward(): Promise<number> {
  const ins = db.prepare(`
    INSERT OR REPLACE INTO tour_award_photo (
      content_id, ko_title, en_title, region_code, ko_film_site, en_film_site,
      film_day, photographer, prize, ko_keyword, en_keyword,
      org_image, thumb_image, fetched_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const at = nowIso();

  return pageThrough<AwardItem>(SERVICES.award, "phokoAwrdList", "수상작", (items) => {
    for (const it of items) {
      if (!it.contentId) continue;
      ins.run(
        it.contentId,
        it.koTitle ?? null,
        it.enTitle ?? null,
        it.lDongRegnCd ?? null,
        it.koFilmst ?? null,
        it.enFilmst ?? null,
        it.filmDay ?? null,
        it.koCmanNm ?? null,
        it.koWnprzDiz ?? null,
        it.koKeyWord ?? null,
        it.enKeyWord ?? null,
        it.orgImage ?? null,
        it.thumbImage ?? null,
        at,
      );
    }
  });
}

// ── 두루누비 걷기길 ───────────────────────────────────────

interface CourseItem {
  crsIdx: string;
  routeIdx?: string;
  crsKorNm?: string;
  crsDstnc?: string;
  crsTotlRqrmHour?: string;
  crsLevel?: string;
  crsCycle?: string;
  crsContents?: string;
  crsSummary?: string;
  crsTourInfo?: string;
  travelerinfo?: string;
  sigun?: string;
  brdDiv?: string;
  gpxpath?: string;
}

async function collectCourse(): Promise<number> {
  const ins = db.prepare(`
    INSERT OR REPLACE INTO tour_course (
      crs_idx, route_idx, name, distance_km, duration_min, level, cycle,
      contents, summary, tour_info, traveler_info, sigun, brd_div, gpx_path, fetched_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const at = nowIso();
  const num = (v?: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return pageThrough<CourseItem>(SERVICES.durunubi, "courseList", "걷기길", (items) => {
    for (const it of items) {
      if (!it.crsIdx) continue;
      ins.run(
        it.crsIdx,
        it.routeIdx ?? null,
        it.crsKorNm ?? null,
        num(it.crsDstnc),
        num(it.crsTotlRqrmHour),
        it.crsLevel ?? null,
        it.crsCycle ?? null,
        it.crsContents ? stripHtml(it.crsContents) : null,
        it.crsSummary ? stripHtml(it.crsSummary) : null,
        it.crsTourInfo ? stripHtml(it.crsTourInfo) : null,
        it.travelerinfo ? stripHtml(it.travelerinfo) : null,
        it.sigun ?? null,
        it.brdDiv ?? null,
        it.gpxpath ?? null,
        at,
      );
    }
  });
}

// ── 실행 ──────────────────────────────────────────────────

async function main() {
  const runId = (
    db.prepare("INSERT INTO collect_run (phase, started_at) VALUES ('extra', ?) RETURNING id")
      .get(nowIso()) as { id: number }
  ).id;

  console.log("\n1단계-C · 사진·코스 수집\n");
  const t0 = Date.now();

  const photo = await collectGallery();
  const award = await collectAward();
  const course = await collectCourse();

  const mins = ((Date.now() - t0) / 60_000).toFixed(1);
  db.prepare("UPDATE collect_run SET ok_count = ?, note = ?, ended_at = ? WHERE id = ?").run(
    photo + award + course,
    `photo=${photo} award=${award} course=${course}`,
    nowIso(),
    runId,
  );

  console.log(`\n═══════════════════════════════════════`);
  console.log(` 사진 ${photo.toLocaleString()} · 수상작 ${award} · 걷기길 ${course}  (${mins}분)`);
  console.log(`═══════════════════════════════════════\n`);

  db.close();
}

main();
