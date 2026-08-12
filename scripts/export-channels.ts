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
   * 조회수 ÷ 구독자. 채널 규모를 지우고 성과만 남기는 값이다 (SPEC 4장).
   * 구독자 2천 채널의 1만 조회와 200만 채널의 1만 조회는 전혀 다른 사건이다.
   */
  const vsrs = videos.map((v) => v.view_count / c.subscriber_count);

  return {
    id: c.channel_id,
    handle: c.handle,
    title: c.title,
    subscriber_count: c.subscriber_count,
    sub_band: c.sub_band,
    language: c.language,
    video_count: c.video_count,
    /** 최근 영상 기준 실측치. 화면의 "예상 도달" 범위를 여기서 만든다 */
    recent: {
      sample: videos.length,
      median_vsr: Number(median(vsrs).toFixed(3)),
      p25_vsr: Number(median(vsrs.filter((v) => v <= median(vsrs))).toFixed(3)),
      p75_vsr: Number(median(vsrs.filter((v) => v >= median(vsrs))).toFixed(3)),
      median_views: Math.round(median(videos.map((v) => v.view_count))),
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
      })),
  };
});

/**
 * 최근 영상이 너무 적은 채널은 뺀다.
 * 재생목록을 못 연 채널이 구독자 1 · 영상 0 인 껍데기로 남는데,
 * 이런 걸 화면에 올리면 "0×" 같은 값이 나와 데이터 전체를 의심받는다.
 */
const usable = out.filter((c) => c.recent.sample >= 5);
const dropped = out.length - usable.length;

mkdirSync("./src/data/real", { recursive: true });
writeFileSync(OUT, JSON.stringify(usable, null, 2) + "\n", "utf8");

console.log(`\n7단계-A · 채널 내보내기\n`);
console.log(
  `  ${OUT}  채널 ${usable.length}개${dropped ? `  (표본 부족 ${dropped}개 제외)` : ""}\n`,
);
for (const c of usable) {
  console.log(
    `  ${c.title.slice(0, 22).padEnd(24)} 구독 ${c.subscriber_count.toLocaleString().padStart(9)}` +
      `  ${c.sub_band.padEnd(9)} ${c.language}  최근 ${c.recent.sample}편 중앙 ${c.recent.median_vsr}×`,
  );
}
console.log("");
