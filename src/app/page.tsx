/**
 * 홈 — 입력부터 추천까지 한 페이지에서 끝난다.
 *
 *   ?q 없음   히어로: 도트맵 + 입력창
 *   ?q 있음   히어로: 도트맵 + 채널 분석 결과 (같은 자리)
 *             아래:   그 분석을 바탕으로 한 추천 플로우
 *   ?tag      소재를 바꿔 다시 계산 (페이지 이동 없이)
 *
 * ⚠️ 도트맵은 이 히어로 배경에만 쓴다. 다른 화면에 넣지 말 것.
 * ⚠️ 빈 자리를 설명 문장으로 채우지 말 것.
 */

import Link from "next/link";
import { ChannelStats } from "@/components/ChannelStats";
import { EvidenceVideoCard } from "@/components/EvidenceVideoCard";
import { MapHero } from "@/components/MapHero";
import { PlaceRecommendCard } from "@/components/PlaceRecommendCard";
import { realCards, subjectForTagName } from "@/lib/realcards";
import { Reveal } from "@/components/Reveal";
import { ShareButton } from "@/components/ShareButton";
import { TagChip } from "@/components/TagChip";
import { reachText } from "@/lib/display";
import { getStrings } from "@/lib/i18n";
import { reachRange } from "@/lib/score";
import {
  GUEST_CHANNEL,
  getChannelProfile,
  getDemoChannels,
  getExpansionTags,
  getTagEvidence,
  getTags,
  occupiedPlaces,
  recommendPlaces,
  resolveChannel,
} from "@/lib/repo";
import type { Tag, TagAxis } from "@/lib/types";

const S = getStrings("ko");

const VEIL =
  "linear-gradient(90deg, #000 0%, rgba(0,0,0,.94) 30%, rgba(0,0,0,.55) 46%, rgba(0,0,0,.12) 60%, transparent 72%)";
const VEIL_BOTTOM = "linear-gradient(to bottom, transparent 62%, #000 100%)";

const AXES: Array<{ key: Exclude<TagAxis, "time">; label: string }> = [
  { key: "subject", label: "소재" },
  { key: "mood", label: "무드" },
  { key: "format", label: "형식" },
  { key: "persona", label: "화법" },
  { key: "audience", label: "시청자" },
];

/** 채널을 아직 안 넣었을 때 지도에 뿌릴 좌표 */
const IDLE_OPEN = [
  { name: "곡성", lat: 35.282, lng: 127.292 },
  { name: "청송", lat: 36.432, lng: 129.057 },
  { name: "무주", lat: 36.007, lng: 127.661 },
  { name: "봉화", lat: 36.893, lng: 128.732 },
  { name: "순창", lat: 35.3744, lng: 127.1376 },
];
const IDLE_HELD = [
  { name: "정선", lat: 37.3805, lng: 128.6606 },
  { name: "화개", lat: 35.1707, lng: 127.647 },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; guest?: string }>;
}) {
  const { q = "", tag: tagParam, guest } = await searchParams;

  // 채널 주소를 넣은 사람과, 소재만 고른 사람(게스트) 두 갈래가 같은 흐름을 탄다.
  const isGuest = guest === "1";
  const channel = isGuest ? GUEST_CHANNEL : q ? await resolveChannel(q) : null;
  const view = channel && !isGuest ? await getChannelProfile(channel.id) : null;
  const notFound = Boolean(q) && !view;

  const tagId = tagParam ?? view?.profile.tag_ids[0];
  const evidence = channel && tagId ? await getTagEvidence(channel.id, tagId) : null;
  const occupied = evidence?.occupied ?? [];
  /**
   * 추천 카드 — **실데이터가 있으면 그걸 먼저 쓴다.**
   *
   * 12개 주력 소재는 실장소·실영상·실장날로 카드를 만든다 (`realcards.ts`).
   * 나머지 소재는 아직 시연 데이터다. 한 화면에 둘이 섞이지 않게
   * **소재 단위로 통째로** 갈린다 — 카드마다 진짜/가짜가 섞이면 구분이 불가능해진다.
   */
  const realSubject = evidence ? subjectForTagName(evidence.tag.name_ko) : null;
  const cardsAreReal = Boolean(realSubject);
  const cards = !channel
    ? []
    : realSubject
      ? realCards(realSubject, channel.language, channel.sub_band, 5)
      : tagId
        ? await recommendPlaces(
            channel.id,
            tagId,
            5,
            occupied.map((o) => o.place.id),
          )
        : [];
  const expansion = tagId ? await getExpansionTags(tagId) : { siblings: [], explore: [] };

  /** 소재를 바꿀 때 유지해야 하는 주소 앞부분 */
  const base = isGuest ? "/?guest=1" : `/?q=${encodeURIComponent(q)}`;

  // 예상 도달은 소재 단위로 한 번만 계산한다 (카드마다 넣으면 전부 같은 값이 된다)
  const reachRangeValue =
    channel && evidence?.score.score
      ? reachRange(channel.subscriber_count, evidence.score.score)
      : null;
  const reach = reachRangeValue
    ? reachText(reachRangeValue.low, reachRangeValue.high)
    : null;

  const allTags = await getTags();
  const byId = (id: string): Tag | undefined => allTags.find((t) => t.id === id);

  const fallbackHeld = view ? [] : await occupiedPlaces("t_oil_market", "en", 3);
  const mapOpen = cards.length
    ? cards.map((c) => ({ name: c.place.name_ko, lat: c.place.lat, lng: c.place.lng }))
    : IDLE_OPEN;
  const mapHeld = occupied.length
    ? occupied.map((o) => ({ name: o.place.name_ko, lat: o.place.lat, lng: o.place.lng }))
    : fallbackHeld.length
      ? fallbackHeld.map((o) => ({ name: o.place.name_ko, lat: o.place.lat, lng: o.place.lng }))
      : IDLE_HELD;

  const demoChannels = await getDemoChannels();
  const shareTitle = view
    ? `${view.channel.title} 채널 분석`
    : evidence
      ? `${evidence.tag.name_ko} 촬영지`
      : "";
  const shareDesc = view
    ? `${view.tags.map((t) => t.name_ko).join(" · ")} — 경쟁이 적은 촬영지 ${cards.length}곳`
    : evidence
      ? `경쟁이 적은 촬영지 ${cards.length}곳`
      : "";

  return (
    <main>
      {/* ══ 히어로 — 도트맵은 여기 배경으로만 ══ */}
      <section
        id="top"
        className="relative flex min-h-[34rem] items-center overflow-hidden lg:min-h-[40rem]"
      >
        <div className="absolute inset-0">
          <MapHero
            open={mapOpen}
            held={mapHeld}
          />
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: VEIL }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: VEIL_BOTTOM }} />

        <div className="relative w-full px-6 py-16 sm:px-10">
          {view ? (
            /* ── 분석 결과가 히어로 자리에 뜬다 ── */
            <div className="max-w-2xl">
              <div className="font-mono text-xs text-ink3">
                {view.channel.title} · {S.subscribers(view.channel.subscriber_count)} ·{" "}
                {view.channel.language === "en" ? "English" : "한국어"}
              </div>
              <h1 className="mt-3 font-serif text-4xl leading-tight font-normal tracking-tight text-balance sm:text-5xl">
                {S.s2Title}
              </h1>
              <p className="mt-2 font-mono text-xs text-ink3">
                최근 {view.profile.analyzed_count}편 중 상위 성과{" "}
                {view.profile.top_performer_count}편에서 추출
              </p>

              {/*
                채널 지표 — 전부 YouTube 실측이다.

                ⚠️ 평균이 아니라 **중앙값**을 쓴다. 대박 영상 한 편이 채널 전체를
                   실제보다 좋아 보이게 만들면, 그걸 기준으로 잡은 예상 도달이 전부 부풀려진다.
                ⚠️ 구독자 대비 배수가 이 화면에서 제일 중요한 값이다. 조회수만 보면
                   큰 채널이 항상 이기지만, 채널 규모를 지우면 순서가 뒤집힌다
                   (실측: 구독자 2천 채널 1.539× vs 620만 채널 0.016×).
              */}
              {view.channel.is_real && view.channel.recent && (
                <ChannelStats
                  recent={view.channel.recent}
                  subscriberCount={view.channel.subscriber_count}
                  totalVideoCount={view.channel.total_video_count}
                />
              )}

              {/*
                실채널은 위 지표가 실측이지만 소재 태그는 아직 시연 데이터다
                (영상→장소→태그 연결이 5단계). 한 화면에 둘이 섞이므로 어느 쪽이
                어느 쪽인지 밝힌다. 밝히지 않으면 화면 전체가 거짓말이 된다.
              */}
              {view.channel.is_real && (
                <p className="mt-2 font-mono text-[11px] text-open">
                  위 수치는 YouTube 실측 (조회수는 중앙값)
                  {view.tagsAreDemo && <> · 아래 소재는 시연 데이터</>}
                </p>
              )}

              <div className="mt-7 space-y-3">
                {AXES.map((axis) => {
                  const ids = view.profile.axes[axis.key] ?? [];
                  if (ids.length === 0) return null;
                  return (
                    <div key={axis.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                      <span className="w-10 shrink-0 font-mono text-[11px] text-ink3">
                        {axis.label}
                      </span>
                      {ids.map((id) => {
                        const t = byId(id);
                        if (!t) return null;
                        return (
                          <span
                            key={id}
                            className={`border px-2.5 py-1 text-sm backdrop-blur ${
                              axis.key === "subject"
                                ? "border-open/50 bg-open/10 text-open"
                                : "border-hair2 bg-ground/50 text-ink2"
                            }`}
                          >
                            {t.name_ko}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-2">
                <a
                  href="#result"
                  className="bg-open px-5 py-2.5 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
                >
                  촬영지 보기
                </a>
                <ShareButton title={shareTitle} description={shareDesc} />
                <Link
                  href="/"
                  className="px-3 py-2.5 font-mono text-xs text-ink3 transition-colors hover:text-ink2"
                >
                  다른 채널
                </Link>
              </div>
            </div>
          ) : (
            /* ── 입력 전 ── */
            <div className="max-w-2xl">
              <h1 className="font-serif text-[2.5rem] leading-[1.15] font-normal tracking-tight text-balance sm:text-[3.5rem]">
                {S.s1Title}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-ink3">
                <span className="text-ink2">채널</span>
                <span>→</span>
                <span className="text-ink2">상위 성과 영상</span>
                <span>→</span>
                <span className="text-signal">소재</span>
                <span>→</span>
                <span className="text-open">경쟁 최소 좌표</span>
              </div>

              <form action="/" method="get" className="mt-8 max-w-lg">
                <div className="flex gap-2">
                  <input
                    name="q"
                    type="text"
                    placeholder={S.s1UrlPlaceholder}
                    aria-label={S.s1UrlLabel}
                    className="min-w-0 flex-1 border border-hair2 bg-panel/80 px-4 py-3.5 text-sm outline-none backdrop-blur placeholder:text-ink3 focus:border-open"
                  />
                  <button
                    type="submit"
                    className="shrink-0 bg-open px-6 py-3.5 text-sm font-semibold text-ground transition-opacity hover:opacity-90"
                  >
                    분석
                  </button>
                </div>
                {notFound && (
                  <p className="mt-2 font-mono text-xs text-open-d">
                    채널을 찾지 못했습니다. 아래 예시로 확인해보세요.
                  </p>
                )}
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-mono text-[11px] text-ink3">예시</span>
                {demoChannels.map((c) => (
                  <Link
                    key={c.id}
                    href={`/?q=${encodeURIComponent(c.title)}`}
                    className="border border-hair2 bg-ground/40 px-3 py-1.5 text-xs text-ink2 backdrop-blur transition-colors hover:border-open hover:text-open"
                  >
                    {c.title}
                  </Link>
                ))}
                <Link href="/start" className="font-mono text-[11px] text-signal hover:underline">
                  소재만 골라서 찾기
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══ 분석 기반 플로우 ══ */}
      {channel && evidence && (
        <>
          {/* 소재 전환 바. 주 조작이라 결과 바로 위에 붙이고 스크롤해도 따라온다 */}
          <div className="sticky top-0 z-40 border-y border-hair bg-ground/92 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3 overflow-x-auto px-6 py-2.5 sm:px-10">
              <span className="shrink-0 font-mono text-[11px] text-ink3">소재</span>
              <div className="flex gap-1.5">
                <span className="shrink-0 border border-open/60 bg-open/10 px-2.5 py-1 text-xs whitespace-nowrap text-open">
                  {evidence.tag.name_ko}
                </span>
                {expansion.siblings.map((t) => (
                  <Link
                    key={t.id}
                    href={`${base}&tag=${t.id}#result`}
                    className="shrink-0 border border-hair2 px-2.5 py-1 text-xs whitespace-nowrap text-ink3 transition-colors hover:border-open hover:text-open"
                  >
                    {t.name_ko}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div id="result" className="mx-auto max-w-3xl px-6 py-14 sm:px-10">
          {/* ── 소재 현황 — 성과·예상 도달·성공 사례·촬영 완료를 한 블록으로 ── */}
          <Reveal>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-3xl font-normal tracking-tight">
                {evidence.tag.name_ko}
              </h2>
              {evidence.score.score && (
                <span className="font-mono text-xs text-ink3 tnum">
                  {S.s3ProvenBasis(
                    evidence.score.score.video_count,
                    evidence.score.score.median_vsr,
                  )}
                </span>
              )}
            </div>

            {/*
              예상 도달은 여기 한 번만 둔다.
              소재 점수 × 구독자라서 카드마다 넣으면 5장이 전부 같은 숫자가 된다.
              SPEC 11장: 단일 숫자 금지 — 반드시 범위 + 추정 고지.
            */}
            {reach && (
              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-hair py-3">
                <span className="font-mono text-[11px] text-ink3">
                  {S.s4ReachLabel(channel.subscriber_count)} 예상 도달
                </span>
                <span className="font-mono text-xl font-bold text-ink tnum">{reach.range}</span>
                <span className="font-mono text-[11px] text-ink3">{reach.disclaimer}</span>
              </div>
            )}
          </Reveal>

          {evidence.provenVideos.length > 0 && (
            <Reveal delay={80}>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {evidence.provenVideos.map((v) => (
                  <EvidenceVideoCard key={v.video.id} item={v} />
                ))}
              </div>
            </Reveal>
          )}

          {occupied.length > 0 && (
            <Reveal delay={140}>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border border-hair bg-panel px-4 py-2.5">
                <span className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
                  {S.s3OccupiedTitle}
                </span>
                {occupied.map((o) => (
                  <span key={o.place.id} className="text-sm text-ink3">
                    {o.place.name_ko}
                    <span className="ml-1.5 font-mono tnum">{S.videoCount(o.count)}</span>
                  </span>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal delay={180}>
            <div className="mt-12 flex items-baseline justify-between">
              <h2 className="text-xl font-bold tracking-tight">{S.s3RecommendTitle}</h2>
              {/*
                ⚠️ 실데이터 카드와 시연 카드를 구분해서 말한다.
                   12개 주력 소재만 실데이터고 나머지는 아직 시연이다.
                   밝히지 않으면 크리에이터가 시연값을 근거로 움직인다.
              */}
              <span
                className={`font-mono text-[11px] ${cardsAreReal ? "text-open" : "text-ink3"}`}
              >
                {cardsAreReal
                  ? `공공데이터 ${realSubject!.total.toLocaleString()}곳에서 · 실데이터`
                  : `${S.s3RecommendHelp(cards.length)} · 시연 데이터`}
              </span>
            </div>
          </Reveal>

          <div className="mt-4">
            {cards.map((card, i) => (
              <PlaceRecommendCard
                key={card.place.id}
                card={card}
                tag={evidence.tag}
                channelId={channel.id}
                rank={i + 1}
              />
            ))}
          </div>

          {/* 형제 소재는 위 고정바에 있다. 여기는 탐색용 다른 분류만 */}
          {expansion.explore.length > 0 && (
            <Reveal>
              <div className="mt-12 border-t border-hair pt-8">
                <div className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
                  {S.s3ExploreLabel}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {expansion.explore.map((t) => (
                    <TagChip
                      key={t.id}
                      tag={t}
                      href={`${base}&tag=${t.id}#result`}
                      variant="explore"
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          <Reveal>
            <div className="mt-12 border-t border-hair pt-8">
              <ShareButton title={shareTitle} description={shareDesc} />
            </div>
          </Reveal>
          </div>
        </>
      )}

      <footer className="border-t border-hair px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-ink3">
          <span>{S.appName}</span>
          <span>2026 관광데이터 활용 공모전</span>
          <Link href="/admin" className="transition-colors hover:text-ink2">
            기관용 콘솔
          </Link>
          <Link href="/check" className="transition-colors hover:text-ink2">
            데이터 검증
          </Link>
          {/* 아래 셋은 YouTube API 심사가 요구한다. 지우지 말 것. */}
          <Link href="/data-sources" className="transition-colors hover:text-ink2">
            데이터 출처
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink2">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink2">
            이용약관
          </Link>
        </div>

        {/*
          YouTube 귀속 표시.
          ⚠️ 심사가 "홈페이지에 YouTube 브랜딩과 개인정보처리방침 링크가 함께 보이는 화면"
             스크린샷을 요구한다. 위 링크 줄과 같은 푸터 안에 있어야 한 장에 담긴다.
             영상 통계를 화면에 쓰는 이상 약관상으로도 필요하다.
        */}
        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink3">
          <svg viewBox="0 0 90 20" aria-label="YouTube" className="h-3.5 w-auto" role="img">
            <path
              fill="#FF0000"
              d="M27.97 3.12A3.57 3.57 0 0 0 25.45.6C23.23 0 14.32 0 14.32 0S5.41 0 3.19.6A3.57 3.57 0 0 0 .67 3.12C.07 5.35.07 10 .07 10s0 4.65.6 6.88a3.57 3.57 0 0 0 2.52 2.52c2.22.6 11.13.6 11.13.6s8.91 0 11.13-.6a3.57 3.57 0 0 0 2.52-2.52c.6-2.23.6-6.88.6-6.88s0-4.65-.6-6.88Z"
            />
            <path fill="#fff" d="m11.48 14.29 7.4-4.29-7.4-4.29v8.58Z" />
            <text x="34" y="14.5" fill="currentColor" fontSize="12" fontFamily="inherit">
              YouTube
            </text>
          </svg>
          <span>영상 통계는 YouTube API Services 로 조회합니다</span>
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 transition-colors hover:text-ink2"
          >
            YouTube 서비스 약관
          </a>
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 transition-colors hover:text-ink2"
          >
            Google 개인정보처리방침
          </a>
        </div>
      </footer>
    </main>
  );
}
