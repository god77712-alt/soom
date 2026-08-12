"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * 진짜 뒤로가기.
 *
 * ── 왜 그냥 Link 로는 안 되는가 ───────────────────────────
 * 상세에서 목록으로 돌아갈 때 `/?q=...&tag=...#result` 같은 URL 로 이동시키면,
 * 브라우저는 **새 방문**으로 취급해서 목록 맨 위로 올려버린다.
 * 5장을 비교하려고 3번째 카드를 열어본 사람이 돌아올 때마다 처음부터 스크롤해야 한다.
 *
 * → 히스토리가 있으면 `router.back()` 을 쓴다. 그래야 보던 스크롤 위치와
 *   고른 소재가 그대로 남는다. 브라우저가 알아서 복원해 주는 것을 굳이 버릴 이유가 없다.
 *
 * 히스토리가 없을 때(링크를 직접 열었거나 새 탭)는 `href` 로 간다.
 */
export function BackLink({
  href,
  children,
  className = "",
}: {
  /** 히스토리가 없을 때 갈 곳 */
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        // 새 탭·새 창으로 여는 조작은 가로채지 않는다
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        // 이 사이트 안에서 넘어온 경우에만 뒤로가기를 쓴다
        const sameOrigin =
          typeof document !== "undefined" &&
          document.referrer.startsWith(window.location.origin);
        if (!sameOrigin || window.history.length <= 1) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
