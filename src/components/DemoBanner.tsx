"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStrings } from "@/lib/i18n";

const S = getStrings("ko");

/**
 * "수치는 시연용입니다" 배너.
 *
 * ── 왜 경로마다 다르게 뜨는가 ────────────────────────────
 * 0단계 동안 전역으로 띄워서 가짜 수치가 실제 값처럼 캡처되는 걸 막아 왔다.
 * 그런데 목록 화면(`/start`·`/subject/*`)은 **전부 실데이터다** —
 * TourAPI 장소, 표준데이터 장날, 천문연 일출. 지어낸 값이 한 줄도 없다.
 *
 * 거기까지 "시연용"이라고 붙이면 **반대 방향의 거짓말**이 된다.
 * 진짜 데이터를 가짜라고 말하면 심사에서도 크리에이터에게도 손해다.
 *
 * ⚠️ 새 화면을 만들 때 이 목록을 갱신할 것. 기본은 "뜨는 것"이다 —
 *    빠뜨렸을 때 가짜를 진짜로 보이게 하는 쪽이 아니라 그 반대가 되도록.
 *
 * ── /place/[id] 는 경로로 못 가른다 ─────────────────────
 * 같은 경로가 장소에 따라 실데이터(카탈로그에 있음)로도, 시연으로도 뜬다.
 * 그래서 실데이터 화면이 `#real-data-page` 표식을 심고, `globals.css` 의
 * `:has()` 규칙이 이 배너를 지운다. **CSS 라서 하이드레이션과 무관하다** —
 * 서버·브라우저가 다르게 판단할 여지가 없다.
 */
const REAL_DATA_ROUTES = ["/start", "/subject"];

export function DemoBanner() {
  const pathname = usePathname();
  if (REAL_DATA_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return null;
  }

  return (
    <div
      data-demo-banner
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-open-d/40 bg-open/10 px-4 py-1.5 text-center font-mono text-[11px] text-open"
    >
      <span>{S.demoBanner}</span>
      <Link href="/data-sources" className="underline underline-offset-2 hover:no-underline">
        {S.demoBannerLink}
      </Link>
    </div>
  );
}
