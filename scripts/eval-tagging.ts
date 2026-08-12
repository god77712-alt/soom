/**
 * 4단계-A · 정답지로 LLM 태깅 정확도 재기.
 *
 * ── 왜 전량 태깅 전에 이걸 먼저 하는가 ────────────────────
 * 소개글이 있고 관광공사 분류(cat3)도 있는 장소가 627건 있다.
 * cat3 는 사람이 붙인 값이므로 **정답지**다.
 * 여기서 정확도를 재고 프롬프트를 고친 다음에 나머지 26,000건에 돌린다.
 *
 * 검증 없이 전량 돌리면 틀린 태깅 4만 건을 나중에 발견한다.
 * 그때는 이미 돈과 시간을 다 쓴 뒤다.
 *
 * ── 점수를 두 가지로 나눠 보는 이유 ──────────────────────
 * 소분류가 정확히 맞는 것(exact)과 대분류만 맞는 것(parent)은 뜻이 다르다.
 * "한식"을 "이색음식점"으로 본 건 거의 맞은 것이고,
 * "한식"을 "사찰"로 본 건 완전히 틀린 것이다. 6단계 폴백도 대분류 단위로 돈다.
 *
 * 실행: npm run eval:tagging [-- --n 60]
 */
import { openDb } from "./lib/db";
import { buildSystem, buildTaxonomy, tagOne } from "./lib/tagger";

const argv = process.argv.slice(2);
const argOf = (k: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const N = Number(argOf("n") ?? 60);
const CONCURRENCY = 4;

const db = openDb();
const { text: taxonomy, nameToCode, codeToName, parentOf } = buildTaxonomy(db);
const system = buildSystem(taxonomy);

type Row = { id: string; name: string; overview: string; truth: string };

/**
 * 정답지를 고른다.
 *
 * 흔한 분류만 뽑으면 점수가 부풀려진다 (음식점이 전체의 4분의 1이라 '한식'만 맞춰도 높게 나온다).
 * → 분류별로 골고루 뽑는다. 실제 태깅 대상의 어려움에 가깝게.
 */
const rows = db
  .prepare(
    `select p.id, p.name_ko as name, p.description_ko as overview, tp.cat3 as truth
       from place p
       join tour_place tp on tp.content_id = p.source_id
      where p.source = 'tourapi'
        and p.description_ko is not null and p.description_ko <> ''
        and tp.cat3 <> ''
      order by (
        select count(*) from tour_place x where x.cat3 = tp.cat3
      ) asc, p.id
      limit ?`,
  )
  .all(N) as Row[];

console.log(`\n4단계-A · 태깅 정확도 평가\n`);
console.log(`  모델   claude-opus-5 (effort low)`);
console.log(`  표본   ${rows.length}건 (희귀 분류 우선 — 쉬운 쪽으로 치우치지 않게)`);
console.log(`  소재   소분류 ${nameToCode.size}종\n`);

type Score = {
  exact: number;
  parent: number;
  miss: number;
  invalid: number;
  fail: number;
};
const score: Score = { exact: 0, parent: 0, miss: 0, invalid: 0, fail: 0 };
const misses: string[] = [];
const invalids = new Set<string>();
let inTok = 0;
let outTok = 0;
let cacheRead = 0;
let cacheWrite = 0;
let timeTagged = 0;

let done = 0;
async function worker(queue: Row[]): Promise<void> {
  for (;;) {
    const r = queue.shift();
    if (!r) return;

    let res;
    try {
      res = await tagOne(system, r.name, r.overview);
    } catch (e) {
      score.fail++;
      console.log(`  실패 ${r.name}: ${(e as Error).message.slice(0, 80)}`);
      continue;
    }

    inTok += res.usage.input_tokens;
    outTok += res.usage.output_tokens;
    cacheRead += res.usage.cache_read_input_tokens ?? 0;
    cacheWrite += res.usage.cache_creation_input_tokens ?? 0;

    if (!res.result) {
      score.fail++;
      continue;
    }
    if (res.result.times.length > 0) timeTagged++;

    // 목록에 없는 이름을 지어냈는지 먼저 본다. 이게 많으면 프롬프트가 잘못된 것이다.
    const predCodes: string[] = [];
    for (const s of res.result.subjects) {
      const code = nameToCode.get(s);
      if (code) predCodes.push(code);
      else invalids.add(s);
    }
    if (predCodes.length === 0) {
      score.invalid++;
      continue;
    }

    const truthParent = parentOf.get(r.truth);
    if (predCodes.includes(r.truth)) score.exact++;
    else if (truthParent && predCodes.some((c) => parentOf.get(c) === truthParent))
      score.parent++;
    else {
      score.miss++;
      if (misses.length < 15) {
        misses.push(
          `  ${r.name.slice(0, 20).padEnd(22)} 정답 ${(codeToName.get(r.truth) ?? r.truth).padEnd(14)} → 예측 ${predCodes.map((c) => codeToName.get(c)).join(", ")}`,
        );
      }
    }

    done++;
    if (done % 20 === 0) console.log(`  ${done}/${rows.length}`);
  }
}

async function main(): Promise<void> {
  const queue = [...rows];
  // 첫 건이 캐시를 쓰고 나머지가 읽는다. 동시에 시작하면 전부 캐시를 못 읽는다.
  const first = queue.shift();
  if (first) await worker([first]);
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  const n = rows.length;
  const pct = (v: number) => `${((v / n) * 100).toFixed(1)}%`;

  console.log(`
  결과

    소분류까지 정확   ${String(score.exact).padStart(3)}  ${pct(score.exact)}
    대분류는 맞음     ${String(score.parent).padStart(3)}  ${pct(score.parent)}   ← 6단계 폴백은 이 단위로 돈다
    틀림              ${String(score.miss).padStart(3)}  ${pct(score.miss)}
    목록에 없는 답    ${String(score.invalid).padStart(3)}  ${pct(score.invalid)}
    호출 실패         ${String(score.fail).padStart(3)}  ${pct(score.fail)}
    ─────────────────────────────
    쓸 만함(정확+대분류) ${pct(score.exact + score.parent)}

    시간대·계절이 붙은 곳 ${timeTagged}건 (${pct(timeTagged)})
  `);

  if (invalids.size) {
    console.log(`  ⚠️ 목록에 없는 이름을 지어냄: ${[...invalids].slice(0, 10).join(", ")}\n`);
  }
  if (misses.length) {
    console.log(`  틀린 예시:\n${misses.join("\n")}\n`);
  }

  // ── 비용 ────────────────────────────────────────────────
  // claude-opus-5: 입력 $5 / 출력 $25 per 1M. 캐시 읽기는 입력의 1/10, 쓰기는 1.25배.
  const cost =
    (inTok / 1e6) * 5 + (outTok / 1e6) * 25 + (cacheRead / 1e6) * 0.5 + (cacheWrite / 1e6) * 6.25;
  const remaining = (
    db
      .prepare(
        `select count(*) c from place p
          where p.description_ko is not null and p.description_ko <> ''`,
      )
      .get() as { c: number }
  ).c;

  console.log(`토큰

    입력(미캐시) ${inTok.toLocaleString()}  ·  출력 ${outTok.toLocaleString()}
    캐시 읽기    ${cacheRead.toLocaleString()}  ·  캐시 쓰기 ${cacheWrite.toLocaleString()}
    ${cacheRead === 0 ? "⚠️ 캐시 읽기 0 — system 문자열이 매번 바뀌고 있다" : `캐시 적중 ${((cacheRead / (cacheRead + inTok)) * 100).toFixed(0)}%`}

    이번 평가 $${cost.toFixed(3)}  →  건당 $${(cost / n).toFixed(5)}
    소개글 있는 ${remaining.toLocaleString()}건 전량 환산 $${((cost / n) * remaining).toFixed(2)}
    (전체 48,929건 기준 $${((cost / n) * 48929).toFixed(2)} · Batch API 쓰면 절반)
  `);

}

main();
