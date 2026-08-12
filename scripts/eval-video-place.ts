/**
 * 5단계-A · 영상 → 장소 연결이 실제로 되는지 확인한다.
 *
 * ── 이게 이 프로젝트에서 가장 검증 안 된 가정이다 ──────────
 * 서비스 전체가 "같은 소재의 영상이 얼마나 잘 됐나" 위에 서 있는데,
 * 그러려면 **영상이 어느 장소를 찍었는지** 알아야 한다.
 * 그 연결이 안 되면 태그별 점수판이 통째로 못 만들어진다.
 *
 * 검증할 것 두 가지:
 *   ① 여행 영상이 실제로 우리 DB 에 있는 장소 이름을 말하는가
 *   ② 말한다면 그 매칭이 믿을 만한가 (오탐이 얼마나 되는가)
 *
 * 여기서 안 되면 5단계 설계를 바꿔야 한다. 쿼터 상향을 받고 나서 알면 늦다.
 *
 * 실행: npm run eval:videoplace
 */
import { openDb } from "./lib/db";

const db = openDb();

type PlaceRow = { id: string; name: string; sido: string | null; sigungu: string | null };
type VideoRow = {
  video_id: string;
  title: string;
  description: string | null;
  channel_title: string;
  language: string;
  view_count: number;
};

/**
 * 장소 이름을 그대로 쓰면 안 된다.
 *   "정선 5일장" 은 영상에서 "정선오일장" 으로 쓰인다.
 *   "옛 봉래초등학교" 의 "옛" 은 우리가 붙인 말이다.
 * → 공백·기호를 지우고 접두어를 떼서 비교한다.
 */
function norm(s: string): string {
  return s
    .replace(/^(옛|구)\s+/, "")
    .replace(/[()（）[\]{}·・,，.\-–—/'"]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * 너무 흔하거나 짧은 이름은 버린다.
 *   "중앙시장" 은 전국에 수십 개라 어느 곳인지 특정이 안 된다.
 *   2글자 이름은 아무 문장에나 걸린다 ("정선" 은 "정선하다" 에도 걸린다).
 * 특정이 안 되는 매칭은 없는 것보다 나쁘다 — 틀린 지역에 성과를 몰아준다.
 */
const MIN_LEN = 4;

/**
 * ⚠️ 라틴 문자만으로 된 상호명은 버린다.
 *
 * TourAPI 음식점·카페에 `Scene`, `TINC`, `A.zel`, `Extraordinary` 같은 이름이 있다.
 * 이런 게 영어 영상 설명란의 평범한 문장에 걸려서, 남극 다큐가 서울 카페를 찍은 것으로
 * 잡혔다. **오탐이 미탐보다 나쁘다** — 틀린 지역에 성과를 몰아준다.
 */
const isLatinOnly = (s: string) => !/[가-힣]/.test(s);

const places = (
  db
    .prepare(
      `select id, name_ko as name, sido, sigungu from place
        where name_ko is not null and length(name_ko) >= 2`,
    )
    .all() as PlaceRow[]
).filter((p) => !isLatinOnly(p.name));

/** 정규화 이름 → 장소들. 같은 이름이 여러 곳이면 특정 불가로 본다. */
const byName = new Map<string, PlaceRow[]>();
for (const p of places) {
  const n = norm(p.name);
  if (n.length < MIN_LEN) continue;
  (byName.get(n) ?? byName.set(n, []).get(n)!).push(p);
}

/**
 * 앞 2글자로 버킷을 나눈다.
 * 안 나누면 영상 한 편마다 5만 개 이름을 전부 대조해야 해서 못 돌린다.
 */
const buckets = new Map<string, string[]>();
for (const n of byName.keys()) {
  const k = n.slice(0, 2);
  (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(n);
}

const unique = [...byName.values()].filter((v) => v.length === 1).length;
console.log(`\n5단계-A · 영상 → 장소 연결 검증\n`);
console.log(`  장소 이름  ${byName.size.toLocaleString()}종 (${MIN_LEN}자 이상)`);
console.log(`    이름이 전국에서 유일   ${unique.toLocaleString()}`);
console.log(`    같은 이름이 여러 곳     ${(byName.size - unique).toLocaleString()}  ← 특정 불가\n`);

const videos = db
  .prepare(
    `select video_id, title, description, channel_title, language, view_count
       from yt_video order by view_count desc`,
  )
  .all() as VideoRow[];

type Hit = { place: PlaceRow; where: "title" | "desc"; name: string };

/** 텍스트에서 장소 이름을 찾는다. 버킷 덕분에 후보가 몇 개로 줄어든다. */
function findPlaces(text: string, where: "title" | "desc"): Hit[] {
  const t = norm(text);
  const out: Hit[] = [];
  const seen = new Set<string>();

  for (let i = 0; i + 2 <= t.length; i++) {
    const cands = buckets.get(t.slice(i, i + 2));
    if (!cands) continue;
    for (const n of cands) {
      if (seen.has(n)) continue;
      if (!t.startsWith(n, i)) continue;
      const rows = byName.get(n)!;
      // 이름이 여러 곳에 있으면 어느 곳인지 못 정한다. 버린다.
      if (rows.length !== 1) continue;
      seen.add(n);
      out.push({ place: rows[0], where, name: n });
    }
  }
  return out;
}

/**
 * 지명(시군구) 사전.
 *
 * 가설: 영상은 개별 상호명보다 **지명**을 훨씬 자주 말한다.
 * "곡성 오일장" 이라고 안 하고 "곡성 여행" 이라고 한다.
 * 지명이 잡히면 그 지역 안에서 소재를 좁히는 방식이 가능하다.
 *
 * 영어 표기도 같이 넣는다 — 해외 채널이 "Jeju", "Busan" 이라고 쓴다.
 */
const REGION_EN: Record<string, string[]> = {
  제주시: ["jeju"],
  서귀포시: ["seogwipo", "jeju"],
  중구: [],
  경주시: ["gyeongju"],
  전주시: ["jeonju"],
  강릉시: ["gangneung"],
  여수시: ["yeosu"],
  부산: ["busan"],
  속초시: ["sokcho"],
  안동시: ["andong"],
  통영시: ["tongyeong"],
  포항시: ["pohang"],
  춘천시: ["chuncheon"],
};

const regionNames = new Map<string, string>();
for (const r of db
  .prepare("select distinct sigungu from place where sigungu is not null")
  .all() as { sigungu: string }[]) {
  const base = r.sigungu.replace(/(시|군|구)$/, "");
  // 2글자 미만 지명은 아무 문장에나 걸린다
  if (base.length >= 2) regionNames.set(norm(base), r.sigungu);
  for (const en of REGION_EN[r.sigungu] ?? []) regionNames.set(en, r.sigungu);
}

function findRegions(text: string): Set<string> {
  const t = norm(text);
  const out = new Set<string>();
  for (const [key, sigungu] of regionNames) {
    if (t.includes(key)) out.add(sigungu);
  }
  return out;
}

let regionHit = 0;
let poiAmongRegion = 0;
let regionOnly = 0;
const regionCount = new Map<string, number>();

let titleHit = 0;
let descHit = 0;
let anyHit = 0;
const samples: string[] = [];
const tagCount = new Map<string, number>();
const perChannel = new Map<string, { n: number; hit: number }>();

const tagsOf = db.prepare(
  `select t.name_ko n from place_tag pt join tag t on t.id = pt.tag_id
    where pt.place_id = ? and t.axis = 'subject' and t.level = 2`,
);

for (const v of videos) {
  const inTitle = findPlaces(v.title, "title");
  const inDesc = v.description ? findPlaces(v.description.slice(0, 1500), "desc") : [];
  const hits = [...inTitle, ...inDesc];

  const regions = findRegions(`${v.title}\n${(v.description ?? "").slice(0, 1500)}`);
  if (regions.size) {
    regionHit++;
    for (const r of regions) regionCount.set(r, (regionCount.get(r) ?? 0) + 1);
  }

  if (regions.size) {
    if (hits.length) poiAmongRegion++;
    else regionOnly++;
  }

  const ch = perChannel.get(v.channel_title) ?? { n: 0, hit: 0 };
  ch.n++;
  if (hits.length) ch.hit++;
  perChannel.set(v.channel_title, ch);

  if (inTitle.length) titleHit++;
  if (inDesc.length) descHit++;
  if (!hits.length) continue;
  anyHit++;

  for (const h of hits) {
    for (const r of tagsOf.all(h.place.id) as { n: string }[]) {
      tagCount.set(r.n, (tagCount.get(r.n) ?? 0) + 1);
    }
  }

  if (samples.length < 12) {
    const names = hits
      .slice(0, 3)
      .map((h) => `${h.place.name}${h.where === "title" ? "" : "(설명)"}`)
      .join(", ");
    samples.push(`  ${v.title.slice(0, 44).padEnd(46)} → ${names}`);
  }
}

const pct = (v: number) => `${((v / videos.length) * 100).toFixed(1)}%`;

console.log(`영상 ${videos.length}편 대조\n`);
console.log(`  제목에서 찾음    ${String(titleHit).padStart(4)}  ${pct(titleHit)}`);
console.log(`  설명란에서 찾음  ${String(descHit).padStart(4)}  ${pct(descHit)}`);
console.log(`  ─────────────────────────────`);
console.log(`  둘 중 하나라도   ${String(anyHit).padStart(4)}  ${pct(anyHit)}\n`);
console.log(`  지명(시군구)으로 ${String(regionHit).padStart(4)}  ${pct(regionHit)}   ← 상호명 대신 지명으로 찾은 것\n`);

/**
 * ★ 5단계 설계를 결정하는 숫자.
 *
 * 전체 대비 비율은 의미가 없다 — 표본에 한국 여행이 아닌 영상(중국·러시아·남극)이
 * 잔뜩 섞여 있어서다. 한국 지명이 잡힌 영상만 놓고 봐야 실제 성능이 보인다.
 */
if (regionHit > 0) {
  console.log(`한국 지명이 잡힌 ${regionHit}편 중에서`);
  console.log(
    `  장소까지 특정  ${String(poiAmongRegion).padStart(4)}  ${((poiAmongRegion / regionHit) * 100).toFixed(1)}%`,
  );
  console.log(
    `  지역만 앎      ${String(regionOnly).padStart(4)}  ${((regionOnly / regionHit) * 100).toFixed(1)}%\n`,
  );
}

if (samples.length) console.log(`붙은 예시:\n${samples.join("\n")}\n`);

console.log(`채널별 적중률:`);
for (const [name, s] of [...perChannel.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8)) {
  console.log(
    `  ${name.slice(0, 24).padEnd(26)} ${s.hit}/${s.n}  ${((s.hit / s.n) * 100).toFixed(0)}%`,
  );
}

console.log(`\n이 영상들에서 나온 소재 태그 상위:`);
for (const [n, c] of [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(c).padStart(4)}  ${n}`);
}
console.log("");
