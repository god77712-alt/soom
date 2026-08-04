import Link from "next/link";
import { MapHero } from "@/components/MapHero";
import { getStrings } from "@/lib/i18n";

const S = getStrings("ko");

/** 0단계 진행 상황판. 화면이 다 붙으면 S1(온보딩)으로 교체된다. */
const SCREENS = [
  { href: "/start", label: "S1 온보딩", desc: "채널 URL 입력 · 소재 직접 선택" },
  { href: "/profile?q=Wander Korea", label: "S2 채널 분석", desc: "잘 되는 색깔을 찾는다" },
  {
    href: "/recommend?channel=ch_wander&tag=t_oil_market",
    label: "S3 추천",
    desc: "성공 영상 → 이미 찍힌 곳 → 경쟁이 적은 곳",
  },
  {
    href: "/place/p_sunchang_market?channel=ch_wander&tag=t_oil_market",
    label: "S4 장소 상세",
    desc: "확신을 만드는 6단 구조",
  },
  { href: "/admin", label: "S5 어드민", desc: "시군구별 랭킹 · 채널 매칭" },
  { href: "/check", label: "검증표", desc: "예외 케이스 10종 자동 점검 (개발용)" },
];

/** 지도 히어로에 뿌릴 좌표. 실데이터가 들어오면 repo 에서 가져온다. */
const DEMO_OPEN = [
  { name: "곡성", lat: 35.282, lng: 127.292 },
  { name: "청송", lat: 36.432, lng: 129.057 },
  { name: "무주", lat: 36.007, lng: 127.661 },
  { name: "봉화", lat: 36.893, lng: 128.732 },
  { name: "순창", lat: 35.3744, lng: 127.1376 },
];
const DEMO_HELD = [
  { name: "정선", lat: 37.3805, lng: 128.6606 },
  { name: "화개", lat: 35.1707, lng: 127.647 },
];

export default function Home() {
  return (
    <main>
      <section className="relative min-h-[30rem] overflow-hidden border-b border-hair">
        <div className="absolute inset-0">
          <MapHero
            origin={{ name: "서울", lat: 37.5665, lng: 126.978 }}
            open={DEMO_OPEN}
            held={DEMO_HELD}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,#000_0%,rgba(0,0,0,.9)_36%,rgba(0,0,0,.4)_58%,transparent_76%)] max-md:bg-[linear-gradient(180deg,rgba(0,0,0,.92)_34%,rgba(0,0,0,.55)_74%,transparent)]" />

        <div className="relative max-w-xl px-6 py-16">
          <div className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
            2026 관광데이터 활용 공모전
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-tight font-normal tracking-tight text-balance sm:text-5xl">
            통계가 다음 좌표를 계산한다
          </h1>
          <p className="mt-5 max-w-[44ch] leading-relaxed text-ink2">
            {S.appTagline}. 당신 채널에서 잘 된 영상의 소재를 뽑고, 그 소재가 아직 촬영되지 않은
            지역을 찾아냅니다.
          </p>
          <div className="mt-7 flex flex-wrap items-baseline gap-1.5 font-mono text-sm tnum">
            <span className="font-serif text-ink2 italic">추천 점수</span>
            <span className="text-ink3">=</span>
            <span className="text-signal">소재 성과</span>
            <span className="text-ink3">×</span>
            <span className="text-open">1 / log(경쟁 영상 수 + 2)</span>
          </div>
          <Link
            href="/start"
            className="mt-8 inline-block border border-open px-6 py-3 text-sm font-medium text-open transition-colors hover:bg-open hover:text-ground"
          >
            내 채널로 시작하기
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <h2 className="font-mono text-[11px] tracking-[0.16em] text-ink3 uppercase">화면</h2>
        <div className="mt-4">
          {SCREENS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-baseline justify-between gap-4 border-b border-hair py-4 transition-colors hover:bg-panel"
            >
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="mt-0.5 text-sm text-ink3">{s.desc}</div>
              </div>
              <span className="font-mono text-xs text-ink3 transition-colors group-hover:text-open">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
