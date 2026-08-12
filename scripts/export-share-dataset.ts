/**
 * 공유 데이터 내보내기 — 공모전 제출용 CSV 1개 (10MB 제한).
 *
 * 무엇을 만드는가:
 *   TourAPI 원본은 지역코드가 대량으로 비어 있다 (48,929 중 26,635건).
 *   특히 쇼핑은 5.8% 만 지역코드가 붙어 있는데, 오일장·재래시장이 쇼핑이라
 *   이 상태로는 "인구감소지역에 어떤 소재가 있는가" 를 셀 수가 없다.
 *
 *   → 주소 문자열에서 시도·시군구를 복원하고(scripts/lib/region.ts),
 *     행정안전부 인구감소지역 89개 시군구를 매칭해 붙인다.
 *     원본에 없던 열이 생기므로 "공공데이터를 기반으로 생성된 데이터" 에 해당한다.
 *
 *   ⚠️ 추정으로 채운 값을 원본인 척 섞지 않는다. `지역코드_출처` 열로 구분한다.
 *
 * 실행: npm run export:share
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";
import { RegionResolver, type RegionHit, type RegionSource } from "./lib/region";

const OUT_DIR = "./data/share";
const OUT_FILE = `${OUT_DIR}/soom_places_declining.csv`;

const TYPE_LABEL: Record<string, string> = {
  "12": "관광지",
  "14": "문화시설",
  "15": "축제공연행사",
  "25": "여행코스",
  "28": "레포츠",
  "32": "숙박",
  "38": "쇼핑",
  "39": "음식점",
};

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const db = openDb();
const region = new RegionResolver(db);

type Row = {
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
};

const rows = db
  .prepare(
    `select p.content_id, p.content_type_id, p.title, p.addr1, p.addr2,
            p.area_code, p.sigungu_code, p.lat, p.lng, p.first_image,
            o.overview
       from tour_place p
       left join tour_overview o on o.content_id = p.content_id
      order by cast(p.content_id as integer)`,
  )
  .all() as Row[];

const header = [
  "content_id",
  "장소명",
  "콘텐츠분류",
  "주소",
  "시도",
  "시군구",
  "시도코드",
  "시군구코드",
  "지역코드_출처",
  "인구감소지역",
  "위도",
  "경도",
  "대표이미지_유무",
  "소개글_유무",
  "소개글_길이",
];

/**
 * 좌표 추정의 기준점을 심는다.
 *
 * 주소만으로 확정된 장소를 기준점으로 삼아, 이름이 바뀌어 코드표에 없는 신설
 * 자치구(인천 제물포구·영종구·서해구 등)를 최근접 거리로 메운다.
 */
region.seedSpatial(
  rows
    .map((r) => ({
      lat: r.lat,
      lng: r.lng,
      hit: region.resolve(r.area_code, r.sigungu_code, r.addr1, r.addr2).hit,
    }))
    .filter((p): p is { lat: number | null; lng: number | null; hit: RegionHit } => p.hit !== null),
);

const lines: string[] = [header.join(",")];
const count: Record<RegionSource, number> = { 원본: 0, 주소복원: 0, 좌표추정: 0, 미상: 0 };
let declining = 0;

for (const r of rows) {
  const { hit, source } = region.resolveWithCoord(
    r.area_code,
    r.sigungu_code,
    r.lat,
    r.lng,
    r.addr1,
    r.addr2,
  );
  count[source]++;

  const isDeclining = region.isDeclining(hit);
  if (isDeclining) declining++;

  const ov = r.overview ?? "";

  lines.push(
    [
      r.content_id,
      r.title,
      TYPE_LABEL[String(r.content_type_id)] ?? r.content_type_id,
      r.addr1,
      hit?.sido ?? "",
      hit?.sigungu ?? "",
      hit?.area_code ?? "",
      hit?.sigungu_code ?? "",
      source,
      isDeclining ? "Y" : "N",
      r.lat ?? "",
      r.lng ?? "",
      r.first_image ? "Y" : "N",
      ov ? "Y" : "N",
      ov.length || "",
    ]
      .map(csvCell)
      .join(","),
  );
}

mkdirSync(OUT_DIR, { recursive: true });
// 엑셀에서 한글이 깨지지 않도록 BOM 을 붙인다
const body = "﻿" + lines.join("\r\n") + "\r\n";
writeFileSync(OUT_FILE, body, "utf8");

const mb = Buffer.byteLength(body, "utf8") / 1024 / 1024;
const resolved = count.원본 + count.주소복원 + count.좌표추정;

console.log(`
공유 데이터 내보내기 완료

  파일   ${OUT_FILE}
  행수   ${rows.length.toLocaleString()}
  크기   ${mb.toFixed(2)} MB  ${mb > 10 ? "⚠️ 10MB 초과 — 열을 줄일 것" : "(제한 10MB)"}

지역코드
  원본에 있던 것    ${count.원본.toLocaleString()}
  주소로 복원한 것  ${count.주소복원.toLocaleString()}  ← 원본에 없던 값
  좌표로 추정한 것  ${count.좌표추정.toLocaleString()}  ← 신설 자치구 등
  끝내 미상         ${count.미상.toLocaleString()}
  확보율            ${((count.원본 / rows.length) * 100).toFixed(1)}% → ${((resolved / rows.length) * 100).toFixed(1)}%

인구감소지역 소재 장소  ${declining.toLocaleString()}건 (${((declining / rows.length) * 100).toFixed(1)}%)
`);
