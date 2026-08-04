/**
 * S1. 온보딩
 *
 * SPEC 5장
 *   · 유튜브 채널 URL 입력 (단일 입력창)
 *   · URL 없이 들어온 사용자를 위한 대체: 태그 3개 직접 선택
 *   · 국적을 묻지 않는다. 영상 언어로 자동 판별한다.
 */

import Link from "next/link";
import { getStrings } from "@/lib/i18n";
import { getDemoChannels, getTags } from "@/lib/repo";
import { GuestTagPicker } from "./GuestTagPicker";

const S = getStrings("ko");

export default async function StartPage() {
  const [demoChannels, tags] = await Promise.all([getDemoChannels(), getTags()]);
  const level1 = tags.filter((t) => t.level === 1);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link href="/" className="text-xs text-ink3 hover:text-ink2">
        ← 처음으로
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{S.s1Title}</h1>
      <p className="mt-2 text-sm text-ink3">
        채널 주소만 넣으면 어떤 소재가 잘 되는지부터 분석합니다.
      </p>

      {/* 채널 URL 입력. 서버로 GET 하므로 자바스크립트 없이도 동작한다. */}
      <form action="/profile" method="get" className="mt-8">
        <label htmlFor="q" className="text-sm text-ink2">
          {S.s1UrlLabel}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="q"
            name="q"
            type="text"
            placeholder={S.s1UrlPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-hair2 bg-panel px-4 py-3 text-sm outline-none placeholder:text-ink3 focus:border-ink3"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-panel transition hover:bg-white"
          >
            {S.s1Submit}
          </button>
        </div>
      </form>

      {/* 0단계에서는 실제 유튜브 조회를 하지 않는다. 데모 채널로만 확인 가능. */}
      <div className="mt-4 rounded-lg border border-hair bg-panel/30 p-4">
        <div className="text-xs text-ink3">데모용 채널 (0단계)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {demoChannels.map((c) => (
            <Link
              key={c.id}
              href={`/profile?q=${encodeURIComponent(c.title)}`}
              className="rounded-lg border border-hair2 px-3 py-2 text-sm transition hover:border-ink3"
            >
              {c.title}
              <span className="ml-2 text-xs text-ink3">
                {S.subscribers(c.subscriber_count)} · {c.language === "en" ? "English" : "한국어"}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 대체 경로 — 채널이 없거나 밝히기 싫은 사용자 */}
      <div className="mt-12 border-t border-hair pt-8">
        <h2 className="text-sm font-medium text-ink2">{S.s1NoUrl}</h2>
        <p className="mt-1 text-sm text-ink3">{S.s1PickTags}</p>
        <GuestTagPicker tags={level1} />
      </div>
    </main>
  );
}
