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
 *
 * ⚠️ **못 재는 것을 숫자로 그리지 말 것.** 방문·체류는 측정 수단이 없다.
 *    담당자가 그 수치로 예산을 짜기 때문에, 기관 화면에서 지어낸 숫자는
 *    가장 나쁜 종류의 거짓말이 된다 (`realadmin.ts` 주석).
 */

import Link from "next/link";
import { getStrings } from "@/lib/i18n";
import { realGaps, realInventory, realMatches } from "@/lib/realadmin";

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
        highlight ? "border-open/40 bg-open/5" : "border-hair bg-panel/40"
      }`}
    >
      <div className="text-xs text-ink3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold tabular-nums ${highlight ? "text-open" : "text-ink"}`}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-ink3">{unit}</span>}
      </div>
      {note && <div className="mt-1 text-[10px] leading-relaxed text-ink3">{note}</div>}
    </div>
  );
}

export default function AdminPage() {
  const inv = realInventory();
  const gaps = realGaps(10);
  const matches = realMatches(6);
  const maxGap = Math.max(...gaps.map((g) => g.openCount), 1);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {/* 실데이터 화면이므로 시연 배너를 지운다 (globals.css `:has()` 규칙) */}
      <div id="real-data-page" hidden />

      <Link href="/" className="text-xs text-ink3 hover:text-ink2">
        ← 처음으로
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">{S.s5Title}</h1>
        <p className="mt-1.5 text-sm text-ink3">
          크리에이터에게 보여주는 것과 같은 엔진입니다. 보는 사람만 바뀝니다.
        </p>
      </header>

      {/* ── 규모 — 잴 수 있는 것만 ── */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-ink2">지금 담고 있는 것</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="소재" value={inv.subjects.toLocaleString("ko-KR")} unit="종" />
          <Kpi label="촬영지" value={inv.places.toLocaleString("ko-KR")} unit="곳" />
          <Kpi
            label="인구감소지역"
            value={inv.decliningPlaces.toLocaleString("ko-KR")}
            unit="곳"
            note={`전체의 ${Math.round((inv.decliningPlaces / inv.places) * 100)}%`}
            highlight
          />
          <Kpi label="시군구" value={inv.sigunguCount.toLocaleString("ko-KR")} unit="개" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Kpi
            label="영상이 잡힌 촬영지"
            value={inv.filmedPlaces.toLocaleString("ko-KR")}
            unit="곳"
            note="수집 코퍼스에서 실제로 언급된 곳. 나머지는 아직 남아 있는 몫입니다."
          />
          <Kpi
            label="그중 인구감소지역"
            value={inv.filmedDeclining.toLocaleString("ko-KR")}
            unit="곳"
          />
        </div>

        {/*
          ⚠️ 못 재는 것을 숫자로 바꾸지 말 것. 여기 적힌 그대로가 정직한 표시다.
             측정 수단이 생기면 그때 KPI 로 올린다.
        */}
        <div className="mt-4 border border-hair bg-panel/40 p-4">
          <div className="text-xs font-medium text-ink2">아직 재지 않는 것</div>
          <ul className="mt-2 space-y-1">
            {inv.unmeasured.map((u) => (
              <li key={u} className="text-xs leading-relaxed text-ink3">
                · {u}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink3">
            추정치를 넣어 채우지 않았습니다. 이 서비스의 성공 지표는 추천 건수가 아니라
            <span className="text-ink2"> 인구감소지역에 콘텐츠가 실제로 생겼는지</span>인데,
            그건 추천 이력이 쌓인 뒤 시점 비교로만 잴 수 있습니다.
          </p>
        </div>
      </section>

      {/* ── 시군구별 남은 몫 ── */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-ink2">{S.s5RankTitle}</h2>
        <p className="mt-1 text-xs text-ink3">
          인구감소지역 중 수집 영상이 아직 안 잡힌 촬영지가 많은 순서입니다.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hair text-xs text-ink3">
                <th className="py-2 text-left font-normal">시군구</th>
                <th className="py-2 text-left font-normal">아직 안 찍힌 곳</th>
                <th className="py-2 text-left font-normal">대표 소재</th>
                <th className="py-2 text-right font-normal">소재 성적</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={`${g.sido}-${g.sigungu}`} className="border-b border-panel">
                  <td className="py-2.5">
                    <span className="text-ink">{g.sigungu}</span>
                    <span className="ml-1.5 text-xs text-ink3">{g.sido}</span>
                    {g.decliningArea && (
                      <span className="ml-2 rounded bg-hair px-1.5 py-0.5 text-[10px] text-ink2">
                        {S.decliningArea}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hair">
                        <div
                          className="h-full rounded-full bg-open/70"
                          style={{ width: `${((g.openCount / maxGap) * 100).toFixed(1)}%` }}
                        />
                      </div>
                      {/* 0 옆에 모수를 둔다 — 안 그러면 "여긴 아무것도 없다"로 읽힌다 */}
                      <span className="tabular-nums text-xs text-ink2">
                        {g.openCount}곳
                        <span className="ml-1 text-ink3">/ {g.totalCount}곳</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-ink2">{g.topSubject}</td>
                  <td className="py-2.5 text-right tabular-nums text-open/90">
                    {/* 신뢰구간이 넓으면 숫자를 안 쓴다. 순위에만 반영 */}
                    {g.topSubjectScore?.can_show_multiplier && g.topSubjectScore.geo_vsr !== null ? (
                      <span className="font-medium">{g.topSubjectScore.geo_vsr}×</span>
                    ) : (
                      <span className="text-xs text-ink3">표본 얇음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[11px] text-ink3">
          성적 = 조회수 ÷ 구독자 기하평균 · 국내 채널 기준 · 신뢰구간이 넓은 소재는 숫자를 쓰지 않습니다
        </p>
      </section>

      {/* ── 채널 ↔ 지역 매칭 ── */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-ink2">{S.s5MatchTitle}</h2>
        <p className="mt-1 text-xs text-ink3">
          채널이 실제로 찍는 소재와, 그 소재가 남아 있는 지역을 맞춥니다. 근거는 센 숫자입니다.
        </p>

        <div className="mt-3 space-y-2">
          {matches.map((m, i) => (
            <div
              key={i}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-hair bg-panel/40 px-4 py-3"
            >
              <div>
                <span className="font-medium text-ink">{m.channelTitle}</span>
                <span className="ml-2 text-xs text-ink3">
                  {S.subscribers(m.subscriberCount)} · {m.language === "en" ? "해외" : "국내"}
                </span>
                <div className="mt-0.5 text-xs text-ink3">{m.reason}</div>
              </div>
              <div className="text-right text-sm">
                <span className="text-ink2">
                  {m.sigungu}
                  <span className="ml-1.5 text-xs text-ink3">아직 {m.openCount}곳</span>
                </span>
                <span className="ml-2 rounded border border-hair2 px-2 py-0.5 text-xs text-ink2">
                  {m.subject}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] text-ink3">
          채널 소재는 롱폼 영상의 제목·설명을 분류한 실측값입니다 · 지역은 겹치지 않게 폅니다
        </p>
      </section>

      <p className="mt-10 border-t border-hair pt-6 text-xs text-ink3">
        추천 이력(recommendation_logs)은 지금 기록만 하고 있습니다. 쌓이면 &quot;비슷한 채널이 많이 고른
        소재&quot; 추천으로 이어집니다.
      </p>
    </main>
  );
}
