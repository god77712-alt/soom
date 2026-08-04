/**
 * 홈. 스크롤하면서 논지가 이어지는 랜딩 화면.
 *
 * 순서를 바꾸지 말 것 — 설득의 순서다.
 *   1. 문제      콘텐츠가 없는 곳엔 아무도 안 간다
 *   2. 계산      우리가 어떻게 고르는가 (공식을 숨기지 않는다)
 *   3. 결과      실제로 이렇게 나온다 (진짜 계산 결과를 그대로 보여준다)
 *   4. 대상      크리에이터 / 기관
 *
 * 화면 목록(S1~S5)은 개발용이라 맨 아래로 내렸다.
 */

import Link from "next/link";
import { MapHero } from "@/components/MapHero";
import { Reveal } from "@/components/Reveal";
import { getStrings } from "@/lib/i18n";
import { occupiedPlaces, recommendPlaces } from "@/lib/repo";

const S = getStrings("ko");

const SCREENS = [
  { href: "/start", label: "S1 온보딩" },
  { href: "/profile?q=Wander Korea", label: "S2 채널 분석" },
  { href: "/recommend?channel=ch_wander&tag=t_oil_market", label: "S3 추천" },
  { href: "/place/p_sunchang_market?channel=ch_wander&tag=t_oil_market", label: "S4 상세" },
  { href: "/admin", label: "S5 어드민" },
  { href: "/check", label: "검증표" },
];

/** 히어로 위 텍스트를 읽히게 하는 장막. 지도를 다 덮지 않는다 */
const VEIL =
  "radial-gradient(115% 90% at 10% 45%, #000 0%, rgba(0,0,0,.88) 26%, rgba(0,0,0,.42) 54%, rgba(0,0,0,.08) 78%, transparent 100%)";
const VEIL_BOTTOM = "linear-gradient(to bottom, transparent 55%, #000 100%)";

export default async function Home() {
  // 랜딩에 박아둔 숫자가 아니라 실제 계산 결과를 그대로 보여준다.
  const occupied = await occupiedPlaces("t_oil_market", "en", 3);
  const cards = await recommendPlaces(
    "ch_wander",
    "t_oil_market",
    5,
    occupied.map((o) => o.place.id),
  );
  const maxScore = Math.max(...cards.map((c) => c.soom_score), 1);

  const mapOpen = cards.map((c) => ({ name: c.place.name_ko, lat: c.place.lat, lng: c.place.lng }));
  const mapHeld = occupied.map((o) => ({
    name: o.place.name_ko,
    lat: o.place.lat,
    lng: o.place.lng,
  }));

  return (
    <main>
      {/* ── 히어로 ── */}
      <section className="relative flex min-h-[38rem] items-center overflow-hidden lg:min-h-[44rem]">
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
            <div className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
              2026 관광데이터 활용 공모전
            </div>
            <h1 className="mt-5 font-serif text-[2.5rem] leading-[1.15] font-normal tracking-tight text-balance sm:text-6xl">
              통계가 다음 좌표를 계산한다
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink2">
              당신 채널에서 <span className="text-ink">잘 된 영상의 소재</span>를 뽑고, 그 소재가
              아직 촬영되지 않은 지역을 찾아냅니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/start"
                className="border border-open px-6 py-3 text-sm font-medium text-open transition-colors hover:bg-open hover:text-ground"
              >
                내 채널로 시작하기
              </Link>
              <Link
                href="/recommend?channel=ch_wander&tag=t_oil_market"
                className="px-2 py-3 font-mono text-xs text-ink3 transition-colors hover:text-ink2"
              >
                결과 먼저 보기 →
              </Link>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-6 bottom-6 hidden text-right font-mono text-[10px] leading-relaxed text-ink3 lg:block">
          <b className="block text-xl font-bold text-signal tnum">48,925</b>
          국문 관광정보 전수
          <br />
          TourAPI 실측 · 2026-08
        </div>
      </section>

      {/* ── 1. 문제 ── */}
      <section className="border-t border-hair px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="font-mono text-[11px] tracking-[0.16em] text-ink3 uppercase">
              01 &nbsp;문제
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-snug font-normal tracking-tight text-balance sm:text-4xl">
              병목은 관광객이 아니라 콘텐츠다
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-px bg-hair sm:grid-cols-3">
            {[
              ["사람은 콘텐츠로 본 곳에 간다", "콘텐츠가 없는 지역엔 아무도 안 간다"],
              ["크리에이터는 안 알려진 곳을 피한다", "조회수가 안 나올 리스크 때문에"],
              ["그래서 그 지역은 영원히 비어 있다", "이게 진짜 병목이다"],
            ].map(([a, b], i) => (
              <Reveal key={a} delay={i * 90}>
                <div className="h-full bg-ground p-6">
                  <div className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</div>
                  <p className="mt-3 leading-relaxed text-ink">{a}</p>
                  <p className={`mt-2 text-sm ${i === 2 ? "text-open" : "text-ink3"}`}>{b}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="mt-10 max-w-[52ch] leading-relaxed text-ink2">
              그래서 우리는 관광객을 보내지 않습니다.{" "}
              <span className="text-ink">관광객을 데려올 사람</span>을 보냅니다. 크리에이터는 촬영
              때문에 2~3일 머물고, 그가 만든 영상이 후속 방문자를 부릅니다.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 2. 계산 ── */}
      <section className="grid-floor border-t border-hair px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="font-mono text-[11px] tracking-[0.16em] text-ink3 uppercase">
              02 &nbsp;계산
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-snug font-normal tracking-tight text-balance sm:text-4xl">
              공식을 숨기지 않는다
            </h2>
          </Reveal>

          <div className="mt-10 space-y-px bg-hair">
            {[
              {
                n: "①",
                t: "영상 한 편이 얼마나 잘 됐나",
                eq: "VSR = 조회수 ÷ 구독자 수",
                d: "절대 조회수로 비교하면 큰 채널이 전부 이깁니다. 3년 이내 영상만, 구독자 1,000 미만 채널 제외, 평균이 아니라 중앙값.",
              },
              {
                n: "②",
                t: "이 소재가 얼마나 먹히나",
                eq: "소재 성과 = 그 소재 영상들의 VSR 중앙값",
                d: "언어별로 반드시 나눕니다. 재래시장은 해외 4.1배 / 국내 0.6배로 정반대입니다. 합치면 모든 소재가 평균으로 수렴해 추천이 무의미해집니다.",
              },
              {
                n: "③",
                t: "그래서 어디로 보낼까",
                eq: "추천 점수 = 소재 성과 × 1 / log(경쟁 영상 수 + 2)",
                d: "인구감소지역에 가산점을 주지 않습니다. 희소성만으로 자연히 위로 올라옵니다. 그래야 «우리가 편애했다»가 아니라 «데이터가 그렇게 말했다»가 됩니다.",
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="bg-ground p-6 sm:p-8">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-open">{s.n}</span>
                    <h3 className="font-semibold tracking-tight">{s.t}</h3>
                  </div>
                  <div className="mt-4 overflow-x-auto border border-hair2 bg-panel px-4 py-3 font-mono text-sm whitespace-nowrap text-ink tnum">
                    {s.eq}
                  </div>
                  <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-ink2">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. 결과 ── */}
      <section className="border-t border-hair px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="font-mono text-[11px] tracking-[0.16em] text-ink3 uppercase">
              03 &nbsp;결과
            </div>
            <h2 className="mt-4 font-serif text-3xl leading-snug font-normal tracking-tight text-balance sm:text-4xl">
              오일장 소재로 계산하면 이렇게 나온다
            </h2>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-ink2">
              해외 채널(구독자 2.1만) 기준. 소재 성과는 후보 전체가 3.2배로 같습니다. 순위를 가르는
              건 경쟁 영상 수 하나뿐입니다.
            </p>
          </Reveal>

          <div className="mt-10">
            {cards.map((c, i) => {
              const zero = c.competition.count === 0;
              return (
                <Reveal key={c.place.id} delay={i * 70}>
                  <div className="grid grid-cols-[2rem_1fr] gap-4 border-b border-hair py-4">
                    <span
                      className={`font-mono text-sm font-bold ${zero ? "text-open" : "text-ink3"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-x-2.5">
                        <span className="font-semibold">{c.place.name_ko}</span>
                        <span className="font-mono text-xs text-ink3">
                          {c.place.sido} {c.place.sigungu}
                        </span>
                        {c.place.is_declining_area && (
                          <span className="border border-hair2 px-1.5 py-0.5 font-mono text-[10px] text-ink3">
                            {S.decliningArea}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
                        <span className="relative h-1 bg-panel2">
                          <i
                            className={`absolute inset-y-0 left-0 ${zero ? "bg-open" : "bg-signal"}`}
                            style={{ width: `${(c.soom_score / maxScore) * 100}%` }}
                          />
                        </span>
                        <span className="font-mono text-sm text-ink3 tnum">
                          <b
                            className={`mr-2 text-base font-bold ${zero ? "text-open" : "text-ink"}`}
                          >
                            {c.soom_score.toFixed(2)}
                          </b>
                          {c.competition.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}

            <Reveal delay={200}>
              <div className="mt-6 border border-hair bg-panel p-5">
                <div className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
                  추천에서 빠진 곳
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink3">
                  {occupied.map((o) => (
                    <span key={o.place.id}>
                      {o.place.name_ko}
                      <span className="ml-1.5 font-mono tnum">{S.videoCount(o.count)}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-ink2">
                  유명한 곳을 지우지 않습니다. 비교 기준으로 남겨둡니다.{" "}
                  <span className="text-ink">정선이 보여야 곡성이 좋아 보이기</span> 때문입니다.
                </p>
              </div>
            </Reveal>

            <Reveal delay={260}>
              <p className="mt-8 max-w-[52ch] leading-relaxed text-ink2">
                상위 다섯 곳이 전부 인구감소지역인데{" "}
                <span className="text-ink">가산점은 한 줄도 없습니다.</span> 희소성 가중치만으로
                자연히 올라온 결과입니다.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 4. 대상 ── */}
      <section className="border-t border-hair px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="font-mono text-[11px] tracking-[0.16em] text-ink3 uppercase">
              04 &nbsp;누가 쓰나
            </div>
          </Reveal>
          <div className="mt-8 grid gap-px bg-hair sm:grid-cols-2">
            <Reveal>
              <div className="h-full bg-ground p-7">
                <h3 className="font-serif text-2xl font-normal">크리에이터</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink2">
                  소재는 정했는데 어디로 갈지 못 정한 사람. 그냥 두면 제일 유명한 곳으로 갑니다.
                  그걸 돌려세우는 게 이 서비스의 일입니다.
                </p>
                <Link
                  href="/start"
                  className="mt-5 inline-block font-mono text-xs text-open hover:underline"
                >
                  채널 분석하기 →
                </Link>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className="h-full bg-ground p-7">
                <h3 className="font-serif text-2xl font-normal">지자체 · 관광공사</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink2">
                  같은 엔진, 다른 뷰. 우리 지역에 아직 남은 소재가 뭔지, 어떤 채널을 부르면 맞는지
                  봅니다. 성공 지표는 인구감소지역에서 새로 생긴 영상 수입니다.
                </p>
                <Link
                  href="/admin"
                  className="mt-5 inline-block font-mono text-xs text-signal hover:underline"
                >
                  어드민 콘솔 →
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 개발용 ── */}
      <footer className="border-t border-hair px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
            개발용 화면
          </span>
          {SCREENS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="font-mono text-xs text-ink3 transition-colors hover:text-open"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
