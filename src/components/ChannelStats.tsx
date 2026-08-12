import type { ChannelFormatStats, FormatStats } from "@/lib/types";

/**
 * 채널 성적 — **롱폼과 쇼츠를 나란히, 절대 합치지 않고.**
 *
 * ── 왜 나눠야 하는가 (실측) ──────────────────────────────
 *   영국남자    합산 0.016×  →  롱폼 0.318× / 쇼츠 0.015×   롱폼이 21배
 *   은윤이행님  합산 1.539×  →  롱폼 0.05×  / 쇼츠 2.168×   쇼츠가 43배
 *
 * 방향이 채널마다 반대라 합산값은 보정으로도 못 고친다. 합쳐서 보여주면
 * 영국남자에게 "당신은 0.016× 채널"이라고 말하게 되는데, 이 사람의 롱폼은
 * 구독자의 3분의 1을 끌어온다. 정반대의 조언이 나간다.
 *
 * ⚠️ 표본 5편 미만이면 **숫자를 그리지 않는다.** 사유를 쓴다.
 *    0× 로 그리면 "표본이 없다"와 "성적이 나쁘다"를 구분할 수 없다.
 */

const fmtDuration = (sec: number) => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
};

function FormatRow({
  label,
  hint,
  s,
  isPrimary,
}: {
  label: string;
  hint: string;
  s: FormatStats;
  isPrimary: boolean;
}) {
  const thin = s.median_vsr === null;

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-6 gap-y-1 border-l-2 py-2 pl-3 ${
        isPrimary ? "border-signal/60" : "border-hair2"
      }`}
    >
      <div className="w-28 shrink-0">
        <div className={`text-sm ${isPrimary ? "text-ink" : "text-ink2"}`}>
          {label}
          {isPrimary && <span className="ml-1.5 font-mono text-[10px] text-signal">주력</span>}
        </div>
        <div className="font-mono text-[10px] text-ink3">{hint}</div>
      </div>

      {thin ? (
        // 숫자 대신 사유. 빈 자리를 문장으로 채우지 않는다 — 사실만 적는다
        <div className="font-mono text-xs text-ink3">
          {s.sample}편 · 배수를 내려면 5편 필요
        </div>
      ) : (
        <>
          <div>
            <div className="font-mono text-[10px] text-ink3">구독자 대비</div>
            <div
              className={`mt-0.5 font-mono text-lg tnum ${
                isPrimary ? "font-bold text-signal" : "text-ink2"
              }`}
            >
              {s.median_vsr}×
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-ink3">조회수 중앙값</div>
            <div className="mt-0.5 font-mono text-lg text-ink tnum">
              {(s.median_views ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-ink3">표본 · 길이</div>
            <div className="mt-0.5 font-mono text-sm text-ink2 tnum">
              {s.sample}편 · {fmtDuration(s.median_duration ?? 0)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ChannelStats({
  recent,
  subscriberCount,
  totalVideoCount,
}: {
  recent: ChannelFormatStats;
  subscriberCount: number;
  totalVideoCount?: number;
}) {
  return (
    <div className="mt-5 border-y border-hair/70 py-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="font-mono text-[10px] tracking-wide text-ink3">구독자</div>
          <div className="mt-0.5 font-mono text-lg text-ink tnum">
            {subscriberCount.toLocaleString()}
          </div>
        </div>
        <div className="font-mono text-[11px] text-ink3">
          최근 {recent.sample}편
          {totalVideoCount ? ` / 전체 ${totalVideoCount.toLocaleString()}편` : ""} · 3년 이내
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <FormatRow
          label="롱폼"
          hint={`${Math.floor(recent.cut_sec / 60)}분 초과`}
          s={recent.long}
          isPrimary={recent.primary === "long"}
        />
        <FormatRow
          label="쇼츠"
          hint={`${Math.floor(recent.cut_sec / 60)}분 이하`}
          s={recent.short}
          isPrimary={recent.primary === "short"}
        />
      </div>

      {/*
        길이만으로 가른다는 사실을 밝힌다. API 가 "이건 쇼츠다"를 알려주지 않는다.
        경계가 180초인 것도 적어야 한다 — 60초로 알고 있는 사람이 대부분이라
        (2024년 10월에 3분으로 늘었다) 안 적으면 숫자가 틀린 것처럼 보인다.
      */}
      <p className="mt-2.5 font-mono text-[10px] text-ink3">
        형식은 영상 길이 {recent.cut_sec}초 기준 · 조회수는 수집 시점 누적의 중앙값
      </p>
    </div>
  );
}
