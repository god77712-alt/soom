/**
 * ★ 이 프로젝트에서 가장 두려운 검증 ★
 *
 * 실행: npm run eval:hypothesis
 *
 * ── 무엇을 묻는가 ────────────────────────────────────────
 * 서비스 전체가 두 개의 가정 위에 서 있는데, 둘 다 한 번도 측정한 적이 없다.
 *
 *   가설 A · 소재가 성과를 예측한다
 *            거짓이면 점수 계산(SPEC 4장)도 태그 213개도 전부 장식이다.
 *
 *   가설 B · 비어 있는 곳이 기회다  (희소성 가중치 `1/log(1+영상수)`)
 *            거짓이면 서비스가 크리에이터를 **실패로 안내한다.** 4시간 운전시켜서.
 *            "아무도 안 갔다"가 아니라 "아무도 안 본다"일 수 있다.
 *
 * ── 왜 이 표본으로 재는가 ────────────────────────────────
 * 원래 하고 싶었던 건 **같은 채널 안에서** 소재를 바꿔 보는 것이다. 그래야
 * 크리에이터 실력이 상수가 된다. 그런데 수집 채널 161개 중 128개가 영상 1편뿐이라
 * 그 설계는 지금 표본으로 돌아가지 않는다 (검색은 채널당 한두 편만 물어온다).
 *
 * 대신 검색 코퍼스가 **자연 실험**으로 쓸 수 있게 생겼다. 검색어 하나가
 * 소재 하나고, 각 50편이 거의 다 서로 다른 채널이다:
 *
 *   곡성 여행 브이로그        인구감소지역 · 경쟁 희소   ← 가설 B 는 여기서 갈린다
 *   국내여행 브이로그          일반 (유명지 포함)         ← 대조군
 *   한식 브이로그              음식
 *   Korea travel vlog countryside  영어권 시골
 *
 * ⚠️ 채널 실력은 여전히 통제되지 않는다. 다만 **편향이 아니라 잡음**이 되도록
 *    구독자 구간별로도 따로 낸다. 구간을 안 나누면 큰 채널이 많이 걸린 묶음이
 *    이기는 걸 소재 효과로 착각한다.
 */
import { openDb } from "./lib/db";

/** 롱폼 기준. 쇼츠와 섞으면 성적이 형식 차이로 뒤집힌다 (실측 최대 43배) */
const SHORTS_MAX_SEC = 180;

/** 묶음으로 인정할 최소 편수. 이보다 적으면 중앙값이 우연에 흔들린다 */
const MIN_GROUP = 12;

type Row = { group: string; vsr: number; subs: number; lang: string };

// ── 통계 ────────────────────────────────────────────────

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 중앙값의 95% 신뢰구간 (부트스트랩).
 *
 * **점 추정만 보고 결론 내면 안 된다.** 50편짜리 묶음의 중앙값은 생각보다
 * 많이 흔들린다. 두 묶음의 구간이 겹치면 "차이가 있다"고 말할 수 없다.
 */
function bootCI(xs: number[], n = 2000): [number, number] {
  if (xs.length < 3) return [NaN, NaN];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const s: number[] = [];
    for (let j = 0; j < xs.length; j++) s.push(xs[(Math.random() * xs.length) | 0]);
    out.push(median(s));
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(n * 0.025)], out[Math.floor(n * 0.975)]];
}

/**
 * 두 묶음의 중앙값 차이가 우연인지 본다 (순열검정).
 *
 * 라벨을 무작위로 섞었을 때 지금만큼의 차이가 얼마나 자주 나오는가.
 * 자주 나오면 소재 때문이 아니다.
 */
function permP(a: number[], b: number[], n = 5000): number {
  const obs = Math.abs(median(a) - median(b));
  const all = [...a, ...b];
  let ge = 0;
  for (let i = 0; i < n; i++) {
    const s = [...all];
    for (let j = s.length - 1; j > 0; j--) {
      const k = (Math.random() * (j + 1)) | 0;
      [s[j], s[k]] = [s[k], s[j]];
    }
    if (Math.abs(median(s.slice(0, a.length)) - median(s.slice(a.length))) >= obs) ge++;
  }
  return ge / n;
}

const fx = (v: number) => (Number.isNaN(v) ? "  -  " : v.toFixed(3));

// ── 표본 만들기 ─────────────────────────────────────────

function main(): void {
  const db = openDb();

  /**
   * 구독자 0(비공개)은 뺀다. vsr 이 무한대가 되고, 1 로 치면 그 채널이
   * 모든 순위를 쓸어버린다.
   */
  const rows = db
    .prepare(
      `select v.found_by as g, v.view_count as vc, v.language as lang,
              c.subscriber_count as subs
         from yt_video v
         join yt_channel c on c.channel_id = v.channel_id
        where c.subscriber_count > 0
          and v.duration_sec > ?
          and v.view_count > 0`,
    )
    .all(SHORTS_MAX_SEC) as { g: string; vc: number; lang: string; subs: number }[];

  const data: Row[] = rows.map((r) => ({
    group: r.g.startsWith("search:") ? r.g.slice(7) : "채널수집",
    vsr: r.vc / r.subs,
    subs: r.subs,
    lang: r.lang,
  }));

  const groups = [...new Set(data.map((d) => d.group))]
    .map((g) => ({ g, xs: data.filter((d) => d.group === g).map((d) => d.vsr) }))
    .filter((x) => x.xs.length >= MIN_GROUP)
    .sort((a, b) => median(b.xs) - median(a.xs));

  console.log(`\n${"═".repeat(72)}`);
  console.log(`핵심 가설 검증 · 롱폼 ${data.length}편 (${SHORTS_MAX_SEC}초 초과)`);
  console.log("═".repeat(72));

  // ── 가설 A · 소재가 성과를 가르는가 ───────────────────
  console.log(`\n【가설 A】 소재가 성과를 예측하는가\n`);
  console.log(`  ${"소재(검색어)".padEnd(30)} 편수   중앙 vsr   95% 신뢰구간`);
  console.log(`  ${"─".repeat(66)}`);
  for (const { g, xs } of groups) {
    const [lo, hi] = bootCI(xs);
    console.log(
      `  ${g.slice(0, 28).padEnd(30)} ${String(xs.length).padStart(4)}    ${fx(median(xs)).padStart(6)}    ${fx(lo)} ~ ${fx(hi)}`,
    );
  }

  // 검색 묶음끼리만 비교한다. 채널수집은 소재가 뒤섞여 있어 대조군이 못 된다
  const search = groups.filter((x) => x.g !== "채널수집");

  /**
   * ── 전체 검정 (omnibus) ────────────────────────────────
   *
   * ⚠️ **쌍끼리 비교부터 하면 안 된다.** 12개 묶음이면 66쌍인데, α=0.05 로
   *    66번 검정하면 아무 효과가 없어도 3쌍쯤은 그냥 유의하게 나온다.
   *    처음 돌렸을 때 136쌍 중 9쌍이 유의했는데, 우연 기대치가 7쌍이었다.
   *    그걸 근거로 "소재가 성과를 가른다"고 말했으면 거짓말이 될 뻔했다.
   *
   * 그래서 먼저 **하나의 질문**을 하나의 검정으로 묻는다:
   *   "소재 라벨을 무작위로 섞어도 지금만큼 묶음끼리 벌어지는가?"
   *
   * 통계량은 묶음별 로그평균의 (편수 가중) 분산이다. 라벨을 섞었을 때
   * 이만큼 벌어지는 비율이 p 다. 검정이 하나뿐이라 보정할 것이 없다.
   */
  const logMean0 = (xs: number[]) => xs.reduce((s, x) => s + Math.log(x), 0) / xs.length;

  function spread(gs: { xs: number[] }[]): number {
    const all = gs.flatMap((g) => g.xs);
    const gm = logMean0(all);
    let v = 0;
    for (const g of gs) v += g.xs.length * (logMean0(g.xs) - gm) ** 2;
    return v / all.length;
  }

  function omnibus(gs: { g: string; xs: number[] }[], n = 3000): number {
    const obs = spread(gs);
    const sizes = gs.map((g) => g.xs.length);
    const all = gs.flatMap((g) => g.xs);
    let ge = 0;
    for (let i = 0; i < n; i++) {
      const s = [...all];
      for (let j = s.length - 1; j > 0; j--) {
        const k = (Math.random() * (j + 1)) | 0;
        [s[j], s[k]] = [s[k], s[j]];
      }
      let off = 0;
      const shuffled = sizes.map((sz) => {
        const part = s.slice(off, off + sz);
        off += sz;
        return { xs: part };
      });
      if (spread(shuffled) >= obs) ge++;
    }
    return ge / n;
  }

  if (search.length >= 3) {
    const p = omnibus(search);
    const gms = search.map((s) => ({ g: s.g, m: Math.exp(logMean0(s.xs)) }));
    gms.sort((a, b) => b.m - a.m);
    console.log(`\n  ── 전체 검정 · 소재 라벨을 섞어도 이만큼 벌어지는가 ──\n`);
    console.log(`    묶음 ${search.length}개 · 영상 ${search.reduce((s, x) => s + x.xs.length, 0)}편`);
    console.log(`    최고 ${gms[0].g.slice(0, 16)} ${gms[0].m.toFixed(3)}  ↔  최저 ${gms[gms.length - 1].g.slice(0, 16)} ${gms[gms.length - 1].m.toFixed(3)}`);
    console.log(`    격차 ${(gms[0].m / gms[gms.length - 1].m).toFixed(2)}배 (기하평균)`);
    console.log(`\n    p = ${p.toFixed(4)}  ${p < 0.05 ? "◀ 소재가 성과를 가른다" : "◀ 소재로 갈린다고 말할 수 없다"}`);

    /**
     * ── 구독자 구성을 걷어낸 재검정 ──────────────────────
     *
     * 어떤 소재에 작은 채널이 많이 걸리면 vsr 이 통째로 올라간다. 그걸
     * 소재 효과로 착각하면 안 된다. 각 영상의 log vsr 에서 **그 구독자 구간의
     * 평균**을 빼고 다시 돌린다. 구간 구성 차이가 사라진 상태에서도
     * 남는 차이만 진짜 소재 효과다.
     */
    const bandOf = (s: number) =>
      s < 10_000 ? 0 : s < 100_000 ? 1 : s < 1_000_000 ? 2 : 3;
    const bandMean = new Map<number, number>();
    for (const b of [0, 1, 2, 3]) {
      const xs = data.filter((d) => bandOf(d.subs) === b).map((d) => Math.log(d.vsr));
      if (xs.length > 0) bandMean.set(b, xs.reduce((s, x) => s + x, 0) / xs.length);
    }
    const adj = search.map((s) => ({
      g: s.g,
      xs: data
        .filter((d) => d.group === s.g)
        .map((d) => Math.exp(Math.log(d.vsr) - (bandMean.get(bandOf(d.subs)) ?? 0))),
    }));
    const pAdj = omnibus(adj);
    console.log(
      `    구독자 구성 보정 후  p = ${pAdj.toFixed(4)}  ${pAdj < 0.05 ? "◀ 보정해도 남는다" : "◀ 보정하면 사라진다 — 채널 구성 효과였다"}`,
    );
  }

  /**
   * 쌍끼리 비교는 **탐색용으로만** 본다. Benjamini-Hochberg 로 다중비교를 보정한다.
   * 보정을 통과한 쌍만 "이 둘은 다르다"고 말할 수 있다.
   */
  if (search.length >= 2) {
    const pairs: { a: string; b: string; p: number }[] = [];
    for (let i = 0; i < search.length; i++) {
      for (let j = i + 1; j < search.length; j++) {
        pairs.push({ a: search[i].g, b: search[j].g, p: permP(search[i].xs, search[j].xs, 2000) });
      }
    }
    pairs.sort((x, y) => x.p - y.p);
    const m = pairs.length;
    // BH: p(k) <= (k/m)·0.05 를 만족하는 가장 큰 k 까지가 통과
    let cut = 0;
    for (let k = 1; k <= m; k++) if (pairs[k - 1].p <= (k / m) * 0.05) cut = k;

    console.log(`\n  ── 쌍끼리 비교 (${m}쌍 · BH 다중비교 보정) ──\n`);
    console.log(`    보정 없이 p<0.05 인 쌍   ${pairs.filter((x) => x.p < 0.05).length}쌍`);
    console.log(`    우연히 기대되는 수       ${(0.05 * m).toFixed(1)}쌍`);
    console.log(`    보정을 통과한 쌍         ${cut}쌍\n`);
    for (const x of pairs.slice(0, Math.max(cut, 5))) {
      console.log(
        `    ${x.a.slice(0, 16).padEnd(18)} vs ${x.b.slice(0, 16).padEnd(18)} p=${x.p.toFixed(4)}` +
          (pairs.indexOf(x) < cut ? "  ◀ 통과" : ""),
      );
    }
    if (cut === 0) console.log(`\n    → 개별 쌍으로는 어느 것도 다르다고 말할 수 없다. 전체 검정만 본다.`);
  }

  // ── 구독자 구간을 갈라 본다 ────────────────────────────
  /**
   * 소재 효과처럼 보이는 것이 사실은 **채널 크기 구성 차이**일 수 있다.
   * 어떤 검색어에 작은 채널이 많이 걸리면 vsr 이 통째로 올라간다.
   * 구간 안에서도 순서가 유지되어야 소재 효과라고 말할 수 있다.
   */
  console.log(`\n  구독자 구간별 (구성 차이를 걷어낸 것)\n`);
  const bands: [string, number, number][] = [
    ["1만 미만", 0, 10_000],
    ["1만~10만", 10_000, 100_000],
    ["10만~100만", 100_000, 1_000_000],
    ["100만+", 1_000_000, Infinity],
  ];
  console.log(`  ${"소재".padEnd(24)}` + bands.map((b) => b[0].padStart(12)).join(""));
  for (const { g } of search) {
    const cells = bands.map(([, lo, hi]) => {
      const xs = data.filter((d) => d.group === g && d.subs >= lo && d.subs < hi).map((d) => d.vsr);
      return xs.length < 5 ? "-".padStart(12) : `${fx(median(xs))}(${xs.length})`.padStart(12);
    });
    console.log(`  ${g.slice(0, 22).padEnd(24)}` + cells.join(""));
  }
  console.log(`\n  (5편 미만 칸은 '-'. 표본이 얇으면 숫자를 쓰지 않는다)`);

  // ── 채널이 전부인가 · 분산 분해 ────────────────────────
  /**
   * 소재가 끼어들 자리가 있는지부터 본다.
   *
   * 같은 채널 안에서도 영상마다 성적이 크게 갈리면 → 소재가 설명할 여지가 있다.
   * 채널만 알면 거의 다 설명되면 → **소재로는 아무것도 못 바꾼다.**
   * 그러면 이 서비스는 "어디를 찍을까"가 아니라 다른 것을 팔아야 한다.
   *
   * vsr 은 꼬리가 길어 로그를 씌우고 잰다.
   */
  const byCh = db
    .prepare(
      `select v.channel_id as ch, v.view_count as vc, c.subscriber_count as subs
         from yt_video v
         join yt_channel c on c.channel_id = v.channel_id
        where c.subscriber_count > 0 and v.duration_sec > ? and v.view_count > 0`,
    )
    .all(SHORTS_MAX_SEC) as { ch: string; vc: number; subs: number }[];

  const map = new Map<string, number[]>();
  for (const r of byCh) {
    const l = Math.log(r.vc / r.subs);
    if (!map.has(r.ch)) map.set(r.ch, []);
    map.get(r.ch)!.push(l);
  }
  const multi = [...map.values()].filter((v) => v.length >= 5);

  console.log(`\n【분산 분해】 소재가 끼어들 자리가 있는가\n`);
  if (multi.length < 3) {
    console.log(`  영상 5편 이상인 채널이 ${multi.length}개뿐이라 계산하지 않는다.\n`);
  } else {
    const all = multi.flat();
    const gm = all.reduce((s, x) => s + x, 0) / all.length;
    let within = 0;
    let between = 0;
    for (const v of multi) {
      const m = v.reduce((s, x) => s + x, 0) / v.length;
      between += v.length * (m - gm) ** 2;
      for (const x of v) within += (x - m) ** 2;
    }
    const tot = within + between;
    console.log(`  채널 ${multi.length}개 · 영상 ${all.length}편 (log vsr 기준)\n`);
    console.log(`    채널이 설명하는 몫   ${((100 * between) / tot).toFixed(1)}%`);
    console.log(`    채널 안에서 갈리는 몫 ${((100 * within) / tot).toFixed(1)}%  ← 소재가 다툴 수 있는 최대치`);
  }

  // ── 가설 B · 비어 있는 곳이 기회인가 ──────────────────
  /**
   * 곡성은 인구감소지역이고 경쟁 영상이 희소하다. 국내여행 일반은 유명지를 포함한다.
   *
   * 희소성 가중치는 "곡성 같은 곳이 기회다" 라고 전제한다.
   * 곡성 영상들이 일반 국내여행보다 **못하면** 그 전제가 흔들린다.
   */
  console.log(`\n【가설 B】 비어 있는 곳이 기회인가 — 아니면 수요가 없는 것인가\n`);
  const scarce = data.filter((d) => d.group.includes("곡성")).map((d) => d.vsr);
  const general = data.filter((d) => d.group.includes("국내여행")).map((d) => d.vsr);

  if (scarce.length >= MIN_GROUP && general.length >= MIN_GROUP) {
    const [sl, sh] = bootCI(scarce);
    const [gl, gh] = bootCI(general);
    const p = permP(scarce, general);
    console.log(`  곡성(인구감소·희소)  ${String(scarce.length).padStart(3)}편  중앙 ${fx(median(scarce))}  [${fx(sl)} ~ ${fx(sh)}]`);
    console.log(`  국내여행 일반        ${String(general.length).padStart(3)}편  중앙 ${fx(median(general))}  [${fx(gl)} ~ ${fx(gh)}]`);
    console.log(`  우연일 확률 p=${p.toFixed(3)}`);
    const ratio = median(scarce) / median(general);
    console.log(`\n  희소 지역이 일반 대비 ${ratio.toFixed(2)}배`);
    console.log(
      ratio >= 1
        ? `  → 희소성 가중치를 뒷받침한다 (다만 p 값과 신뢰구간 겹침을 함께 볼 것)`
        : `  → ⚠️ 희소 지역이 오히려 낮다. 가중치를 그대로 두면 크리에이터를 실패로 보낸다`,
    );
  } else {
    console.log(`  표본 부족 (곡성 ${scarce.length} · 일반 ${general.length})`);
  }

  // ── 구간별 방향이 일관적인가 ──────────────────────────
  /**
   * 묶음 하나하나는 표본이 얇아 p 값이 안 나온다. 하지만 **방향이 구간마다
   * 같은 쪽으로 쏠리는지**는 따로 볼 값어치가 있다.
   *
   * 각 구간이 동전던지기라면 3구간이 전부 같은 방향일 확률은 1/4 이다.
   * 증거로는 약하지만, 점 추정이 전부 한쪽이면 "차이 없음"이라고 넘기면 안 된다.
   */
  console.log(`\n  구독자 구간별 방향 (곡성 ÷ 국내여행)\n`);
  let below = 0;
  let cmp = 0;
  for (const [name, lo, hi] of bands) {
    const s = data.filter((d) => d.group.includes("곡성") && d.subs >= lo && d.subs < hi).map((d) => d.vsr);
    const g = data.filter((d) => d.group.includes("국내여행") && d.subs >= lo && d.subs < hi).map((d) => d.vsr);
    if (s.length < 5 || g.length < 5) continue;
    cmp++;
    const r = median(s) / median(g);
    if (r < 1) below++;
    console.log(`    ${name.padEnd(12)} ${r.toFixed(2)}배  ${r < 1 ? "낮음" : "높음"}  (${s.length} vs ${g.length}편)`);
  }
  if (cmp > 0) {
    console.log(
      `\n    ${cmp}개 구간 중 ${below}개에서 곡성이 낮다` +
        (below === cmp ? `  ← 전부 같은 방향. 우연이라면 1/${2 ** cmp} 확률` : ""),
    );
  }

  // ── 지금 표본으로 무엇을 감지할 수 있는가 ──────────────
  /**
   * ★ 이 절이 위의 p 값들보다 중요하다. ★
   *
   * "차이가 없다"와 "차이를 볼 눈이 없다"는 완전히 다른 말인데 p 값만 보면
   * 구분이 안 된다. 소재당 30편으로 잴 수 있는 차이가 2배부터라면,
   * 1.5배짜리 진짜 효과가 있어도 p 는 계속 0.5 근처로 나온다.
   *
   * 관측된 분포를 그대로 쓰고 한쪽에만 배수를 곱해, 순열검정이 그걸
   * 잡아내는 비율(검정력)을 센다. 80% 를 넘는 배수가 감지 하한이다.
   */
  console.log(`\n【검정력】 지금 표본으로 감지 가능한 차이\n`);
  const pool = search.flatMap((s) => s.xs);
  const power = (n: number, lift: number, sims = 200): number => {
    let hit = 0;
    for (let i = 0; i < sims; i++) {
      const a: number[] = [];
      const b: number[] = [];
      for (let j = 0; j < n; j++) {
        a.push(pool[(Math.random() * pool.length) | 0]);
        b.push(pool[(Math.random() * pool.length) | 0] * lift);
      }
      if (permP(a, b, 400) < 0.05) hit++;
    }
    return hit / sims;
  };

  const nNow = Math.round(search.reduce((s, x) => s + x.xs.length, 0) / search.length);
  console.log(`  현재 소재당 평균 ${nNow}편\n`);
  console.log(`    배수     검정력`);
  for (const lift of [1.3, 1.5, 2, 3]) {
    const pw = power(nNow, lift);
    console.log(`    ${lift.toFixed(1)}배     ${(100 * pw).toFixed(0)}%  ${pw >= 0.8 ? "◀ 감지 가능" : ""}`);
  }

  console.log(`\n  1.5배를 80% 확률로 잡으려면 소재당 몇 편이 필요한가`);
  let need = 0;
  for (const n of [50, 100, 200, 400, 800]) {
    if (power(n, 1.5) >= 0.8) {
      need = n;
      break;
    }
  }
  console.log(
    need
      ? `    → 약 ${need}편  (지금 ${nNow}편)`
      : `    → 800편으로도 부족`,
  );

  /**
   * ── 중앙값 대신 로그 평균으로 재면 달라지는가 ──────────
   *
   * vsr 은 꼬리가 극단적으로 길다 (30편에 신뢰구간이 0.6~2.8). 중앙값은
   * 이상치에 안 흔들리는 대신 **정보를 많이 버린다.**
   *
   * 배수를 다루는 값이니 로그를 씌우면 곱셈이 덧셈이 되고, 분포도 정규에
   * 가까워진다. 같은 편수로 훨씬 작은 차이를 잡을 수 있다.
   * → 이게 통하면 "소재당 800편"이 현실적인 숫자로 내려온다.
   */
  const logMean = (xs: number[]) => xs.reduce((s, x) => s + Math.log(x), 0) / xs.length;
  const permPLog = (a: number[], b: number[], n = 400): number => {
    const obs = Math.abs(logMean(a) - logMean(b));
    const all = [...a, ...b];
    let ge = 0;
    for (let i = 0; i < n; i++) {
      const s = [...all];
      for (let j = s.length - 1; j > 0; j--) {
        const k = (Math.random() * (j + 1)) | 0;
        [s[j], s[k]] = [s[k], s[j]];
      }
      if (Math.abs(logMean(s.slice(0, a.length)) - logMean(s.slice(a.length))) >= obs) ge++;
    }
    return ge / n;
  };
  const powerLog = (n: number, lift: number, sims = 200): number => {
    let hit = 0;
    for (let i = 0; i < sims; i++) {
      const a: number[] = [];
      const b: number[] = [];
      for (let j = 0; j < n; j++) {
        a.push(pool[(Math.random() * pool.length) | 0]);
        b.push(pool[(Math.random() * pool.length) | 0] * lift);
      }
      if (permPLog(a, b) < 0.05) hit++;
    }
    return hit / sims;
  };

  console.log(`\n  같은 것을 로그 평균으로 재면 (기하평균 비교)\n`);
  console.log(`    편수     1.5배 검정력`);
  for (const n of [31, 50, 100, 200]) {
    const pw = powerLog(n, 1.5);
    console.log(`    ${String(n).padStart(4)}편     ${(100 * pw).toFixed(0)}%  ${pw >= 0.8 ? "◀ 감지 가능" : ""}`);
  }

  console.log(`\n${"═".repeat(72)}\n`);
}

main();
