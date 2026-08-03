/**
 * S5. 어드민 콘솔 — 같은 엔진, 다른 뷰
 *
 * 관광공사·지자체 담당자 시점. "실제로 쓸 수 있냐"는 질문에 대한 답이고
 * 심사의 발전성 20점 근거다.
 *
 * 참고: 여기서는 "미개척"이라고 써도 된다.
 * 크리에이터에게 그 말이 금지인 이유는 "잘 될 증거가 없다"로 읽히기 때문인데,
 * 기관 담당자에게는 정확히 반대로 "우리 지역에 아직 남은 기회"로 읽힌다.
 * 같은 데이터라도 보는 사람이 다르면 말을 바꿔야 한다.
 */

import Link from "next/link";
import { getStrings } from "@/lib/i18n";
import { getAdminGaps, getAdminImpact, getAdminMatches, getTags } from "@/lib/repo";

const S = getStrings("ko");

function Kpi({
  label,
  value,
  unit,
  note,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight ? "border-amber-400/40 bg-amber-400/5" : "border-neutral-800 bg-neutral-900/40"
      }`}
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold tabular-nums ${highlight ? "text-amber-300" : "text-neutral-100"}`}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-neutral-500">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-[10px] leading-relaxed text-neutral-600">{note}</div>}
    </div>
  );
}

export default async function AdminPage() {
  const [gaps, matches, impact, tags] = await Promise.all([
    getAdminGaps(),
    getAdminMatches(),
    getAdminImpact(),
    getTags(),
  ]);

  const tagName = (id: string) => tags.find((t) => t.id === id)?.name_ko ?? id;
  const maxGap = Math.max(...gaps.map((g) => g.uncharted_count), 1);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300">
        ← 처음으로
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">{S.s5Title}</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          크리에이터에게 보여주는 것과 같은 엔진입니다. 보는 사람만 바뀝니다.
        </p>
      </header>

      {/* ── 성과 환산 ── */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">{S.s5ImpactTitle}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="누적 추천" value={impact.recommended_places.toLocaleString("ko-KR")} unit="건" />
          <Kpi label="실제 방문 확인" value={impact.estimated_visits.toLocaleString("ko-KR")} unit="명" />
          <Kpi label="1인 평균 체류" value={impact.avg_stay_days.toFixed(1)} unit="일" />
          <Kpi
            label="생활인구 환산"
            value={impact.estimated_population_days.toLocaleString("ko-KR")}
            unit="인·일"
            note="방문 × 체류일"
          />
        </div>

        {/* 성공 지표는 하나뿐이다. 추천 건수가 아니라 실제로 생긴 영상 수다. */}
        <div className="mt-3">
          <Kpi
            label={S.s5KpiTitle}
            value={impact.new_videos_in_declining_areas.toLocaleString("ko-KR")}
            unit="편"
            note="이 서비스의 유일한 성공 지표. 추천을 많이 한 게 아니라 콘텐츠가 실제로 생겼는지를 본다."
            highlight
          />
        </div>
      </section>

      {/* ── 시군구별 미개척 랭킹 ── */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-300">{S.s5RankTitle}</h2>
        <p className="mt-1 text-xs text-neutral-600">
          해외 채널 영상이 0편인 장소 수 기준. 어느 지역에 아직 기회가 남아 있는지 봅니다.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th className="py-2 text-left font-normal">시군구</th>
                <th className="py-2 text-left font-normal">미개척 장소</th>
                <th className="py-2 text-left font-normal">대표 소재</th>
                <th className="py-2 text-right font-normal">해외 성과</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={`${g.sido}-${g.sigungu}`} className="border-b border-neutral-900">
                  <td className="py-2.5">
                    <span className="text-neutral-200">{g.sigungu}</span>
                    <span className="ml-1.5 text-xs text-neutral-600">{g.sido}</span>
                    {g.is_declining_area && (
                      <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                        {S.decliningArea}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-800">
                        <div
                          className="h-full rounded-full bg-amber-400/70"
                          style={{ width: `${(g.uncharted_count / maxGap) * 100}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-xs text-neutral-400">
                        {g.uncharted_count}곳
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-neutral-400">{tagName(g.top_tag_id)}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-amber-300/90">
                    {g.tag_median_vsr.toFixed(1)}배
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 채널 ↔ 지역 매칭 ── */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-300">{S.s5MatchTitle}</h2>
        <p className="mt-1 text-xs text-neutral-600">
          채널 프로필과 지역 소재를 맞춰 섭외 대상을 고릅니다. 근거를 함께 표시합니다.
        </p>

        <div className="mt-3 space-y-2">
          {matches.map((m, i) => (
            <div
              key={i}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3"
            >
              <div>
                <span className="font-medium text-neutral-200">{m.channel_title}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {S.subscribers(m.subscriber_count)} · {m.language === "en" ? "해외" : "국내"}
                </span>
                <div className="mt-0.5 text-xs text-neutral-600">{m.reason}</div>
              </div>
              <div className="text-right text-sm">
                <span className="text-neutral-300">{m.sigungu}</span>
                <span className="ml-2 rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
                  {tagName(m.matched_tag_id)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 border-t border-neutral-800 pt-6 text-xs text-neutral-600">
        추천 이력(recommendation_logs)은 지금 기록만 하고 있습니다. 쌓이면 &quot;비슷한 채널이 많이 고른
        소재&quot; 추천으로 이어집니다.
      </p>
    </main>
  );
}
