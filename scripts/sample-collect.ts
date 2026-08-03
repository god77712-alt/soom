/**
 * 태그 샘플 수집 — 1단계를 작게 미리 해본다.
 *
 *   npm run sample
 *
 * 목적은 데이터를 모으는 게 아니라 **SPEC 7장 1단계 완료 판정**을 미리 확인하는 것이다.
 *
 *   "TourAPI 전수 수집 → 소개글 채워진 비율 확인 ← 여기가 낮으면 계획 수정"
 *
 * 소개글(overview)이 태그 추출의 유일한 원료다. 이게 비어 있으면 LLM 태깅 자체가 성립하지 않고,
 * 4단계 계획을 통째로 바꿔야 한다. 그래서 전수 수집 전에 반드시 표본으로 먼저 잰다.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { callTourApi, SERVICES } from "./lib/tourapi";

/** 샘플로 확인할 태그 2개. 성격이 다른 걸 골랐다. */
const SAMPLE_TAGS = [
  {
    code: "oil_market",
    name: "오일장·전통시장",
    keywords: ["오일장", "전통시장", "재래시장"],
    why: "S3·S4 데모의 주력 소재. 인구감소지역에 고르게 분포",
  },
  {
    code: "lighthouse",
    name: "등대",
    keywords: ["등대"],
    why: "해안 소재. 관광공사 등록이 잘 돼 있는지 대조군으로",
  },
];

interface CommonDetail {
  contentid: string;
  contenttypeid: string;
  title: string;
  overview?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx?: string;
  mapy?: string;
  addr1?: string;
  areacode?: string;
  sigungucode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  homepage?: string;
  tel?: string;
}

interface KeywordItem {
  contentid: string;
  title: string;
  addr1?: string;
  mapx?: string;
  mapy?: string;
  areacode?: string;
  sigungucode?: string;
  contenttypeid?: string;
  firstimage?: string;
}

const strip = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function collectKeyword(keyword: string): Promise<KeywordItem[]> {
  const out: KeywordItem[] = [];
  let page = 1;

  while (page <= 5) {
    const r = await callTourApi<KeywordItem>(SERVICES.kor, "searchKeyword2", {
      keyword,
      numOfRows: 100,
      pageNo: page,
      arrange: "A",
    });
    if (!r.ok) {
      console.log(`   ! "${keyword}" 검색 실패 [${r.code}] ${r.message}`);
      break;
    }
    out.push(...r.items);
    if (out.length >= r.totalCount || r.items.length === 0) break;
    page += 1;
  }
  return out;
}

async function main() {
  await mkdir("./data/raw", { recursive: true });

  console.log("\n태그 샘플 수집 — 소개글 확보율 측정\n");

  const report: Array<{
    tag: string;
    total: number;
    withOverview: number;
    avgLen: number;
    withImage: number;
    withCoord: number;
  }> = [];

  for (const tag of SAMPLE_TAGS) {
    console.log(`\n■ ${tag.name}  (${tag.why})`);

    // 1) 키워드로 후보 장소를 모은다
    const seen = new Map<string, KeywordItem>();
    for (const kw of tag.keywords) {
      const items = await collectKeyword(kw);
      console.log(`   "${kw}" → ${items.length}건`);
      for (const it of items) if (it.contentid) seen.set(it.contentid, it);
    }
    const candidates = [...seen.values()];
    console.log(`   중복 제거 후 ${candidates.length}건`);

    if (candidates.length === 0) continue;

    // 2) 소개글을 받는다. 여기가 태그 추출의 원료다.
    //    ⚠️ contentId 만 보낼 것. 다른 파라미터를 붙이면 게이트웨이가 거부한다.
    const details: CommonDetail[] = [];
    let done = 0;
    for (const c of candidates) {
      const r = await callTourApi<CommonDetail>(SERVICES.kor, "detailCommon2", {
        contentId: c.contentid,
      });
      if (r.ok && r.items[0]) {
        const d = r.items[0];
        details.push({
          ...d,
          overview: d.overview ? strip(d.overview) : undefined,
          // 목록에만 있고 상세에 빠지는 값이 있어 병합해 둔다
          mapx: d.mapx || c.mapx,
          mapy: d.mapy || c.mapy,
          addr1: d.addr1 || c.addr1,
          areacode: d.areacode || c.areacode,
          sigungucode: d.sigungucode || c.sigungucode,
        });
      }
      done += 1;
      if (done % 25 === 0) console.log(`   소개글 수집 ${done}/${candidates.length}`);
    }

    // 3) 판정
    const withOverview = details.filter((d) => (d.overview?.length ?? 0) >= 30);
    const avgLen = withOverview.length
      ? Math.round(withOverview.reduce((s, d) => s + (d.overview?.length ?? 0), 0) / withOverview.length)
      : 0;
    const withImage = details.filter((d) => d.firstimage);
    const withCoord = details.filter((d) => d.mapx && d.mapy);

    const pct = (n: number) => `${Math.round((n / details.length) * 100)}%`;
    console.log(`   ─────────────────────────────`);
    console.log(`   상세 확보     ${details.length}건`);
    console.log(`   소개글 있음   ${withOverview.length}건 (${pct(withOverview.length)})  평균 ${avgLen}자`);
    console.log(`   대표이미지    ${withImage.length}건 (${pct(withImage.length)})`);
    console.log(`   좌표          ${withCoord.length}건 (${pct(withCoord.length)})`);

    report.push({
      tag: tag.name,
      total: details.length,
      withOverview: withOverview.length,
      avgLen,
      withImage: withImage.length,
      withCoord: withCoord.length,
    });

    await writeFile(
      `./data/raw/sample-${tag.code}.json`,
      JSON.stringify({ tag: tag.code, collected_at: new Date().toISOString(), items: details }, null, 2),
      "utf8",
    );
    console.log(`   저장: data/raw/sample-${tag.code}.json`);

    // 4) 소개글 실물을 눈으로 본다. 태그를 뽑을 만한 글인지가 핵심이다.
    const samples = withOverview.slice(0, 2);
    for (const s of samples) {
      console.log(`\n   [${s.title}]`);
      console.log(`   ${s.overview?.slice(0, 160)}...`);
    }
  }

  // ── 종합 판정 ──
  const total = report.reduce((s, r) => s + r.total, 0);
  const ov = report.reduce((s, r) => s + r.withOverview, 0);
  const rate = total ? Math.round((ov / total) * 100) : 0;

  console.log(`\n\n═════════════════════════════════════`);
  console.log(` 소개글 확보율  ${ov}/${total}  =  ${rate}%`);
  console.log(`═════════════════════════════════════`);
  if (rate >= 80) {
    console.log(" → 태그 추출 가능. 계획대로 진행.\n");
  } else if (rate >= 50) {
    console.log(" → 절반은 채워진다. 빈 곳은 규칙 기반 태깅으로 보완 필요.\n");
  } else {
    console.log(" → 소개글이 부족하다. SPEC 4단계(LLM 태깅) 계획을 바꿔야 한다.\n");
  }
}

main();
