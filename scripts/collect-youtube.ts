/**
 * 5단계 · YouTube 수집.
 *
 * 세 가지 일을 한다. 쿼터 성격이 완전히 달라서 명령을 나눴다.
 *
 *   npm run yt:channel -- @wanderkorea   채널 최근 영상  (3 units — 싸다)
 *   npm run yt:search                     소재·지역 검색  (페이지당 100 units — 비싸다)
 *   npm run yt:comments                   댓글 수집       (영상당 1 unit)
 *
 * ── 채널 분석에 search 를 쓰지 않는 이유 ──────────────────
 * search.list 로 채널 영상을 찾으면 100 units 다.
 * channels.list 로 업로드 재생목록을 받아 playlistItems 로 타면 **3 units** 다.
 * 33배 차이라, 승인 전에도 채널 수백 개를 돌려볼 수 있다.
 *
 * ── 언제 멈추는가 ────────────────────────────────────────
 * 호출 **전에** 남은 쿼터를 확인한다. 넘긴 뒤에는 그날 아무것도 못 하고,
 * 무엇보다 어디까지 받았는지 모르게 된다. 진행 상황은 yt_search_log 에 남는다.
 */
import { openDb, nowIso, stripHtml } from "./lib/db";
import {
  COST,
  DAILY_QUOTA,
  Quota,
  QuotaExceeded,
  call,
  detectLanguage,
  parseChannelInput,
  parseChapters,
  parseDuration,
  subBand,
} from "./lib/youtube";

const argv = process.argv.slice(2);
const mode = argv[0] ?? "channel";
const argOf = (k: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};

/** SPEC: 3년 이내 영상만 저장한다. 오래된 건 성과 기준이 달라 섞으면 안 된다. */
const CUTOFF = new Date(Date.now() - 3 * 365 * 86400_000).toISOString();

const db = openDb();
const quota = new Quota(db);
const now = nowIso();

const insVideo = db.prepare(`
  INSERT INTO yt_video (video_id, channel_id, channel_title, title, description,
    published_at, duration_sec, view_count, like_count, comment_count,
    language, chapters, found_by, fetched_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(video_id) DO UPDATE SET
    view_count = excluded.view_count,
    like_count = excluded.like_count,
    comment_count = excluded.comment_count,
    fetched_at = excluded.fetched_at
`);

type VideoItem = {
  id: string;
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    publishedAt: string;
  };
  contentDetails: { duration: string };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
};

/**
 * 영상 id 를 실제 데이터로 채운다. 50개 묶음에 1 unit.
 * 조회수·챕터·재생시간이 여기서만 나온다 — search 결과에는 없다.
 */
async function hydrate(ids: string[], foundBy: string): Promise<number> {
  let saved = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const r = await call<VideoItem>(quota, "videos", {
      part: "snippet,contentDetails,statistics",
      id: batch.join(","),
      maxResults: 50,
    });

    for (const v of r.items) {
      if (v.snippet.publishedAt < CUTOFF) continue;
      const desc = v.snippet.description ?? "";
      insVideo.run(
        v.id,
        v.snippet.channelId,
        v.snippet.channelTitle,
        v.snippet.title,
        desc,
        v.snippet.publishedAt,
        parseDuration(v.contentDetails?.duration ?? ""),
        Number(v.statistics?.viewCount ?? 0),
        Number(v.statistics?.likeCount ?? 0),
        Number(v.statistics?.commentCount ?? 0),
        detectLanguage(v.snippet.title, desc),
        JSON.stringify(parseChapters(desc)),
        foundBy,
        now,
      );
      saved++;
    }
  }
  return saved;
}

// ═══════════════════════════════════════════════════════
//  1. 채널 — 3 units 로 최근 50편
// ═══════════════════════════════════════════════════════
type ChannelItem = {
  id: string;
  snippet: { title: string; description: string; country?: string; customUrl?: string };
  statistics: { subscriberCount?: string; videoCount?: string; viewCount?: string };
  contentDetails: { relatedPlaylists: { uploads: string } };
};

async function collectChannel(input: string): Promise<void> {
  const { kind, value } = parseChannelInput(input);

  const r = await call<ChannelItem>(quota, "channels", {
    part: "snippet,statistics,contentDetails",
    ...(kind === "id" ? { id: value } : { forHandle: value }),
  });

  const ch = r.items[0];
  if (!ch) {
    console.log(`  채널을 찾지 못했습니다: ${input}`);
    return;
  }

  const subs = Number(ch.statistics?.subscriberCount ?? 0);
  db.prepare(
    `INSERT INTO yt_channel (channel_id, title, handle, subscriber_count, sub_band,
       video_count, view_count, uploads_playlist, language, country, fetched_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id) DO UPDATE SET
       subscriber_count = excluded.subscriber_count,
       sub_band = excluded.sub_band,
       video_count = excluded.video_count,
       view_count = excluded.view_count,
       fetched_at = excluded.fetched_at`,
  ).run(
    ch.id,
    ch.snippet.title,
    ch.snippet.customUrl ?? null,
    subs,
    subBand(subs),
    Number(ch.statistics?.videoCount ?? 0),
    Number(ch.statistics?.viewCount ?? 0),
    ch.contentDetails.relatedPlaylists.uploads,
    detectLanguage(ch.snippet.title, ch.snippet.description ?? ""),
    ch.snippet.country ?? null,
    now,
  );

  console.log(
    `  ${ch.snippet.title}  구독자 ${subs.toLocaleString()} (${subBand(subs)})  영상 ${ch.statistics?.videoCount}`,
  );

  // 업로드 재생목록을 탄다 — 여기가 search 를 피하는 지점이다
  const ids: string[] = [];
  let token: string | undefined;
  const want = Number(argOf("max") ?? 50);

  while (ids.length < want) {
    let p;
    try {
      p = await call<{ contentDetails: { videoId: string; videoPublishedAt?: string } }>(
        quota,
        "playlistItems",
        {
          part: "contentDetails",
          playlistId: ch.contentDetails.relatedPlaylists.uploads,
          maxResults: 50,
          ...(token ? { pageToken: token } : {}),
        },
      );
    } catch (e) {
      if (e instanceof QuotaExceeded) throw e;
      /**
       * 업로드 재생목록을 못 여는 채널이 있다 (비공개·삭제·지역 차단).
       * 채널 정보는 이미 저장했으니 여기서 죽이지 않고 다음 채널로 넘어간다.
       * 채널을 목록으로 돌릴 때 하나 때문에 전체가 멈추면 안 된다.
       */
      console.log(`  재생목록을 열 수 없습니다: ${(e as Error).message.slice(0, 60)}`);
      break;
    }
    for (const it of p.items) ids.push(it.contentDetails.videoId);
    token = p.nextPageToken;
    if (!token) break;
  }
  if (ids.length === 0) return;

  const saved = await hydrate(ids.slice(0, want), "channel");
  console.log(`  영상 ${saved}건 저장 (3년 이내만)\n`);
}

// ═══════════════════════════════════════════════════════
//  2. 검색 — 페이지당 100 units. 제일 비싸다
// ═══════════════════════════════════════════════════════
/**
 * 검색어를 데이터에서 만든다.
 *
 * 지어내지 않고 실제로 태그가 붙은 소재와 인구감소지역 시군구명을 쓴다.
 * SPEC 8장의 형태를 따른다.
 */
function buildQueries(limit: number): { query: string; language: string }[] {
  const out: { query: string; language: string }[] = [];

  const subjects = db
    .prepare(
      `select t.name_ko n, count(*) c from place_tag pt
         join tag t on t.id = pt.tag_id
        where t.axis = 'subject' and t.level = 2
        group by t.id order by c desc limit 40`,
    )
    .all() as { n: string }[];

  for (const s of subjects) {
    out.push({ query: `${s.n} 브이로그`, language: "ko" });
    out.push({ query: `Korea ${s.n} travel`, language: "en" });
  }

  const regions = db
    .prepare(
      `select distinct sigungu n from place
        where is_declining_area = 1 and sigungu is not null limit 60`,
    )
    .all() as { n: string }[];

  for (const r of regions) {
    out.push({ query: `${r.n} 여행`, language: "ko" });
  }

  return out.slice(0, limit);
}

type SearchItem = { id: { videoId?: string } };

async function collectSearch(): Promise<void> {
  const pagesPer = Number(argOf("pages") ?? 2);
  const queries = buildQueries(Number(argOf("queries") ?? 1000));

  const affordable = Math.floor(quota.left / COST.search);
  console.log(
    `  검색어 ${queries.length}개 · 검색어당 ${pagesPer}페이지\n` +
      `  남은 쿼터로 가능한 검색 ${affordable}회 (필요 ${queries.length * pagesPer}회)\n`,
  );
  if (affordable === 0) {
    console.log("  오늘 검색할 여유가 없습니다.\n");
    return;
  }

  const logUp = db.prepare(
    `INSERT INTO yt_search_log (query, language, page_token, pages_done, found, done, updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(query, language) DO UPDATE SET
       page_token = excluded.page_token, pages_done = excluded.pages_done,
       found = excluded.found, done = excluded.done, updated_at = excluded.updated_at`,
  );

  let totalSaved = 0;
  for (const q of queries) {
    const prev = db
      .prepare("select page_token, pages_done, found, done from yt_search_log where query=? and language=?")
      .get(q.query, q.language) as
      | { page_token: string | null; pages_done: number; found: number; done: number }
      | undefined;
    if (prev?.done) continue;

    let token = prev?.page_token ?? undefined;
    let pages = prev?.pages_done ?? 0;
    let found = prev?.found ?? 0;

    try {
      for (let i = 0; i < pagesPer; i++) {
        const r = await call<SearchItem>(quota, "search", {
          part: "id",
          type: "video",
          q: q.query,
          maxResults: 50,
          order: "relevance",
          relevanceLanguage: q.language,
          publishedAfter: CUTOFF,
          ...(token ? { pageToken: token } : {}),
        });

        const ids = r.items.map((x) => x.id.videoId).filter((v): v is string => Boolean(v));
        found += await hydrate(ids, `search:${q.query}`);
        pages++;
        token = r.nextPageToken;
        if (!token) break;
      }
      logUp.run(q.query, q.language, token ?? null, pages, found, token ? 0 : 1, nowIso());
      totalSaved += found;
      console.log(`  ${q.query.padEnd(24)} ${found}편  (남은 쿼터 ${quota.left})`);
    } catch (e) {
      logUp.run(q.query, q.language, token ?? null, pages, found, 0, nowIso());
      if (e instanceof QuotaExceeded) {
        console.log(`\n  쿼터 소진 — 여기까지. 내일 같은 명령으로 이어받습니다.\n`);
        break;
      }
      throw e;
    }
  }
  console.log(`\n  영상 ${totalSaved}편 저장\n`);
}

// ═══════════════════════════════════════════════════════
//  3. 댓글 — 영상당 1 unit
// ═══════════════════════════════════════════════════════
type CommentThread = {
  snippet: {
    topLevelComment: {
      id: string;
      snippet: { textOriginal: string; likeCount: number; publishedAt: string };
    };
  };
};

async function collectComments(): Promise<void> {
  /**
   * 영어권 영상을 먼저 받는다.
   * 한국어 영상은 제목에 지명이 있지만, 영어권은 "I Visited Korea's Most Beautiful
   * Village" 식이라 댓글이 지명을 얻는 **유일한** 경로다.
   */
  const targets = db
    .prepare(
      `select v.video_id from yt_video v
        where v.comment_count > 0
          and not exists (select 1 from yt_comment c where c.video_id = v.video_id)
        order by (v.language = 'en') desc, v.view_count desc
        limit ?`,
    )
    .all(Number(argOf("max") ?? 200)) as { video_id: string }[];

  const ins = db.prepare(
    `INSERT OR IGNORE INTO yt_comment (comment_id, video_id, text, like_count, published_at, fetched_at)
     VALUES (?,?,?,?,?,?)`,
  );

  let saved = 0;
  for (const t of targets) {
    if (!quota.canAfford("commentThreads")) {
      console.log("\n  쿼터 소진 — 여기까지.\n");
      break;
    }
    try {
      const r = await call<CommentThread>(quota, "commentThreads", {
        part: "snippet",
        videoId: t.video_id,
        maxResults: 100,
        order: "relevance",
        textFormat: "plainText",
      });
      for (const c of r.items) {
        const s = c.snippet.topLevelComment;
        ins.run(
          s.id,
          t.video_id,
          stripHtml(s.snippet.textOriginal ?? ""),
          s.snippet.likeCount ?? 0,
          s.snippet.publishedAt,
          now,
        );
        saved++;
      }
    } catch (e) {
      if (e instanceof QuotaExceeded) {
        console.log("\n  쿼터 소진 — 여기까지.\n");
        break;
      }
      // 댓글이 꺼진 영상은 403 이다. 흔한 일이라 넘어간다.
      continue;
    }
  }
  console.log(`  댓글 ${saved.toLocaleString()}건 저장 (영상 ${targets.length}개 대상)\n`);
}

// ═══════════════════════════════════════════════════════
async function main(): Promise<void> {
  console.log(`\n5단계 · YouTube 수집 [${mode}]`);
  console.log(`  쿼터 ${quota.spent.toLocaleString()} / ${DAILY_QUOTA.toLocaleString()} 사용 · 남음 ${quota.left.toLocaleString()}\n`);

  try {
    if (mode === "channel") {
      const input = argv[1] && !argv[1].startsWith("--") ? argv[1] : argOf("id");
      if (!input) {
        console.log("  채널을 지정하세요: npm run yt:channel -- @핸들\n");
        return;
      }
      await collectChannel(input);
    } else if (mode === "search") {
      await collectSearch();
    } else if (mode === "comments") {
      await collectComments();
    } else {
      console.log(`  알 수 없는 모드: ${mode} (channel | search | comments)\n`);
      return;
    }
  } catch (e) {
    if (e instanceof QuotaExceeded) console.log(`\n  ${e.message}\n`);
    else throw e;
  }

  const v = (db.prepare("select count(*) c from yt_video").get() as { c: number }).c;
  const c = (db.prepare("select count(*) c from yt_comment").get() as { c: number }).c;
  const withCh = (
    db.prepare("select count(*) c from yt_video where chapters <> '[]'").get() as { c: number }
  ).c;

  console.log(
    `누적  영상 ${v.toLocaleString()} (챕터 있음 ${withCh.toLocaleString()}) · 댓글 ${c.toLocaleString()}\n` +
      `쿼터  ${quota.spent.toLocaleString()} / ${DAILY_QUOTA.toLocaleString()} 사용\n`,
  );
}

main();
