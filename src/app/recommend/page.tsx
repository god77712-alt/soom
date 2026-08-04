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
import { MapHero } from "@/components/MapHero";
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

  // 지도에 찍을 좌표. 추천된 곳은 금색으로 맥동하고, 이미 찍힌 곳은 가라앉는다.
  const mapOpen = cards.map((c) => ({
    name: c.place.name_ko,
    lat: c.place.lat,
    lng: c.place.lng,
  }));
  const mapHeld = occupied.map((o) => ({
    name: o.place.name_ko,
    lat: o.place.lat,
    lng: o.place.lng,
  }));

  return (
    <main>
      {/* ── 지도 히어로: 공식이 지도 위에 뜬다 ── */}
      <section className="relative min-h-[26rem] overflow-hidden border-b border-hair">
        <div className="absolute inset-0">
          <MapHero origin={{ name: "서울", lat: 37.5665, lng: 126.978 }} open={mapOpen} held={mapHeld} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,#000_0%,rgba(0,0,0,.88)_34%,rgba(0,0,0,.35)_56%,transparent_74%)] max-md:bg-[linear-gradient(180deg,rgba(0,0,0,.92)_32%,rgba(0,0,0,.5)_72%,transparent)]" />

        <div className="relative max-w-xl px-6 py-12">
          <Link
            href={channel.id === "guest" ? "/start" : `/profile?q=${encodeURIComponent(channel.title)}`}
            className="font-mono text-xs text-ink3 hover:text-ink2"
          >
            ← {channel.id === "guest" ? "소재 다시 고르기" : "채널 프로필"}
          </Link>

          <div className="mt-6 font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
            신호 · {tag.name_ko}
            {score.score && ` · 표본 ${score.score.video_count}편`}
          </div>

          <h1 className="mt-3 font-serif text-3xl leading-tight font-normal tracking-tight text-balance sm:text-4xl">
            {S.s3ProvenTitle(tag.name_ko)}
          </h1>

          {/* 공식을 숨기지 않는다. 이게 보이면 아래 순위에 설명이 필요 없다 */}
          {score.score ? (
            <>
              <div className="mt-6 flex flex-wrap items-baseline gap-1.5 font-mono text-base tnum">
                <span className="font-serif italic text-ink2">추천 점수</span>
                <span className="text-ink3">=</span>
                <span className="text-signal">{score.score.median_vsr.toFixed(2)}</span>
                <span className="text-ink3">×</span>
                <span className="text-open">1 / log(경쟁 영상 수 + 2)</span>
              </div>
              <p className="mt-2 max-w-[38ch] font-mono text-xs leading-relaxed text-ink3">
                {langLabel} 기준 · 소재 성과는 후보 전체가 같다. 순위를 가르는 건 오른쪽 항 하나뿐이다.
                {score.status === "fallback" && score.fallback_from && (
                  <span className="ml-1 text-open-d">({S.fallbackHelp(score.fallback_from.name_ko)})</span>
                )}
              </p>
            </>
          ) : (
            <p className={`mt-4 text-sm ${toneClass("muted")}`}>
              {S.insufficientSample} — {S.insufficientSampleHelp}
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-4 left-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink3">
          <span>
            <i className="mr-1.5 inline-block size-1.5 rounded-full bg-signal-d align-[0.1em]" />
            등록 관광지
          </span>
          <span>
            <i className="mr-1.5 inline-block size-1.5 rounded-full bg-open align-[0.1em]" />
            추천 구역
          </span>
          <span>
            <i className="mr-1.5 inline-block size-1.5 rounded-full bg-held align-[0.1em]" />
            이미 관광지
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 py-10">

      {/* ── ① 이 소재가 먹힌다 ── */}
      <section>
        <h2 className="text-sm font-bold tracking-tight">이 소재로 잘 된 영상</h2>
        {provenVideos.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {provenVideos.map((v) => (
              <EvidenceVideoCard key={v.video.id} item={v} />
            ))}
          </div>
        )}
      </section>

      {/* ── ② 이미 찍힌 곳 (가라앉게) ── */}
      {occupied.length > 0 && (
        <section className="mt-10 border border-hair bg-panel p-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium text-ink2">{S.s3OccupiedTitle}</h2>
            <span className="text-xs text-ink3">{S.s3OccupiedHelp}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink3">
            {occupied.map((o) => (
              <span key={o.place.id}>
                {o.place.name_ko}
                <span className="ml-1.5 font-mono tnum text-ink3/70">{S.videoCount(o.count)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── ③ 경쟁이 가장 적은 곳 (본론) ── */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold tracking-tight">{S.s3RecommendTitle}</h2>
          <span className="font-mono text-[11px] text-ink3">{S.s3RecommendHelp(cards.length)}</span>
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
          <p className="mt-4 border border-hair bg-panel p-5 text-sm text-ink3">
            이 소재는 남은 자리가 없습니다. 등록된 장소가 모두 촬영된 상태입니다. 아래에서 다른
            소재를 골라보세요.
          </p>
        )}
      </section>

      {/* ── 태그 확장: 형제 8개 + 다른 대분류 2개 ── */}
      <section className="mt-12 border-t border-hair pt-8">
        <h2 className="text-sm font-medium text-ink2">{S.s3ExpandTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {siblings.map((t) => (
            <TagChip key={t.id} tag={t} href={`/recommend?channel=${channel.id}&tag=${t.id}`} />
          ))}
        </div>
        {explore.length > 0 && (
          <>
            <div className="mt-5 font-mono text-[11px] text-ink3">{S.s3ExploreLabel}</div>
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
      </div>
    </main>
  );
}
