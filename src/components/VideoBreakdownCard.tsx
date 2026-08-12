import { formatCount, getStrings } from "@/lib/i18n";
import type { VideoBreakdown } from "@/lib/viewmodels";

const S = getStrings("ko");

/**
 * 잘 된 영상 한 편을 뜯어 놓은 것.
 *
 * 점수는 "갈지 말지"를 정하고, 이건 "가서 뭘 찍을지"를 정한다.
 * 크리에이터는 잘 된 영상을 보고 따라 만든다 — 그러니 성적이 아니라 **구성**을 보여준다.
 *
 * 챕터 출처를 반드시 함께 적는다. 우리가 지어낸 구성이 아니라 그 사람이 설명란에
 * 직접 적어 둔 목차라는 사실이 이 블록을 믿게 만드는 유일한 근거다.
 */
export function VideoBreakdownCard({ item }: { item: VideoBreakdown }) {
  const isDemo = item.youtube_id.startsWith("DEMO_");

  return (
    <div className="border border-hair bg-panel/40 p-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-mono text-lg font-bold text-open tnum">
          {S.multiplier(item.vsr)}
        </span>
        <span className="font-mono text-[11px] text-ink3">
          구독 {formatCount(item.subscriber_count)} → 조회 {formatCount(item.view_count)}
        </span>
        <span className="font-mono text-[11px] text-ink3">{S.duration(item.duration)}</span>
      </div>

      <div className="mt-1.5 text-sm text-ink">{item.title}</div>
      <div className="mt-1 font-mono text-[11px] text-ink3">
        {item.channel_title} · {S.cardBreakdownAt(item.place_name)}
      </div>

      {item.hook && (
        <div className="mt-3 flex gap-2.5 border-l border-open-d pl-2.5">
          <span className="shrink-0 font-mono text-[11px] text-open-d">{S.cardHookLabel}</span>
          <span className="text-[13px] text-ink2">{item.hook}</span>
        </div>
      )}

      {item.chapters.length > 0 && (
        <>
          <ol className="mt-3 space-y-1">
            {item.chapters.map((c, i) => {
              const isCut = item.shorts_cut?.index === i;
              return (
                <li
                  key={i}
                  className={`flex gap-2.5 text-[13px] ${
                    isCut ? "-ml-2 border-l-2 border-signal/70 pl-2" : ""
                  }`}
                >
                  <span className="w-10 shrink-0 font-mono text-[11px] text-ink3 tnum">
                    {S.timestamp(c.at)}
                  </span>
                  <span className={isCut ? "text-ink" : "text-ink2"}>{c.label}</span>
                  {isCut && (
                    <span className="shrink-0 font-mono text-[10px] text-signal">
                      쇼츠 후보
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-2 font-mono text-[10px] text-ink3">
            {S.cardChapterSource[item.chapter_source]}
          </div>

          {/*
            한 번 가서 두 형식으로 쓰는 길. 쇼츠가 훨씬 잘 되는 채널이 실제로 있다
            (실측: 은윤이행님 롱폼 0.05× / 쇼츠 2.168×).

            ⚠️ **길이만 보고 고른 것이라고 반드시 밝힌다.** 구간별 시청 유지율은
               영상 주인만 볼 수 있어서 "여기가 제일 재미있다"고는 말할 수 없다.
               근거 없이 단정하면 이 블록 하나 때문에 화면 전체를 의심받는다.
          */}
          {item.shorts_cut && (
            <div className="mt-2.5 border-t border-hair/70 pt-2.5">
              <div className="font-mono text-[11px] text-signal">
                {S.timestamp(item.shorts_cut.at)}–{S.timestamp(item.shorts_cut.end)}{" "}
                <span className="text-ink2">{item.shorts_cut.label}</span>
                <span className="text-ink3"> · {item.shorts_cut.span}초</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink3">
                쇼츠 길이(180초) 안에 그대로 들어가는 구간 · 길이 기준 제안
              </div>
            </div>
          )}
        </>
      )}

      {isDemo && (
        <div className="mt-2 font-mono text-[10px] text-ink3">데모 — 실제 영상 아님</div>
      )}
    </div>
  );
}
