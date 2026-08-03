/**
 * TourAPI 진단 — 발급받은 9개 서비스가 실제로 도는지 확인한다.
 *
 *   npm run probe
 *
 * SPEC 2-1 경고대로 오퍼레이션명은 버전별로 다르다. 문서를 믿기 전에 실제로 때려보고
 * 어떤 이름이 살아 있는지 확인한다. 여러 후보를 순서대로 시도해 첫 성공을 기록한다.
 */

import { callTourApi, SERVICES } from "./lib/tourapi";

interface Probe {
  label: string;
  endpoint: string;
  /** 후보 오퍼레이션명. 위에서부터 시도한다 */
  candidates: string[];
  params?: Record<string, string | number>;
  why: string;
}

const PROBES: Probe[] = [
  {
    label: "국문 관광정보 — 지역코드",
    endpoint: SERVICES.kor,
    candidates: ["areaCode2", "areaCode1", "areaCode"],
    params: { numOfRows: 5, pageNo: 1 },
    why: "시군구 코드 확보. 전수 수집의 출발점",
  },
  {
    label: "국문 관광정보 — 지역기반 목록",
    endpoint: SERVICES.kor,
    candidates: ["areaBasedList2", "areaBasedList1", "areaBasedList"],
    params: { numOfRows: 5, pageNo: 1, arrange: "A" },
    why: "장소 전수 수집의 본체",
  },
  {
    label: "국문 관광정보 — 키워드 검색",
    endpoint: SERVICES.kor,
    candidates: ["searchKeyword2", "searchKeyword1", "searchKeyword"],
    params: { numOfRows: 5, pageNo: 1, keyword: "오일장", arrange: "A" },
    why: "태그 샘플 수집",
  },
  {
    label: "국문 관광정보 — 공통 상세(소개글)",
    endpoint: SERVICES.kor,
    candidates: ["detailCommon2", "detailCommon1", "detailCommon"],
    // ⚠️ contentId 만 준다. KorService2 에서 defaultYN·overviewYN·firstImageYN 이 사라졌고,
    //    없어진 파라미터를 같이 보내면 게이트웨이가 NO_OPENAPI_SERVICE_ERROR 로 거부한다.
    //    contentTypeId 를 붙여도 거부당한다. 옛날 블로그 예제를 그대로 쓰면 여기서 막힌다.
    params: { contentId: 126508 },
    why: "★ 소개글(overview) = 태그 추출 원료. 1단계 완료 판정 기준",
  },
  {
    label: "국문 관광정보 — 소개 상세(운영시간)",
    endpoint: SERVICES.kor,
    candidates: ["detailIntro2", "detailIntro1", "detailIntro"],
    params: { contentId: 126508, contentTypeId: 12 },
    why: "운영시간·주차·휴무. S4 ⑤ 재료",
  },
  {
    label: "국문 관광정보 — 이미지 목록",
    endpoint: SERVICES.kor,
    candidates: ["detailImage2", "detailImage1", "detailImage"],
    params: { contentId: 126508, imageYN: "Y", numOfRows: 5, pageNo: 1 },
    why: "S4 '어떤 그림이 나오나' 의 사진",
  },
  {
    label: "국문 관광정보 — 축제 검색",
    endpoint: SERVICES.kor,
    candidates: ["searchFestival2", "searchFestival1", "searchFestival"],
    params: { numOfRows: 5, pageNo: 1, eventStartDate: "20260801", arrange: "A" },
    why: "S4 ⑥ 주변 축제",
  },
  {
    label: "국문 관광정보 — 숙박 검색",
    endpoint: SERVICES.kor,
    candidates: ["searchStay2", "searchStay1", "searchStay"],
    params: { numOfRows: 5, pageNo: 1, arrange: "A" },
    why: "S4 ⑥ 숙소",
  },
  {
    label: "영문 관광정보 — 지역기반 목록",
    endpoint: SERVICES.eng,
    candidates: ["areaBasedList2", "areaBasedList1", "areaBasedList"],
    params: { numOfRows: 5, pageNo: 1, arrange: "A" },
    why: "해외 채널용 영문 장소명",
  },
  {
    label: "관광사진 갤러리",
    endpoint: SERVICES.photo,
    candidates: ["galleryList1", "galleryList", "galleryKeywordList1", "galleryMetaList1"],
    params: { numOfRows: 5, pageNo: 1, arrange: "A" },
    why: "장소 사진 보강",
  },
  {
    label: "관광지별 연관 관광지",
    endpoint: SERVICES.related,
    candidates: ["areaBasedList1", "areaBasedList", "areaBasedList2"],
    params: { numOfRows: 5, pageNo: 1, baseYm: "202506" },
    why: "S4 ⑥ '근처에 같이 찍을 소재' 를 좌표 계산 대신 실제 데이터로",
  },
  {
    label: "관광공모전 수상작 사진",
    endpoint: SERVICES.award,
    candidates: ["phokoAwrdList", "getPhokoAwrdList", "awrdList", "phokoAwrdList1"],
    params: { numOfRows: 5, pageNo: 1 },
    why: "상 받은 앵글 = 검증된 촬영 컷",
  },
  {
    label: "두루누비 걷기길",
    endpoint: SERVICES.durunubi,
    candidates: ["courseList", "routeList", "themeList", "GdCourseList"],
    params: { numOfRows: 5, pageNo: 1 },
    why: "완성된 촬영 동선",
  },
  {
    label: "기초지자체 중심 관광지",
    endpoint: SERVICES.locgo,
    candidates: ["areaBasedList1", "areaBasedList", "locgoHubTarList1"],
    params: { numOfRows: 5, pageNo: 1, baseYm: "202506" },
    why: "시군구 단위 대표 관광지",
  },
  {
    label: "지역별 관광 자원 수요",
    endpoint: SERVICES.demand,
    candidates: ["areaTarResDemList", "getAreaTarResDemList", "areaBasedList"],
    params: { numOfRows: 5, pageNo: 1, baseYm: "202506" },
    why: "S5 어드민 수요 분석",
  },
  {
    label: "지역별 관광 다양성",
    endpoint: SERVICES.diversity,
    candidates: ["areaTarDivList", "getAreaTarDivList", "areaBasedList"],
    params: { numOfRows: 5, pageNo: 1, baseYm: "202506" },
    why: "S5 어드민 다양성 지표",
  },
];

const OK = "\x1b[32m OK \x1b[0m";
const NG = "\x1b[31mFAIL\x1b[0m";

async function main() {
  console.log("\nTourAPI 진단 — 발급받은 9개 서비스\n");

  const results: Array<{ label: string; op: string | null; note: string; why: string }> = [];

  for (const p of PROBES) {
    let done = false;
    const failures: string[] = [];
    let lastRaw = "";

    // 후보를 끝까지 다 시도한다. 중간에 멈추면 살아 있는 이름을 놓친다.
    for (const op of p.candidates) {
      const r = await callTourApi(p.endpoint, op, p.params ?? {});
      if (r.ok) {
        console.log(`${OK} ${p.label}`);
        console.log(`     ${op}  ·  전체 ${r.totalCount.toLocaleString("ko-KR")}건  ·  표본 ${r.items.length}건`);
        results.push({ label: p.label, op, note: `${r.totalCount}건`, why: p.why });
        done = true;
        break;
      }
      failures.push(`${op} → [${r.code}] ${r.message || "(메시지 없음)"}`);
      if (r.raw) lastRaw = r.raw;
    }

    if (!done) {
      console.log(`${NG} ${p.label}`);
      for (const f of failures) console.log(`     ${f}`);
      if (lastRaw) console.log(`     원문: ${lastRaw.replace(/\s+/g, " ").slice(0, 220)}`);
      results.push({ label: p.label, op: null, note: failures[0] ?? "실패", why: p.why });
    }
  }

  const ok = results.filter((r) => r.op);
  const ng = results.filter((r) => !r.op);

  console.log(`\n─────────────────────────────────────────`);
  console.log(`성공 ${ok.length} / 실패 ${ng.length}\n`);

  if (ng.length > 0) {
    console.log("실패한 것 (개발자 문서에서 오퍼레이션명 확인 필요)");
    for (const r of ng) console.log(`  · ${r.label} — ${r.note}`);
    console.log("");
  }

  console.log("확인된 오퍼레이션명");
  for (const r of ok) console.log(`  ${r.label.padEnd(34)} ${r.op}`);
  console.log("");
}

main();
