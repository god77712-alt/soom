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
const AXES: Array<{
  key: Exclude<TagAxis, "time">;
  label: string;
  note: string;
  accent: boolean;
}> = [
  { key: "subject", label: "무엇을 찍는가", note: "상위 성과 영상에서 공통 추출", accent: true },
  { key: "mood", label: "어떤 공기를 담는가", note: "영상 내용과 댓글 반응에서", accent: false },
  { key: "format", label: "어떤 형식인가", note: "편집·구성 패턴", accent: false },
  { key: "persona", label: "어떻게 말하는가", note: "화자의 태도", accent: false },
  { key: "audience", label: "누가 보는가", note: "댓글 언어·내용으로 추정", accent: false },
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
      <p className="mt-4 max-w-[48ch] text-ink2">
        최근 {profile.analyzed_count}편 중{" "}
        <span className="text-ink">성과가 좋았던 {profile.top_performer_count}편</span>만 골라
        뽑았습니다. 평균이 아니라 <span className="text-open">잘 되는 것</span>을 봅니다.
      </p>

      {/* ── 축별 분석 ── */}
      <div className="mt-12 space-y-px bg-hair">
        {AXES.map((axis) => {
          const ids = profile.axes[axis.key] ?? [];
          if (ids.length === 0) return null;
          return (
            <div key={axis.key} className="grid gap-4 bg-ground py-5 sm:grid-cols-[11rem_1fr]">
              <div>
                <div className={`text-sm font-semibold ${axis.accent ? "text-open" : "text-ink"}`}>
                  {axis.label}
                </div>
                <div className="mt-0.5 font-mono text-[11px] leading-relaxed text-ink3">
                  {axis.note}
                </div>
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
                {axis.key === "audience" && (
                  <span className="self-center font-mono text-[11px] text-ink3">
                    ※ 시청자 통계는 채널 소유자만 볼 수 있어 댓글로 추정한 값입니다
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 이어서 ── */}
      {strongest && (
        <div className="mt-12 border border-hair2 bg-panel p-6">
          <p className="text-sm text-ink2">
            가장 강한 소재는 <span className="font-semibold text-open">{strongest.name_ko}</span>{" "}
            입니다. 이 소재로 아직 경쟁이 적은 곳을 찾아드릴까요?
          </p>
          <Link
            href={`/recommend?channel=${ch.id}&tag=${strongest.id}`}
            className="mt-4 inline-block bg-open px-6 py-3 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
          >
            촬영지 5곳 보기
          </Link>
        </div>
      )}
    </main>
  );
}
