/**
 * 1단계-C · 장소 사진 수집 (detailImage2).
 *
 *   npm run collect:image
 *   npm run collect:image -- --limit 200 --concurrency 4
 *   npm run collect:image -- --dry        받을 대상만 세어 본다
 *
 * ── 왜 이게 필요한가 ──────────────────────────────────────
 * 우리가 파는 건 예측이 아니라 **목록**이다. 목록으로 어필하면 화면이 썸네일로
 * 채워지고, **사진 없는 카드는 있어도 안 눌린다.** 그래서 사진이 점수보다 중요하다.
 *
 * 목록 API(`areaBasedList2`)가 주는 `firstimage` 는 장소당 한 장뿐이고,
 * TourAPI 48,929곳 중 **약 6,900곳은 그마저도 비어 있다.**
 * 상설시장 564 · 한옥 281 · 게스트하우스 208 · 5일장 203 —
 * 전부 12개 주력 소재다. `detailImage2` 로만 메울 수 있다.
 *
 * ⚠️ **폐교·간이역·승격시장 1,104곳은 이걸로 못 메운다.** TourAPI 에 없어서
 *    contentId 자체가 없다. 그쪽은 관광사진 갤러리(`tour_photo`) 매칭이 답이고
 *    별개 작업이다. 여기서 메워지는 척하면 안 된다.
 *
 * ── 쿼터 ──────────────────────────────────────────────────
 * 🚨 `detailImage2` 는 `detailCommon2` 와 **별도의 1,000/일 버킷**이다 (실측).
 *    한도는 서비스별·오퍼레이션별로 따로 걸린다. 소개글이 [22] 로 막힌 날에도
 *    사진은 그대로 받아진다 — **그날을 통째로 버리지 말 것.**
 *
 * ── 이어받기 ──────────────────────────────────────────────
 * `tour_overview` 와 같은 원칙. 별도 체크포인트 파일을 두지 않는다.
 * `tour_image_status` 에 행이 있으면 받은 것이고, `fail` 은 **다시 받을 대상**이다.
 * 행이 있다는 이유로 건너뛰면 쿼터가 말라 실패한 것들이 영원히 빈 채로 남는다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";
import { nowIso, openDb, stripHtml } from "./lib/db";

interface ImageItem {
  contentid?: string;
  originimgurl?: string;
  smallimageurl?: string;
  imgname?: string;
}

// ── 인자 ──────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const DRY = argv.includes("--dry");
const LIMIT = Number(flag("limit") ?? 0) || Infinity;
const CONCURRENCY = Math.max(1, Number(flag("concurrency") ?? 4));

/**
 * 성과가 검증된 12개 주력 소재. `collect-overview.ts` 와 **같은 목록이어야 한다** —
 * 이름은 관광공사 소분류명 그대로다. 바꾸면 조인이 조용히 0건이 된다.
 */
const TARGET_SUBJECTS = [
  "야영장,오토캠핑장",
  "유적지/사적지",
  "사찰",
  "5일장",
  "폐교",
  "해수욕장",
  "상설시장",
  "계곡",
  "항구/포구",
  "고택",
  "섬",
  "자연휴양림",
];

const db = openDb();

// ── 대상 뽑기 ─────────────────────────────────────────────

/**
 * 우선순위 — 소개글 수집과 **같은 사고**다. 콘텐츠 타입 순서로 돌면 쇼핑만
 * 몇 주를 갈다가 정작 화면에 나올 소재는 한 건도 못 받는다 (실제로 그랬다).
 *
 *   ① 12개 주력 소재 · 사진이 아예 없는 곳 · 인구감소지역   ← 가장 아픈 자리
 *   ② 12개 주력 소재 · 사진이 아예 없는 곳
 *   ③ 12개 주력 소재 · 사진 1장은 있는 곳 (여러 장 확보)
 *   ④ 나머지 중 사진이 없는 곳
 *   ⑤ 나머지
 */
const targets = db
  .prepare(
    `SELECT p.content_id FROM tour_place p
      LEFT JOIN tour_image_status s ON s.content_id = p.content_id
      LEFT JOIN place pl ON pl.source_id = p.content_id AND pl.source = 'tourapi'
      WHERE s.content_id IS NULL OR s.status IS NULL OR s.status = 'fail'
      ORDER BY
        CASE
          WHEN EXISTS (SELECT 1 FROM place_tag pt JOIN tag t ON t.id = pt.tag_id
                        WHERE pt.place_id = pl.id
                          AND t.name_ko IN (${TARGET_SUBJECTS.map(() => "?").join(",")}))
           THEN CASE
                  WHEN COALESCE(pl.image_url, '') = ''
                   THEN CASE WHEN pl.is_declining_area = 1 THEN 0 ELSE 1 END
                  ELSE 2
                END
          ELSE CASE WHEN COALESCE(pl.image_url, '') = '' THEN 3 ELSE 4 END
        END,
        p.content_id`,
  )
  .all(...TARGET_SUBJECTS) as Array<{ content_id: string }>;

const queue = targets.slice(0, LIMIT === Infinity ? undefined : LIMIT);
const already = (
  db.prepare("SELECT COUNT(*) AS n FROM tour_image_status WHERE status <> 'fail'").get() as {
    n: number;
  }
).n;

console.log(`\n1단계-C · 장소 사진 수집 (detailImage2)`);
console.log(
  `  이미 조회 ${already.toLocaleString()} · 남은 ${targets.length.toLocaleString()} · 이번 실행 ${queue.length.toLocaleString()}`,
);
console.log(`  동시 ${CONCURRENCY}\n`);

if (DRY) {
  console.log(`  --dry · 쿼터를 쓰지 않았습니다.`);
  console.log(`  앞 10건: ${queue.slice(0, 10).map((q) => q.content_id).join(", ")}\n`);
  db.close();
  process.exit(0);
}

if (queue.length === 0) {
  console.log("받을 게 없습니다. 이미 전부 조회했습니다.\n");
  db.close();
  process.exit(0);
}

// ── 저장 ──────────────────────────────────────────────────

const insImage = db.prepare(
  `INSERT OR REPLACE INTO tour_image (content_id, ord, origin_url, small_url, name)
   VALUES (?,?,?,?,?)`,
);
const upsertStatus = db.prepare(`
  INSERT INTO tour_image_status (content_id, status, n_images, fail_code, fetched_at)
  VALUES (?,?,?,?,?)
  ON CONFLICT(content_id) DO UPDATE SET
    status     = excluded.status,
    n_images   = excluded.n_images,
    fail_code  = excluded.fail_code,
    fetched_at = excluded.fetched_at
`);

// ── 실행 ──────────────────────────────────────────────────

const runId = (
  db
    .prepare("INSERT INTO collect_run (phase, scope, started_at) VALUES (?, ?, ?) RETURNING id")
    .get("image", `${queue.length}건`, nowIso()) as { id: number }
).id;

let ok = 0;
let empty = 0;
let fail = 0;
let images = 0;
let done = 0;
let stopped: string | null = null;
const t0 = Date.now();

/** 쿼터 소진은 즉시 멈춘다. 계속 두드리면 fail 이 박히고 다음 날 큐에서 빠진다 */
const QUOTA_CODES = new Set(["22", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"]);
/** 코드를 못 읽는 게이트웨이 오류 대비 안전장치 */
const FAIL_STREAK_LIMIT = 50;
let failStreak = 0;

async function worker(items: Array<{ content_id: string }>): Promise<void> {
  for (const it of items) {
    if (stopped) return;

    const r = await callTourApi<ImageItem>(SERVICES.kor, "detailImage2", {
      contentId: it.content_id,
      imageYN: "Y",
    });

    if (!r.ok && QUOTA_CODES.has(r.code)) {
      stopped = `쿼터 소진 [${r.code}] ${r.message}`;
      return;
    }

    if (r.ok) {
      failStreak = 0;
    } else if ((failStreak += 1) >= FAIL_STREAK_LIMIT) {
      stopped = `연속 실패 ${failStreak}회 [${r.code}] ${r.message || r.raw?.slice(0, 120) || ""}`;
      return;
    }

    const rows = r.ok ? r.items.filter((d) => d.originimgurl || d.smallimageurl) : [];
    rows.forEach((d, i) => {
      insImage.run(
        it.content_id,
        i + 1,
        d.originimgurl ?? null,
        d.smallimageurl ?? null,
        d.imgname ? stripHtml(d.imgname) : null,
      );
    });

    const status = !r.ok ? "fail" : rows.length > 0 ? "ok" : "empty";
    upsertStatus.run(it.content_id, status, rows.length, r.ok ? null : r.code, nowIso());

    if (!r.ok) fail += 1;
    else if (rows.length > 0) {
      ok += 1;
      images += rows.length;
    } else empty += 1;

    done += 1;
    if (done % 250 === 0) {
      const rate = done / ((Date.now() - t0) / 1000);
      const left = ((queue.length - done) / rate / 60).toFixed(0);
      console.log(
        `  ${String(done).padStart(6)} / ${queue.length}  ` +
          `있음 ${ok} · 없음 ${empty} · 실패 ${fail} · 사진 ${images}장  ` +
          `${rate.toFixed(1)}/s  남은 ${left}분`,
      );
    }
  }
}

async function main() {
  // 라운드로빈. 앞뒤로 자르면 우선순위 높은 소재가 한 워커에 몰린다.
  const lanes: Array<Array<{ content_id: string }>> = Array.from({ length: CONCURRENCY }, () => []);
  queue.forEach((it, i) => lanes[i % CONCURRENCY].push(it));

  await Promise.all(lanes.map(worker));

  const mins = ((Date.now() - t0) / 60_000).toFixed(1);
  db.prepare(
    "UPDATE collect_run SET ok_count = ?, fail_count = ?, note = ?, ended_at = ? WHERE id = ?",
  ).run(ok + empty, fail, stopped ?? `${mins}분`, stopped ? null : nowIso(), runId);

  console.log(`\n═══════════════════════════════════════`);
  if (stopped) {
    console.log(` 중단: ${stopped}`);
    console.log(` 받은 만큼은 저장됨. 내일 같은 명령으로 이어받으세요.`);
  } else {
    console.log(` 완료  ${done.toLocaleString()}건  (${mins}분)`);
  }
  console.log(
    ` 있음 ${ok.toLocaleString()} · 없음 ${empty.toLocaleString()} · 실패 ${fail.toLocaleString()} · 사진 ${images.toLocaleString()}장`,
  );
  console.log(`═══════════════════════════════════════\n`);

  db.close();
}

main();
