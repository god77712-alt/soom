import Link from "next/link";
import { getStrings } from "@/lib/i18n";

const S = getStrings("ko");

/** 0단계 진행 상황판. 화면이 다 붙으면 S1(온보딩)으로 교체된다. */
const SCREENS = [
  { href: "/check", label: "가짜 데이터 검증표", desc: "30건이 명세의 예외 케이스를 다 밟는지 확인", ready: true },
  { href: "/start", label: "S1 온보딩", desc: "채널 URL 입력 · 태그 직접 선택", ready: false },
  { href: "/profile", label: "S2 채널 프로필", desc: "당신 채널의 색깔", ready: false },
  { href: "/recommend", label: "S3 추천 5곳", desc: "한 태그로 5곳 + 확장 태그", ready: false },
  { href: "/place", label: "S4 장소 상세", desc: "확신을 만드는 6단 구조", ready: false },
  { href: "/admin", label: "S5 어드민 콘솔", desc: "시군구별 미개척 랭킹", ready: false },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">{S.appName}</h1>
      <p className="mt-2 text-neutral-400">{S.appTagline}</p>

      <div className="mt-10 space-y-2">
        {SCREENS.map((s) =>
          s.ready ? (
            <Link
              key={s.href}
              href={s.href}
              className="block rounded-lg border border-neutral-800 bg-neutral-900/40 px-5 py-4 transition hover:border-neutral-600"
            >
              <div className="font-medium">{s.label}</div>
              <div className="mt-0.5 text-sm text-neutral-500">{s.desc}</div>
            </Link>
          ) : (
            <div
              key={s.href}
              className="rounded-lg border border-neutral-900 px-5 py-4 opacity-40"
            >
              <div className="font-medium">
                {s.label} <span className="text-xs font-normal text-neutral-500">준비 중</span>
              </div>
              <div className="mt-0.5 text-sm text-neutral-600">{s.desc}</div>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
