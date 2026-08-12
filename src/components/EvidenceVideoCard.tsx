import { formatCount, getStrings } from "@/lib/i18n";
import type { EvidenceVideo } from "@/lib/repo";

const S = getStrings("ko");

/**
 * 성공 영상 한 편.
 *
 * youtube_id 가 "DEMO_" 로 시작하면 임베드 대신 자리표시 박스를 그린다.
 * 실존 크리에이터 영상에 가짜 조회수를 붙여 캡처하면 그대로 오해가 되기 때문이다.
 * 7단계에서 진짜 ID 가 들어오면 자동으로 임베드가 붙는다.
 *
 * SPEC 11장: 영상은 임베드로만 표시. 다운로드/재호스팅 금지.
 */
export function EvidenceVideoCard({ item }: { item: EvidenceVideo }) {
  const isDemo = item.video.youtube_id.startsWith("DEMO_");

  return (
    <div className="overflow-hidden rounded-lg border border-hair bg-panel/40">
      <div className="aspect-video bg-panel">
        {isDemo ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-ink3">
            <span className="text-2xl">▶</span>
            <span className="text-[10px]">데모 — 실제 영상 아님</span>
          </div>
        ) : (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${item.video.youtube_id}`}
            title={item.video.title}
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      <div className="p-3">
        <div className="line-clamp-2 text-sm font-medium text-ink">{item.video.title}</div>
        <div className="mt-1.5 text-xs text-ink3">
          {item.channel.title} · {item.place.name_ko}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-open tnum">{S.multiplier(item.vsr)}</span>
          <span className="text-xs text-ink3">
            구독자 {formatCount(item.channel.subscriber_count)} → 조회 {formatCount(item.video.view_count)}
          </span>
        </div>
        {item.excluded_from_score && (
          <div className="mt-1.5 text-[10px] text-ink3">
            구독자 1,000 미만 — 점수 계산에서는 제외된 영상입니다
          </div>
        )}
      </div>
    </div>
  );
}
