/**
 * S3. 추천 결과
 *
 * SPEC S3 구성 순서 — 바꾸지 말 것
 *   ① 이 소재가 먹힌다        성공 영상 3편
 *   ② 이미 찍힌 곳            회색, 작게. 비교 기준
 *   ③ 아직 안 찍힌 같은 조건 5곳
 *
 * ②를 빼면 안 된다. 크리에이터는 아는 곳으로 서비스를 테스트한다.
 * 오일장을 추천했는데 정선이 없으면 데이터를 의심하고 나간다.
 * 그리고 정선이 있어야 곡성이 좋아 보인다.
 *
 * ②와 ③을 같은 목록에 섞지 말 것. 나란히 놓으면 100% 정선을 고른다.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceVideoCard } from "@/components/EvidenceVideoCard";
import { PlaceRecommendCard } from "@/components/PlaceRecommendCard";
import { TagChip } from "@/components/TagChip";
import { toneClass } from "@/lib/display";
import { getStrings } from "@/lib/i18n";
import { getChannel, getChannelProfile, getExpansionTags, getTagEvidence, recommendPlaces } from "@/lib/repo";

const S = getStrings("ko");

export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; tag?: string }>;
}) {
  const { channel: channelId = "", tag: tagParam } = await searchParams;
  const channel = await getChannel(channelId);
  if (!channel) notFound();

  // 태그가 안 넘어오면 채널 프로필의 가장 강한 태그를 쓴다.
  const profile = await getChannelProfile(channel.id);
  const tagId = tagParam ?? profile?.profile.tag_ids[0];
  if (!tagId) notFound();

  const evidence = await getTagEvidence(channel.id, tagId);
  if (!evidence) notFound();

  const { tag, score, provenVideos, occupied } = evidence;
  // ②에 이미 나온 곳은 ③에서 뺀다. 같은 화면에 두 번 나오면 안 된다.
  const cards = await recommendPlaces(channel.id, tagId, 5, occupied.map((o) => o.place.id));
  const { siblings, explore } = await getExpansionTags(tagId);

  const langLabel = channel.language === "en" ? "해외 채널" : "국내 채널";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={channel.id === "guest" ? "/start" : `/profile?q=${encodeURIComponent(channel.title)}`}
        className="text-xs text-neutral-500 hover:text-neutral-300"
      >
        ← {channel.id === "guest" ? "소재 다시 고르기" : "채널 프로필"}
      </Link>

      {/* ── ① 이 소재가 먹힌다 ── */}
      <section className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">{S.s3ProvenTitle(tag.name_ko)}</h1>
        {score.score ? (
          <p className="mt-2 text-sm text-neutral-400">
            {langLabel} 기준 · {S.s3ProvenBasis(score.score.video_count, score.score.median_vsr)}
            {score.status === "fallback" && score.fallback_from && (
              <span className="ml-2 text-orange-300/80">
                ({S.fallbackHelp(score.fallback_from.name_ko)})
              </span>
            )}
          </p>
        ) : (
          <p className={`mt-2 text-sm ${toneClass("muted")}`}>
            {S.insufficientSample} — {S.insufficientSampleHelp}
          </p>
        )}

        {provenVideos.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {provenVideos.map((v) => (
              <EvidenceVideoCard key={v.video.id} item={v} />
            ))}
          </div>
        )}
      </section>

      {/* ── ② 이미 찍힌 곳 (회색, 작게) ── */}
      {occupied.length > 0 && (
        <section className="mt-10 rounded-lg border border-neutral-800/70 bg-neutral-900/20 p-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium text-neutral-400">{S.s3OccupiedTitle}</h2>
            <span className="text-xs text-neutral-600">{S.s3OccupiedHelp}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-neutral-500">
            {occupied.map((o) => (
              <span key={o.place.id}>
                {o.place.name_ko}
                <span className="ml-1.5 text-neutral-600">{S.videoCount(o.count)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── ③ 아직 안 찍힌 같은 조건 (본론) ── */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">{S.s3RecommendTitle}</h2>
          <span className="text-xs text-neutral-600">{S.s3RecommendHelp(cards.length)}</span>
        </div>

        {cards.length > 0 ? (
          <div className="mt-4 space-y-3">
            {cards.map((card, i) => (
              <PlaceRecommendCard
                key={card.place.id}
                card={card}
                tag={tag}
                channelId={channel.id}
                rank={i + 1}
              />
            ))}
          </div>
        ) : (
          // 이 소재는 이미 다 찍혔다는 뜻이다. 억지로 채우지 않고 그대로 말한다.
          <p className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/30 p-5 text-sm text-neutral-500">
            이 소재는 남은 자리가 없습니다. 등록된 장소가 모두 촬영된 상태입니다. 아래에서 다른
            소재를 골라보세요.
          </p>
        )}
      </section>

      {/* ── 태그 확장: 형제 8개 + 다른 대분류 2개 ── */}
      <section className="mt-12 border-t border-neutral-800 pt-8">
        <h2 className="text-sm font-medium text-neutral-300">{S.s3ExpandTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {siblings.map((t) => (
            <TagChip key={t.id} tag={t} href={`/recommend?channel=${channel.id}&tag=${t.id}`} />
          ))}
        </div>
        {explore.length > 0 && (
          <>
            <div className="mt-5 text-xs text-neutral-600">{S.s3ExploreLabel}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {explore.map((t) => (
                <TagChip
                  key={t.id}
                  tag={t}
                  href={`/recommend?channel=${channel.id}&tag=${t.id}`}
                  variant="explore"
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
