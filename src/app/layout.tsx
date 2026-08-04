import type { Metadata } from "next";
import Link from "next/link";
import { getStrings } from "@/lib/i18n";
import { IS_DEMO_DATA } from "@/lib/repo";
import "./globals.css";

const S = getStrings("ko");

export const metadata: Metadata = {
  title: `${S.appName} — ${S.appTagline}`,
  description: "촬영지 추천 서비스. 2026 관광데이터 활용 공모전 출품작.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-ground font-sans text-ink antialiased">
        {/* 상단 바. 서비스명은 i18n.ts 의 appName 한 곳에서 바뀐다 */}
        <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-hair px-6 py-3">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
            <span className="relative h-3.5 w-3.5 rounded-full border-[1.5px] border-signal">
              <span className="absolute inset-[3px] rounded-full bg-open" />
            </span>
            {S.appName}
          </Link>
          <nav className="ml-auto flex gap-5 font-mono text-xs text-ink3">
            <Link href="/start" className="hover:text-ink2">
              시작
            </Link>
            <Link href="/admin" className="hover:text-ink2">
              어드민
            </Link>
            <Link href="/check" className="hover:text-ink2">
              검증
            </Link>
          </nav>
        </header>

        {/*
          0단계 동안 항상 떠 있는 배너.
          가짜 수치가 실제 값처럼 캡처되는 걸 막는다. 7단계에서 IS_DEMO_DATA 를 끄면 사라진다.
        */}
        {IS_DEMO_DATA && (
          <div className="border-b border-open-d/40 bg-open/10 px-4 py-1.5 text-center font-mono text-[11px] text-open">
            {S.demoBanner}
          </div>
        )}

        {children}
      </body>
    </html>
  );
}
