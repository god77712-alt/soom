"use client";

import { useEffect, useState } from "react";

/**
 * 분석 결과 공유.
 *
 * 크리에이터끼리 서로 돌려보고, 구독자가 자기 유튜버 채널을 넣어 공유할 수 있게 한다.
 * 공유되는 건 결과 이미지가 아니라 **주소**다. 받은 사람이 열면 같은 분석이 다시 계산된다.
 *
 * 카카오 JS 키가 없으면(0단계) 카카오 대신 링크 복사로 떨어진다.
 * 키가 채워지면 자동으로 카카오톡 공유가 켜진다 — 코드를 고칠 필요 없다.
 */

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: { sendDefault: (o: unknown) => void };
    };
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
const SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

export function ShareButton({
  title,
  description,
  className = "",
}: {
  title: string;
  description: string;
  className?: string;
}) {
  const [kakaoReady, setKakaoReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!KAKAO_KEY) return;
    if (window.Kakao?.isInitialized()) {
      setKakaoReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () => {
      try {
        window.Kakao?.init(KAKAO_KEY);
        setKakaoReady(Boolean(window.Kakao?.isInitialized()));
      } catch {
        setKakaoReady(false);
      }
    };
    document.head.appendChild(s);
  }, []);

  const share = async () => {
    const url = window.location.href;

    if (kakaoReady && window.Kakao) {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: { title, description, imageUrl: "", link: { mobileWebUrl: url, webUrl: url } },
        buttons: [{ title: "분석 결과 보기", link: { mobileWebUrl: url, webUrl: url } }],
      });
      return;
    }

    // 카카오 키가 없을 때 — 모바일이면 기본 공유, 아니면 링크 복사
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
        return;
      } catch {
        /* 사용자가 취소한 경우 — 복사로 떨어진다 */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 권한이 없으면 아무 일도 안 일어난다 */
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center gap-2 border border-hair2 px-4 py-2 text-xs text-ink2 transition-colors hover:border-open hover:text-open ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 fill-current">
        <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3 0 .2.1.4.3.3.3 0 3.3-2.2 4-2.7.6.1 1.2.1 1.8.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
      </svg>
      {copied ? "링크 복사됨" : kakaoReady ? "카카오톡 공유" : "공유하기"}
    </button>
  );
}
