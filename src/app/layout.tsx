import type { Metadata } from "next";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { getStrings } from "@/lib/i18n";
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
          {/*
            서비스 내비게이션. 개발용 화면(/check)은 여기 넣지 않는다.

            ⚠️ **「소재로 찾기」를 뺐다** (2026-08-22). 현관이 소재 목록이 되면서
               로고를 눌러도 그 링크를 눌러도 같은 화면이 나왔다. 같은 곳으로 가는
               길이 둘이면 쓰는 사람은 둘이 어떻게 다른지부터 알아내야 한다.

            ⚠️ 「채널 분석」도 강조를 뺐다. 테두리 버튼이라 화면에서 가장 센 요소였는데,
               그건 근거가 제일 약한 경로다(채널이 성과의 74%). 현관이 목록인 이상
               내비가 그 반대를 가리키면 안 된다.
          */}
          <nav className="ml-auto flex items-center gap-5 text-xs text-ink3">
            <Link href="/admin" className="transition-colors hover:text-ink2">
              기관용
            </Link>
            <Link href="/#channel" className="transition-colors hover:text-ink2">
              채널 분석
            </Link>
          </nav>
        </header>

        <DemoBanner />

        {children}
      </body>
    </html>
  );
}
