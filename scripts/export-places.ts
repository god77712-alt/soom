/**
 * 소재별 **실제 촬영 가능 장소 목록**을 화면용 JSON 으로 굽는다.
 *
 * 실행: npm run export:places  →  src/data/real/places.json
 *
 * ── 왜 전량이 아니라 골라 담는가 ─────────────────────────
 * 목록 대상 장소가 20,934곳이라 통째로 구우면 수 MB 다. 배포 번들에 그걸 넣으면
 * 첫 화면이 느려지는데, 크리에이터가 한 소재에서 실제로 훑는 건 수십 곳이다.
 *
 * → 소재당 `CAP` 곳까지만. **무엇을 남기느냐가 중요하다** — 아래 정렬 참조.
 *
 * ── 왜 12개 소재만인가 ───────────────────────────────────
 * `eval:hypothesis` 로 영상 성과까지 확인된 소재가 이 12개다.
 * 나머지는 장소는 있어도 영상 표본이 0이라 "이 소재가 어떻게 먹히는지" 를 못 말한다.
 * 목록만 보여줄 수는 있지만, 그건 소개글·태깅이 더 찬 뒤에 늘린다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";

const OUT = "./src/data/real/places.json";

/** 소재당 최대 장소 수 */
const CAP = 240;

/**
 * 성과가 검증된 12개 소재. `slug` 는 URL 에 쓴다 —
 * `야영장,오토캠핑장`·`유적지/사적지` 처럼 쉼표·슬래시가 든 이름이 있어서
 * 태그명을 그대로 URL 에 넣을 수 없다.
 */
const SUBJECTS: { tag: string; slug: string; label: string }[] = [
  { tag: "5일장", slug: "oiljang", label: "오일장" },
  { tag: "폐교", slug: "pyegyo", label: "폐교" },
  { tag: "상설시장", slug: "market", label: "상설시장" },
  { tag: "사찰", slug: "sacheol", label: "사찰" },
  { tag: "유적지/사적지", slug: "yujeokji", label: "유적지" },
  { tag: "고택", slug: "gotaek", label: "고택" },
  { tag: "해수욕장", slug: "beach", label: "해수욕장" },
  { tag: "계곡", slug: "gyegok", label: "계곡" },
  { tag: "항구/포구", slug: "hanggu", label: "항구·포구" },
  { tag: "섬", slug: "seom", label: "섬" },
  { tag: "자연휴양림", slug: "hyuyangnim", label: "자연휴양림" },
  { tag: "야영장,오토캠핑장", slug: "camping", label: "야영장·오토캠핑장" },
];

/** 소재당 수집한 영상 수 (`collect-youtube.ts` SUBJECT_PLAN 의 검색어) */
const QUERY_OF: Record<string, string> = {
  "야영장,오토캠핑장": "차박 캠핑 브이로그",
  "유적지/사적지": "유적지 여행 브이로그",
  사찰: "사찰 여행 브이로그",
  "5일장": "오일장 여행 브이로그",
  폐교: "폐교 브이로그",
  해수욕장: "해수욕장 여행 브이로그",
  상설시장: "전통시장 여행 브이로그",
  계곡: "계곡 여행 브이로그",
  "항구/포구": "항구 여행 브이로그",
  고택: "고택 한옥 스테이 브이로그",
  섬: "섬 여행 브이로그",
  자연휴양림: "자연휴양림 브이로그",
};

/** 배수를 화면에 그려도 되는 최소 영상 수 (`score.ts` MIN_SAMPLE_FOR_MULTIPLIER) */
const MIN_FOR_MULTIPLIER = 100;

function main(): void {
  const db = openDb();

  const videoCount = db.prepare(
    `select count(*) n from yt_video where found_by = ?`,
  );

  /**
   * 정렬이 곧 편집 방침이다 (`score.ts` scarcity 주석).
   *
   *   ① 인구감소지역 먼저 — 이 서비스가 답해야 하는 곳이다.
   *      성과 예측이 아니라 방침이다. 화면도 그렇게 말한다.
   *   ② 사진 있는 것 먼저 — 목록 화면은 썸네일로 읽힌다. 글자만 남으면 안 훑는다.
   *   ③ 좌표가 원본인 것 먼저 — 추정 좌표는 지도에서 몇 km 어긋난다.
   *   ④ 시도·이름 — 같은 조건이면 지역이 뭉쳐 보이게
   */
  const places = db.prepare(
    `select pl.id, pl.name_ko, pl.sido, pl.sigungu, pl.addr,
            pl.lat, pl.lng, pl.is_declining_area, pl.image_url,
            pl.data_reliability, pl.coord_source
       from place_tag pt
       join tag t    on t.id = pt.tag_id
       join place pl on pl.id = pt.place_id
      where t.name_ko = ?
        and pl.lat is not null and pl.lat <> 0
      order by pl.is_declining_area desc,
               case when pl.image_url is not null and pl.image_url <> '' then 0 else 1 end,
               case when pl.coord_source = '원본' or pl.coord_source is null then 0 else 1 end,
               pl.sido, pl.name_ko
      limit ?`,
  );

  /**
   * 이 장소를 언급한 수집 영상. **전수가 아니다** — 우리 코퍼스 3,696편 기준이다.
   * 화면은 반드시 모수를 함께 말해야 한다 (build-video-place.ts 주석).
   */
  const placeVideos = db.prepare(
    `select v.video_id, v.title, v.channel_title, v.view_count, v.duration_sec,
            v.language, v.chapters, c.subscriber_count subs
       from video_place vp
       join yt_video v on v.video_id = vp.video_id
       left join yt_channel c on c.channel_id = v.channel_id
      where vp.place_id = ?
      order by v.view_count desc
      limit 3`,
  );

  const videoCountByLang = db.prepare(
    `select v.language lang, count(*) n
       from video_place vp
       join yt_video v on v.video_id = vp.video_id
      where vp.place_id = ?
      group by v.language`,
  );

  interface VideoRow {
    video_id: string;
    title: string;
    channel_title: string;
    view_count: number;
    duration_sec: number;
    language: string;
    chapters: string;
    subs: number | null;
  }

  /** 언어별 언급 수. `en` 이 아니면 전부 국내로 본다 (detectLanguage 와 같은 기준) */
  const langCount = (placeId: string, want: "ko" | "en"): number => {
    const rows = videoCountByLang.all(placeId) as { lang: string; n: number }[];
    return rows
      .filter((r) => (want === "en" ? r.lang === "en" : r.lang !== "en"))
      .reduce((s, r) => s + r.n, 0);
  };

  const counts = db.prepare(
    `select count(*) n,
            sum(case when pl.is_declining_area = 1 then 1 else 0 end) d,
            count(distinct pl.sigungu) sg
       from place_tag pt
       join tag t    on t.id = pt.tag_id
       join place pl on pl.id = pt.place_id
      where t.name_ko = ?`,
  );

  const out = SUBJECTS.map((s) => {
    const c = counts.get(s.tag) as { n: number; d: number; sg: number };
    const v = (videoCount.get(QUERY_OF[s.tag] ? `search:${QUERY_OF[s.tag]}` : "") as { n: number }).n;
    const rows = places.all(s.tag, CAP) as {
      id: string;
      name_ko: string;
      sido: string;
      sigungu: string;
      addr: string | null;
      lat: number;
      lng: number;
      is_declining_area: number;
      image_url: string | null;
      data_reliability: string | null;
      coord_source: string | null;
    }[];

    return {
      slug: s.slug,
      tag: s.tag,
      label: s.label,
      /** 전국 실제 총계. 담은 것(places.length)과 다르다 — 화면이 둘 다 말한다 */
      total: c.n,
      declining: c.d,
      sigungu_count: c.sg,
      video_count: v,
      /** 배수를 숫자로 써도 되는가 */
      can_show_multiplier: v >= MIN_FOR_MULTIPLIER,
      places: rows.map((r) => ({
        id: r.id,
        name: r.name_ko,
        sido: r.sido,
        sigungu: r.sigungu,
        addr: r.addr,
        lat: Number(r.lat.toFixed(6)),
        lng: Number(r.lng.toFixed(6)),
        declining: r.is_declining_area === 1,
        image: r.image_url || null,
        /** 폐교·간이역은 현장이 자주 바뀐다 — 화면에 "현장 확인" 을 띄운다 */
        low_reliability: r.data_reliability === "low",
        /** 원본이 아니면 화면이 정확도를 낮춰 말한다 */
        coord_estimated: r.coord_source === "읍면추정" || r.coord_source === "시군구추정",
        /** 언어별 언급 영상 수. 0 은 "없다"가 아니라 "우리 코퍼스에서 안 잡혔다" */
        videos_ko: langCount(r.id, "ko"),
        videos_en: langCount(r.id, "en"),
        /** 이 장소를 언급한 영상 상위 3편. 카드 펼침의 근거가 된다 */
        videos: (placeVideos.all(r.id) as unknown as VideoRow[]).map((v) => ({
          video_id: v.video_id,
          title: v.title,
          channel_title: v.channel_title,
          view_count: v.view_count,
          subscriber_count: v.subs ?? 0,
          duration_sec: v.duration_sec,
          language: v.language,
          /**
           * ⚠️ 키 이름을 여기서 맞춘다. 수집기(`parseChapters`)는 `title` 로 저장하는데
           *    화면(`VideoBreakdown`·`shorts.ts`)은 `label` 을 본다. 안 바꾸면
           *    챕터가 전부 `undefined` 로 그려진다 — 타입 오류로 잡힌 실수다.
           */
          chapters: (JSON.parse(v.chapters || "[]") as { at: number; title: string }[]).map(
            (c) => ({ at: c.at, label: c.title }),
          ),
        })),
      })),
    };
  });

  mkdirSync("./src/data/real", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out) + "\n", "utf8");

  const bytes = JSON.stringify(out).length;
  console.log(`\n소재별 장소 목록\n`);
  console.log(`  ${OUT}  ${(bytes / 1024).toFixed(0)}KB\n`);
  console.log(`  ${"소재".padEnd(18)}${"전국".padStart(7)}${"감소지역".padStart(9)}${"담음".padStart(6)}${"영상".padStart(7)}   표시`);
  console.log(`  ${"─".repeat(60)}`);
  for (const o of out) {
    console.log(
      `  ${o.label.padEnd(18)}${String(o.total).padStart(7)}${String(o.declining).padStart(9)}` +
        `${String(o.places.length).padStart(6)}${String(o.video_count).padStart(7)}   ` +
        (o.can_show_multiplier ? "배수까지" : "순위만"),
    );
  }
  const noImg = out.map((o) => ({
    label: o.label,
    p: Math.round((100 * o.places.filter((x) => x.image).length) / (o.places.length || 1)),
  }));
  console.log(`\n  담은 장소의 사진 보유율`);
  console.log(`    ${noImg.map((x) => `${x.label} ${x.p}%`).join(" · ")}\n`);
}

main();
