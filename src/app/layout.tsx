import type { Metadata } from "next";
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
      <body className="min-h-screen bg-neutral-950 text-neutral-200 antialiased">
        {/*
          0단계 동안 항상 떠 있는 배너.
          가짜 수치가 실제 값처럼 캡처되는 걸 막는다. 7단계에서 IS_DEMO_DATA 를 끄면 사라진다.
        */}
        {IS_DEMO_DATA && (
          <div className="sticky top-0 z-50 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-200">
            {S.demoBanner}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
