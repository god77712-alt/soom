import { callTourApi, SERVICES } from "./lib/tourapi";

async function main() {
  const tests: [string, string, string, Record<string, string | number>][] = [
    ["kor", SERVICES.kor, "detailIntro2", { contentId: "126508", contentTypeId: 12 }],
    ["kor", SERVICES.kor, "detailInfo2", { contentId: "126508", contentTypeId: 12 }],
    ["kor", SERVICES.kor, "areaBasedList2", { numOfRows: 1, pageNo: 1 }],
    ["kor", SERVICES.kor, "detailImage2", { contentId: "126508", imageYN: "Y" }],
    ["kor", SERVICES.kor, "detailCommon2", { contentId: "126508" }],
    ["eng", SERVICES.eng, "detailImage2", { contentId: "264337", imageYN: "Y" }],
    ["eng", SERVICES.eng, "detailIntro2", { contentId: "264337", contentTypeId: 76 }],
    ["eng", SERVICES.eng, "areaBasedList2", { numOfRows: 1, pageNo: 1 }],
  ];
  for (const [svc, base, op, p] of tests) {
    const r = await callTourApi(base, op, p);
    const open = r.ok ? "열림" : r.code === "22" ? "소진" : "오류";
    console.log(
      `${svc.padEnd(4)} ${op.padEnd(16)} ${open}  code=${String(r.code).padEnd(6)} items=${r.items.length} ${r.ok ? "" : r.message}`,
    );
  }
}

main();
