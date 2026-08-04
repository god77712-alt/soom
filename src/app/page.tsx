/**
 * 홈 — 크리에이터가 들어오는 화면.
 *
 * ⚠️ 이 페이지는 심사위원에게 프로젝트를 설명하는 곳이 아니다.
 *    크리에이터는 "병목이 어쩌고" 에 관심이 없다. 바로 쓸 수 있어야 한다.
 *
 *   · 입력창이 첫 화면에 있다. 버튼 눌러서 다른 페이지로 가는 구조가 아니다.
 *   · 기능 설명은 실제 결과 조각으로 보여준다. 문장으로 설명하지 않는다.
 *   · 공식·방법론은 여기 안 쓴다. 궁금한 사람만 상세에서 본다.
 */

import Link from "next/link";
import { MapHero } from "@/components/MapHero";
import { Reveal } from "@/components/Reveal";
import { getStrings } from "@/lib/i18n";
import {
  getDemoChannels,
  getPlaceDetail,
  occupiedPlaces,
  recommendPlaces,
} from "@/lib/repo";

const S = getStrings("ko");

/**
 * 글자가 앉는 왼쪽만 가린다. 지도가 있는 오른쪽은 건드리지 않는다.
 * 예전엔 원형으로 덮어서 지도 한가운데가 제일 어두웠다.
 */
const VEIL =
  "linear-gradient(90deg, #000 0%, rgba(0,0,0,.94) 30%, rgba(0,0,0,.55) 46%, rgba(0,0,0,.12) 60%, transparent 72%)";
const VEIL_BOTTOM = "linear-gradient(to bottom, transparent 62%, #000 100%)";

export default async function Home() {
  const [demoChannels, occupied] = await Promise.all([
    getDemoChannels(),
    occupiedPlaces("t_oil_market", "en", 3),
  ]);
  const cards = await recommendPlaces(
    "ch_wander",
    "t_oil_market",
    5,
    occupied.map((o) => o.place.id),
  );
  const sample = await getPlaceDetail("p_sunchang_market", "ch_wander", "t_oil_market");

  const mapOpen = cards.map((c) => ({ name: c.place.name_ko, lat: c.place.lat, lng: c.place.lng }));
  const mapHeld = occupied.map((o) => ({
    name: o.place.name_ko,
    lat: o.place.lat,
    lng: o.place.lng,
  }));

  return (
    <main>
      {/* ══ 히어로 — 여기서 바로 시작한다 ══ */}
      <section className="relative flex min-h-[36rem] items-center overflow-hidden lg:min-h-[42rem]">
        <div className="absolute inset-0">
          <MapHero
            origin={{ name: "서울", lat: 37.5665, lng: 126.978 }}
            open={mapOpen}
            held={mapHeld}
          />
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: VEIL }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: VEIL_BOTTOM }} />

        <div className="relative w-full px-6 py-20 sm:px-10">
          <div className="max-w-2xl">
            <h1 className="font-serif text-[2.5rem] leading-[1.15] font-normal tracking-tight text-balance sm:text-[3.5rem]">
              다음 영상, 어디서 찍을지
              <br />
              <span className="text-open">데이터가 골라드립니다</span>
            </h1>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-ink2">
              채널 주소만 넣으면 당신이 잘 찍는 소재를 찾고, 그 소재로 아직 아무도 안 찍은 곳을
              알려드립니다.
            </p>

            {/* 입력창. 자바스크립트 없이도 동작한다 */}
            <form action="/profile" method="get" className="mt-8 max-w-lg">
              <div className="flex gap-2">
                <input
                  name="q"
                  type="text"
                  placeholder={S.s1UrlPlaceholder}
                  aria-label={S.s1UrlLabel}
                  className="min-w-0 flex-1 border border-hair2 bg-panel/80 px-4 py-3.5 text-sm outline-none backdrop-blur placeholder:text-ink3 focus:border-open"
                />
                <button
                  type="submit"
                  className="shrink-0 bg-open px-6 py-3.5 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
                >
                  분석
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-[11px] text-ink3">예시로 바로 보기</span>
              {demoChannels.map((c) => (
                <Link
                  key={c.id}
                  href={`/profile?q=${encodeURIComponent(c.title)}`}
                  className="border border-hair2 px-3 py-1.5 text-xs text-ink2 transition-colors hover:border-open hover:text-open"
                >
                  {c.title}
                </Link>
              ))}
            </div>

            <p className="mt-5 font-mono text-[11px] text-ink3">
              채널이 없어도 됩니다 —{" "}
              <Link href="/start" className="text-signal hover:underline">
                소재만 골라서 찾기
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ══ 뭘 받는지 — 실제 결과 조각으로 ══ */}
      <section className="border-t border-hair px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="font-serif text-3xl leading-snug font-normal tracking-tight text-balance">
              이런 걸 받습니다
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-px bg-hair md:grid-cols-2">
            {/* 촬영지 목록 */}
            <Reveal>
              <div className="h-full bg-ground p-6">
                <div className="font-mono text-[11px] tracking-wider text-signal uppercase">
                  촬영지
                </div>
                <h3 className="mt-2 font-semibold">경쟁이 적은 순서로 5곳</h3>
                <div className="mt-4 space-y-2">
                  {cards.slice(0, 3).map((c) => (
                    <div key={c.place.id} className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-ink2">{c.place.name_ko}</span>
                      <span
                        className={`shrink-0 font-mono text-xs tnum ${
                          c.competition.count === 0 ? "font-semibold text-open" : "text-ink3"
                        }`}
                      >
                        {c.competition.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* 촬영 컷 */}
            <Reveal delay={80}>
              <div className="h-full bg-ground p-6">
                <div className="font-mono text-[11px] tracking-wider text-signal uppercase">
                  촬영 구성
                </div>
                <h3 className="mt-2 font-semibold">뭘 찍을지, 몇 시에 찍을지</h3>
                <div className="mt-4 space-y-2">
                  {sample?.shots.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-baseline gap-3">
                      <span className="shrink-0 font-mono text-[11px] text-open tnum">
                        {s.best_time ?? "상시"}
                      </span>
                      <span className="truncate text-sm text-ink2">{s.caption}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* 헛걸음 방지 */}
            <Reveal delay={160}>
              <div className="h-full bg-ground p-6">
                <div className="font-mono text-[11px] tracking-wider text-signal uppercase">
                  헛걸음 방지
                </div>
                <h3 className="mt-2 font-semibold">장날 · 운영시간 · 일출</h3>
                {sample && (
                  <div className="mt-4 space-y-1.5 font-mono text-sm text-ink2 tnum">
                    <div>
                      장날 <span className="text-ink">{sample.operation.open_cycle ?? "상시"}</span>
                    </div>
                    <div>
                      운영 <span className="text-ink">{sample.operation.open_hours ?? "확인 필요"}</span>
                    </div>
                    <div>
                      일출 <span className="text-ink">{sample.plan.sunrise}</span> · 일몰{" "}
                      <span className="text-ink">{sample.plan.sunset}</span>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>

            {/* 묶어 찍기 */}
            <Reveal delay={240}>
              <div className="h-full bg-ground p-6">
                <div className="font-mono text-[11px] tracking-wider text-signal uppercase">
                  하루 동선
                </div>
                <h3 className="mt-2 font-semibold">근처에 같이 찍을 곳</h3>
                <div className="mt-4 space-y-2">
                  {sample?.nearby.slice(0, 3).map((n) => (
                    <div key={n.place_id} className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-ink2">
                        {n.name_ko}
                        <span className="ml-2 text-xs text-ink3">{n.tag_names.join(" · ")}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ink3 tnum">
                        차로 {n.drive_minutes}분
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

            {/* ══ 마지막 입력 ══ */}
      <section className="border-t border-hair px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="font-serif text-3xl leading-snug font-normal tracking-tight text-balance">
              채널 주소 하나면 됩니다
            </h2>
            <form action="/profile" method="get" className="mt-6 max-w-lg">
              <div className="flex gap-2">
                <input
                  name="q"
                  type="text"
                  placeholder={S.s1UrlPlaceholder}
                  aria-label={S.s1UrlLabel}
                  className="min-w-0 flex-1 border border-hair2 bg-panel px-4 py-3.5 text-sm outline-none placeholder:text-ink3 focus:border-open"
                />
                <button
                  type="submit"
                  className="shrink-0 bg-open px-6 py-3.5 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
                >
                  분석
                </button>
              </div>
            </form>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-hair px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-ink3">
          <span>{S.appName}</span>
          <span>2026 관광데이터 활용 공모전</span>
          <Link href="/admin" className="transition-colors hover:text-ink2">
            기관용 콘솔
          </Link>
          <Link href="/check" className="transition-colors hover:text-ink2">
            데이터 검증
          </Link>
        </div>
      </footer>
    </main>
  );
}
