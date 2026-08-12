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
//  1-B. 채널 메타만 일괄 — 50개 묶음에 1 unit
// ═══════════════════════════════════════════════════════
/**
 * 수집한 영상에 등장하는 채널의 **구독자 수만** 채운다. 영상은 안 받는다.
 *
 * ── 왜 이게 급한가 ───────────────────────────────────────
 * 이 서비스의 모든 점수가 `조회수 ÷ 구독자` 위에 서 있다 (SPEC 4장).
 * 그런데 수집 영상 548편이 걸친 채널 162개 중 구독자를 아는 건 7개뿐이었다.
 * → **점수 체계의 유일한 입력값을 96% 에서 못 만들고 있었다.**
 *
 * 조회수만으로는 아무것도 못 한다. 구독자 620만 채널의 10만 조회는 실패고
 * 구독자 2천 채널의 1만 조회는 대박인데, 구독자를 모르면 둘이 구분되지 않는다.
 *
 * `channels.list` 는 id 50개를 한 번에 받고 1 unit 이다. 162개면 4 units.
 * 영상까지 받는 `yt:channel` 과 달리 재생목록을 안 타므로 훨씬 싸다.
 */
async function collectChannelMeta(): Promise<void> {
  const rows = db
    .prepare(
      `select distinct v.channel_id from yt_video v
        where v.channel_id is not null and v.channel_id <> ''
          and not exists (
            select 1 from yt_channel c
             where c.channel_id = v.channel_id and c.subscriber_count > 0)`,
    )
    .all() as { channel_id: string }[];

  if (rows.length === 0) {
    console.log("  채워야 할 채널이 없습니다.\n");
    return;
  }

  const ids = rows.map((r) => r.channel_id);
  console.log(`  대상 ${ids.length}개 · 예상 ${Math.ceil(ids.length / 50)} units\n`);

  const ins = db.prepare(
    `INSERT INTO yt_channel (channel_id, title, handle, subscriber_count, sub_band,
       video_count, view_count, uploads_playlist, language, country, fetched_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(channel_id) DO UPDATE SET
       title = excluded.title,
       subscriber_count = excluded.subscriber_count,
       sub_band = excluded.sub_band,
       video_count = excluded.video_count,
       view_count = excluded.view_count,
       fetched_at = excluded.fetched_at`,
  );

  let saved = 0;
  let hidden = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    if (!quota.canAfford("channels")) {
      console.log("  쿼터 소진 — 여기까지.\n");
      break;
    }
    const r = await call<ChannelItem>(quota, "channels", {
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
      maxResults: 50,
    });
    for (const ch of r.items) {
      const subs = Number(ch.statistics?.subscriberCount ?? 0);
      /**
       * 구독자를 숨긴 채널은 0 으로 온다. **저장은 하되 vsr 계산에서는 빠진다** —
       * 0 으로 나누면 무한대가 되고, 1 로 치면 그 채널이 모든 순위를 쓸어버린다.
       */
      if (subs === 0) hidden++;
      ins.run(
        ch.id,
        ch.snippet.title,
        ch.snippet.customUrl ?? null,
        subs,
        subBand(subs),
        Number(ch.statistics?.videoCount ?? 0),
        Number(ch.statistics?.viewCount ?? 0),
        ch.contentDetails?.relatedPlaylists?.uploads ?? "",
        detectLanguage(ch.snippet.title, ch.snippet.description ?? ""),
        ch.snippet.country ?? null,
        now,
      );
      saved++;
    }
  }

  console.log(
    `  채널 ${saved}개 저장${hidden ? ` (구독자 비공개 ${hidden}개 — vsr 계산에서 제외된다)` : ""}\n`,
  );
}

// ═══════════════════════════════════════════════════════
//  2. 검색 — 페이지당 100 units. 제일 비싸다
// ═══════════════════════════════════════════════════════
/**
 * ⚠️ 소재 이름만으로 검색하면 안 된다 — 실측으로 확인했다 (`npm run eval:videoplace`).
 *
 * `한식 브이로그` 로 받은 50편에는 중국·러시아·남극 영상이 섞여 있었고,
 * 그 채널들의 장소 적중률은 **0%** 였다. 여행 영상이 아니라 음식·일상 영상이라서다.
 * 반면 국내 여행 브이로그(써머진)는 33% 가 붙었다.
 *
 * → 검색어는 **여행 맥락을 명시**해야 하고, 소재보다 **지명**이 강하다 (22.6% vs 8.6%).
 *   국내 여행 브이로그는 설명란에 코스를 나열한다:
 *   "공주여행 → 루치아의 뜰, 가가책방, 메타세콰이어길"
 */

/**
 * 지역과 함께 쓰는 패턴.
 * "여행"·"브이로그"·"코스" 가 들어가야 여행 영상만 걸린다.
 * "1박2일 코스" 는 설명란에 일정이 적힌 영상을 특히 잘 끌어온다.
 */
const KO_REGION_PATTERNS = ["{r} 여행 브이로그", "{r} 여행 코스", "{r} 1박2일"];
const EN_REGION_PATTERNS = ["{r} Korea travel vlog"];

/**
 * 소재 검색에 쓸 대분류.
 *
 * 음식점·숙박·레포츠·공연은 뺀다. 그 이름으로 검색하면 여행 영상이 아니라
 * 먹방·숙소리뷰·경기중계가 온다. 장소 자체가 목적지인 것만 남긴다.
 */
const SUBJECT_PARENTS = [
  "자연관광지",
  "관광자원",
  "역사관광지",
  "휴양관광지",
  "체험관광지",
  "건축/조형물",
  "문화시설",
  "쇼핑",
  "유휴공간",
];

/** 소재 이름이 검색어로 안 되는 것들. 너무 일반적이거나 장소가 아니다. */
const SUBJECT_SKIP = new Set([
  "기타",
  "이색체험",
  "전문매장/상가",
  "대형마트",
  "백화점",
  "면세점",
  "사후면세점",
  "스키(보드) 렌탈샵",
  "학교",
  "어학당",
  "외국문화원",
  "컨벤션센터",
  "영화관",
  "도서관",
  "문화전수시설",
]);

/**
 * ★ 소재 점수를 낼 수 있게 만드는 계획 ★  `--plan subject`
 *
 * ── 왜 이 계획이 따로 필요한가 ───────────────────────────
 * `eval:hypothesis` 로 검정력을 재보니 이랬다:
 *
 *   소재당 31편으로 잡을 수 있는 차이   3배부터
 *   1.5배를 80% 로 잡으려면            소재당 약 300편 (로그평균 기준)
 *
 * 지금 지역 중심 계획(696개 × 3페이지 = 208,800 units)은 **소재당 표본을 안 만든다.**
 * 지역으로 긁으면 소재가 뒤섞여서, 아무리 많이 모아도 "오일장이 몇 배" 를 못 낸다.
 *
 * → 소재당 300편이 되게 **깊게** 판다. 12개 × 6페이지 = 7,200 units.
 *   하루 기본 쿼터 10,000 안에 들어간다. **승인을 기다릴 필요가 없다.**
 *
 * ── 왜 12개뿐인가 ────────────────────────────────────────
 * 세부 태그 153종 × 300편은 어떤 쿼터로도 불가능하다. 그래서 이 서비스의
 * **주력 소재만** 고른다. 고르는 기준 셋:
 *   ① 인구감소지역에 실제로 많다 (숫자는 place_tag 실측)
 *   ② 사람이 실제로 그렇게 검색한다 (`5일장` 이 아니라 `오일장`)
 *   ③ 목적지다 — 먹방·숙소리뷰가 아니라 가서 찍는 곳
 *
 * 나머지 태그는 점수를 안 낸다. 순위만 쓰고 배수를 안 그린다.
 * **표본 없이 배수를 그리는 것이 지금까지의 문제였다.**
 */
const SUBJECT_PLAN: { tag: string; query: string; note: string }[] = [
  // 인구감소지역 보유 수 순. 앞이 잘려도 주력이 남게 둔다
  { tag: "야영장,오토캠핑장", query: "차박 캠핑 브이로그", note: "감소지역 849 — 가장 두껍다" },
  { tag: "유적지/사적지", query: "유적지 여행 브이로그", note: "감소지역 640" },
  { tag: "사찰", query: "사찰 여행 브이로그", note: "감소지역 327" },
  { tag: "5일장", query: "오일장 여행 브이로그", note: "감소지역 244 · 장날 달력 보유" },
  { tag: "폐교", query: "폐교 브이로그", note: "감소지역 194 · TourAPI 에 없는 소재" },
  { tag: "해수욕장", query: "해수욕장 여행 브이로그", note: "감소지역 148" },
  { tag: "상설시장", query: "전통시장 여행 브이로그", note: "감소지역 131" },
  { tag: "계곡", query: "계곡 여행 브이로그", note: "감소지역 125" },
  { tag: "항구/포구", query: "항구 여행 브이로그", note: "감소지역 106" },
  { tag: "고택", query: "고택 한옥 스테이 브이로그", note: "감소지역 75" },
  { tag: "섬", query: "섬 여행 브이로그", note: "감소지역 62" },
  { tag: "자연휴양림", query: "자연휴양림 브이로그", note: "감소지역 60" },
];

/** 검색어 → 태그. 점수 계산이 이 표를 거꾸로 탄다 */
export const QUERY_TO_TAG = new Map(SUBJECT_PLAN.map((s) => [s.query, s.tag]));

function buildQueries(limit: number): { query: string; language: string }[] {
  /**
   * `--q "곡성 여행"` 으로 검색어를 직접 줄 수 있다.
   * 한 번이 100 units 라 전체를 돌려보고 판단할 수 없어서, 찍어보는 수단이 필요하다.
   */
  const manual = argOf("q");
  if (manual) {
    return [{ query: manual, language: argOf("lang") ?? "ko" }];
  }

  /**
   * `--plan subject` — 소재 점수를 낼 수 있게 만드는 계획.
   * 지역 계획과 **섞지 않는다.** 섞으면 쿼터가 지역에 먼저 쓰이고
   * 소재당 표본은 또 안 쌓인다 (지금까지 그랬다).
   */
  if (argOf("plan") === "subject") {
    return SUBJECT_PLAN.map((s) => ({ query: s.query, language: "ko" }));
  }

  const out: { query: string; language: string }[] = [];
  const seen = new Set<string>();
  const push = (query: string, language: string) => {
    const k = `${language}|${query}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ query, language });
  };

  /**
   * ① 지역 — 가장 강한 신호라 먼저 채운다.
   *
   * 인구감소지역(89곳)을 앞에 둔다. 쿼터가 중간에 마르면 뒤쪽이 잘리는데,
   * 이 서비스가 답해야 하는 곳이 거기라서 뒤로 밀면 안 된다.
   */
  const regions = db
    .prepare(
      `select distinct sigungu n, is_declining_area d from place
        where sigungu is not null and sigungu <> ''
        order by is_declining_area desc, sigungu`,
    )
    .all() as { n: string; d: number }[];

  for (const r of regions) {
    // "곡성군" 보다 "곡성" 으로 검색해야 걸린다. 영상은 행정 접미사를 안 쓴다.
    const base = r.n.replace(/(시|군|구)$/, "");
    if (base.length < 2) continue;
    for (const p of KO_REGION_PATTERNS) push(p.replace("{r}", base), "ko");
  }

  /**
   * ② 소재 — 지역만으로는 소재별 표본이 얇은 곳이 생긴다.
   *    폐교·간이역처럼 드문 소재는 지역 검색에 거의 안 걸린다.
   */
  const subjects = db
    .prepare(
      `select c.name_ko n, count(pt.place_id) c
         from tag c
         join tag p on p.id = c.parent_id
         left join place_tag pt on pt.tag_id = c.id
        where c.axis = 'subject' and c.level = 2
          and p.name_ko in (${SUBJECT_PARENTS.map(() => "?").join(",")})
        group by c.id
        order by c desc`,
    )
    .all(...SUBJECT_PARENTS) as { n: string }[];

  for (const s of subjects) {
    if (SUBJECT_SKIP.has(s.n)) continue;
    push(`${s.n} 여행 브이로그`, "ko");
  }

  /**
   * ③ 영어 — 해외 채널은 지명을 영어로 쓴다.
   *    시군구를 전부 영어로 옮길 수는 없으니 널리 알려진 곳 위주로 간다.
   */
  const EN_REGIONS = [
    "Jeju", "Busan", "Gyeongju", "Jeonju", "Gangneung", "Yeosu", "Andong",
    "Tongyeong", "Sokcho", "Pohang", "Suncheon", "Damyang", "Boseong",
    "Hadong", "Gapyeong", "Chuncheon", "Danyang", "Yeongwol", "Namhae", "Geoje",
  ];
  for (const r of EN_REGIONS) {
    for (const p of EN_REGION_PATTERNS) push(p.replace("{r}", r), "en");
  }

  const EN_SUBJECTS = [
    "Korean traditional market",
    "Korea five day market",
    "Korea abandoned school",
    "Korea rural train station",
    "Korea lighthouse",
    "Korea temple stay",
    "Korea hanok village",
    "Korea countryside travel",
    "Korea small town travel",
    "Korea hidden gems travel",
  ];
  for (const q of EN_SUBJECTS) push(q, "en");

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

  /**
   * `--dry` 는 검색어만 보여주고 끝낸다.
   * 1,000개 × 100 units 짜리 계획을 눈으로 확인하지 않고 돌릴 수는 없다.
   */
  if (argv.includes("--dry")) {
    const byLang = new Map<string, string[]>();
    for (const q of queries) (byLang.get(q.language) ?? byLang.set(q.language, []).get(q.language)!).push(q.query);
    for (const [lang, qs] of byLang) {
      console.log(`  [${lang}] ${qs.length}개`);
      console.log(`    ${qs.slice(0, 6).join(" / ")}`);
      console.log(`    …`);
      console.log(`    ${qs.slice(-3).join(" / ")}\n`);
    }
    console.log(
      `  예상 소비 ${(queries.length * pagesPer * COST.search).toLocaleString()} units` +
        ` (${pagesPer}페이지 기준)\n`,
    );
    return;
  }
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
    } else if (mode === "channelmeta") {
      await collectChannelMeta();
    } else if (mode === "search") {
      await collectSearch();
    } else if (mode === "comments") {
      await collectComments();
    } else {
      console.log(`  알 수 없는 모드: ${mode} (channel | channelmeta | search | comments)\n`);
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
