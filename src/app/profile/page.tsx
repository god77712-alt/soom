/**
 * S2. 채널 프로필 — "당신 채널의 색깔"
 *
 * SPEC 이유: 추천 5곳이 안 맞아도 분석이 맞으면 신뢰가 유지된다.
 * 바로 추천부터 던지면 안 맞을 때 그냥 이탈한다.
 */

import Link from "next/link";
import { TagChip } from "@/components/TagChip";
import { getStrings } from "@/lib/i18n";
import { getChannelProfile, getDemoChannels, resolveChannel } from "@/lib/repo";

const S = getStrings("ko");

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
      <main className="mx-auto max-w-xl px-6 py-16">
        <Link href="/start" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← 다시 입력
        </Link>
        <h1 className="mt-6 text-2xl font-bold">채널을 찾지 못했습니다</h1>
        <p className="mt-2 text-sm text-neutral-500">
          0단계에서는 실제 유튜브를 조회하지 않습니다. 아래 데모 채널로 확인해주세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {demo.map((c) => (
            <Link
              key={c.id}
              href={`/profile?q=${encodeURIComponent(c.title)}`}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm transition hover:border-neutral-500"
            >
              {c.title}
            </Link>
          ))}
        </div>
      </main>
    );
  }

  const { channel: ch, profile, tags } = view;
  const strongest = tags[0];

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link href="/start" className="text-xs text-neutral-500 hover:text-neutral-300">
        ← 다시 입력
      </Link>

      {/* 국적을 묻지 않는다. 영상 언어로 자동 판별한 결과만 보여준다. */}
      <div className="mt-6 text-sm text-neutral-500">
        {ch.title} · {S.subscribers(ch.subscriber_count)} · 주 언어{" "}
        {ch.language === "en" ? "English" : "한국어"}
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{S.s2Title}</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <TagChip key={t.id} tag={t} variant={i === 0 ? "active" : "default"} />
        ))}
      </div>

      {/* 근거를 반드시 함께 보여준다. 태그만 던지면 점집처럼 보인다. */}
      <p className="mt-4 text-sm text-neutral-500">
        근거: {S.s2Basis(profile.analyzed_count, profile.top_performer_count)}
      </p>

      {strongest && (
        <Link
          href={`/recommend?channel=${ch.id}&tag=${strongest.id}`}
          className="mt-10 block rounded-lg bg-neutral-100 px-5 py-3.5 text-center text-sm font-medium text-neutral-900 transition hover:bg-white"
        >
          {S.s2Next}
        </Link>
      )}
    </main>
  );
}
