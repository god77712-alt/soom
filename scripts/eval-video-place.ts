/**
 * 5단계-A · 영상 → 장소 연결이 실제로 되는지 확인한다.
 *
 * ── 이게 이 프로젝트에서 가장 검증 안 된 가정이다 ──────────
 * 서비스 전체가 "같은 소재의 영상이 얼마나 잘 됐나" 위에 서 있는데,
 * 그러려면 **영상이 어느 장소를 찍었는지** 알아야 한다.
 *
 * 🚨 **규칙은 `lib/videoplace.ts` 에만 있다** (2026-08-21 수정).
 *
 * 예전엔 이 파일이 matcher 를 **통째로 복사해서** 들고 있었다. 그래서 실제 적재
 * (`build-video-place.ts`)에는 있는 `mentionsOwnRegion` 관문이 여기엔 없었고,
 * **평가만 오탐을 그대로 세고 있었다.** `제주여행`(포천시 업소)이 제주 영상마다
 * 붙은 채로 리포트에 찍혔다 — 오류는 안 뜬다. 숫자가 조용히 틀릴 뿐이다.
 *
 * `canShowMultiplier` · `SUBJECT_PLAN` 과 같은 원칙 —
 * **같은 판단이 두 곳에 있으면 반드시 어긋난다.**
 *
 * 실행: npm run eval:videoplace
 */
import { openDb } from "./lib/db";
import {
  buildIndex,
  buildRegionIndex,
  findPlaces,
  findRegions,
  mentionsOwnRegion,
  isChannelSelfMatch,
  type PlaceRow,
} from "./lib/videoplace";

const db = openDb();

type VideoRow = {
  video_id: string;
  title: string;
  description: string | null;
  channel_title: string;
  found_by: string | null;
};

const places = db
  .prepare(
    `select id, name_ko as name, sido, sigungu from place
      where name_ko is not null and length(name_ko) >= 2`,
  )
  .all() as unknown as PlaceRow[];

const idx = buildIndex(places);
const regionIdx = buildRegionIndex(
  db
    .prepare(
      `select distinct sido, sigungu from place
        where sigungu is not null and sigungu <> ''`,
    )
    .all() as { sido: string; sigungu: string }[],
);

const unique = [...idx.byName.values()].filter((v) => v.length === 1).length;
console.log(`\n5단계-A · 영상 → 장소 연결 검증\n`);
console.log(`  장소 이름  ${idx.byName.size.toLocaleString()}종`);
console.log(`    이름이 전국에서 유일   ${unique.toLocaleString()}`);
console.log(
  `    같은 이름이 여러 곳     ${(idx.byName.size - unique).toLocaleString()}  ← 특정 불가\n`,
);

const videos = db
  .prepare(
    `select video_id, title, description, channel_title, found_by
       from yt_video order by view_count desc`,
  )
  .all() as unknown as VideoRow[];

/**
 * ⚠️ **모수를 갈라서 봐야 한다** (2026-08-21).
 *
 * 코퍼스 151,565편 중 145,692편이 `found_by='channel'` — 상위 채널 깊이 훑기로
 * 받은 것이다. 거기엔 SBS 뉴스·TV조선·디글이 통째로 들어 있고, **여행 영상이
 * 아니다.** 전체 평균만 보면 적중률이 5% 대로 찍히는데, 그건 매칭이 나빠진 게
 * 아니라 **여행 영상이 아닌 걸 분모에 넣은 것**이다.
 *
 * 소개글 수집이 쇼핑만 갈고 있던 것과 같은 함정 —
 * **총량만 보면 안 된다. 쓸 곳 단위로 갈라서 봐야 한다.**
 */
type Bucket = {
  label: string;
  n: number;
  title: number;
  desc: number;
  any: number;
  gated: number;
  region: number;
  poiAmongRegion: number;
};
const mk = (label: string): Bucket => ({
  label, n: 0, title: 0, desc: 0, any: 0, gated: 0, region: 0, poiAmongRegion: 0,
});
const search = mk("여행 검색으로 받은 것");
const channel = mk("채널 훑기로 받은 것");
const all = mk("전체");

/** 자기 지역 관문이 걸러낸 것 — 오탐이 어떻게 생겼는지 봐야 한다 */
const droppedBy = new Map<string, number>();
const keptSamples: string[] = [];
const perChannel = new Map<string, { n: number; hit: number }>();
const tagCount = new Map<string, number>();

const tagsOf = db.prepare(
  `select t.name_ko n from place_tag pt join tag t on t.id = pt.tag_id
    where pt.place_id = ? and t.axis = 'subject' and t.level = 2`,
);

for (const v of videos) {
  const desc = (v.description ?? "").slice(0, 1500);
  const whole = `${v.title}\n${desc}`;

  const inTitle = findPlaces(idx, v.title, "title");
  const inDesc = findPlaces(idx, desc, "desc");
  const hits = [...inTitle, ...inDesc];

  /** 관문 통과분 = 실제 적재되는 것 */
  const kept = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.place.id)) continue;
    if (!mentionsOwnRegion(whole, h.place)) {
      droppedBy.set(h.name, (droppedBy.get(h.name) ?? 0) + 1);
      continue;
    }
    if (isChannelSelfMatch(v.channel_title, h.name)) {
      droppedBy.set(h.name, (droppedBy.get(h.name) ?? 0) + 1);
      continue;
    }
    seen.add(h.place.id);
    kept.push(h);
  }

  const regions = findRegions(regionIdx, whole);
  const b = v.found_by === "channel" ? channel : search;

  for (const t of [b, all]) {
    t.n++;
    if (inTitle.length) t.title++;
    if (inDesc.length) t.desc++;
    if (hits.length) t.any++;
    if (kept.length) t.gated++;
    if (regions.length) {
      t.region++;
      if (kept.length) t.poiAmongRegion++;
    }
  }

  const c = perChannel.get(v.channel_title) ?? { n: 0, hit: 0 };
  c.n++;
  if (kept.length) c.hit++;
  perChannel.set(v.channel_title, c);

  for (const h of kept) {
    for (const t of tagsOf.all(h.place.id) as unknown as { n: string }[]) {
      tagCount.set(t.n, (tagCount.get(t.n) ?? 0) + 1);
    }
  }

  if (kept.length && keptSamples.length < 12) {
    keptSamples.push(
      `  ${v.title.slice(0, 46).padEnd(48)} → ${kept
        .map((h) => `${h.place.name}(${h.place.sigungu})`)
        .join(", ")}`,
    );
  }
}

const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : "0.0");

function report(b: Bucket) {
  if (!b.n) return;
  console.log(`\n${b.label}  ${b.n.toLocaleString()}편`);
  console.log(`  제목에서 찾음      ${String(b.title).padStart(7)}  ${pct(b.title, b.n)}%`);
  console.log(`  설명란에서 찾음    ${String(b.desc).padStart(7)}  ${pct(b.desc, b.n)}%`);
  console.log(`  이름만 맞으면      ${String(b.any).padStart(7)}  ${pct(b.any, b.n)}%  ← 관문 전`);
  console.log(
    `  자기 지역도 맞음   ${String(b.gated).padStart(7)}  ${pct(b.gated, b.n)}%  ← 실제 적재`,
  );
  console.log(
    `    관문이 걸러낸 비율 ${pct(b.any - b.gated, b.any)}%  (이름만 맞은 것 중)`,
  );
  console.log(`  지명(시군구)으로   ${String(b.region).padStart(7)}  ${pct(b.region, b.n)}%`);
  console.log(
    `    그중 장소까지 특정 ${String(b.poiAmongRegion).padStart(7)}  ${pct(b.poiAmongRegion, b.region)}%`,
  );
}

report(search);
report(channel);
report(all);

console.log(`\n\n자기 지역 관문이 걸러낸 이름 상위 — 전부 일반 명사가 상호명인 곳이다`);
for (const [n, c] of [...droppedBy].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(c).padStart(6)}  ${n}`);
}

console.log(`\n관문을 통과한 예시:`);
for (const s of keptSamples) console.log(s);

console.log(`\n채널별 적중률 (여행 검색 표본이 많은 채널 상위):`);
for (const [name, c] of [...perChannel]
  .filter((x) => x[1].n >= 50)
  .sort((a, b) => b[1].hit / b[1].n - a[1].hit / a[1].n)
  .slice(0, 12)) {
  console.log(`  ${name.slice(0, 24).padEnd(26)} ${c.hit}/${c.n}  ${pct(c.hit, c.n)}%`);
}

console.log(`\n연결된 장소의 소재 태그 상위:`);
for (const [n, c] of [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(c).padStart(6)}  ${n}`);
}
console.log();
