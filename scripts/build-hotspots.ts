/**
 * 5단계-B · 댓글 타임스탬프에서 화제 구간을 뽑아 화면용 JSON 으로 굽는다.
 *
 * 실행:  npm run build:hotspots      (`yt:comments` 다음)
 * 출력:  src/data/real/hotspots.json
 *
 * 화면에서 YouTube API 를 부르지 않는다 (SPEC 6장 절대원칙 1).
 * 배포된 사이트는 우리 SQLite 도 못 읽으므로 빌드 시점 JSON 으로 굽는다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { openDb } from "./lib/db";
import { clusterMentions, mentionsIn, type Hotspot, type Mention } from "./lib/hotspot";

const OUT = "./src/data/real/hotspots.json";

/**
 * 롱폼만 대상이다. 쇼츠에서 화제 구간을 뽑아봐야 잘라낼 데가 없다.
 * 경계 180초는 export-channels 와 같은 기준 (2024년 10월부터 쇼츠가 3분까지다).
 */
const SHORTS_MAX_SEC = 180;

function main(): void {
  const db = openDb();

  const videos = db
    .prepare(
      `select v.video_id, v.title, v.duration_sec, v.view_count, v.language
         from yt_video v
        where v.duration_sec > ?
          and exists (select 1 from yt_comment c where c.video_id = v.video_id)`,
    )
    .all(SHORTS_MAX_SEC) as {
    video_id: string;
    title: string;
    duration_sec: number;
    view_count: number;
    language: string;
  }[];

  const getComments = db.prepare(
    `select text, like_count from yt_comment where video_id = ?`,
  );

  const out: Record<string, Hotspot[]> = {};
  let withAny = 0;
  let tocDropped = 0;
  let totalMentions = 0;

  for (const v of videos) {
    const rows = getComments.all(v.video_id) as { text: string; like_count: number }[];
    const ms: Mention[] = [];
    for (const r of rows) {
      const got = mentionsIn(r.text, r.like_count, v.duration_sec);
      // 타임스탬프는 있었는데 버려진 것(목차·광고·길이초과)을 따로 센다
      if (got.length === 0 && /\d{1,2}:[0-5]\d/.test(r.text)) tocDropped++;
      ms.push(...got);
    }
    totalMentions += ms.length;

    const spots = clusterMentions(ms);
    if (spots.length === 0) continue;
    withAny++;
    // 상위 3개만 굽는다. 화면은 1개만 쓰지만 나중에 고를 여지를 남긴다
    out[v.video_id] = spots.slice(0, 3);
  }

  mkdirSync("./src/data/real", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`\n5단계-B · 화제 구간\n`);
  console.log(`  대상 롱폼          ${videos.length.toLocaleString()}편`);
  console.log(`  타임스탬프 언급    ${totalMentions.toLocaleString()}건  (목차·광고·범위밖 ${tocDropped.toLocaleString()}건 제외)`);
  console.log(
    `  화제 구간 잡힌 영상 ${withAny.toLocaleString()}편  (${((100 * withAny) / (videos.length || 1)).toFixed(1)}%)`,
  );
  console.log(`  ${OUT}\n`);

  // 육안 검증용. 숫자만 보고 넘어가면 엉뚱한 구간을 잡아도 모른다
  const top = Object.entries(out)
    .sort((a, b) => b[1][0].mentions - a[1][0].mentions)
    .slice(0, 8);
  for (const [id, spots] of top) {
    const v = videos.find((x) => x.video_id === id)!;
    const s = spots[0];
    const mmss = (t: number) =>
      `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    console.log(`  ${v.title.slice(0, 34).padEnd(36)} ${mmss(s.at)}  댓글 ${String(s.mentions).padStart(2)}건`);
    console.log(`    └ ${s.top_comment.slice(0, 62)}`);
  }
  console.log("");
}

main();
