import type { ShootPlan } from "@/lib/shootday";

/**
 * 날짜가 박힌 촬영 계획.
 *
 * ── 이 블록이 펼침의 맨 위에 있는 이유 ───────────────────
 * `3.2×` 를 보고 4시간을 운전하는 사람은 없다. 크리에이터를 실제로 움직이는 건
 * **놓칠 수 있는 날짜**다. 오일장은 안 맞춰 가면 그냥 빈 공터다 — 점수가 아무리
 * 높아도 헛걸음이면 두 번 다시 이 서비스를 안 쓴다.
 *
 * 그리고 이 블록은 소재 점수가 검증에 실패해도 그대로 살아남는다.
 * 장날과 일출은 **예측이 아니라 사실**이라서.
 *
 * 재료는 전부 실측이다:
 *   장날  전국전통시장표준데이터 개설주기
 *   해    천문연 20지점 (실측 오차 평균 0.1분)
 */
export function ShootPlanBlock({ plan }: { plan: ShootPlan }) {
  const { calendar, days } = plan;

  return (
    <div className="border border-open-d/40 bg-open/5 p-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-mono text-[11px] tracking-wide text-open">다음 장날</span>
        <span className="font-mono text-[11px] text-ink3">{calendar.cycle_label}</span>
        {calendar.shop_count ? (
          <span className="font-mono text-[11px] text-ink3">점포 {calendar.shop_count}</span>
        ) : null}
      </div>

      {/*
        이름이 정확히 맞아떨어지지 않은 경우 **등록명을 보여준다.**
        `곡성 오일장` 으로 찾았는데 실제로는 `곡성기차마을전통시장` 이라면,
        크리에이터가 "내가 아는 그 장이 맞나" 를 직접 확인할 수 있어야 한다.
        추정을 원본인 척 섞지 않는다.
      */}
      {plan.tier !== "이름" && (
        <div className="mt-1 font-mono text-[10px] text-ink3">
          표준데이터 등록명 · {calendar.name}
        </div>
      )}

      <div className="mt-2.5 space-y-2">
        {days.map((d) => (
          <div key={d.date} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="w-28 shrink-0 text-sm text-ink">
              {d.label}
              {d.in_days === 0 && <span className="ml-1.5 text-[11px] text-open">오늘</span>}
            </span>

            {/*
              골든아워를 먼저 쓴다. 크리에이터가 실제로 카메라를 드는 시간이
              일출 자체가 아니라 그 앞뒤 어스름이라서다.
            */}
            {d.sun ? (
              <span className="font-mono text-[11px] text-ink2 tnum">
                {d.sun.dawn && (
                  <>
                    <span className="text-ink3">박명</span> {d.sun.dawn}{" "}
                  </>
                )}
                {d.sun.sunrise && (
                  <>
                    <span className="text-ink3">일출</span> {d.sun.sunrise}{" "}
                  </>
                )}
                {d.sun.sunset && (
                  <>
                    <span className="text-ink3">일몰</span> {d.sun.sunset}
                  </>
                )}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/*
        ⚠️ 어느 지점 기준인지 반드시 밝힌다. 그 장소에서 직접 잰 값이 아니다.
           밝히지 않으면 분 단위까지 그 자리에서 잰 것처럼 읽힌다.
      */}
      <div className="mt-2.5 font-mono text-[10px] text-ink3">
        장날 · 전통시장 표준데이터
        {days[0]?.sun ? ` · 해 · 천문연 ${days[0].sun.site} 기준` : ""}
      </div>
    </div>
  );
}
