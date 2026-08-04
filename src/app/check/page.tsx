/**
 * 0단계 가짜 데이터 검증표.
 *
 * 이 페이지는 발표에 안 나간다. 개발 중 육안 검증용이다.
 * CLAUDE.md: "1단계 후 / 6단계 후에는 반드시 육안 검증" — 그 습관을 0단계부터 붙인다.
 *
 * 여기서 확인할 것
 *   · 30건이 명세의 예외 케이스를 전부 밟는가
 *   · "데이터 없음"이 한 군데도 안 나오는가 (전부 "미개척"이어야 함)
 *   · 이미 포화된 정선·화개가 추천 5곳에서 밀려나는가
 */

import Link from "next/link";
import { seasonBadge, tagScoreLabel, toneClass } from "@/lib/display";
import { scarcity } from "@/lib/score";
import { getAllPlaceLines, getTags, getTagScores, recommendPlaces } from "@/lib/repo";

const NOW = new Date("2026-08-02T12:00:00+09:00");

export default async function CheckPage() {
  const [lines, tags, scores, top5] = await Promise.all([
    getAllPlaceLines(),
    getTags(),
    getTagScores(),
    recommendPlaces("ch_wander", "t_oil_market"),
  ]);

  const tagOf = (code: string) => tags.find((t) => t.code === code)!;

  // ── 자동 점검 ──────────────────────────────────────────
  const checks = [
    {
      label: "① 국내 34편 / 해외 2편 — 미개척 강조",
      ok: lines.some((l) => l.place.id === "p_sunchang_market" && l.enLine.tone === "uncharted"),
    },
    {
      label: "② 양쪽 다 0편인 장소가 있다",
      ok: lines.some((l) => l.koLine.isUncharted && l.enLine.isUncharted),
    },
    {
      label: "③ 국내 0편 / 해외 2편 (반대 방향)",
      ok: lines.some((l) => l.place.id === "p_station_simcheon" && l.koLine.isUncharted && !l.enLine.isUncharted),
    },
    {
      label: "④ 세부 표본 부족 → 상위 태그 폴백",
      ok: tagScoreLabel(tagOf("flea_market"), "en", 2, scores, tags).resolved.status === "fallback",
    },
    {
      label: "⑤ 상위 태그도 부족 → 표본 부족 표시",
      ok: tagScoreLabel(tagOf("old_bathhouse"), "en", 2, scores, tags).resolved.status === "insufficient",
    },
    {
      label: "⑥ 저신뢰(폐교·역) 장소가 있다",
      ok: lines.filter((l) => l.place.data_reliability === "low").length >= 6,
    },
    {
      label: "⑦ 계절 배지 3종(NOW / N월부터 / 상시)이 모두 나온다",
      ok:
        seasonBadge(tagOf("night_market"), NOW).state === "now" &&
        seasonBadge(tagOf("silver_grass"), NOW).state === "off" &&
        seasonBadge(tagOf("oil_market"), NOW).state === "always",
    },
    {
      label: "⑧ 인구감소지역과 비지역이 섞여 있다",
      ok:
        lines.some((l) => l.place.is_declining_area) && lines.some((l) => !l.place.is_declining_area),
    },
    {
      label: "⑨ 포화된 정선·화개가 추천 5곳에서 밀려난다",
      ok: !top5.some((c) => c.place.id === "p_jeongseon_market" || c.place.id === "p_hwagae_market"),
    },
    {
      label: "⑩ 화면 어디에도 '데이터 없음'이 없다",
      ok: !lines.some((l) => l.koLine.text.includes("데이터 없음") || l.enLine.text.includes("데이터 없음")),
    },
  ];

  const seasonSamples = ["night_market", "silver_grass", "cherry_blossom", "oil_market"].map((c) => {
    const tag = tagOf(c);
    return { tag, badge: seasonBadge(tag, NOW) };
  });

  const scoreSamples = ["oil_market", "old_diner", "flea_market", "old_bathhouse", "market"].map((c) => {
    const tag = tagOf(c);
    return {
      tag,
      ko: tagScoreLabel(tag, "ko", 2, scores, tags),
      en: tagScoreLabel(tag, "en", 2, scores, tags),
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-sm">
      <Link href="/" className="text-xs text-ink3 hover:text-ink2">
        ← 처음으로
      </Link>
      <h1 className="mt-4 text-2xl font-bold">0단계 가짜 데이터 검증표</h1>
      <p className="mt-1 text-ink3">
        장소 {lines.length}건 · 태그 {tags.length}개 · 점수판 {scores.length}행 (기준일 2026-08-02)
      </p>

      {/* ── 자동 점검 ── */}
      <section className="mt-8">
        <h2 className="font-semibold text-ink2">예외 케이스 점검</h2>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-2 rounded border border-hair px-3 py-2">
              <span className={c.ok ? "text-emerald-400" : "text-red-400"}>{c.ok ? "✅" : "❌"}</span>
              <span className={c.ok ? "text-ink2" : "text-red-300"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 추천 5곳 ── */}
      <section className="mt-10">
        <h2 className="font-semibold text-ink2">
          숨 스코어 상위 5곳 <span className="font-normal text-ink3">(Wander Korea · 해외 · 오일장)</span>
        </h2>
        <p className="mt-1 text-xs text-ink3">
          soom_score = 태그점수(3.2) × 1/log(해외영상수+2) — 인구감소지역 가산점 없음
        </p>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead className="text-ink3">
            <tr className="border-b border-hair">
              <th className="py-2 text-left font-normal">#</th>
              <th className="py-2 text-left font-normal">장소</th>
              <th className="py-2 text-right font-normal">해외 영상</th>
              <th className="py-2 text-right font-normal">희소성</th>
              <th className="py-2 text-right font-normal">숨 스코어</th>
            </tr>
          </thead>
          <tbody>
            {top5.map((c, i) => {
              const n = c.enLine.isUncharted ? 0 : Number(c.enLine.text.match(/영상 (\d+)편/)?.[1] ?? 0);
              return (
                <tr key={c.place.id} className="border-b border-panel">
                  <td className="py-2 text-ink3">{i + 1}</td>
                  <td className="py-2">
                    {c.place.name_ko}
                    <span className="ml-2 text-ink3">
                      {c.place.sido} {c.place.sigungu}
                    </span>
                    {c.place.is_declining_area && (
                      <span className="ml-2 rounded bg-hair px-1.5 py-0.5 text-[10px] text-ink2">
                        인구감소지역
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-ink2">{n}편</td>
                  <td className="py-2 text-right text-ink3">{scarcity(n).toFixed(3)}</td>
                  <td className="py-2 text-right font-medium">{c.soom_score.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── 태그 점수 (언어별 분리 확인) ── */}
      <section className="mt-10">
        <h2 className="font-semibold text-ink2">태그 점수 — 언어별로 갈리는가</h2>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead className="text-ink3">
            <tr className="border-b border-hair">
              <th className="py-2 text-left font-normal">태그</th>
              <th className="py-2 text-left font-normal">국내(ko)</th>
              <th className="py-2 text-left font-normal">해외(en)</th>
              <th className="py-2 text-left font-normal">비고</th>
            </tr>
          </thead>
          <tbody>
            {scoreSamples.map(({ tag, ko, en }) => (
              <tr key={tag.id} className="border-b border-panel">
                <td className="py-2">
                  {tag.name_ko}
                  <span className="ml-1 text-ink3">L{tag.level}</span>
                </td>
                <td className={`py-2 ${toneClass(ko.tone)}`}>{ko.text}</td>
                <td className={`py-2 ${toneClass(en.tone)}`}>{en.text}</td>
                <td className="py-2 text-ink3">{en.note ?? ko.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── 계절 배지 ── */}
      <section className="mt-10">
        <h2 className="font-semibold text-ink2">계절 태그 배지 (오늘 = 8월)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {seasonSamples.map(({ tag, badge }) => (
            <span
              key={tag.id}
              className={`rounded-full border border-hair px-3 py-1 text-xs ${toneClass(badge.tone)}`}
            >
              {tag.name_ko}
              {badge.label && <span className="ml-1.5 text-[10px]">{badge.label}</span>}
            </span>
          ))}
        </div>
      </section>

      {/* ── 장소 30건 전체 ── */}
      <section className="mt-10">
        <h2 className="font-semibold text-ink2">장소 {lines.length}건 전체</h2>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead className="text-ink3">
            <tr className="border-b border-hair">
              <th className="py-2 text-left font-normal">장소</th>
              <th className="py-2 text-left font-normal">지역</th>
              <th className="py-2 text-left font-normal">출처</th>
              <th className="py-2 text-left font-normal">🇰🇷 국내</th>
              <th className="py-2 text-left font-normal">🌏 해외</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ place, koLine, enLine }) => (
              <tr key={place.id} className="border-b border-panel align-top">
                <td className="py-2">
                  {place.name_ko}
                  {place.is_declining_area && <span className="ml-1.5 text-[10px] text-ink3">감소</span>}
                </td>
                <td className="py-2 text-ink3">
                  {place.sido} {place.sigungu}
                </td>
                <td className="py-2 text-ink3">
                  {place.source}
                  {place.data_reliability === "low" && (
                    <span className="ml-1 text-orange-400/70" title="현장 확인 권장">
                      ⚠
                    </span>
                  )}
                </td>
                <td className={`py-2 ${toneClass(koLine.tone)}`}>{koLine.text}</td>
                <td className={`py-2 ${toneClass(enLine.tone)}`}>{enLine.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
