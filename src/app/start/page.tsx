/**
 * 소재로 찾기 — **촬영 가능 장소 목록의 입구.**
 *
 * ── 홈과 역할이 다르다 ───────────────────────────────────
 * 홈:   채널을 넣으면 → 당신에게 맞는 5곳을 **골라 준다** (예측)
 * 여기: 소재를 고르면 → 그 소재로 찍을 수 있는 곳을 **다 펼쳐 놓는다** (목록)
 *
 * 예측은 근거가 약하다. 소재 효과는 실재하지만(p=0.0007) 채널이 성과의 74% 를
 * 설명하고, 개별 소재끼리는 다중비교 보정을 하나도 통과 못 했다.
 * **목록은 근거가 필요 없다. 있으면 있는 것이다.** 그래서 이 경로가 더 정직하고,
 * 크리에이터가 스스로 고를 여지도 넓다.
 *
 * 원래 이 자리에 채널 입력 폼이 또 있었는데(옛 온보딩) 홈과 중복이라 걷어냈다.
 * 내비 라벨이 이미 "소재로 찾기" 였으니 이름과 내용이 이제 맞는다.
 */
import Link from "next/link";
import { SUBJECTS, regionChips, shortSido } from "@/lib/catalog";

export const metadata = {
  title: "소재로 찾기 — 숨",
  description: "소재별 촬영 가능 장소 목록. 인구감소지역 포함.",
};

export default function StartPage() {
  const totalPlaces = SUBJECTS.reduce((s, x) => s + x.total, 0);
  const totalDeclining = SUBJECTS.reduce((s, x) => s + x.declining, 0);

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <Link href="/" className="font-mono text-[11px] text-ink3 hover:text-ink">
        ← 숨
      </Link>

      <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight sm:text-5xl">
        소재로 찾기
      </h1>

      {/*
        문구 원칙: 설득·설명 문장 금지. 라벨과 숫자만 두고 판단은 크리에이터가 한다.
        이 화면의 주장은 "이만큼 있다" 하나뿐이라 숫자로만 말한다.
      */}
      <p className="mt-2.5 font-mono text-sm text-ink2 tnum">
        {SUBJECTS.length}개 소재 · {totalPlaces.toLocaleString()}곳
        <span className="text-ink3"> · </span>
        <span className="text-open">인구감소지역 {totalDeclining.toLocaleString()}곳</span>
      </p>

      <ul className="mt-9 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((s) => {
          const chips = regionChips(s);
          return (
            <li key={s.slug}>
              <Link
                href={`/subject/${s.slug}`}
                className="group block border border-hair p-4 transition-colors hover:border-open/50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg text-ink transition-colors group-hover:text-open">
                    {s.label}
                  </span>
                  <span className="font-mono text-sm text-ink2 tnum">
                    {s.total.toLocaleString()}
                    <span className="text-ink3">곳</span>
                  </span>
                </div>

                <div className="mt-1 font-mono text-[11px] text-open">
                  인구감소지역 {s.declining.toLocaleString()}곳
                  <span className="text-ink3"> · {s.sigungu_count}개 시군구</span>
                </div>

                {/*
                  지역 칩 미리보기 — 데이터에 실제로 있는 시도만.
                  17개 시도를 다 그려놓고 누르면 빈 화면이 나오는 게 최악이다
                  (`report:grid` 실측: 소재 × 시군구는 절반이 0곳).
                */}
                <div className="mt-2.5 font-mono text-[11px] text-ink3">
                  {chips
                    .slice(0, 4)
                    .map((c) => `${shortSido(c.sido)} ${c.count}`)
                    .join(" · ")}
                  {chips.length > 4 && ` +${chips.length - 4}`}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/*
        ⚠️ 목록 화면에서 배수를 약속하지 않는다. 여기서 말할 수 있는 건
           "몇 곳 있다" 까지다. 성과는 채널을 넣어야 나온다.
      */}
      <div className="mt-12 border-t border-hair pt-6">
        <p className="font-mono text-[11px] leading-relaxed text-ink3">
          채널을 넣으면 이 목록에서 채널에 맞는 곳을 골라 준다 ·{" "}
          <Link href="/" className="text-ink2 underline-offset-2 hover:text-open hover:underline">
            채널 분석
          </Link>
        </p>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink3">
          한국관광공사 TourAPI · 전국전통시장 표준데이터 · 전국폐교재산 기본정보 ·
          한국천문연구원 출몰시각
        </p>
      </div>
    </main>
  );
}
