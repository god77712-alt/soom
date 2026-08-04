import Link from "next/link";
import { TagScoreList } from "@/components/TagScoreList";
import { reliabilityNote, toneClass } from "@/lib/display";
import { getStrings } from "@/lib/i18n";
import type { PlaceCard } from "@/lib/repo";
import type { Tag } from "@/lib/types";

const S = getStrings("ko");

/**
 * S3 추천 행.
 *
 * 줄 순서를 바꾸지 말 것 (SPEC S3).
 *   1. 소재 성과   — 갈 만한가?
 *   2. 경쟁 상황   — 근데 왜 하필 여기?
 *   3. 갈 수 있나  — 장날 · 이동시간
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
  const isOpen = card.competition.count === 0;
  const max = 5; // 막대 기준선 (숨 스코어 상한 근사)

  return (
    <Link
      href={`/place/${card.place.id}?channel=${channelId}&tag=${tag.id}`}
      className="group grid grid-cols-[2rem_1fr] gap-4 border-b border-hair py-4 transition-colors hover:bg-panel"
    >
      <div className={`pt-0.5 font-mono text-base font-bold ${isOpen ? "text-open" : "text-ink3"}`}>
        {String(rank).padStart(2, "0")}
      </div>

      <div className="min-w-0">
        {/* 이름 · 구역코드 · 상태 */}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[17px] font-semibold tracking-tight">{card.place.name_ko}</span>
          <span className="font-mono text-xs text-ink3">
            {card.place.sido} {card.place.sigungu} · {card.place.sigungu_code}
          </span>
          {card.place.is_declining_area && (
            <span className="border border-hair2 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-ink3">
              {S.decliningArea}
            </span>
          )}
        </div>

        {/* 1. 소재 성과 */}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-ink3">
          {score ? (
            <>
              <span>
                {tag.name_ko} <b className="font-medium text-ink2">{score.median_vsr.toFixed(1)}배</b>
              </span>
              <span>표본 {score.video_count}편</span>
              {card.score.status === "fallback" && (
                <span className="text-open-d">{S.fallbackNote}</span>
              )}
            </>
          ) : (
            <span className={toneClass("muted")}>{S.insufficientSample}</span>
          )}

          {/* 2. 경쟁 상황 — 이 줄이 가장 눈에 띄어야 한다 */}
          <span className={isOpen ? "font-semibold text-open" : "text-ink2"}>
            {card.competition.text}
          </span>

          {/* 3. 갈 수 있나 */}
          {card.operation.open_cycle && <span>장날 {card.operation.open_cycle}</span>}
          {card.travelFromSeoul && <span>서울 {card.travelFromSeoul}</span>}
          {card.nearbyCount > 0 && <span>근처 소재 {card.nearbyCount}곳</span>}
          {note && <span className="text-open-d">⚠ {note}</span>}
        </div>

        {/* 이 장소에서 찍을 수 있는 소재 전부 */}
        {card.tagScores.length > 0 && (
          <div className="mt-2">
            <TagScoreList items={card.tagScores} compact limit={4} />
          </div>
        )}

        {/* 찍을 수 있는 컷 */}
        {card.shots.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink3">
            {card.shots.slice(0, 3).map((s, i) => (
              <span key={i}>· {s.caption}</span>
            ))}
            {card.shots.length > 3 && <span>외 {card.shots.length - 3}컷</span>}
          </div>
        )}

        {/* 숨 스코어 */}
        <div className="mt-2.5 grid grid-cols-[1fr_auto] items-center gap-3.5">
          <span className="relative h-1 bg-panel2">
            <i
              className={`absolute inset-y-0 left-0 ${isOpen ? "bg-open" : "bg-signal"}`}
              style={{ width: `${Math.min(100, (card.soom_score / max) * 100)}%` }}
            />
          </span>
          <span className={`font-mono text-base font-bold tnum ${isOpen ? "text-open" : "text-ink"}`}>
            {card.soom_score.toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
}
