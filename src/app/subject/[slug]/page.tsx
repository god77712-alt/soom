import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceThumb } from "@/components/PlaceThumb";
import {
  SUBJECTS,
  filterPlaces,
  getSubject,
  regionChips,
  shortSido,
} from "@/lib/catalog";
import { shootPlanFor } from "@/lib/shootday";

/**
 * ⚠️ `dynamic = "force-static"` 을 쓰면 안 된다. 이 화면은 `searchParams`(지역 칩)로
 *    목록을 거르는데, force-static 이면 그 값이 항상 비어서 **칩이 조용히 안 먹는다.**
 *    generateStaticParams 로 12개 소재 경로만 미리 알려주고 렌더는 요청 시에 한다.
 */
export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = getSubject((await params).slug);
  return s
    ? { title: `${s.label} 촬영지 ${s.total}곳 — 숨`, description: `인구감소지역 ${s.declining}곳 포함` }
    : {};
}

/**
 * 소재별 촬영 가능 장소 **목록**.
 *
 * ── 홈의 추천 5곳과 무엇이 다른가 ────────────────────────
 * 홈은 "당신 채널엔 이 5곳" 이라고 **골라 준다.** 여기는 **다 펼쳐 놓는다.**
 *
 * 예측(추천)은 근거가 약하다 — 소재 효과는 실재해도 채널이 74% 를 설명하고,
 * 개별 소재끼리는 다중비교 보정을 하나도 통과 못 했다.
 * 반면 **목록은 근거가 필요 없다. 있으면 있는 것이다.**
 * 그래서 이 화면은 아무것도 예측하지 않는다. 세어서 보여줄 뿐이다.
 *
 * ⚠️ 지역 칩을 하드코딩하지 않는다. 데이터에 있는 시도만 그린다
 *    (`regionChips`). 실측에서 소재 × 시군구는 절반이 0곳이었다 —
 *    없는 칩을 눌러 빈 화면을 보면 크리에이터는 데이터가 없다고 판단하고 이탈한다.
 */
export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sido?: string; only?: string }>;
}) {
  const subject = getSubject((await params).slug);
  if (!subject) notFound();

  const sp = await searchParams;
  const sido = sp.sido ?? null;
  const decliningOnly = sp.only === "declining";

  const chips = regionChips(subject);
  const shown = filterPlaces(subject, { sido, decliningOnly });

  /** 촬영 계획의 기준 날짜. 카드마다 만들면 자정 근처에서 카드끼리 날짜가 갈린다 */
  const today = new Date();

  const href = (next: { sido?: string | null; only?: boolean }) => {
    const q = new URLSearchParams();
    const s = next.sido === undefined ? sido : next.sido;
    const o = next.only === undefined ? decliningOnly : next.only;
    if (s) q.set("sido", s);
    if (o) q.set("only", "declining");
    const qs = q.toString();
    return `/subject/${subject.slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link href="/" className="font-mono text-[11px] text-ink3 hover:text-ink">
        ← 숨
      </Link>

      {/* ── 머리 ─────────────────────────────────────────── */}
      <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight sm:text-5xl">
        {subject.label}
      </h1>

      {/*
        전국 총계를 먼저 말한다. 이 화면의 주장이 그것 하나다.
        담은 것(places.length)과 전국 총계(total)가 다르므로 아래에서 그 사실도 밝힌다.
      */}
      <p className="mt-2.5 font-mono text-sm text-ink2 tnum">
        전국 {subject.total.toLocaleString()}곳
        <span className="text-ink3"> · </span>
        <span className="text-open">인구감소지역 {subject.declining.toLocaleString()}곳</span>
        <span className="text-ink3"> · {subject.sigungu_count}개 시군구</span>
      </p>

      {/*
        영상 표본을 밝힌다. 배수를 안 쓰는 이유이기도 하다 —
        100편 미만이면 `1.2×` 와 `2.4×` 를 구분해서 말할 수 없다 (score.ts).
      */}
      <p className="mt-1 font-mono text-[11px] text-ink3">
        YouTube 영상 {subject.video_count}편 수집
        {subject.can_show_multiplier ? " · 성과 비교 가능" : " · 표본이 얇아 순위만"}
      </p>

      {/* ── 지역 좁히기 ──────────────────────────────────── */}
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[11px] text-ink3">지역</span>
        <Chip href={href({ sido: null })} active={!sido} label="전국" count={subject.places.length} />
        {chips.map((c) => (
          <Chip
            key={c.sido}
            href={href({ sido: c.sido })}
            active={sido === c.sido}
            label={shortSido(c.sido)}
            count={c.count}
          />
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[11px] text-ink3">범위</span>
        <Chip href={href({ only: false })} active={!decliningOnly} label="전체" />
        <Chip href={href({ only: true })} active={decliningOnly} label="인구감소지역만" />
      </div>

      {/* ── 목록 ─────────────────────────────────────────── */}
      <div className="mt-8 flex items-baseline justify-between border-b border-hair pb-2">
        <h2 className="font-mono text-[11px] tracking-wider text-ink3 uppercase">목록</h2>
        <span className="font-mono text-[11px] text-ink3 tnum">
          {shown.length}곳
          {subject.places.length < subject.total && !sido && !decliningOnly && (
            <span> · 전국 {subject.total.toLocaleString()}곳 중</span>
          )}
        </span>
      </div>

      {shown.length === 0 ? (
        // 칩을 데이터에서 만들기 때문에 여기 도달하기 어렵지만, 조합 필터로는 가능하다
        <p className="mt-6 font-mono text-sm text-ink3">
          이 조건에는 없다. 지역을 넓혀서 본다.
        </p>
      ) : (
        <ul className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {shown.map((p) => {
            const plan = shootPlanFor(p.name, p.sigungu, today);
            return (
              <li key={p.id} className="flex gap-3.5">
                <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden">
                  <PlaceThumb
                    place={{ name_ko: p.name, lat: p.lat, lng: p.lng, image_url: p.image }}
                    open={p.declining}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm text-ink">{p.name}</span>
                    {p.declining && (
                      <span className="border border-open/40 px-1 font-mono text-[10px] text-open">
                        인구감소
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink3">
                    {shortSido(p.sido)} {p.sigungu}
                  </div>

                  {/* 장날은 목록에서도 보여준다 — 안 맞춰 가면 빈 공터다 */}
                  {plan && (
                    <div className="mt-1 font-mono text-[11px] text-open-d">
                      다음 장날 {plan.days[0].label}
                      {plan.days[0].sun?.sunrise && (
                        <span className="text-ink3"> · 일출 {plan.days[0].sun.sunrise}</span>
                      )}
                    </div>
                  )}

                  {/*
                    ⚠️ 추정 좌표와 저신뢰 데이터를 반드시 밝힌다.
                       폐교는 좌표가 읍면 중심이라 실제 위치와 km 단위로 다를 수 있고,
                       현장 상태도 자주 바뀐다. 밝히지 않으면 헛걸음의 책임이 우리에게 온다.
                  */}
                  {(p.coord_estimated || p.low_reliability) && (
                    <div className="mt-1 font-mono text-[10px] text-ink3">
                      {p.coord_estimated && "위치는 읍면 중심 추정"}
                      {p.coord_estimated && p.low_reliability && " · "}
                      {p.low_reliability && "공공데이터 기준 · 현장 확인"}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── 다른 소재 ────────────────────────────────────── */}
      <div className="mt-12 border-t border-hair pt-6">
        <h2 className="font-mono text-[11px] tracking-wider text-ink3 uppercase">다른 소재</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUBJECTS.filter((s) => s.slug !== subject.slug).map((s) => (
            <Link
              key={s.slug}
              href={`/subject/${s.slug}`}
              className="border border-hair2 px-2.5 py-1 font-mono text-[12px] text-ink2 transition-colors hover:border-open/50 hover:text-open"
            >
              {s.label}
              <span className="ml-1.5 text-ink3 tnum">{s.total.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-8 font-mono text-[10px] leading-relaxed text-ink3">
        장소 · 한국관광공사 TourAPI, 전국전통시장·폐교재산 표준데이터 · 장날 · 전통시장
        표준데이터 · 일출 · 한국천문연구원
      </p>
    </main>
  );
}

function Chip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`border px-2.5 py-1 font-mono text-[12px] transition-colors ${
        active
          ? "border-open bg-open/10 text-open"
          : "border-hair2 text-ink2 hover:border-open/50 hover:text-open"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 text-ink3 tnum">{count}</span>}
    </Link>
  );
}
