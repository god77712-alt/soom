/**
 * 7단계-A · 수집한 채널을 화면용 JSON 으로 내보낸다.
 *
 * ── 왜 JSON 으로 굽는가 ──────────────────────────────────
 * SPEC 6장 절대원칙 1: **화면에서 YouTube API 를 직접 호출하지 않는다.**
 * 시연 중에 쿼터가 마르면 서비스가 통째로 멈추기 때문이다.
 * 게다가 배포된 사이트(Netlify)는 우리 SQLite 를 읽을 수 없다 — DB 는 커밋하지 않는다.
 *
 * → 수집 결과를 빌드 시점 JSON 으로 구워 넣는다. 방문자가 늘어도 쿼터는 0 이다.
 *
 * ── 지금 진짜로 보여줄 수 있는 것과 없는 것 ───────────────
 * 있음: 구독자 수, 구독자 구간, 언어, 최근 영상 성과(조회수 ÷ 구독자 중앙값), 상위 영상
 * 없음: **잘 되는 소재** — 영상→장소→태그 연결이 5단계라 아직 없다.
 *       그래서 소재 추천은 계속 시연 데이터를 쓴다. 섞어서 진짜인 척하지 않는다.
 *
 * 실행: npm run export:channels
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";

const OUT = "./src/data/real/channels.json";

const db = openDb();

type ChannelRow = {
  channel_id: string;
  title: string;
  handle: string | null;
  subscriber_count: number;
  sub_band: string;
  video_count: number;
  language: string;
};

type VideoRow = {
  video_id: string;
  title: string;
  view_count: number;
  published_at: string;
  duration_sec: number;
};

/** 중앙값. 평균을 쓰면 대박 영상 한 편이 채널 전체를 왜곡한다. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 쇼츠 경계 — **180초다. 60초가 아니다.**
 *
 * 2024년 10월에 쇼츠 최대 길이가 1분에서 3분으로 늘었다. 60초로 자르면
 * `Korea travel` 의 50편 중 46편(61~180초)이 롱폼으로 분류된다.
 * 실제로는 거의 다 쇼츠라서, 그 채널의 "롱폼 성적"이 통째로 쇼츠 성적이 된다.
 *
 * 길이만으로는 완벽히 못 가른다 (2분 30초짜리 일반 영상도 있다). 하지만
 * API 가 주는 신호가 길이뿐이고, **쇼츠를 롱폼에 섞는 쪽이 반대보다 훨씬 나쁘다** —
 * 우리는 롱폼 촬영지를 추천하는데 쇼츠 성적으로 기대값을 잡게 되기 때문이다.
 */
const SHORTS_MAX_SEC = 180;

/**
 * 배수를 그리려면 최소 5편. 태그 폴백과 같은 기준이다 (CLAUDE.md 2항).
 * 2~3편으로 중앙값을 내면 우연히 잘 된 한 편이 채널 전체를 대표해 버린다.
 */
const MIN_SAMPLE = 5;

/** 한 묶음(롱폼 또는 쇼츠)의 성적. 표본이 얇으면 배수를 null 로 둔다 */
function statsOf(videos: VideoRow[], subs: number) {
  const vsrs = videos.map((v) => v.view_count / subs);
  const enough = videos.length >= MIN_SAMPLE;
  return {
    sample: videos.length,
    /** null = 표본 부족. 화면은 이걸 보고 숫자 대신 사유를 띄운다 */
    median_vsr: enough ? Number(median(vsrs).toFixed(3)) : null,
    p25_vsr: enough
      ? Number(median(vsrs.filter((v) => v <= median(vsrs))).toFixed(3))
      : null,
    p75_vsr: enough
      ? Number(median(vsrs.filter((v) => v >= median(vsrs))).toFixed(3))
      : null,
    median_views: enough ? Math.round(median(videos.map((v) => v.view_count))) : null,
    median_duration: enough ? Math.round(median(videos.map((v) => v.duration_sec))) : null,
  };
}

const channels = db
  .prepare(
    `select channel_id, title, handle, subscriber_count, sub_band, video_count, language
       from yt_channel
      where subscriber_count > 0
      order by subscriber_count desc`,
  )
  .all() as ChannelRow[];

const out = channels.map((c) => {
  const videos = db
    .prepare(
      `select video_id, title, view_count, published_at, duration_sec
         from yt_video
        where channel_id = ? and found_by = 'channel'
        order by published_at desc
        limit 50`,
    )
    .all(c.channel_id) as VideoRow[];

  /**
   * ── 롱폼과 쇼츠를 절대 합치지 말 것 ────────────────────
   * 같은 채널 안에서도 둘의 성적이 정반대로 나온다 (실측):
   *
   *   영국남자    합산 0.016×  →  롱폼 0.275× / 쇼츠 0.014×   (롱폼이 20배)
   *   은윤이행님  합산 1.539×  →  롱폼 0.131× / 쇼츠 2.603×   (쇼츠가 20배)
   *
   * 방향이 채널마다 반대라 합산값에 보정 계수를 곱해도 못 고친다.
   * 언어별 점수판을 안 합치는 것과 같은 이유다 (CLAUDE.md 1항) —
   * 합치면 모든 채널이 평균으로 수렴해서 추천이 무의미해진다.
   *
   * 조회수 ÷ 구독자는 채널 규모를 지우고 성과만 남기는 값이다 (SPEC 4장).
   * 구독자 2천 채널의 1만 조회와 200만 채널의 1만 조회는 전혀 다른 사건이다.
   */
  const long = videos.filter((v) => v.duration_sec > SHORTS_MAX_SEC);
  const shorts = videos.filter((v) => v.duration_sec > 0 && v.duration_sec <= SHORTS_MAX_SEC);

  /** 롱폼이 주력인지 쇼츠가 주력인지. 화면이 어느 쪽을 먼저 보여줄지 정한다 */
  const primary: "long" | "short" | null =
    long.length >= MIN_SAMPLE && long.length >= shorts.length
      ? "long"
      : shorts.length >= MIN_SAMPLE
        ? "short"
        : long.length >= MIN_SAMPLE
          ? "long"
          : null;

  return {
    id: c.channel_id,
    handle: c.handle,
    title: c.title,
    subscriber_count: c.subscriber_count,
    sub_band: c.sub_band,
    language: c.language,
    video_count: c.video_count,
    /**
     * 최근 영상 기준 실측치. 화면의 "예상 도달" 범위를 여기서 만든다.
     * **롱폼 값만 쓴다** — 우리가 추천하는 건 촬영지고, 그건 롱폼의 재료다.
     */
    recent: {
      sample: videos.length,
      cut_sec: SHORTS_MAX_SEC,
      primary,
      long: statsOf(long, c.subscriber_count),
      short: statsOf(shorts, c.subscriber_count),
    },
    /** 상위 3편. 채널 주인이 자기 채널을 알아보게 하는 장치 */
    top: videos
      .slice()
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 3)
      .map((v) => ({
        video_id: v.video_id,
        title: v.title,
        view_count: v.view_count,
        published_at: v.published_at.slice(0, 10),
        vsr: Number((v.view_count / c.subscriber_count).toFixed(2)),
        duration_sec: v.duration_sec,
        /** 상위 3편에도 형식을 붙인다. 안 붙이면 쇼츠 대박을 롱폼 실력으로 읽는다 */
        is_short: v.duration_sec > 0 && v.duration_sec <= SHORTS_MAX_SEC,
      })),
  };
});

/**
 * 최근 영상이 너무 적은 채널은 뺀다.
 * 재생목록을 못 연 채널이 구독자 1 · 영상 0 인 껍데기로 남는데,
 * 이런 걸 화면에 올리면 "0×" 같은 값이 나와 데이터 전체를 의심받는다.
 */
const usable = out.filter((c) => c.recent.primary !== null);
const dropped = out.length - usable.length;

mkdirSync("./src/data/real", { recursive: true });
writeFileSync(OUT, JSON.stringify(usable, null, 2) + "\n", "utf8");

console.log(`\n7단계-A · 채널 내보내기\n`);
console.log(
  `  ${OUT}  채널 ${usable.length}개${dropped ? `  (표본 부족 ${dropped}개 제외)` : ""}\n`,
);
const fmt = (s: { sample: number; median_vsr: number | null }) =>
  s.median_vsr === null
    ? `${String(s.sample).padStart(2)}편 표본부족`.padEnd(14)
    : `${String(s.sample).padStart(2)}편 ${String(s.median_vsr).padEnd(6)}×`.padEnd(14);

console.log(`  ${"채널".padEnd(23)}${"구독".padStart(10)}   롱폼(>180초)    쇼츠(<=180초)`);
for (const c of usable) {
  console.log(
    `  ${c.title.slice(0, 22).padEnd(24)}${c.subscriber_count.toLocaleString().padStart(9)}  ` +
      `${fmt(c.recent.long)}  ${fmt(c.recent.short)}  ${c.recent.primary === "long" ? "롱폼형" : "쇼츠형"}`,
  );
}
console.log("");
