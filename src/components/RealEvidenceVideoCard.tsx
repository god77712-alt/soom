import { formatCount, getStrings } from "@/lib/i18n";
import type { RealEvidenceVideo } from "@/lib/realdetail";

const S = getStrings("ko");

/**
 * 근거 영상 한 편 — **실제 YouTube 영상.**
 *
 * SPEC 11장 / YouTube API 서비스 약관:
 *   - 영상은 공식 iframe 플레이어로만 재생한다. 내려받거나 다시 호스팅하지 않는다
 *   - 저장하는 것은 공개 메타데이터뿐이고, 원본 watch 페이지로 돌아가는 링크를
 *     **항상 함께 둔다.** 임베드만 두면 출처가 화면에서 사라진다
 *
 * `EvidenceVideoCard` 와 달리 여기는 시연 자리표시가 없다. 실데이터 경로 전용이다.
 */
export function RealEvidenceVideoCard({ item }: { item: RealEvidenceVideo }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hair bg-panel/40">
      <div className="aspect-video bg-panel">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${item.video_id}`}
          title={item.title}
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="p-3">
        <div className="line-clamp-2 text-sm font-medium text-ink">{item.title}</div>
        <div className="mt-1.5 text-xs text-ink3">
          {item.channel_title} · {item.place_name}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-open tnum">{S.multiplier(item.vsr)}</span>
          <span className="text-xs text-ink3">
            구독자 {formatCount(item.subscriber_count)} → 조회 {formatCount(item.view_count)}
          </span>
        </div>
        {item.excluded_from_score && (
          <div className="mt-1.5 text-[10px] text-ink3">
            구독자 1,000 미만 — 점수 계산에서는 제외된 영상입니다
          </div>
        )}
        {/* 출처. 임베드만 두면 어디서 온 값인지 화면에서 사라진다 */}
        <a
          className="mt-2 inline-block font-mono text-[11px] text-ink3 underline hover:text-ink2"
          href={`https://www.youtube.com/watch?v=${item.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          YouTube 에서 보기 ↗
        </a>
      </div>
    </div>
  );
}
