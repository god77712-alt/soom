/**
 * 3단계 · 태그 체계 확정 + 규칙 기반 1차 태깅.
 *
 * ── 왜 태그를 새로 지어내지 않는가 ────────────────────────
 * 설계에 앞서 데이터를 봤더니, 관광공사 분류(cat1/cat2/cat3)가 이미
 * **대분류 24 · 세부 153** 이었다. SPEC 이 잡았던 "대분류 20 + 세부 150" 과 사실상 같다.
 * 게다가 우리가 필요하다고 적어둔 `5일장`·`등대`·`상설시장` 이 전부 소분류에 있다.
 *
 *   → 새 분류를 만들면 관광공사 분류와 우리 분류 사이 대응표를 평생 관리해야 한다.
 *     그 표가 틀어지는 순간 점수가 조용히 어긋난다.
 *     **그대로 쓰고, 없는 것만 얹는다.**
 *
 * ── 그런데 cat3 는 45.8% 만 채워져 있다 ────────────────────
 * 지역코드가 빈 행과 같은 행들이다. 그래서 규칙만으로는 절반밖에 못 붙인다.
 * 나머지는 4단계에서 소개글로 LLM 이 붙인다.
 *
 *   ★ 이게 오히려 이득이다. cat3 가 채워진 22,425건은 **정답지**다.
 *     LLM 을 27,000건에 돌리기 전에 이 정답지로 정확도를 재고 프롬프트를 고칠 수 있다.
 *     검증 없이 전량 돌리면 틀린 태깅 4만 건을 나중에 발견한다.
 *
 * ── 축마다 근거가 다르다 (types.ts TagEvidence) ────────────
 * subject/time 은 소개글에서 뽑아도 되지만, mood 는 뽑으면 안 된다.
 * 소개글은 관광공사가 쓴 홍보문이라 어디를 읽어도 정겹고 따뜻하다.
 * → mood 어휘는 여기서 **정의만** 하고, 실제로 붙이는 건 5단계 영상·댓글이다.
 *
 * 실행: npm run build:tags
 */
import { openDb, nowIso } from "./lib/db";

const db = openDb();
const now = nowIso();

db.exec(`
  CREATE TABLE IF NOT EXISTS tag (
    id            TEXT PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name_ko       TEXT NOT NULL,
    name_en       TEXT NOT NULL,
    axis          TEXT NOT NULL,     -- subject | mood | time | format | persona | audience
    parent_id     TEXT,
    level         INTEGER NOT NULL,  -- 1=대분류 | 2=세부
    is_seasonal   INTEGER NOT NULL DEFAULT 0,
    season_months TEXT,              -- "4,5" · 상시면 NULL
    /** 이 태그를 무엇으로 붙일 수 있는가. types.ts TagEvidence 와 같은 값 */
    evidence      TEXT NOT NULL,     -- rule | overview | video | comment
    /** 관광공사 분류에서 온 것이면 그 코드 */
    source_code   TEXT,
    built_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS place_tag (
    content_id  TEXT NOT NULL,
    tag_id      TEXT NOT NULL,
    evidence    TEXT NOT NULL,
    confidence  REAL NOT NULL DEFAULT 1.0,
    detail      TEXT,               -- 장날 "2,7" 처럼 태그에 딸린 값
    tagged_at   TEXT NOT NULL,
    PRIMARY KEY (content_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS idx_place_tag_tag ON place_tag (tag_id);
`);
db.exec("DELETE FROM tag");
db.exec("DELETE FROM place_tag");

const insTag = db.prepare(`
  INSERT INTO tag (id, code, name_ko, name_en, axis, parent_id, level,
                   is_seasonal, season_months, evidence, source_code, built_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`);
const insPlaceTag = db.prepare(`
  INSERT OR IGNORE INTO place_tag (content_id, tag_id, evidence, confidence, detail, tagged_at)
  VALUES (?,?,?,?,?,?)
`);

// ═══════════════════════════════════════════════════════
//  1. subject — 관광공사 분류를 그대로 쓴다
// ═══════════════════════════════════════════════════════
/**
 * 계층을 어디서 자를 것인가.
 *
 * cat1 은 7종("자연","인문"…)이라 폴백 단위로 너무 거칠다.
 * 표본이 모자랄 때 "자연 전체 평균"을 빌려오면 등대가 국립공원 점수를 쓰게 된다.
 * → **대분류 = cat2(24종), 세부 = cat3(153종).** cat1 은 태그로 만들지 않는다.
 */
const cat2Rows = db
  .prepare("select code, name from category_code where level = 2 order by code")
  .all() as { code: string; name: string }[];
const cat3Rows = db
  .prepare("select code, name, parent from category_code where level = 3 order by code")
  .all() as { code: string; name: string; parent: string | null }[];

/** 코드 → 태그 id */
const tagIdByCat = new Map<string, string>();

const slug = (s: string) =>
  s
    .replace(/[/,.()·\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

for (const r of cat2Rows) {
  const id = `t_${r.code}`;
  tagIdByCat.set(r.code, id);
  insTag.run(id, `c_${slug(r.name)}`, r.name, "", "subject", null, 1, 0, null, "rule", r.code, now);
}
for (const r of cat3Rows) {
  const id = `t_${r.code}`;
  tagIdByCat.set(r.code, id);
  insTag.run(
    id,
    `c_${slug(r.name)}_${r.code.slice(-4)}`,
    r.name,
    "",
    "subject",
    r.parent ? (tagIdByCat.get(r.parent) ?? null) : null,
    2,
    0,
    null,
    "rule",
    r.code,
    now,
  );
}

// ═══════════════════════════════════════════════════════
//  2. subject — 관광공사 분류에 **없는** 소재
// ═══════════════════════════════════════════════════════
/**
 * 폐교와 간이역은 관광시설이 아니라 분류에 없다. 그런데 이 서비스의 주력 소재다.
 * (경쟁 영상이 없는 게 아니라 아무도 데이터로 만들지 않은 소재다)
 * → 대분류 '유휴공간' 을 새로 만든다. 관광공사 코드와 섞이지 않게 별도 접두사를 쓴다.
 */
const EXTRA_SUBJECT = {
  parent: { code: "idle_space", ko: "유휴공간", en: "Idle space" },
  children: [
    { code: "closed_school", ko: "폐교", en: "Closed school" },
    { code: "small_station", ko: "간이역", en: "Rural station" },
  ],
};

const idleParentId = "t_x_idle_space";
insTag.run(
  idleParentId,
  EXTRA_SUBJECT.parent.code,
  EXTRA_SUBJECT.parent.ko,
  EXTRA_SUBJECT.parent.en,
  "subject",
  null,
  1,
  0,
  null,
  "rule",
  null,
  now,
);
for (const c of EXTRA_SUBJECT.children) {
  insTag.run(
    `t_x_${c.code}`,
    c.code,
    c.ko,
    c.en,
    "subject",
    idleParentId,
    2,
    0,
    null,
    "rule",
    null,
    now,
  );
}

// ═══════════════════════════════════════════════════════
//  3. 나머지 축 — 어휘만 정의한다 (붙이는 건 4·5단계)
// ═══════════════════════════════════════════════════════
/**
 * 어휘를 지어내지 않았다. 관광사진 6,118장의 `search_keyword` 에서 실제로 많이 나온 말을 골랐다.
 * (야경 122 · 일몰 88 · 단풍 187 · 설경 155 · 드론촬영 552 · 파노라마 141 …)
 * 관광공사가 사진에 직접 붙인 말이라 우리가 상상한 것보다 믿을 만하다.
 *
 * evidence 가 축의 성패를 가른다:
 *   time   → overview (소개글에 "일출 명소" 처럼 사실로 적혀 있다)
 *   mood   → comment  (소개글에서 뽑으면 전부 '정겨움'이 된다. 홍보문이라서)
 *   format → video    (영상이 어떻게 찍혔는지는 영상만 안다)
 */
type Seed = {
  ko: string;
  en: string;
  code: string;
  months?: number[];
  children?: Seed[];
};

const AXES: { axis: string; evidence: string; groups: Seed[] }[] = [
  {
    axis: "time",
    evidence: "overview",
    groups: [
      {
        ko: "시간대",
        en: "Time of day",
        code: "time_of_day",
        children: [
          { ko: "일출", en: "Sunrise", code: "sunrise" },
          { ko: "일몰·노을", en: "Sunset", code: "sunset" },
          { ko: "야경", en: "Night view", code: "night_view" },
          { ko: "운무·새벽", en: "Morning mist", code: "mist" },
        ],
      },
      {
        ko: "계절",
        en: "Season",
        code: "season",
        children: [
          { ko: "벚꽃·봄꽃", en: "Spring blossom", code: "spring_blossom", months: [3, 4, 5] },
          { ko: "여름 녹음", en: "Summer green", code: "summer_green", months: [6, 7, 8] },
          { ko: "단풍", en: "Autumn foliage", code: "autumn_foliage", months: [10, 11] },
          { ko: "설경", en: "Snowscape", code: "snowscape", months: [12, 1, 2] },
        ],
      },
    ],
  },
  {
    axis: "mood",
    evidence: "comment",
    groups: [
      {
        ko: "무드",
        en: "Mood",
        code: "mood",
        children: [
          { ko: "한적함", en: "Quiet", code: "quiet" },
          { ko: "정겨움", en: "Homely", code: "homely" },
          { ko: "웅장함", en: "Grand", code: "grand" },
          { ko: "쓸쓸함", en: "Desolate", code: "desolate" },
          { ko: "이국적", en: "Exotic", code: "exotic" },
          { ko: "활기", en: "Lively", code: "lively" },
        ],
      },
    ],
  },
  {
    axis: "format",
    evidence: "video",
    groups: [
      {
        ko: "촬영 형식",
        en: "Shooting format",
        code: "format",
        children: [
          { ko: "드론·항공", en: "Drone", code: "drone" },
          { ko: "브이로그", en: "Vlog", code: "vlog" },
          { ko: "타임랩스", en: "Timelapse", code: "timelapse" },
          { ko: "먹방", en: "Mukbang", code: "mukbang" },
          { ko: "인터뷰·대화", en: "Interview", code: "interview" },
          { ko: "걷기·워크스루", en: "Walking tour", code: "walking_tour" },
        ],
      },
    ],
  },
  {
    axis: "persona",
    evidence: "video",
    groups: [
      {
        ko: "화자 성향",
        en: "Persona",
        code: "persona",
        children: [
          { ko: "혼자", en: "Solo", code: "solo" },
          { ko: "동행", en: "With companion", code: "companion" },
          { ko: "관찰형", en: "Observer", code: "observer" },
          { ko: "참여형", en: "Participant", code: "participant" },
        ],
      },
    ],
  },
  {
    axis: "audience",
    evidence: "video",
    groups: [
      {
        ko: "시청자",
        en: "Audience",
        code: "audience",
        children: [
          { ko: "국내 여행자", en: "Domestic traveler", code: "domestic" },
          { ko: "해외 한국여행", en: "Inbound traveler", code: "inbound" },
          { ko: "재방문·심화", en: "Repeat visitor", code: "repeat" },
        ],
      },
    ],
  },
];

let otherCount = 0;
for (const a of AXES) {
  for (const g of a.groups) {
    const pid = `t_${a.axis}_${g.code}`;
    insTag.run(pid, g.code, g.ko, g.en, a.axis, null, 1, 0, null, a.evidence, null, now);
    otherCount++;
    for (const c of g.children ?? []) {
      insTag.run(
        `t_${a.axis}_${c.code}`,
        c.code,
        c.ko,
        c.en,
        a.axis,
        pid,
        2,
        c.months ? 1 : 0,
        c.months ? c.months.join(",") : null,
        a.evidence,
        null,
        now,
      );
      otherCount++;
    }
  }
}

// ═══════════════════════════════════════════════════════
//  4. 규칙 기반 1차 태깅 — 돈 한 푼 안 드는 부분부터
// ═══════════════════════════════════════════════════════
let byCat = 0;
for (const p of db
  .prepare("select content_id, cat2, cat3 from tour_place where cat3 <> ''")
  .all() as { content_id: string; cat2: string; cat3: string }[]) {
  const t3 = tagIdByCat.get(p.cat3);
  const t2 = tagIdByCat.get(p.cat2);
  if (t3) {
    insPlaceTag.run(p.content_id, t3, "rule", 1.0, null, now);
    byCat++;
  }
  if (t2) insPlaceTag.run(p.content_id, t2, "rule", 1.0, null, now);
}

/**
 * 보강 데이터로 태그를 얹는다. place_link 로 이미 이어둔 짝만 대상이다.
 * 장날은 태그가 아니라 태그에 딸린 값(detail)이다 — "2,7" 을 태그로 만들면 태그가 폭발한다.
 */
let byMarket = 0;
for (const r of db
  .prepare(
    `select l.content_id, m.market_days
       from raw_market m
       join place_link l on l.source = 'market' and l.source_id = cast(m.id as text)
      where m.is_periodic = 1`,
  )
  .all() as { content_id: string; market_days: string }[]) {
  // 5일장 소분류 코드는 A04010100 계열. 이름으로 찾아 붙인다.
  const t = db.prepare("select id from tag where name_ko = '5일장'").get() as
    | { id: string }
    | undefined;
  if (!t) break;
  insPlaceTag.run(r.content_id, t.id, "rule", 1.0, r.market_days, now);
  byMarket++;
}

let byExtra = 0;
for (const [source, tagId, where] of [
  ["school", "t_x_closed_school", "usable = 1"],
  ["station", "t_x_small_station", "is_small = 1"],
] as const) {
  for (const r of db
    .prepare(
      `select l.content_id
         from raw_${source} r
         join place_link l on l.source = ? and l.source_id = cast(r.id as text)
        where ${where}`,
    )
    .all(source) as { content_id: string }[]) {
    insPlaceTag.run(r.content_id, tagId, "rule", 1.0, null, now);
    byExtra++;
  }
}

// ═══════════════════════════════════════════════════════
//  결과
// ═══════════════════════════════════════════════════════
const total = (db.prepare("select count(*) c from tour_place").get() as { c: number }).c;
const tagged = (
  db.prepare("select count(distinct content_id) c from place_tag").get() as { c: number }
).c;
const subjectTags = (
  db.prepare("select count(*) c from tag where axis = 'subject'").get() as { c: number }
).c;

console.log(`
3단계 · 태그 체계

  subject  ${subjectTags}개  (관광공사 대분류 ${cat2Rows.length} + 세부 ${cat3Rows.length} + 유휴공간 3)
  나머지 축 ${otherCount}개  (time · mood · format · persona · audience)
  합계      ${subjectTags + otherCount}개

규칙 기반 1차 태깅 — LLM 없이 붙은 것
  분류코드로     ${byCat.toLocaleString()}건
  장날 있는 시장  ${byMarket}건 (장날은 detail 에 "2,7" 로)
  폐교·간이역     ${byExtra}건
  ─────────────────────────────
  태그 붙은 장소  ${tagged.toLocaleString()} / ${total.toLocaleString()}  ${((tagged / total) * 100).toFixed(1)}%

남은 ${(total - tagged).toLocaleString()}건은 4단계에서 소개글로 붙인다.
★ 위 ${byCat.toLocaleString()}건은 정답지다. LLM 을 전량에 돌리기 전에 여기서 정확도를 잰다.
`);

for (const r of db
  .prepare(
    `select t.name_ko, count(*) n from place_tag pt
       join tag t on t.id = pt.tag_id
      where t.level = 2 group by t.id order by n desc limit 12`,
  )
  .all() as { name_ko: string; n: number }[]) {
  console.log(`  ${String(r.n).padStart(5)}  ${r.name_ko}`);
}
console.log("");
