/**
 * S2. 채널 분석 — "당신 채널의 색깔"
 *
 * 소재만 뽑으면 "당신은 시장을 찍는군요"에서 끝난다. 크리에이터가 이미 아는 사실이다.
 * 형식·성향·무드·시청자까지 맞춰야 "내 채널을 봤구나" 소리가 나온다.
 *
 * SPEC 이유: 추천 5곳이 안 맞아도 분석이 맞으면 신뢰가 유지된다.
 * 바로 추천부터 던지면 안 맞을 때 그냥 이탈한다.
 */

import Link from "next/link";
import { getStrings } from "@/lib/i18n";
import { getChannelProfile, getDemoChannels, getTags, resolveChannel } from "@/lib/repo";
import type { Tag, TagAxis } from "@/lib/types";

const S = getStrings("ko");

/** 화면에 나가는 순서. 소재가 먼저고 시청자가 마지막이다 */
const AXES: Array<{ key: Exclude<TagAxis, "time">; label: string; accent: boolean }> = [
  { key: "subject", label: "소재", accent: true },
  { key: "mood", label: "무드", accent: false },
  { key: "format", label: "형식", accent: false },
  { key: "persona", label: "화법", accent: false },
  { key: "audience", label: "시청자", accent: false },
];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const channel = await resolveChannel(q);
  const view = channel ? await getChannelProfile(channel.id) : null;

  if (!view) {
    const demo = await getDemoChannels();
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="font-serif text-3xl font-normal">채널을 찾지 못했습니다</h1>
        <p className="mt-3 text-sm text-ink2">
          0단계에서는 실제 유튜브를 조회하지 않습니다. 아래 예시 채널로 확인해주세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {demo.map((c) => (
            <Link
              key={c.id}
              href={`/profile?q=${encodeURIComponent(c.title)}`}
              className="border border-hair2 px-3 py-2 text-sm transition-colors hover:border-open hover:text-open"
            >
              {c.title}
            </Link>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-block font-mono text-xs text-ink3 hover:text-ink2">
          ← 처음으로
        </Link>
      </main>
    );
  }

  const { channel: ch, profile, tags } = view;
  const strongest = tags[0];
  const allTags = await getTags();
  const byId = (id: string): Tag | undefined => allTags.find((t) => t.id === id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-mono text-xs text-ink3 hover:text-ink2">
        ← 다시 입력
      </Link>

      {/* 국적을 묻지 않는다. 영상 언어로 자동 판별한 결과만 보여준다. */}
      <div className="mt-8 font-mono text-xs text-ink3">
        {ch.title} · {S.subscribers(ch.subscriber_count)} · 주 언어{" "}
        {ch.language === "en" ? "English" : "한국어"}
      </div>

      <h1 className="mt-4 font-serif text-4xl leading-tight font-normal tracking-tight text-balance">
        {S.s2Title}
      </h1>
      <p className="mt-3 font-mono text-xs text-ink3">
        최근 {profile.analyzed_count}편 중 상위 성과 {profile.top_performer_count}편에서 추출
      </p>

      {/* ── 축별 키워드. 설명 문장을 붙이지 않는다 ── */}
      <div className="mt-10 space-y-px bg-hair">
        {AXES.map((axis) => {
          const ids = profile.axes[axis.key] ?? [];
          if (ids.length === 0) return null;
          return (
            <div key={axis.key} className="grid gap-3 bg-ground py-4 sm:grid-cols-[7rem_1fr]">
              <div className={`text-sm font-semibold ${axis.accent ? "text-open" : "text-ink2"}`}>
                {axis.label}
              </div>
              <div className="flex flex-wrap content-start gap-2">
                {ids.map((id) => {
                  const t = byId(id);
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      className={`border px-3 py-1.5 text-sm ${
                        axis.accent
                          ? "border-open/50 bg-open/10 text-open"
                          : "border-hair2 text-ink2"
                      }`}
                    >
                      {t.name_ko}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {strongest && (
        <Link
          href={`/recommend?channel=${ch.id}&tag=${strongest.id}`}
          className="mt-10 inline-block bg-open px-6 py-3 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
        >
          {strongest.name_ko} 촬영지 보기
        </Link>
      )}
    </main>
  );
}
