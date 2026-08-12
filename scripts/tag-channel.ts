/**
 * 채널 소재 태그를 **실데이터로** 만든다.
 *
 * 실행: npm run tag:channel
 * 출력: yt_video_subject 표 → `export:channels` 가 화면 JSON 으로 굽는다
 *
 * ── 왜 LLM 인가 (다른 방법을 먼저 재봤다) ────────────────
 *   영상→장소→태그    채널 영상 349편 중 장소가 붙은 것 11편   → 못 쓴다
 *   소재 이름 문자열   50편 중 0~13편                          → 못 쓴다
 *
 * 채널 영상은 대부분 쇼츠라 제목이 짧고 설명란이 비어 있다. 그래서 규칙으로는
 * 안 잡힌다. **롱폼 + 설명 100자 이상**인 영상만 골라 LLM 에 넘긴다.
 *
 * ── 분류할 수 없는 채널은 분류하지 않는다 ────────────────
 * 써머진·Korea travel 은 최근 업로드가 전부 쇼츠라 분류 가능한 영상이 0편이다.
 * 그런 채널에 억지로 태그를 붙이면 시연 데이터와 다를 게 없다.
 * **없으면 없다고 두고, 화면이 그 사실을 말한다.**
 */
import Anthropic from "@anthropic-ai/sdk";
import { openDb } from "./lib/db";
import { buildTaxonomy, client, MODEL } from "./lib/tagger";

const argv = process.argv.slice(2);
const argOf = (k: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};

/** 한 번에 넘길 영상 수. 캐시된 system 을 여러 건이 나눠 쓴다 */
const BATCH = 8;

/** 분류 대상 최소 조건 — 이보다 짧으면 근거가 없다 */
const MIN_DURATION = 180;
const MIN_DESC = 100;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer", description: "입력 번호" },
          subjects: {
            type: "array",
            items: { type: "string" },
            description: "소재 소분류 이름. 목록에 있는 것만. 최대 3개",
          },
        },
        required: ["i", "subjects"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

/**
 * ⚠️ 바이트 하나라도 바뀌면 프롬프트 캐시가 통째로 날아간다.
 *    영상 정보를 여기 끼워 넣지 말 것 — 전부 user 메시지로 간다.
 */
function buildSystem(taxonomy: string): string {
  return `당신은 유튜브 여행 영상의 제목과 설명을 읽고, 그 영상이 **어떤 장소를 찍었는지** 분류한다.

## 소재 분류 (한국관광공사 소분류)

${taxonomy}

## 규칙

- **영상이 실제로 찾아간 장소**만 고른다. 지나가며 언급한 것은 고르지 않는다.
- 목록에 있는 이름을 **글자 그대로** 쓴다. 목록에 없는 말을 지어내지 않는다.
- 보통 1~2개. 여러 곳을 돌아다닌 영상이라도 최대 3개까지만.
- 장소가 아니라 사람·먹방·리뷰가 중심이면 **빈 배열**로 둔다.
- 한국이 아닌 곳을 찍은 영상도 **빈 배열**로 둔다.
- 근거가 없으면 억지로 채우지 않는다. 빈 배열이 정답인 경우가 많다.`;
}

async function main(): Promise<void> {
  const db = openDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS yt_video_subject (
      video_id TEXT NOT NULL,
      subject  TEXT NOT NULL,
      PRIMARY KEY (video_id, subject)
    );
    CREATE INDEX IF NOT EXISTS idx_vs_video ON yt_video_subject(video_id);
    -- 분류를 시도했지만 소재가 없던 영상도 남긴다.
    -- 안 남기면 매번 다시 물어보게 되고, "분류했는데 없음"과 "아직 안 함"이 구분되지 않는다.
    CREATE TABLE IF NOT EXISTS yt_video_subject_done (
      video_id TEXT PRIMARY KEY
    );
  `);

  const { text: taxonomy, nameToCode } = buildTaxonomy(db);
  const system = buildSystem(taxonomy);

  const only = argOf("channel");
  const limit = Number(argOf("max") ?? 400);

  const videos = db
    .prepare(
      `select v.video_id, v.title, v.description, v.channel_title
         from yt_video v
        where v.found_by = 'channel'
          and v.duration_sec > ?
          and length(coalesce(v.description, '')) >= ?
          and not exists (select 1 from yt_video_subject_done d where d.video_id = v.video_id)
          ${only ? "and v.channel_id = ?" : ""}
        order by v.view_count desc
        limit ?`,
    )
    .all(...(only ? [MIN_DURATION, MIN_DESC, only, limit] : [MIN_DURATION, MIN_DESC, limit])) as {
    video_id: string;
    title: string;
    description: string;
    channel_title: string;
  }[];

  if (videos.length === 0) {
    console.log("\n  분류할 영상이 없습니다.\n");
    return;
  }

  console.log(`\n채널 영상 소재 분류\n`);
  console.log(`  대상 ${videos.length}편 · ${BATCH}편씩 · ${MODEL}\n`);

  const insS = db.prepare(`INSERT OR IGNORE INTO yt_video_subject (video_id, subject) VALUES (?,?)`);
  const insD = db.prepare(`INSERT OR IGNORE INTO yt_video_subject_done (video_id) VALUES (?)`);

  let tagged = 0;
  let empty = 0;
  let unknown = 0;
  let inTok = 0;
  let cacheTok = 0;
  let outTok = 0;

  for (let i = 0; i < videos.length; i += BATCH) {
    const batch = videos.slice(i, i + BATCH);
    const body = batch
      .map(
        (v, j) =>
          `[${j}] 제목: ${v.title}\n설명: ${(v.description ?? "").replace(/\s+/g, " ").slice(0, 900)}`,
      )
      .join("\n\n");

    let res: Anthropic.Message;
    try {
      res = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        // 분류라 깊게 생각할 게 없다. 비용과 지연을 줄인다
        output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: body }],
      });
    } catch (e) {
      console.log(`  실패: ${(e as Error).message.slice(0, 70)}`);
      continue;
    }

    inTok += res.usage.input_tokens ?? 0;
    cacheTok += res.usage.cache_read_input_tokens ?? 0;
    outTok += res.usage.output_tokens ?? 0;

    // 거부되면 content 가 비어 있다. 인덱싱 전에 확인한다
    if (res.stop_reason === "refusal") continue;
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") continue;

    let parsed: { results: { i: number; subjects: string[] }[] };
    try {
      parsed = JSON.parse(block.text);
    } catch {
      continue;
    }

    for (const r of parsed.results) {
      const v = batch[r.i];
      if (!v) continue;
      insD.run(v.video_id);
      const valid = r.subjects.filter((s) => nameToCode.has(s));
      // 목록에 없는 답은 버린다. 지어낸 이름을 태그로 저장하면 조인이 조용히 깨진다
      unknown += r.subjects.length - valid.length;
      if (valid.length === 0) empty++;
      for (const s of valid) {
        insS.run(v.video_id, s);
        tagged++;
      }
    }

    if ((i / BATCH) % 5 === 0) {
      process.stdout.write(`\r  ${Math.min(i + BATCH, videos.length)}/${videos.length}`);
    }
  }

  console.log(`\n\n  태그 ${tagged}건 · 소재 없음 ${empty}편 · 목록에 없는 답 ${unknown}건`);
  console.log(
    `  토큰  입력 ${inTok.toLocaleString()} (캐시 ${cacheTok.toLocaleString()}) · 출력 ${outTok.toLocaleString()}\n`,
  );

  const byCh = db
    .prepare(
      `select v.channel_title t, count(distinct vs.video_id) n, count(*) c
         from yt_video_subject vs join yt_video v on v.video_id = vs.video_id
        group by v.channel_id order by n desc limit 12`,
    )
    .all() as { t: string; n: number; c: number }[];
  console.log(`  채널별 분류된 영상`);
  for (const b of byCh) console.log(`    ${(b.t ?? "").slice(0, 22).padEnd(24)} ${b.n}편 · 태그 ${b.c}건`);
  console.log("");
}

main();
