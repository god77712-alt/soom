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
/**
 * 롱폼에서 쇼츠로 떼어낼 구간.
 *
 * 한 번 가서 두 형식으로 쓰는 길이다. 쇼츠가 훨씬 잘 되는 채널이 실제로 있다
 * (실측: 은윤이행님 롱폼 0.05× / 쇼츠 2.168×).
 *
 * ⚠️ **근거가 무엇인지 반드시 밝힌다.** 둘의 격이 다르다:
 *    - `comment` 여러 명이 그 지점을 댓글로 짚었다 → 반응. 댓글 원문까지 보여준다
 *    - `length`  그냥 쇼츠 길이에 들어간다 → 그뿐. 단정하면 안 된다
 *    길이로 고른 것을 반응으로 고른 것처럼 보이게 하면, 크리에이터가 없는 근거를
 *    믿고 편집 순서를 바꾼다.
 */
function ShortsCutBlock({ cut }: { cut: NonNullable<VideoBreakdown["shorts_cut"]> }) {
  const byComment = cut.reason === "comment";

  return (
    <div className="mt-2.5 border-t border-hair/70 pt-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px]">
        <span className="text-signal">
          {S.timestamp(cut.at)}–{S.timestamp(cut.end)}
        </span>
        <span className="text-ink3">{cut.span}초</span>
        {cut.label && <span className="text-ink2">{cut.label}</span>}
        <span className="text-[10px] text-ink3">
          {byComment ? `댓글 ${cut.mentions}건이 짚은 지점` : "길이 기준"}
        </span>
      </div>

      {/* 댓글 원문. 우리가 판단한 게 아니라 시청자가 남긴 것이라는 유일한 증거다 */}
      {byComment && cut.top_comment && (
        <div className="mt-1.5 border-l border-hair2 pl-2.5 text-[12px] text-ink2">
          {cut.top_comment}
        </div>
      )}

      <div className="mt-1.5 font-mono text-[10px] text-ink3">
        {byComment
          ? "댓글 타임스탬프가 몰린 구간 · 앞뒤를 붙여 쇼츠 길이로 맞췄다"
          : "쇼츠 길이(180초) 안에 들어가는 구간 · 반응 데이터는 아직 없다"}
      </div>
    </div>
  );
}

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

        </>
      )}

      {/*
        쇼츠 후보 구간. 챕터 목록 **바깥에** 둔다 — 화제 구간은 챕터가 없는
        영상에서도 나온다. 챕터를 적는 여행 브이로그는 실측 12% 뿐이라,
        챕터 블록 안에 넣으면 대부분의 영상에서 이 블록이 통째로 사라진다.
      */}
      {item.shorts_cut && <ShortsCutBlock cut={item.shorts_cut} />}

      {isDemo && (
        <div className="mt-2 font-mono text-[10px] text-ink3">데모 — 실제 영상 아님</div>
      )}
    </div>
  );
}
