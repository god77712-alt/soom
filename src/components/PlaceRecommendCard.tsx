import Link from "next/link";
import { TagScoreList } from "@/components/TagScoreList";
import { reliabilityNote, toneClass } from "@/lib/display";
import { getStrings } from "@/lib/i18n";
import type { PlaceCard } from "@/lib/repo";
import type { Tag } from "@/lib/types";

const S = getStrings("ko");

/**
 * S3 추천 카드.
 *
 * 줄 순서를 바꾸지 말 것 (SPEC S3).
 *   1. 소재 성과   — 갈 만한가?
 *   2. 경쟁 상황   — 근데 왜 하필 여기?
 *   3. 이동 시간   — 갈 수 있나?
 *
 * "미개척"이라고 쓰지 않는다. 같은 사실을 경쟁 영상 수로 말한다.
 */
export function PlaceRecommendCard({
  card,
  tag,
  channelId,
  rank,
}: {
  card: PlaceCard;
  tag: Tag;
  channelId: string;
  rank: number;
}) {
  const note = reliabilityNote(card.place);
  const score = card.score.score;

  return (
    <Link
      href={`/place/${card.place.id}?channel=${channelId}&tag=${tag.id}`}
      className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition hover:border-neutral-600"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="mr-2 text-xs text-neutral-600">{rank}</span>
          <span className="text-lg font-semibold text-neutral-100">{card.place.name_ko}</span>
          <span className="ml-2 text-sm text-neutral-500">
            {card.place.sido} {card.place.sigungu}
          </span>
        </div>
        {card.place.is_declining_area && (
          <span className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400">
            {S.decliningArea}
          </span>
        )}
      </div>

      {/* 1. 소재 성과 — 크리에이터가 제일 먼저 봐야 할 줄 */}
      <div className="mt-3">
        {score ? (
          <>
            <div className="text-neutral-200">
              {S.s3TagPerformance(tag.name_ko, score.median_vsr)}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">
              {S.s3TagBasis(score.video_count)}
              {card.score.status === "fallback" && card.score.fallback_from && (
                <span className="ml-1.5 text-orange-300/80">· {S.fallbackNote}</span>
              )}
            </div>
          </>
        ) : (
          <div className={toneClass("muted")}>
            {S.insufficientSample}
            <span className="ml-1.5 text-xs">{S.insufficientSampleHelp}</span>
          </div>
        )}
      </div>

      {/* 2. 이 장소에 있는 소재 전부. 한 번 가서 여러 개를 찍기 때문이다 */}
      {card.tagScores.length > 0 && (
        <div className="mt-3">
          <TagScoreList items={card.tagScores} compact limit={4} />
        </div>
      )}

      {/* 3. 뭘 찍을 수 있는지 — 카드 단계에서는 컷 이름만 */}
      {card.shots.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
          {card.shots.slice(0, 3).map((s, i) => (
            <span key={i}>· {s.caption}</span>
          ))}
          {card.shots.length > 3 && (
            <span className="text-neutral-600">외 {card.shots.length - 3}컷</span>
          )}
        </div>
      )}

      {/*
        4. 경쟁 상황 — 왜 유명한 곳이 아니라 여기인가

        비교군(정선 14편 …)은 여기 붙이지 않는다. 카드 바로 위 ②"이미 찍힌 곳"에
        이미 나와 있어서, 카드마다 반복하면 5줄이 똑같아지고 숫자가 안 읽힌다.
        비교군이 필요한 건 이 카드가 단독으로 쓰일 때뿐이다 (competition.peers 로 접근).
      */}
      <div className="mt-3 border-t border-neutral-800/70 pt-3">
        <span className={`font-semibold ${toneClass(card.competition.tone)}`}>
          {card.competition.text}
        </span>
      </div>

      {/* 5. 갈 수 있나 — 장날을 모르고 가면 헛걸음이라 카드에서부터 보여준다 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        {card.operation.open_cycle && (
          <span className="text-neutral-300">장날 {card.operation.open_cycle}</span>
        )}
        {card.travelFromSeoul && <span>{S.s3TravelTime("서울", card.travelFromSeoul)}</span>}
        {card.nearbyCount > 0 && (
          <span className="text-neutral-400">근처 소재 {card.nearbyCount}곳</span>
        )}
        {note && <span className="text-orange-300/70">⚠ {note}</span>}
      </div>
    </Link>
  );
}
