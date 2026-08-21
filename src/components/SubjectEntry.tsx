import Link from "next/link";
import { SUBJECTS, regionChips, shortSido } from "@/lib/catalog";

/**
 * 홈 현관 — **소재 목록이 먼저 보인다.**
 *
 * ── 왜 바꿨나 (2026-08-22) ───────────────────────────────
 * 예전 현관은 유튜브 채널 URL 을 넣기 전에는 아무것도 안 보여줬다. 처음 온
 * 사람은 자기 채널 주소를 복사해 오거나, 그냥 나간다.
 *
 * 그런데 **채널 없이 쓰는 길이 페이지에서 시각적으로 제일 약한 요소였다** —
 * 회색 작은 글씨 링크 하나(`소재만 골라서 찾기`). 정작 그쪽(`/start`)이
 * 12개 소재 6,309곳 전부 실데이터고 사진도 붙어 있다.
 * **제일 좋은 걸 제일 안 보이게 두고 있었다.**
 *
 * 근거는 이미 나와 있었다: 우리가 파는 건 예측이 아니라 목록이다.
 * 예측은 채널이 성과의 74% 를 설명하고 개별 소재끼리는 다중비교 보정을 하나도
 * 통과 못 했다. **목록은 근거가 필요 없다 — 있으면 있는 것이다.**
 * 근거가 약한 쪽을 현관에 두고 강한 쪽을 숨기고 있었던 셈이다.
 *
 * ── 문구 ─────────────────────────────────────────────────
 * `좌표` 를 걷어냈다. 우리 내부 말이다 — 크리에이터는 촬영지를 찾지 좌표를
 * 찾지 않는다. `채널 → 상위 성과 영상 → 소재 → 경쟁 최소 좌표` 도 뺐다.
 * 그건 우리가 어떻게 계산하는지지 방문자가 뭘 얻는지가 아니다.
 *
 * ⚠️ 여기서 성과·배수를 약속하지 않는다. 이 화면이 말할 수 있는 건
 *    "몇 곳 있다" 까지다. 성과는 채널을 넣어야 나온다.
 */

/** 표지 사진이 없는 소재(폐교)를 위한 자리. 남의 사진을 갖다 쓰지 않는다 */
function CoverFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-panel">
      <span className="font-serif text-2xl text-ink2">{label}</span>
      {/*
        ⚠️ "사진 없음" 이라고 쓰지 않는다 — 없는 걸 굳이 알리는 문장이다(7항).
           대신 **왜 없는지**를 사실로 말한다. 폐교는 TourAPI 에 없어서 우리가
           직접 승격시킨 소재라 관광 사진이 애초에 존재하지 않는다.
           관광사진 갤러리도 실측 매칭 0곳이었다.
      */}
      <span className="font-mono text-[10px] text-ink3">공공데이터 기준 · 현장 확인</span>
    </div>
  );
}

export function SubjectEntry({
  notFound,
  demoChannels,
}: {
  notFound: boolean;
  demoChannels: Array<{ id: string; title: string }>;
}) {
  const totalPlaces = SUBJECTS.reduce((s, x) => s + x.total, 0);
  const totalDeclining = SUBJECTS.reduce((s, x) => s + x.declining, 0);

  return (
    <main className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      {/*
        ⚠️ **이 화면은 전부 실데이터다** — TourAPI 장소, 표준데이터 장날,
           천문연 일출. 지어낸 값이 한 줄도 없다.

        그런데 경로가 `/` 라서 배너는 시연으로 본다. `/?q=채널` 은 같은 경로에서
        아직 시연이 섞이므로 **경로로는 못 가른다** — `/place/[id]` 와 같은 상황이다.
        그래서 표식을 심고 `globals.css` 의 `:has()` 규칙이 배너를 지운다.
        CSS 라서 하이드레이션과 무관하다.

        진짜 데이터를 가짜라고 말하는 건 그 반대만큼 나쁘다.
      */}
      <div id="real-data-page" hidden />

      <h1 className="font-serif text-[2.5rem] leading-[1.15] font-normal tracking-tight text-balance sm:text-[3.25rem]">
        찍을 곳을 소재로 찾습니다
      </h1>

      {/*
        설득 문장 금지. 이 화면의 주장은 "이만큼 있다" 하나뿐이라 숫자로만 말한다.
      */}
      <p className="mt-3 font-mono text-sm text-ink2 tnum">
        {SUBJECTS.length}개 소재 · {totalPlaces.toLocaleString()}곳
        <span className="text-ink3"> · </span>
        <span className="text-open">인구감소지역 {totalDeclining.toLocaleString()}곳</span>
      </p>

      <ul className="mt-8 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((s) => {
          const chips = regionChips(s);
          return (
            <li key={s.slug}>
              <Link href={`/subject/${s.slug}`} className="group block">
                {/*
                  사진이 현관의 실질이다. 목록으로 어필하면 화면이 썸네일로
                  채워지고, **사진 없는 카드는 있어도 안 눌린다.**
                */}
                <div className="aspect-[3/2] w-full overflow-hidden border border-hair transition-colors group-hover:border-open/50">
                  {s.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.cover}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
                    />
                  ) : (
                    <CoverFallback label={s.label} />
                  )}
                </div>

                <div className="mt-2.5 flex items-baseline justify-between gap-2">
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
                <div className="mt-1.5 font-mono text-[11px] text-ink3">
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
        ── 채널 분석은 보조로 내려온다 ──────────────────────
        없애지 않는다. 채널을 넣으면 이 목록에서 골라 주는 건 실제로 값어치가
        있고, 유튜브 심사에도 그 경로가 들어가 있다. 다만 **현관을 막지는 않는다.**
      */}
      <div className="mt-14 border-t border-hair pt-8">
        <h2 className="text-lg text-ink">내 채널에 맞춰 고르려면</h2>
        <p className="mt-1.5 font-mono text-[11px] text-ink3">
          채널의 최근 영상에서 잘 된 소재를 찾아, 이 목록에서 골라 준다
        </p>

        <form action="/" method="get" className="mt-4 max-w-lg">
          <div className="flex gap-2">
            <input
              name="q"
              type="text"
              placeholder="youtube.com/@channel"
              aria-label="YouTube 채널 주소"
              className="min-w-0 flex-1 border border-hair2 bg-panel/80 px-4 py-3 text-sm outline-none placeholder:text-ink3 focus:border-open"
            />
            <button
              type="submit"
              className="shrink-0 bg-open px-6 py-3 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
            >
              분석
            </button>
          </div>
          {notFound && (
            <p className="mt-2 font-mono text-xs text-open-d">
              채널을 찾지 못했습니다. 아래 예시로 확인해보세요.
            </p>
          )}
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[11px] text-ink3">예시</span>
          {demoChannels.map((c) => (
            <Link
              key={c.id}
              href={`/?q=${encodeURIComponent(c.title)}`}
              className="border border-hair2 px-3 py-1.5 text-xs text-ink2 transition-colors hover:border-open hover:text-open"
            >
              {c.title}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-10 font-mono text-[10px] leading-relaxed text-ink3">
        한국관광공사 TourAPI · 전국전통시장 표준데이터 · 전국폐교재산 기본정보 ·
        한국천문연구원 출몰시각
      </p>
    </main>
  );
}
