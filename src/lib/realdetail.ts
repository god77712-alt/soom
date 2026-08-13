/**
 * S4 6단 근거를 **실데이터로** 만든다.
 *
 * ── 왜 repo.ts 를 고치지 않고 파일을 따로 뒀나 ───────────
 * `realcards.ts` 와 같은 이유다. `repo.ts` 의 상세 경로는 시연 데이터(FAKE_*)와
 * 촘촘히 엮여 있어서 거기를 뜯으면 `/check` 까지 흔들린다.
 * 실데이터 경로를 옆에 새로 놓고, 화면이 그쪽을 먼저 보게 한다.
 *
 * ── 6단 구조는 그대로 지킨다 (CLAUDE.md 4항) ─────────────
 * 단계를 빼거나 요약하지 않는다. 특히 ③ "별로라서가 아니다" 는 반드시 남는다.
 * 다만 **각 단계를 실데이터로 채울 수 있는 만큼만 채우고, 못 채우면 그린다는
 * 사실 자체를 화면에 넘긴다** — 빈 자리를 문장으로 메우지 않는다 (문구 원칙).
 *
 * 실데이터로 채워지는 것:
 *
 *   ① 소재 성적       tagscores.json (기하평균 + 95% 신뢰구간)
 *      다른 곳 영상    places.json — 같은 소재 · **다른 장소**의 실제 영상
 *   ② 여기 영상       places.json — 이 장소를 실제로 언급한 영상
 *   ③ 등록·사진·비교  catalog + 같은 소재 평균 영상 수
 *   ④ 예상 도달       구독자 × p25~p75 (범위. 단일 숫자 금지)
 *   ⑤ 장날·해 시각    전통시장 표준데이터 + 천문연
 *   ⑥ 근처 소재       좌표 계산
 *
 * 지어내지 않는 것: 컷 순서 · 제목 예시 · 숙소 · 축제 · 접근성 문장.
 * 재료가 없다. 없는 것을 붙이면 크리에이터가 그걸 믿고 4시간을 운전한다.
 */
import { distanceKm, estimateDriveMinutes } from "./geo";
import { findTagScore, type RealTagScore } from "./realcards";
import { shootPlanFor, type ShootPlan } from "./shootday";
import { SUBJECTS, type CatalogPlace, type CatalogVideo, type Subject } from "./catalog";
import type { Channel, Language, Place, SubBand } from "./types";
import type { NearbySpot } from "./viewmodels";

/**
 * 근거로 쓰는 영상 한 편.
 *
 * ⚠️ 전부 실제 YouTube 영상이다. `video_id` 는 watch 페이지로 그대로 열린다.
 *    시연 카드(`DEMO_`)와 달리 임베드가 실제로 붙는다.
 */
export interface RealEvidenceVideo {
  video_id: string;
  title: string;
  channel_title: string;
  view_count: number;
  subscriber_count: number;
  vsr: number;
  duration_sec: number;
  place_name: string;
  /** 구독자 1,000 미만은 배수가 폭발한다. 보여주되 점수에서는 뺀 것으로 표시 */
  excluded_from_score: boolean;
}

export interface RealPlaceDetail {
  place: Place;
  subject: Subject;
  channel: Channel;
  language: Language;

  /** ① 소재 성적 */
  score: RealTagScore | null;
  /** 밴드별 칸을 썼는가. 아니면 구독자 구간 합산이다 */
  usedBand: boolean;
  /** ① 같은 소재 · 다른 장소의 실제 영상 */
  step1Videos: RealEvidenceVideo[];

  /** ② 이 장소를 실제로 언급한 영상 */
  step2Videos: RealEvidenceVideo[];
  /** 우리 코퍼스에서 이 장소가 잡힌 횟수. 0 은 "세상에 없다"가 아니다 */
  ownVideoCount: number;

  /** ③ 별로라서가 아니다 */
  evidence: {
    hasTourapiRecord: boolean;
    hasPhoto: boolean;
    /** 같은 소재에서 영상이 잡힌 장소들의 평균 편수 */
    peerAvgVideoCount: number;
    /** 그 평균을 낸 모수 */
    peerPlaceCount: number;
    lowReliability: boolean;
    coordEstimated: boolean;
  };

  /** ④ 예상 도달. 범위가 없으면 null → 화면이 안 그린다 */
  reach: { low: number; high: number } | null;

  /** ⑤ 다음 장날 + 그날의 해 시각. 정기장이 아니면 null */
  shootPlan: ShootPlan | null;

  /** ⑥ 근처에 묶어 찍을 소재 */
  nearby: NearbySpot[];
}

const MIN_SUBSCRIBER_COUNT = 1000;

function toPlace(p: CatalogPlace): Place {
  return {
    id: p.id,
    source: "tourapi",
    source_id: p.id,
    name_ko: p.name,
    name_en: p.name,
    description_ko: "",
    description_en: "",
    sido: p.sido,
    sigungu: p.sigungu,
    sigungu_code: "",
    lat: p.lat,
    lng: p.lng,
    is_declining_area: p.declining,
    image_url: p.image,
    content_type_id: null,
    data_reliability: p.low_reliability ? "low" : "high",
    created_at: "",
  };
}

function toEvidence(v: CatalogVideo, placeName: string): RealEvidenceVideo {
  return {
    video_id: v.video_id,
    title: v.title,
    channel_title: v.channel_title,
    view_count: v.view_count,
    subscriber_count: v.subscriber_count,
    vsr: Number((v.view_count / Math.max(v.subscriber_count, 1)).toFixed(2)),
    duration_sec: v.duration_sec,
    place_name: placeName,
    excluded_from_score: v.subscriber_count < MIN_SUBSCRIBER_COUNT,
  };
}

/** 카탈로그에서 장소를 찾는다. 소재를 모를 때 전 소재를 훑는다 */
export function findCatalogPlace(
  placeId: string,
  preferred?: Subject | null,
): { subject: Subject; place: CatalogPlace } | null {
  const search = preferred ? [preferred, ...SUBJECTS.filter((s) => s !== preferred)] : SUBJECTS;
  for (const s of search) {
    const p = s.places.find((q) => q.id === placeId);
    if (p) return { subject: s, place: p };
  }
  return null;
}

/**
 * ① 같은 소재가 **다른 장소**에서 낸 실제 영상.
 *
 * 현재 장소는 뺀다 — 그건 ②의 몫이다. 두 단계가 같은 영상을 보여주면
 * "여긴 비어 있다"는 ②의 주장이 무너진다.
 */
function step1Of(subject: Subject, placeId: string, lang: Language): RealEvidenceVideo[] {
  const out: RealEvidenceVideo[] = [];
  for (const p of subject.places) {
    if (p.id === placeId) continue;
    for (const v of p.videos) {
      if (v.language !== lang) continue;
      if (v.subscriber_count < MIN_SUBSCRIBER_COUNT) continue;
      out.push(toEvidence(v, p.name));
    }
  }
  return out.sort((a, b) => b.vsr - a.vsr).slice(0, 3);
}

function step2Of(place: CatalogPlace, lang: Language): RealEvidenceVideo[] {
  return place.videos
    .filter((v) => v.language === lang)
    .map((v) => toEvidence(v, place.name))
    .sort((a, b) => b.vsr - a.vsr);
}

/** 같은 소재에서 **영상이 잡힌 장소들만**의 평균. 0편인 곳까지 넣으면 평균이 0에 눌린다 */
function peerAverage(subject: Subject, placeId: string, lang: Language) {
  const counts = subject.places
    .filter((p) => p.id !== placeId)
    .map((p) => (lang === "en" ? p.videos_en : p.videos_ko))
    .filter((n) => n > 0);
  if (counts.length === 0) return { avg: 0, n: 0 };
  return {
    avg: Number((counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)),
    n: counts.length,
  };
}

/** 근처에 묶어 찍을 소재. 좌표로 실제 계산한다 */
function nearbyOf(p: CatalogPlace, lang: Language): NearbySpot[] {
  const out: NearbySpot[] = [];
  for (const s of SUBJECTS) {
    for (const q of s.places) {
      if (q.id === p.id) continue;
      const km = distanceKm({ lat: p.lat, lng: p.lng }, { lat: q.lat, lng: q.lng });
      if (km > 40) continue;
      out.push({
        place_id: q.id,
        name_ko: q.name,
        sigungu: q.sigungu,
        distance_km: Number(km.toFixed(1)),
        drive_minutes: estimateDriveMinutes(km),
        tag_names: [s.label],
        video_count: lang === "en" ? q.videos_en : q.videos_ko,
        is_declining_area: q.declining,
      });
    }
  }
  return out.sort((a, b) => a.distance_km - b.distance_km).slice(0, 6);
}

/**
 * 실데이터 상세를 만든다. 카탈로그에 없는 장소면 null —
 * 호출부가 시연 경로로 떨어진다.
 */
export function realPlaceDetail(
  placeId: string,
  channel: Channel,
  subjectHint: Subject | null,
  today: Date = new Date(),
): RealPlaceDetail | null {
  const found = findCatalogPlace(placeId, subjectHint);
  if (!found) return null;
  const { subject, place } = found;

  const lang = channel.language;
  const band: SubBand = channel.sub_band;
  const scoreFound = findTagScore(subject.tag, lang, band);
  const score = scoreFound?.score ?? null;

  /**
   * ④ 예상 도달. p25~p75 가 없으면 **그리지 않는다.**
   * 단일 숫자 금지(CLAUDE.md 6항) — 범위를 못 내면 아예 안 낸다.
   */
  const reach =
    score && score.p25_vsr !== null && score.p75_vsr !== null
      ? {
          low: Math.round(channel.subscriber_count * score.p25_vsr),
          high: Math.round(channel.subscriber_count * score.p75_vsr),
        }
      : null;

  const peer = peerAverage(subject, placeId, lang);

  return {
    place: toPlace(place),
    subject,
    channel,
    language: lang,
    score,
    usedBand: scoreFound?.usedBand ?? false,
    step1Videos: step1Of(subject, placeId, lang),
    step2Videos: step2Of(place, lang),
    ownVideoCount: lang === "en" ? place.videos_en : place.videos_ko,
    evidence: {
      // 승격 데이터(폐교·간이역)는 TourAPI 에 없다. 있는 척하지 않는다
      hasTourapiRecord: !place.low_reliability,
      hasPhoto: Boolean(place.image),
      peerAvgVideoCount: peer.avg,
      peerPlaceCount: peer.n,
      lowReliability: place.low_reliability,
      coordEstimated: place.coord_estimated,
    },
    reach,
    shootPlan: shootPlanFor(place.name, place.sigungu, today),
    nearby: nearbyOf(place, lang),
  };
}
