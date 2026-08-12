/**
 * 5단계-C · 영상 → 장소·지역 연결을 **적재한다.**
 *
 * 실행: npm run build:videoplace   (`yt:search` 다음)
 *
 * 지금까지는 `eval:videoplace` 로 **얼마나 붙는지 재기만** 했다. 이제 실제로 붙인다.
 * 이게 있어야 홈 추천 카드의 `경쟁 영상 N편` 이 실측이 된다.
 *
 * ── 이 숫자가 무엇을 뜻하는지 정확히 해둘 것 ─────────────
 * **`경쟁 영상 0편` 은 "세상에 영상이 없다"가 아니다.**
 * "우리가 수집한 N편 안에서 이 장소가 언급된 적 없다" 다.
 *
 * 우리 코퍼스는 3,600편 남짓이고 이름 매칭 적중률은 12% 대다.
 * 그러니 0편을 전수조사 결과인 척 쓰면 거짓말이 된다.
 * → 화면은 반드시 **모수를 함께** 말해야 한다 (`수집 3,696편 기준`).
 *
 * ⚠️ 오탐이 미탐보다 나쁘다. 규칙은 전부 재현율을 깎아 정밀도를 산 것이다
 *    (`scripts/lib/videoplace.ts` 주석 참조).
 */
import { openDb } from "./lib/db";
import {
  buildIndex,
  buildRegionIndex,
  findPlaces,
  findRegions,
  mentionsOwnRegion,
  type PlaceRow,
} from "./lib/videoplace";

function main(): void {
  const db = openDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS video_place (
      video_id   TEXT NOT NULL,
      place_id   TEXT NOT NULL,
      -- title 이 desc 보다 강한 신호다. 나중에 가중치를 줄 때 쓴다
      evidence   TEXT NOT NULL,
      matched    TEXT NOT NULL,
      PRIMARY KEY (video_id, place_id)
    );
    CREATE INDEX IF NOT EXISTS idx_vp_place ON video_place(place_id);

    CREATE TABLE IF NOT EXISTS video_region (
      video_id   TEXT NOT NULL,
      sido       TEXT NOT NULL,
      sigungu    TEXT NOT NULL,
      PRIMARY KEY (video_id, sigungu)
    );
    CREATE INDEX IF NOT EXISTS idx_vr_sigungu ON video_region(sigungu);
  `);
  db.exec(`DELETE FROM video_place; DELETE FROM video_region;`);

  const places = db
    .prepare(
      `select id, name_ko as name, sido, sigungu from place
        where name_ko is not null and length(name_ko) >= 2`,
    )
    .all() as unknown as PlaceRow[];
  const idx = buildIndex(places);

  const regionIdx = buildRegionIndex(
    db
      .prepare(`select distinct sido, sigungu from place where sigungu is not null and sigungu <> ''`)
      .all() as { sido: string; sigungu: string }[],
  );

  const videos = db
    .prepare(`select video_id, title, description, language from yt_video`)
    .all() as { video_id: string; title: string; description: string; language: string }[];

  const insP = db.prepare(
    `INSERT OR IGNORE INTO video_place (video_id, place_id, evidence, matched) VALUES (?,?,?,?)`,
  );
  const insR = db.prepare(
    `INSERT OR IGNORE INTO video_region (video_id, sido, sigungu) VALUES (?,?,?)`,
  );

  let vWithPlace = 0;
  let vWithRegion = 0;
  let links = 0;
  /** 이름은 맞았지만 자기 지역이 안 나와서 버린 것 */
  let dropped = 0;

  for (const v of videos) {
    const hits = [
      ...findPlaces(idx, v.title ?? "", "title"),
      ...findPlaces(idx, v.description ?? "", "desc"),
    ];
    const seen = new Set<string>();
    let any = false;
    const whole = `${v.title ?? ""} ${v.description ?? ""}`;
    for (const h of hits) {
      if (seen.has(h.place.id)) continue;
      // 자기 지역이 같이 언급되지 않으면 버린다 (일반 명사 상호명 오탐 차단)
      if (!mentionsOwnRegion(whole, h.place)) { dropped++; continue; }
      seen.add(h.place.id);
      insP.run(v.video_id, h.place.id, h.where, h.name);
      links++;
      any = true;
    }
    if (any) vWithPlace++;

    const regions = findRegions(regionIdx, `${v.title ?? ""} ${v.description ?? ""}`);
    if (regions.length > 0) vWithRegion++;
    for (const r of regions) insR.run(v.video_id, r.sido, r.sigungu);
  }

  const pct = (n: number) => ((100 * n) / (videos.length || 1)).toFixed(1);

  console.log(`\n5단계-C · 영상 → 장소 연결 적재\n`);
  console.log(`  영상            ${videos.length.toLocaleString()}편`);
  console.log(`  장소가 잡힌 영상 ${vWithPlace.toLocaleString()}편  (${pct(vWithPlace)}%)`);
  console.log(`  지명이 잡힌 영상 ${vWithRegion.toLocaleString()}편  (${pct(vWithRegion)}%)`);
  console.log(`  연결 수         ${links.toLocaleString()}건\n`);

  const topPlaces = db
    .prepare(
      `select p.name_ko n, p.sigungu g, count(*) c
         from video_place vp join place p on p.id = vp.place_id
        group by vp.place_id order by c desc limit 10`,
    )
    .all() as { n: string; g: string; c: number }[];
  console.log(`  가장 많이 잡힌 장소`);
  for (const t of topPlaces) console.log(`    ${t.n.slice(0, 20).padEnd(22)} ${t.g.padEnd(8)} ${t.c}편`);

  const covered = (
    db.prepare(`select count(distinct place_id) n from video_place`).get() as { n: number }
  ).n;
  console.log(`\n  영상이 하나라도 붙은 장소 ${covered.toLocaleString()}곳`);
  console.log(`  ⚠️ 나머지는 "영상이 없다"가 아니라 "우리 코퍼스에서 안 잡혔다" 다.`);
  console.log(`     화면은 모수를 함께 말할 것 — 수집 ${videos.length.toLocaleString()}편 기준\n`);
}

main();
