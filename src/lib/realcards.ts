/**
 * 홈 추천 카드를 **실데이터로** 만든다.
 *
 * ── 왜 repo.ts 를 고치지 않고 파일을 따로 뒀나 ───────────
 * `repo.ts` 의 추천 경로는 시연 데이터(FAKE_*)와 촘촘히 엮여 있다. 거기를 뜯으면
 * `/place/[id]`·`/check` 까지 같이 흔들린다. 실데이터 경로를 **옆에 새로 놓고**
 * 홈이 그쪽을 먼저 보게 하는 편이 되돌리기도 쉽다.
 *
 * ── 지어낸 것을 하나도 넣지 않는다 ───────────────────────
 * 시연 카드에는 `찍을 수 있는 컷`·`촬영 순서` 같은 문장이 있었다. 그건 우리가
 * 지어낸 것이다. **실재하는 장소에 없는 구체적 사실을 붙이는 건 가짜 장소에
 * 붙이는 것보다 나쁘다** — 크리에이터가 그걸 믿고 4시간을 운전한다.
 *
 * 그래서 실데이터로 채울 수 있는 것만 남긴다:
 *
 *   장날·일출     전통시장 표준데이터 + 천문연        `shootday.ts`
 *   소재 성적     수집 영상 기하평균 + 95% 신뢰구간    `tagscores.json`
 *   경쟁 영상 수  영상→장소 연결 실측                 `places.json`
 *   잘 된 영상    이 장소를 실제로 언급한 영상         `places.json`
 *   근처 소재     좌표로 계산                         `geo.ts`
 *
 * 빈 자리는 **그리지 않는다.** 문장으로 채우지 않는다 (문구 원칙).
 */
import { competitionLine, placeLanguageLine, type CompetitionLine, type PerformanceLine, type PlaceLanguageLine } from "./display";
import { distanceKm, estimateDriveMinutes } from "./geo";
import { getStrings } from "@/lib/i18n";
import { scarcity } from "./score";
import { shootPlanFor, type ShootPlan } from "./shootday";
import { pickShortsCut } from "./shorts";
import { SUBJECTS, type CatalogPlace, type Subject } from "./catalog";
import TAGSCORES_JSON from "@/data/real/tagscores.json";
import type { RealEvidenceVideo } from "./realdetail";
import type { Language, Place, PlaceLanguageStat, SubBand } from "./types";
import type { NearbySpot, VideoBreakdown } from "./viewmodels";

const S = getStrings("ko");

export interface RealTagScore {
  tag: string;
  language: string;
  sub_band: number | null;
  video_count: number;
  geo_vsr: number | null;
  p25_vsr: number | null;
  p75_vsr: number | null;
  ci_low: number | null;
  ci_high: number | null;
  can_show_multiplier: boolean;
}

const TAGSCORES = TAGSCORES_JSON as RealTagScore[];

/**
 * 소재 점수를 찾는다.
 *
 * 밴드 칸이 얇으면 **밴드를 푼 값**으로 떨어진다 (`sub_band: null`).
 * 언어는 절대 풀지 않는다 — 언어별 점수판을 합치지 말 것 (CLAUDE.md 1항).
 * 한국어와 영어는 먹히는 소재가 정반대라, 합치면 모든 소재가 평균으로 수렴한다.
 */
export function findTagScore(
  tag: string,
  language: Language,
  band: SubBand,
): { score: RealTagScore; usedBand: boolean } | null {
  const exact = TAGSCORES.find(
    (s) => s.tag === tag && s.language === language && s.sub_band === band,
  );
  if (exact?.can_show_multiplier) return { score: exact, usedBand: true };

  const anyBand = TAGSCORES.find(
    (s) => s.tag === tag && s.language === language && s.sub_band === null,
  );
  if (anyBand) return { score: anyBand, usedBand: false };
  return exact ? { score: exact, usedBand: true } : null;
}

/** 카탈로그 장소를 화면이 아는 모양으로 */
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

const statOf = (p: CatalogPlace, lang: Language): PlaceLanguageStat => ({
  place_id: p.id,
  language: lang,
  video_count: lang === "en" ? p.videos_en : p.videos_ko,
  // 장소 단위 배수는 내지 않는다. 몇 편으로 낸 배수는 장식이다
  median_vsr: null,
});

export interface RealCard {
  place: Place;
  koLine: PlaceLanguageLine;
  enLine: PlaceLanguageLine;
  competition: CompetitionLine;
  performance: PerformanceLine;
  travelFromSeoul: string | null;
  soom_score: number;
  shots: never[];
  tagScores: never[];
  operation: { open_cycle: string | null; open_hours: null; filming_note: string | null };
  nearby: NearbySpot[];
  breakdowns: VideoBreakdown[];
  shootPlan: ShootPlan | null;
  /** 추정 좌표는 지도·거리가 몇 km 어긋난다. 화면이 밝혀야 한다 */
  coordEstimated: boolean;
}

/** 서울 시청. 이동 시간의 기준점 */
const SEOUL = { lat: 37.5663, lng: 126.9779 };

/**
 * 화면의 태그 이름 → 실데이터 소재.
 *
 * 홈은 아직 시연 태그 체계(`t_oil_market` 등)로 돌아간다. 그걸 통째로 바꾸면
 * 채널 분석·소재 전환바까지 다 뜯어야 해서, **이름으로 다리를 놓는다.**
 * 짝이 있으면 실데이터 카드가 나가고, 없으면 시연 카드로 떨어진다.
 *
 * 12개 소재만 실데이터가 있으므로 나머지 소재를 고르면 여전히 시연이다 —
 * 화면이 그 사실을 밝혀야 한다 (`isReal` 로 구분).
 */
export function subjectForTagName(nameKo: string): Subject | null {
  return (
    SUBJECTS.find((s) => s.label === nameKo || s.tag === nameKo) ??
    // `오일장` ↔ `5일장` 처럼 부르는 이름이 다른 경우
    SUBJECTS.find((s) => s.label.replace(/[·,]/g, "") === nameKo.replace(/[·,]/g, "")) ??
    null
  );
}

/**
 * 소재 하나에 대해 추천 카드를 만든다.
 *
 * 정렬은 숨 스코어 (`소재 점수 × 희소성`). 희소성은 **정책이지 예측이 아니다** —
 * 비어 있는 곳이 더 잘 된다는 증거는 없다 (`score.ts` scarcity 주석).
 * 안 찍힌 곳을 위로 올리는 편집 방침일 뿐이고, 화면도 그렇게만 말한다.
 */
export function realCards(
  subject: Subject,
  language: Language,
  band: SubBand,
  limit = 5,
  today: Date = new Date(),
): RealCard[] {
  const found = findTagScore(subject.tag, language, band);
  const geo = found?.score.geo_vsr ?? null;

  /**
   * 비교군 — 이 소재에서 **실제로 영상이 가장 많이 잡힌** 장소들.
   * `경쟁 0편` 옆에 이걸 나란히 둬야 0 이 무슨 뜻인지 읽힌다 (CLAUDE.md 7항).
   */
  const peers = [...subject.places]
    .map((p) => ({ name: p.name, count: language === "en" ? p.videos_en : p.videos_ko }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);

  const scored = subject.places
    .map((p) => {
      const count = language === "en" ? p.videos_en : p.videos_ko;
      return { p, count, score: (geo ?? 0) * scarcity(count) };
    })
    .sort(
      (a, b) =>
        // 인구감소지역 먼저 — 편집 방침 (성과 예측 아님)
        Number(b.p.declining) - Number(a.p.declining) ||
        b.score - a.score ||
        // 같으면 사진 있는 쪽. 목록은 썸네일로 읽힌다
        Number(Boolean(b.p.image)) - Number(Boolean(a.p.image)),
    )
    .slice(0, limit);

  return scored.map(({ p, count }) => {
    const km = distanceKm(SEOUL, { lat: p.lat, lng: p.lng });
    return {
      place: toPlace(p),
      koLine: placeLanguageLine(statOf(p, "ko"), "ko"),
      enLine: placeLanguageLine(statOf(p, "en"), "en"),
      competition: competitionLine(statOf(p, language), peers),
      performance: buildPerformance(subject, found),
      travelFromSeoul: `${Math.round(estimateDriveMinutes(km) / 60)}시간`,
      soom_score: (geo ?? 0) * scarcity(count),
      shots: [],
      tagScores: [],
      operation: {
        // 장날은 표준데이터 실측. 없으면 안 그린다
        open_cycle: shootPlanFor(p.name, p.sigungu, today)?.calendar.cycle_label ?? null,
        open_hours: null,
        filming_note: p.low_reliability ? "공공데이터 기준 · 현장 확인" : null,
      },
      nearby: nearbyOf(p, language),
      breakdowns: breakdownsOf(p),
      shootPlan: shootPlanFor(p.name, p.sigungu, today),
      coordEstimated: p.coord_estimated,
    };
  });
}

/**
 * 성과 한 줄.
 *
 * ⚠️ **장소 성적이 아니라 소재 성적이다.** 이 장소에서 찍힌 영상은 대부분 0편이라
 *    장소 단위 배수를 낼 수 없다. 그래서 "같은 소재가 전국에서 낸 성적"을 쓰고,
 *    출처를 반드시 함께 적는다. 안 밝히면 "여기서 0.59배 나왔다"는 거짓말이 된다.
 *
 * 신뢰구간이 넓으면 숫자를 안 쓴다. 순위에만 반영하고 `순위만` 이라고 적는다.
 */
function buildPerformance(
  subject: Subject,
  found: { score: RealTagScore; usedBand: boolean } | null,
): PerformanceLine {
  const scope = S.perfTagScope(subject.label);
  if (!found) {
    return { scope, value: S.insufficientSample, basis: null, isOwn: false, tone: "muted" };
  }
  const s = found.score;
  if (!s.can_show_multiplier || s.geo_vsr === null) {
    return {
      scope,
      value: S.rankOnly,
      basis: `수집 ${s.video_count}편 · 편차가 커서 배수를 쓰지 않는다`,
      isOwn: false,
      tone: "muted",
    };
  }
  return {
    scope,
    value: `${s.geo_vsr}×`,
    // 범위를 반드시 함께. 점 추정만 두면 확정된 사실로 읽힌다
    basis:
      `전국 ${s.video_count}편 기준 · 95% ${s.ci_low}~${s.ci_high}` +
      (found.usedBand ? "" : " · 구독자 구간 합산"),
    isOwn: false,
    tone: "normal",
  };
}

/**
 * 홈 상단 "소재 현황" 블록의 재료 — **실데이터로.**
 *
 * 여기가 시연으로 남아 있으면 화면 맨 위, 추천 목록 바로 앞에 가짜 영상 카드가
 * 걸린다. 아래 카드들이 실데이터여도 그것부터 눈에 들어온다.
 */
export interface RealSubjectEvidence {
  score: RealTagScore | null;
  usedBand: boolean;
  /** 이 소재로 가장 잘 된 실제 영상 3편 */
  topVideos: RealEvidenceVideo[];
  /** 이미 찍힌 곳 — `경쟁 0편` 이 무슨 뜻인지 읽히게 하는 비교군 */
  occupied: Array<{ name: string; count: number }>;
  reach: { low: number; high: number } | null;
}

export function realSubjectEvidence(
  subject: Subject,
  language: Language,
  band: SubBand,
  subscriberCount: number,
): RealSubjectEvidence {
  const found = findTagScore(subject.tag, language, band);
  const s = found?.score ?? null;

  const videos: RealEvidenceVideo[] = [];
  for (const p of subject.places) {
    for (const v of p.videos) {
      if (v.language !== language) continue;
      // 구독자 1,000 미만은 배수가 폭발해 순위를 망친다
      if (v.subscriber_count < 1000) continue;
      videos.push({
        video_id: v.video_id,
        title: v.title,
        channel_title: v.channel_title,
        view_count: v.view_count,
        subscriber_count: v.subscriber_count,
        vsr: Number((v.view_count / v.subscriber_count).toFixed(2)),
        duration_sec: v.duration_sec,
        place_name: p.name,
        excluded_from_score: false,
      });
    }
  }

  return {
    score: s,
    usedBand: found?.usedBand ?? false,
    topVideos: videos.sort((a, b) => b.vsr - a.vsr).slice(0, 3),
    occupied: [...subject.places]
      .map((p) => ({ name: p.name, count: language === "en" ? p.videos_en : p.videos_ko }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    // 단일 숫자 금지 (CLAUDE.md 6항). 범위를 못 내면 아예 안 낸다
    reach:
      s && s.p25_vsr !== null && s.p75_vsr !== null
        ? {
            low: Math.round(subscriberCount * s.p25_vsr),
            high: Math.round(subscriberCount * s.p75_vsr),
          }
        : null,
  };
}

/** 근처에 묶어 찍을 소재. 좌표로 실제 계산한다 — 지어낸 값이 아니다 */
function nearbyOf(p: CatalogPlace, language: Language): NearbySpot[] {
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
        video_count: language === "en" ? q.videos_en : q.videos_ko,
        is_declining_area: q.declining,
      });
    }
  }
  return out.sort((a, b) => a.distance_km - b.distance_km).slice(0, 4);
}

/** 이 장소를 실제로 언급한 영상. 없으면 빈 배열 — 화면이 블록을 안 그린다 */
function breakdownsOf(p: CatalogPlace): VideoBreakdown[] {
  return p.videos
    .filter((v) => v.subscriber_count > 0)
    .map((v) => ({
      video_id: v.video_id,
      youtube_id: v.video_id,
      title: v.title,
      channel_title: v.channel_title,
      subscriber_count: v.subscriber_count,
      view_count: v.view_count,
      vsr: Number((v.view_count / v.subscriber_count).toFixed(2)),
      duration: v.duration_sec,
      place_id: p.id,
      place_name: p.name,
      // 훅은 자막에서 뽑는 값인데 자막을 못 받는다. 지어내지 않는다
      hook: null,
      chapters: v.chapters,
      chapter_source: "description" as const,
      shorts_cut: pickShortsCut(v.chapters, v.duration_sec, null),
    }));
}
