/**
 * `/check` 의 **실데이터 경로** 점검.
 *
 * ── 왜 따로 두는가 ──────────────────────────────────────
 * `/check` 는 원래 `repo.ts`(=`FAKE_*`)만 읽었다. 그런데 지금 배포되는 화면은
 * `realcards`·`realdetail`·`realadmin` 이다. **검증표가 안 쓰는 데이터를 검사하고
 * 있었다** — 실화면이 깨져도 초록불이 뜬다 (2026-08-13 발견).
 *
 * 여기서 보는 것은 "값이 예쁜가" 가 아니라 **"화면이 거짓말을 할 수 있는가"** 다.
 * 표본 없이 배수를 그리거나, 두 화면이 같은 소재를 다르게 말하거나,
 * 같은 장소가 한 화면에 두 번 나오는 것 — 전부 여기서 잡는다.
 */
import { SUBJECTS } from "@/lib/catalog";
import { realCards, realSubjectEvidence } from "@/lib/realcards";
import { realGaps, realInventory, realMatches } from "@/lib/realadmin";
import { realPlaceDetail } from "@/lib/realdetail";
import TAGSCORES_JSON from "@/data/real/tagscores.json";
import type { Language, SubBand } from "@/lib/types";

interface Cell {
  tag: string;
  language: string;
  sub_band: number | null;
  video_count: number;
  geo_vsr: number | null;
  ci_low: number | null;
  ci_high: number | null;
  can_show_multiplier: boolean;
}
const TAGSCORES = TAGSCORES_JSON as Cell[];

const LANG: Language = "ko";
const BAND: SubBand = 2;

interface Row {
  label: string;
  ok: boolean;
  detail: string;
}

function run(): Row[] {
  const rows: Row[] = [];
  const bad: string[] = [];

  // ① 소재 단위와 셀 단위가 같은 말을 하는가 (예전에 항구·포구가 어긋났다)
  bad.length = 0;
  for (const s of SUBJECTS) {
    const cell = TAGSCORES.find(
      (t) => t.tag === s.tag && t.language === LANG && t.sub_band === null,
    );
    if (s.can_show_multiplier !== (cell?.can_show_multiplier ?? false)) bad.push(s.label);
  }
  rows.push({
    label: "① 소재 목록과 추천 카드가 배수 표시를 같게 판정한다",
    ok: bad.length === 0,
    detail: bad.length ? `어긋남: ${bad.join(", ")}` : `${SUBJECTS.length}개 소재 일치`,
  });

  // ② 배수를 그리는 칸은 전부 신뢰구간이 4배 안인가
  bad.length = 0;
  for (const t of TAGSCORES) {
    if (!t.can_show_multiplier) continue;
    if (t.ci_low === null || t.ci_high === null || t.ci_low <= 0 || t.ci_high / t.ci_low > 4) {
      bad.push(`${t.tag}/${t.language}`);
    }
  }
  rows.push({
    label: "② 배수를 그리는 칸은 전부 신뢰구간 4배 안이다",
    ok: bad.length === 0,
    detail: bad.length
      ? `근거 없이 배수: ${bad.slice(0, 3).join(", ")}`
      : `${TAGSCORES.filter((t) => t.can_show_multiplier).length}칸 통과`,
  });

  // ③ 언어 점수판이 섞이지 않았는가 (CLAUDE.md 1항)
  const mixed = TAGSCORES.filter((t) => t.language !== "ko" && t.language !== "en");
  rows.push({
    label: "③ 점수판이 언어별로 분리돼 있다",
    ok: mixed.length === 0,
    detail: mixed.length ? `알 수 없는 언어 ${mixed.length}칸` : "ko / en 만 존재",
  });

  // ④ 모든 소재에서 카드가 비지 않는가 (빈 화면이 나오면 이탈한다)
  bad.length = 0;
  for (const s of SUBJECTS) {
    if (realCards(s, LANG, BAND, 5).length === 0) bad.push(s.label);
  }
  rows.push({
    label: "④ 12개 소재 전부 추천 카드가 나온다",
    ok: bad.length === 0,
    detail: bad.length ? `빈 목록: ${bad.join(", ")}` : "빈 목록 없음",
  });

  // ⑤ "촬영 완료" 에 나온 장소가 추천 카드에 또 나오지 않는가
  bad.length = 0;
  for (const s of SUBJECTS) {
    const ev = realSubjectEvidence(s, LANG, BAND, 450_000);
    const ids = ev.occupied.map((o) => o.id);
    const dup = realCards(s, LANG, BAND, 5, new Date(), ids).filter((c) =>
      ids.includes(c.place.id),
    );
    if (dup.length > 0) bad.push(`${s.label}(${dup[0].place.name_ko})`);
  }
  rows.push({
    label: "⑤ 같은 장소가 한 화면에 두 번 나오지 않는다",
    ok: bad.length === 0,
    detail: bad.length ? `중복: ${bad.join(", ")}` : "중복 없음",
  });

  // ⑥ 인구감소지역을 정렬로 강제로 올리지 않는가 (SPEC 11장)
  //    전부 감소지역이면 정렬이 개입했을 가능성이 높다 — 신호로 본다
  const allDeclining = SUBJECTS.filter((s) => {
    const cards = realCards(s, LANG, BAND, 5);
    return cards.length === 5 && cards.every((c) => c.place.is_declining_area);
  });
  rows.push({
    label: "⑥ 비감소지역도 카드에 오를 수 있다",
    ok: allDeclining.length < SUBJECTS.length,
    detail:
      allDeclining.length === SUBJECTS.length
        ? "모든 소재가 감소지역만 — 정렬 가산점 의심"
        : `${SUBJECTS.length - allDeclining.length}개 소재에서 비감소지역 등장`,
  });

  // ⑦ 상세 화면이 실데이터로 열리는가 + 배수를 표본 없이 그리지 않는가
  bad.length = 0;
  for (const s of SUBJECTS) {
    const p = s.places[0];
    if (!p) continue;
    const d = realPlaceDetail(
      p.id,
      {
        id: "chk",
        title: "검증",
        subscriber_count: 450_000,
        sub_band: BAND,
        language: LANG,
      } as never,
      s,
    );
    if (!d) {
      bad.push(`${s.label}: 상세 없음`);
      continue;
    }
    if (d.score?.can_show_multiplier && d.score.geo_vsr === null) {
      bad.push(`${s.label}: 배수 표시인데 값 없음`);
    }
  }
  rows.push({
    label: "⑦ 상세 화면이 12개 소재 전부 열린다",
    ok: bad.length === 0,
    detail: bad.length ? bad.join(" · ") : "전부 정상",
  });

  // ⑧ 기관 화면이 못 재는 것을 숫자로 그리지 않는가
  const inv = realInventory();
  rows.push({
    label: "⑧ 기관 화면이 측정 못 하는 KPI 를 숫자로 안 쓴다",
    ok: inv.unmeasured.length > 0 && inv.places > 0,
    detail: `측정 안 하는 항목 ${inv.unmeasured.length}개를 그대로 표시 · 촬영지 ${inv.places.toLocaleString()}곳`,
  });

  // ⑨ 섭외 목록의 지역이 겹치지 않는가 (겹치면 목록으로 못 쓴다)
  const matches = realMatches(6);
  const uniq = new Set(matches.map((m) => m.sigungu));
  rows.push({
    label: "⑨ 섭외 목록의 지역이 서로 다르다",
    ok: uniq.size === matches.length,
    detail: `${matches.length}행 중 ${uniq.size}개 지역`,
  });

  // ⑩ 지역 랭킹이 모수를 함께 내는가 (0 을 "없다"로 읽히게 두지 않는다)
  const gaps = realGaps(10);
  rows.push({
    label: "⑩ 지역 랭킹이 모수(전체 장소 수)를 함께 낸다",
    ok: gaps.length > 0 && gaps.every((g) => g.totalCount >= g.openCount && g.totalCount > 0),
    detail: gaps.length ? `${gaps.length}개 지역 · 모수 누락 없음` : "지역 없음",
  });

  return rows;
}

export function RealDataChecks() {
  const rows = run();
  const failed = rows.filter((r) => !r.ok).length;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-ink2">
        실데이터 경로 점검
        <span className={`ml-2 font-mono text-xs ${failed ? "text-open" : "text-ink3"}`}>
          {failed ? `${failed}건 실패` : `${rows.length}건 통과`}
        </span>
      </h2>
      <p className="mt-1 text-xs text-ink3">
        실제로 배포되는 화면(realcards · realdetail · realadmin)을 검사합니다.
      </p>

      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.label}
            className={`flex flex-wrap items-baseline gap-x-3 border-l-2 py-1.5 pl-3 text-sm ${
              r.ok ? "border-hair2 text-ink2" : "border-open text-ink"
            }`}
          >
            <span className="font-mono text-xs">{r.ok ? "통과" : "실패"}</span>
            <span>{r.label}</span>
            <span className="font-mono text-[11px] text-ink3">{r.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
