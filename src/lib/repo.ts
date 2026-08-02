/**
 * 데이터 접근층.
 *
 * ★ 7단계에서 바꾸는 파일은 여기 하나다. ★
 * 화면 컴포넌트는 가짜 데이터 파일을 직접 import 하지 않는다. 전부 이 함수들을 통해서만
 * 데이터를 얻는다. 그래서 7단계에서 아래 import 를 SQLite 쿼리로 바꾸면 화면은 그대로 돈다.
 *
 * 지금 당장은 전부 동기 배열 조회지만 함수는 모두 async 로 선언한다.
 * 나중에 DB 로 바뀔 때 호출부를 하나도 안 고치기 위해서다.
 */

import { FAKE_PLACES, FAKE_PLACE_TAGS, FAKE_TRAVEL_FROM_SEOUL } from "@/data/fake/places";
import { FAKE_TAGS } from "@/data/fake/tags";
import { FAKE_PLACE_STATS, FAKE_TAG_SCORES } from "@/data/fake/stats";
import { FAKE_CHANNELS, FAKE_CHANNEL_PROFILES, FAKE_VIDEOS, FAKE_VIDEO_PLACES } from "@/data/fake/videos";
import {
  FAKE_ADMIN_GAPS,
  FAKE_ADMIN_IMPACT,
  FAKE_ADMIN_MATCHES,
  fakePlaceEvidence,
  fakeShootingPlan,
  fakeStayPlan,
} from "@/data/fake/details";
import { placeLanguageLine, type PlaceLanguageLine } from "./display";
import { MIN_SUBSCRIBER_COUNT, reachRange, resolveTagScore, soomScore, vsr, type ResolvedTagScore } from "./score";
import type { Channel, Language, Place, PlaceLanguageStat, Tag, TagScore, Video } from "./types";
import type { AdminGapRow, AdminImpact, AdminMatchRow, ChannelProfile, PlaceEvidence, ShootingPlan, StayPlan } from "./viewmodels";

/** 0단계는 가짜 데이터로 돈다는 사실을 화면이 알아야 배너를 띄울 수 있다. */
export const IS_DEMO_DATA = true;

// ─── 태그 ────────────────────────────────────────────────

export async function getTags(): Promise<Tag[]> {
  return FAKE_TAGS;
}

export async function getTag(tagId: string): Promise<Tag | null> {
  return FAKE_TAGS.find((t) => t.id === tagId) ?? null;
}

/** 폴백·표본부족 판정은 화면이 아니라 score.ts 가 한다. 화면엔 원본 점수판을 넘겨준다. */
export async function getTagScores(): Promise<TagScore[]> {
  return FAKE_TAG_SCORES;
}

/**
 * S3 하단 확장 영역: 형제 태그 8개 + 전혀 다른 대분류 2개.
 * 다른 대분류를 섞는 건 탐색용이다. 형제만 보여주면 사용자가 같은 소재에 갇힌다.
 */
export async function getExpansionTags(tagId: string): Promise<{ siblings: Tag[]; explore: Tag[] }> {
  const tag = FAKE_TAGS.find((t) => t.id === tagId);
  if (!tag) return { siblings: [], explore: [] };

  const siblings = FAKE_TAGS.filter(
    (t) => t.level === 2 && t.parent_id === tag.parent_id && t.id !== tag.id,
  ).slice(0, 8);

  const explore = FAKE_TAGS.filter(
    (t) => t.level === 2 && t.parent_id !== tag.parent_id,
  )
    // 대분류가 서로 겹치지 않게 2개만 고른다
    .filter((t, i, arr) => arr.findIndex((x) => x.parent_id === t.parent_id) === i)
    .slice(0, 2);

  return { siblings, explore };
}

// ─── 채널 (S1 · S2) ──────────────────────────────────────

/**
 * S1: 유튜브 채널 URL 입력.
 * 실제로는 URL → 채널 ID 변환에 YouTube API 가 필요하지만, SPEC 6장 절대원칙 1에 따라
 * 화면에서 유튜브를 직접 부르지 않는다. 7단계에서는 서버측 1회 조회 + 캐시로 처리한다.
 */
export async function resolveChannel(input: string): Promise<Channel | null> {
  const q = input.trim().toLowerCase().replace(/^@/, "");
  if (!q) return null;
  return (
    FAKE_CHANNELS.find(
      (c) =>
        c.id === q ||
        c.youtube_channel_id.toLowerCase() === q ||
        c.title.toLowerCase().replace(/\s+/g, "") === q.replace(/\s+/g, "") ||
        q.includes(c.title.toLowerCase().replace(/\s+/g, "")),
    ) ?? null
  );
}

export async function getChannel(channelId: string): Promise<Channel | null> {
  return FAKE_CHANNELS.find((c) => c.id === channelId) ?? null;
}

export async function getDemoChannels(): Promise<Channel[]> {
  return FAKE_CHANNELS.filter((c) => c.id === "ch_wander" || c.id === "ch_ddeona");
}

export interface ChannelProfileView {
  channel: Channel;
  profile: ChannelProfile;
  tags: Tag[];
}

export async function getChannelProfile(channelId: string): Promise<ChannelProfileView | null> {
  const channel = await getChannel(channelId);
  const profile = FAKE_CHANNEL_PROFILES.find((p) => p.channel_id === channelId);
  if (!channel || !profile) return null;
  const tags = profile.tag_ids
    .map((id) => FAKE_TAGS.find((t) => t.id === id))
    .filter((t): t is Tag => Boolean(t));
  return { channel, profile, tags };
}

// ─── 장소 · 추천 (S3) ────────────────────────────────────

export interface PlaceCard {
  place: Place;
  /** 국내 채널 줄. video_count 0 이면 "미개척"으로 나온다 */
  koLine: PlaceLanguageLine;
  /** 해외 채널 줄 */
  enLine: PlaceLanguageLine;
  travelFromSeoul: string | null;
  soom_score: number;
  score: ResolvedTagScore;
}

async function statOf(placeId: string, language: Language): Promise<PlaceLanguageStat | undefined> {
  return FAKE_PLACE_STATS.find((s) => s.place_id === placeId && s.language === language);
}

/**
 * SPEC 4-3 숨 스코어로 5곳을 뽑는다.
 *
 *   soom_score = tag_score[tag, lang, band] × (1 / log(place_video_count + 2))
 *
 * 인구감소지역 가산점은 없다. 희소성 가중치만으로 자연히 위로 올라와야
 * "우리가 편애한 게 아니라 데이터가 그렇게 말했다"는 논리가 선다.
 */
export async function recommendPlaces(channelId: string, tagId: string, limit = 5): Promise<PlaceCard[]> {
  const channel = await getChannel(channelId);
  const tag = await getTag(tagId);
  if (!channel || !tag) return [];

  const lang = channel.language;
  const other: Language = lang === "ko" ? "en" : "ko";
  const placeIds = FAKE_PLACE_TAGS.filter((pt) => pt.tag_id === tagId).map((pt) => pt.place_id);

  const cards = await Promise.all(
    placeIds.map(async (placeId) => {
      const place = FAKE_PLACES.find((p) => p.id === placeId)!;
      const stat = await statOf(placeId, lang);
      const score = resolveTagScore(tag, lang, channel.sub_band, FAKE_TAG_SCORES, FAKE_TAGS);
      const count = stat?.video_count ?? 0;
      return {
        place,
        koLine: placeLanguageLine(await statOf(placeId, "ko"), "ko"),
        enLine: placeLanguageLine(await statOf(placeId, "en"), "en"),
        travelFromSeoul: FAKE_TRAVEL_FROM_SEOUL[placeId] ?? null,
        soom_score: score.score ? soomScore(score.score.median_vsr, count) : 0,
        score,
        _tiebreak: (await statOf(placeId, other))?.median_vsr ?? 0,
      };
    }),
  );

  return cards
    .sort((a, b) => {
      if (b.soom_score !== a.soom_score) return b.soom_score - a.soom_score;
      // 희소성이 같으면(둘 다 0편) 반대 언어권에서 이미 먹힌 곳을 먼저 보여준다.
      // 인구감소지역 여부로 순서를 가르면 SPEC 11장의 "인위적 가산점 금지"를 어기게 된다.
      if (b._tiebreak !== a._tiebreak) return b._tiebreak - a._tiebreak;
      return a.place.id.localeCompare(b.place.id);
    })
    .slice(0, limit)
    .map(({ _tiebreak, ...card }) => card);
}

export async function getPlace(placeId: string): Promise<Place | null> {
  return FAKE_PLACES.find((p) => p.id === placeId) ?? null;
}

export interface PlaceLines {
  place: Place;
  koLine: PlaceLanguageLine;
  enLine: PlaceLanguageLine;
  tags: Tag[];
}

/** 검증표(/check)와 S5 어드민이 쓴다. 장소 전체를 언어 두 줄과 함께 돌려준다. */
export async function getAllPlaceLines(): Promise<PlaceLines[]> {
  return Promise.all(
    FAKE_PLACES.map(async (place) => ({
      place,
      koLine: placeLanguageLine(await statOf(place.id, "ko"), "ko"),
      enLine: placeLanguageLine(await statOf(place.id, "en"), "en"),
      tags: await getPlaceTags(place.id),
    })),
  );
}

export async function getPlaceTags(placeId: string): Promise<Tag[]> {
  return FAKE_PLACE_TAGS.filter((pt) => pt.place_id === placeId)
    .map((pt) => FAKE_TAGS.find((t) => t.id === pt.tag_id))
    .filter((t): t is Tag => Boolean(t));
}

// ─── 장소 상세 (S4) ──────────────────────────────────────

export interface EvidenceVideo {
  video: Video;
  channel: Channel;
  vsr: number;
  place: Place;
  /** 점수 계산에서 제외된 영상(구독자 1,000 미만). 화면에는 보여주되 표시를 다르게 한다 */
  excluded_from_score: boolean;
}

export interface PlaceDetail {
  place: Place;
  tags: Tag[];
  language: Language;
  channel: Channel;
  tag: Tag;
  /** ① 이 소재는 먹힌다 — 다른 곳의 성공 사례 3편 */
  step1Videos: EvidenceVideo[];
  step1Score: ResolvedTagScore;
  /** ② 그런데 여긴 비어 있다 — 여기서 찍힌 영상 전체 */
  step2Videos: EvidenceVideo[];
  /** ③ 별로라서가 아니다 */
  evidence: PlaceEvidence;
  /** ④ 당신이면 이 정도 */
  reach: { low: number; high: number } | null;
  /** ⑤ 이렇게 찍으면 된다 */
  plan: ShootingPlan;
  /** ⑥ 이렇게 머물면 된다 */
  stay: StayPlan;
}

function toEvidenceVideo(video: Video): EvidenceVideo | null {
  const channel = FAKE_CHANNELS.find((c) => c.id === video.channel_id);
  const vp = FAKE_VIDEO_PLACES.find((x) => x.video_id === video.id);
  const place = vp ? FAKE_PLACES.find((p) => p.id === vp.place_id) : undefined;
  if (!channel || !place) return null;
  return {
    video,
    channel,
    vsr: vsr(video.view_count, channel.subscriber_count),
    place,
    excluded_from_score: channel.subscriber_count < MIN_SUBSCRIBER_COUNT,
  };
}

export async function getPlaceDetail(
  placeId: string,
  channelId: string,
  tagId: string,
): Promise<PlaceDetail | null> {
  const place = await getPlace(placeId);
  const channel = await getChannel(channelId);
  const tag = await getTag(tagId);
  if (!place || !channel || !tag) return null;

  const lang = channel.language;

  // ① 같은 소재의 다른 장소에서 잘 된 영상. 현재 장소는 제외한다(그건 ②의 몫).
  const taggedPlaceIds = new Set(
    FAKE_PLACE_TAGS.filter((pt) => pt.tag_id === tagId && pt.place_id !== placeId).map((pt) => pt.place_id),
  );
  const step1Videos = FAKE_VIDEOS.filter((v) => v.language === lang)
    .filter((v) => FAKE_VIDEO_PLACES.some((vp) => vp.video_id === v.id && taggedPlaceIds.has(vp.place_id)))
    .map(toEvidenceVideo)
    .filter((x): x is EvidenceVideo => x !== null)
    // 구독자 1,000 미만은 배수가 폭발해 순위를 망친다. ①에서는 제외한다.
    .filter((x) => !x.excluded_from_score)
    .sort((a, b) => b.vsr - a.vsr)
    .slice(0, 3);

  // ② 여기서 찍힌 영상 전체. 위아래 대비를 눈으로 보여주는 게 목적이라 전부 보여준다.
  const step2Videos = FAKE_VIDEOS.filter((v) => v.language === lang)
    .filter((v) => FAKE_VIDEO_PLACES.some((vp) => vp.video_id === v.id && vp.place_id === placeId))
    .map(toEvidenceVideo)
    .filter((x): x is EvidenceVideo => x !== null)
    .sort((a, b) => (a.video.published_at < b.video.published_at ? 1 : -1));

  const step1Score = resolveTagScore(tag, lang, channel.sub_band, FAKE_TAG_SCORES, FAKE_TAGS);

  return {
    place,
    tags: await getPlaceTags(placeId),
    language: lang,
    channel,
    tag,
    step1Videos,
    step1Score,
    step2Videos,
    evidence: fakePlaceEvidence(placeId, lang),
    reach: step1Score.score ? reachRange(channel.subscriber_count, step1Score.score) : null,
    plan: fakeShootingPlan(placeId),
    stay: fakeStayPlan(placeId),
  };
}

// ─── 어드민 (S5) ─────────────────────────────────────────

export async function getAdminGaps(): Promise<AdminGapRow[]> {
  return FAKE_ADMIN_GAPS;
}

export async function getAdminMatches(): Promise<AdminMatchRow[]> {
  return FAKE_ADMIN_MATCHES;
}

export async function getAdminImpact(): Promise<AdminImpact> {
  return FAKE_ADMIN_IMPACT;
}

// ─── 로그 (발전성 근거) ──────────────────────────────────

/**
 * SPEC: 지금은 기록만 한다. 나중에 "비슷한 채널이 많이 고른 태그" 기능의 재료가 된다.
 * 0단계에서는 콘솔에만 남긴다.
 */
export async function logRecommendation(entry: {
  channel_id: string;
  place_id: string;
  tag_id: string;
  selected_tag_id?: string;
}): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log("[recommendation_log]", { ...entry, shown_at: new Date().toISOString() });
  }
}
