/**
 * 폐교 334곳의 **좌표를 읍면 중심으로 채운다.**
 *
 * 실행: npm run fill:schoolcoords   (`build:places` 다음)
 *
 * ── 왜 폐교가 급한가 ─────────────────────────────────────
 * `eval:hypothesis` 에서 폐교가 **유일하게 채널이 커져도 안 죽는 소재**로 나왔다.
 *
 *   폐교      1.06 / 2.59 / 2.41   (1만 미만 / 1만~10만 / 10만~100만)
 *   섬 여행   2.99 / 0.50 / 0.87
 *   사찰      0.79 / 0.03 /  -
 *
 * 그런데 `report:inventory` 를 돌려 보니 **좌표 0% · 사진 0%** 였다.
 * 가장 값어치 있는 소재가 지도에 점 하나 못 찍는 상태였다.
 * 좌표가 없으면 지도·거리·일출·근처 묶기가 전부 빈다 — 카드가 안 그려진다.
 *
 * ── 왜 지오코더를 안 쓰는가 ──────────────────────────────
 * 카카오·V-World 를 쓰면 건물 단위로 정확하지만 키 발급이 필요하다.
 * 그런데 우리에겐 **같은 읍면에 있는 TourAPI 장소 48,903곳의 좌표**가 이미 있다.
 * 그 평균을 쓰면 읍면 중심을 얻는다 — 317/334 가 이 방법으로 채워진다.
 *
 * ⚠️ **정확도를 착각하면 안 된다.** 읍면 중심은 학교 건물 위치가 아니다.
 *    읍면 하나가 수 km 라 실제 폐교와 몇 km 떨어질 수 있다.
 *    → `coord_source` 를 반드시 남기고 화면이 그 사실을 말하게 한다.
 *      지역코드에서 쓴 것과 같은 원칙이다 (원본 / 주소복원 / 좌표추정 / 미상).
 *    → 키가 생기면 이 값을 덮어쓴다. 그때 `coord_source='지오코딩'` 이 된다.
 */
import { openDb } from "./lib/db";

/** `경상북도 영천시 고경면 석계리 5-2` → `고경면` */
const EMD = /([가-힣]{2,}(?:읍|면|동))/;

function main(): void {
  const db = openDb();

  // place 에 좌표 출처 칸이 없으면 만든다. 추정을 원본과 섞지 않기 위해서다
  const cols = (db.prepare("PRAGMA table_info(place)").all() as { name: string }[]).map(
    (c) => c.name,
  );
  if (!cols.includes("coord_source")) {
    db.exec(`ALTER TABLE place ADD COLUMN coord_source TEXT`);
    // 이미 좌표가 있는 곳은 전부 원본이다
    db.exec(
      `UPDATE place SET coord_source = '원본'
        WHERE lat IS NOT NULL AND lat <> 0 AND coord_source IS NULL`,
    );
    console.log("  coord_source 열 추가\n");
  }

  const targets = db
    .prepare(
      `select p.id, p.name_ko, p.sigungu, s.jibun_addr, s.road_addr
         from place p
         join raw_school s on s.id = p.source_id
        where p.source = 'school'
          and (p.lat is null or p.lat = 0)`,
    )
    .all() as {
    id: string;
    name_ko: string;
    sigungu: string;
    jibun_addr: string | null;
    road_addr: string | null;
  }[];

  if (targets.length === 0) {
    console.log("  채울 폐교가 없습니다.\n");
    return;
  }

  /**
   * 읍면 중심 = 그 읍면 안 TourAPI 장소들의 좌표 평균.
   *
   * ⚠️ 반드시 **같은 시군구 안에서만** 찾는다. `남면`·`동면` 같은 이름은 전국에 널렸다.
   *    (지역코드에서 검단구가 김포시로 넘어간 것과 같은 함정)
   */
  const centroid = db.prepare(
    `select avg(lat) lat, avg(lng) lng, count(*) n
       from place
      where sigungu = ? and addr like ? and lat is not null and lat <> 0
        and source = 'tourapi'`,
  );

  const sigunguCentroid = db.prepare(
    `select avg(lat) lat, avg(lng) lng, count(*) n
       from place
      where sigungu = ? and lat is not null and lat <> 0 and source = 'tourapi'`,
  );

  const upd = db.prepare(`UPDATE place SET lat = ?, lng = ?, coord_source = ? WHERE id = ?`);

  let byEmd = 0;
  let bySigungu = 0;
  const failed: string[] = [];

  for (const t of targets) {
    const addr = t.jibun_addr || t.road_addr || "";
    const m = addr.match(EMD);

    if (m) {
      const c = centroid.get(t.sigungu, `%${m[1]}%`) as {
        lat: number | null;
        lng: number | null;
        n: number;
      };
      if (c.n > 0 && c.lat !== null && c.lng !== null) {
        upd.run(c.lat, c.lng, "읍면추정", t.id);
        byEmd++;
        continue;
      }
    }

    /**
     * 읍면으로 못 찾으면 시군구 중심. **훨씬 거칠다** — 시군 하나가 수십 km 다.
     * 그래도 좌표가 아예 없는 것보다는 낫다. 지도에 점은 찍히고,
     * 출처가 `시군구추정` 이라 화면이 정확도를 낮춰 말할 수 있다.
     */
    const c = sigunguCentroid.get(t.sigungu) as {
      lat: number | null;
      lng: number | null;
      n: number;
    };
    if (c.n > 0 && c.lat !== null && c.lng !== null) {
      upd.run(c.lat, c.lng, "시군구추정", t.id);
      bySigungu++;
    } else {
      failed.push(`${t.name_ko} (${t.sigungu})`);
    }
  }

  console.log(`\n폐교 좌표 채우기\n`);
  console.log(`  대상            ${targets.length}곳`);
  console.log(`  읍면 중심       ${byEmd}곳   ← 쓸 만하다 (읍면 하나 수 km)`);
  console.log(`  시군구 중심     ${bySigungu}곳   ⚠️ 거칠다. 화면에서 정확도를 낮춰 말할 것`);
  console.log(`  실패            ${failed.length}곳`);
  for (const f of failed.slice(0, 5)) console.log(`    ${f}`);

  const dist = db
    .prepare(
      `select coord_source s, count(*) n from place
        where source = 'school' group by coord_source`,
    )
    .all() as { s: string | null; n: number }[];
  console.log(`\n  폐교 좌표 출처 분포`);
  for (const d of dist) console.log(`    ${(d.s ?? "없음").padEnd(12)} ${d.n}곳`);
  console.log("");
}

main();
