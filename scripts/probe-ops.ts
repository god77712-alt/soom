/**
 * 활용매뉴얼(docx)에서 확인한 오퍼레이션명·파라미터로 재검증.
 *
 *   npm run probe:ops
 *
 * 앞선 진단에서 4개 서비스가 NO_OPENAPI_SERVICE_ERROR 로 실패했는데,
 * 오퍼레이션명뿐 아니라 **필수 파라미터가 빠져도 같은 오류**가 난다.
 * 여기서는 매뉴얼의 예제 요청을 그대로 재현해 어느 쪽이 원인이었는지 가른다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";

interface Case {
  service: string;
  endpoint: string;
  op: string;
  params: Record<string, string | number>;
  why: string;
}

/** 매뉴얼 예제 그대로. baseYm 은 최신 데이터가 있을 만한 값으로 살짝 조정한다. */
const CASES: Case[] = [
  {
    service: "관광지별 연관 관광지",
    endpoint: SERVICES.related,
    op: "areaBasedList1",
    params: { numOfRows: 5, pageNo: 1, baseYm: "202504", areaCd: 51, signguCd: 51130 },
    why: "S4 ⑥ 근처에 같이 찍을 소재",
  },
  {
    service: "관광지별 연관 관광지 (키워드)",
    endpoint: SERVICES.related,
    op: "searchKeyword1",
    // signguCd 도 필수다. 하나라도 빠지면 NO_OPENAPI_SERVICE_ERROR 가 난다.
    params: { numOfRows: 5, pageNo: 1, baseYm: "202504", areaCd: 51, signguCd: 51130, keyword: "뮤지엄산" },
    why: "소재명으로 연관 장소 찾기",
  },
  {
    service: "기초지자체 중심 관광지",
    endpoint: SERVICES.locgo,
    op: "areaBasedList1",
    // baseYm·areaCd·signguCd 가 전부 필수(항목구분 1)다. 하나만 빠져도 거부당한다.
    params: { numOfRows: 5, pageNo: 1, baseYm: "202404", areaCd: 11, signguCd: 11530 },
    why: "시군구 대표 관광지",
  },
  {
    service: "지역별 관광 서비스 수요",
    endpoint: SERVICES.demand,
    op: "areaTarSvcDemList",
    params: { numOfRows: 5, pageNo: 1, baseYm: "202509", areaCd: 11, signguCd: 11530, tarSvcDemIxCd: 1112 },
    why: "S5 어드민 수요",
  },
  {
    service: "지역별 문화 자원 수요",
    endpoint: SERVICES.demand,
    op: "areaCulResDemList",
    params: { numOfRows: 5, pageNo: 1, baseYm: "202404", areaCd: 11, signguCd: 11530, culResDemIxCd: 1205 },
    why: "S5 어드민 문화 수요",
  },
  {
    service: "지역별 관광 다양성",
    endpoint: SERVICES.diversity,
    op: "areaTouDivList",
    params: { numOfRows: 5, pageNo: 1, baseYm: "202509", areaCd: 11, signguCd: 11530, touDivIxCd: 3101 },
    why: "S5 어드민 다양성",
  },
  {
    service: "지역별 경험 다양성",
    endpoint: SERVICES.diversity,
    op: "areaExpDivList",
    params: { numOfRows: 5, pageNo: 1, baseYm: "202504", areaCd: 51, signguCd: 51130, expDivIxCd: 3204 },
    why: "S5 어드민 경험 다양성",
  },
  {
    service: "지역별 국제 다양성",
    endpoint: SERVICES.diversity,
    op: "areaIntlDivList",
    params: { numOfRows: 5, pageNo: 1, baseYm: "202504", areaCd: 11, signguCd: 11530, intlDivIxCd: 3303 },
    why: "해외 방문 다양성",
  },
];

const OK = "\x1b[32m OK \x1b[0m";
const NG = "\x1b[31mFAIL\x1b[0m";

async function main() {
  console.log("\n매뉴얼 기준 재검증\n");

  for (const c of CASES) {
    const r = await callTourApi(c.endpoint, c.op, c.params);
    if (r.ok) {
      console.log(`${OK} ${c.service}`);
      console.log(`     ${c.op}  ·  전체 ${r.totalCount.toLocaleString("ko-KR")}건  ·  표본 ${r.items.length}건`);
      if (r.items[0]) {
        console.log(`     필드: ${Object.keys(r.items[0] as object).join(", ")}`);
        const first = r.items[0] as Record<string, unknown>;
        const preview = Object.entries(first).slice(0, 6).map(([k, v]) => `${k}=${v}`).join("  ");
        console.log(`     예시: ${preview}`);
      }
    } else {
      console.log(`${NG} ${c.service}`);
      console.log(`     ${c.op}  ·  [${r.code}] ${r.message || "-"}`);
    }
    console.log("");
  }
}

main();
