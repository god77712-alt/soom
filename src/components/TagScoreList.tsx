import { toneClass } from "@/lib/display";
import type { PlaceTagScore } from "@/lib/repo";

/**
 * 이 장소에 붙은 태그 전부 + 각 태그의 성적.
 *
 * "여기 가면 이 소재들을 찍을 수 있고, 각각 이만큼 먹힌다."
 * 태그를 하나만 보여주면 크리에이터가 그 소재 하나로만 판단하는데,
 * 실제로는 한 번 가서 여러 소재를 찍는다.
 */
export function TagScoreList({
  items,
  compact = false,
  limit,
}: {
  items: PlaceTagScore[];
  compact?: boolean;
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  const rest = limit ? items.length - shown.length : 0;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map(({ tag, label, season }) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded border border-hair bg-panel/60 px-2 py-1 text-xs"
          >
            <span className="text-ink2">{tag.name_ko}</span>
            <span className={label.resolved.score ? "font-semibold text-open/90" : toneClass("muted")}>
              {label.text}
            </span>
            {season.label && (
              <span className={season.state === "now" ? "text-open" : "text-ink3"}>
                {season.label}
              </span>
            )}
          </span>
        ))}
        {rest > 0 && <span className="text-xs text-ink3">+{rest}</span>}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hair/70">
      {shown.map(({ tag, label, season, confidence }) => (
        <li key={tag.id} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <span className="text-sm text-ink">{tag.name_ko}</span>
            {season.label && (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                  season.state === "now" ? "bg-open/20 text-open" : "text-ink3"
                }`}
              >
                {season.label}
              </span>
            )}
            {/* 4단계 LLM 태깅 신뢰도. 낮은 태그를 같은 무게로 보여주면 안 된다 */}
            {confidence < 0.8 && (
              <span className="ml-2 text-[10px] text-ink3">추정 태그</span>
            )}
            {label.note && <div className="mt-0.5 text-xs text-ink3">{label.note}</div>}
          </div>
          <div className="shrink-0 text-right">
            <span
              className={`text-sm font-semibold ${
                label.resolved.score ? "text-open/90" : toneClass("muted")
              }`}
            >
              {label.text}
            </span>
            {label.resolved.score && (
              <div className="text-[10px] text-ink3">
                영상 {label.resolved.score.video_count}편
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
