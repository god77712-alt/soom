/**
 * 실패한 오퍼레이션만 좁혀서 재시도.
 *
 *   npm run probe:ops
 *
 * 두 가지를 가른다.
 *   (1) 파라미터가 문제인가  → 최소 파라미터로 다시
 *   (2) 오퍼레이션명이 문제인가 → 후보를 넓혀서
 */

import { callTourApi, SERVICES } from "./lib/tourapi";

async function tryOne(
  label: string,
  endpoint: string,
  op: string,
  params: Record<string, string | number>,
) {
  const r = await callTourApi(endpoint, op, params);
  const mark = r.ok ? "\x1b[32mOK  \x1b[0m" : "\x1b[31m    \x1b[0m";
  const detail = r.ok
    ? `전체 ${r.totalCount.toLocaleString("ko-KR")}건`
    : `[${r.code}] ${r.message || "-"}`;
  console.log(`  ${mark} ${op.padEnd(26)} ${detail}`);
  if (r.ok && r.items.length > 0) {
    console.log(`       필드: ${Object.keys(r.items[0] as object).join(", ").slice(0, 200)}`);
  }
  return r.ok;
}

async function main() {
  // ── 1. detailCommon — 파라미터 때문인지 확인 ──
  // KorService2 에서는 defaultYN / overviewYN / firstImageYN 이 사라졌을 가능성이 있다.
  console.log("\n[1] 국문 상세(소개글) — 파라미터를 줄여가며");
  await tryOne("detailCommon 최소", SERVICES.kor, "detailCommon2", { contentId: 126508 });
  await tryOne("detailCommon +타입", SERVICES.kor, "detailCommon2", { contentId: 126508, contentTypeId: 12 });
  await tryOne("detailCommon 구파라미터", SERVICES.kor, "detailCommon2", {
    contentId: 126508, defaultYN: "Y", overviewYN: "Y",
  });
  // 같은 엔드포인트에서 되는 것과 비교
  await tryOne("detailInfo2 (대조군)", SERVICES.kor, "detailInfo2", { contentId: 126508, contentTypeId: 12 });

  // ── 2. 나머지 서비스 — 오퍼레이션명 후보 확대 ──
  const wide: Array<[string, string, string[], Record<string, string | number>]> = [
    [
      "관광지별 연관 관광지",
      SERVICES.related,
      ["areaBasedList1", "areaBasedList", "tarRlteTarList", "getTarRlteTarList", "rlteTarList", "tarRlteTarList1"],
      { numOfRows: 3, pageNo: 1, baseYm: "202506" },
    ],
    [
      "기초지자체 중심 관광지",
      SERVICES.locgo,
      ["areaBasedList1", "locgoHubTarList", "getLocgoHubTarList", "hubTarList", "locgoHubTarList1"],
      { numOfRows: 3, pageNo: 1, baseYm: "202506" },
    ],
    [
      "지역별 관광 자원 수요",
      SERVICES.demand,
      ["areaTarResDemList", "getAreaTarResDemList", "tarResDemList", "resDemList", "areaTarResDem"],
      { numOfRows: 3, pageNo: 1, baseYm: "202506" },
    ],
    [
      "지역별 관광 다양성",
      SERVICES.diversity,
      ["areaTarDivList", "getAreaTarDivList", "tarDivList", "divList", "areaTarDiv"],
      { numOfRows: 3, pageNo: 1, baseYm: "202506" },
    ],
  ];

  for (const [label, endpoint, ops, params] of wide) {
    console.log(`\n[2] ${label}`);
    let hit = false;
    for (const op of ops) {
      if (await tryOne(label, endpoint, op, params)) {
        hit = true;
        break;
      }
    }
    if (!hit) console.log(`       → 후보 전부 실패. 개발자 문서 확인 필요`);
  }

  console.log("");
}

main();
