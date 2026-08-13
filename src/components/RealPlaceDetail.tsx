/**
 * S4. 장소 상세 — 6단 구조를 **실데이터로.**
 *
 * ⚠️ 순서를 바꾸거나 단계를 요약하지 말 것 (CLAUDE.md 4항).
 *    특히 ③ "별로라서가 아니다" 를 빼면 크리에이터가 안 움직인다.
 *
 * 시연판(`/place/[id]/page.tsx` 의 폴백)과 다른 점은 하나다:
 * **재료가 없는 칸을 문장으로 메우지 않는다.** 컷 순서·제목 예시·숙소는
 * 우리가 지어낸 것이라 여기엔 없다. 대신 장날·해 시각처럼 실측인 것만 남는다.
 */
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { PlaceThumb } from "@/components/PlaceThumb";
import { RealEvidenceVideoCard } from "@/components/RealEvidenceVideoCard";
import { ShootPlanBlock } from "@/components/ShootPlanBlock";
import { reachText } from "@/lib/display";
import { formatMinutes } from "@/lib/geo";
import { formatCount, getStrings } from "@/lib/i18n";
import type { RealPlaceDetail } from "@/lib/realdetail";

const S = getStrings("ko");

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hair pt-8">
      <h2 className="flex items-baseline gap-2 text-lg font-bold">
        <span className="text-open/70">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RealPlaceDetailView({
  detail,
  tagId,
}: {
  detail: RealPlaceDetail;
  tagId: string;
}) {
  const { place, subject, channel, score, usedBand, step1Videos, step2Videos, evidence, reach, shootPlan, nearby } =
    detail;

  const reachLabels = reach ? reachText(reach.low, reach.high) : null;

  return (
    <main>
      {/* 실데이터 표식. `globals.css` 가 이걸 보고 시연 배너를 지운다 */}
      <div id="real-data-page" hidden />

      <div className="border-b border-hair px-6 pt-6 pb-6 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <BackLink
            href={`/?q=${encodeURIComponent(channel.title)}&tag=${tagId}#result`}
            className="font-mono text-xs text-ink3 hover:text-ink2"
          >
            ← 추천 목록
          </BackLink>
          {place.image_url && (
            <div className="mt-5 aspect-[21/9] overflow-hidden">
              <PlaceThumb place={place} />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 sm:px-10">
        {/* ── 머리말 ── */}
        <header>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-serif text-4xl font-normal tracking-tight">{place.name_ko}</h1>
            {place.is_declining_area && (
              <span className="border border-hair2 px-2 py-0.5 font-mono text-[10px] text-ink3">
                {S.decliningArea}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink3 tnum">
            <span>
              {place.sido} {place.sigungu}
            </span>
            <span>
              {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
            </span>
            <span>{subject.label}</span>
          </div>

          {/* 추정을 원본인 척 섞지 않는다 (CLAUDE.md 지역코드 원칙) */}
          {evidence.coordEstimated && (
            <p className="mt-3 font-mono text-xs text-open-d">
              ⚠ 좌표는 읍면·시군구 중심 추정값입니다 · 실제 위치와 다를 수 있습니다
            </p>
          )}
          {evidence.lowReliability && (
            <p className="mt-1 font-mono text-xs text-open-d">
              ⚠ 공공데이터 기준 · 현장 확인을 권장합니다
            </p>
          )}
        </header>

        <div className="mt-12 space-y-8">
          {/* ── ① 이 소재는 먹힌다 ── */}
          <Step n="①" title={S.s4Step1}>
            {score ? (
              <p className="text-sm text-ink2">
                <span className="text-ink">{subject.label}</span> · 수집 영상{" "}
                <span className="tnum">{score.video_count}</span>편
                {score.can_show_multiplier && score.geo_vsr !== null ? (
                  <>
                    {" · 기하평균 "}
                    <span className="font-mono font-bold text-open tnum">{score.geo_vsr}×</span>
                    {score.ci_low !== null && score.ci_high !== null && (
                      <span className="ml-2 font-mono text-xs text-ink3 tnum">
                        95% {score.ci_low}~{score.ci_high}
                      </span>
                    )}
                    {!usedBand && (
                      <span className="ml-2 font-mono text-xs text-ink3">구독자 구간 합산</span>
                    )}
                  </>
                ) : (
                  <span className="ml-2 text-ink3">
                    · 편차가 커서 배수를 쓰지 않습니다 (순위에만 반영)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-ink3">
                {S.insufficientSample} — 이 언어권에서 이 소재의 표본이 아직 없습니다
              </p>
            )}

            {step1Videos.length > 0 ? (
              <>
                <p className="mt-4 font-mono text-xs text-ink3">
                  같은 소재 · 다른 지역에서 실제로 나온 영상
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {step1Videos.map((v) => (
                    <RealEvidenceVideoCard key={v.video_id} item={v} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink3">
                이 소재로 수집된 영상 중 장소가 특정된 것이 아직 없습니다
              </p>
            )}
          </Step>

          {/* ── ② 그런데 여긴 비어 있다 ── */}
          <Step n="②" title={S.s4Step2}>
            <p className="text-sm text-ink2">{S.s4Step2Basis(place.name_ko)}</p>
            {step2Videos.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {step2Videos.map((v) => (
                  <RealEvidenceVideoCard key={v.video_id} item={v} />
                ))}
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-open">{S.competition(0)}</p>
                {/*
                  0 은 "세상에 영상이 없다"가 아니라 "우리 코퍼스에서 안 잡혔다" 다.
                  모수를 반드시 함께 말한다 (CLAUDE.md 7항).
                */}
                <p className="mt-1 font-mono text-xs text-ink3">
                  {subject.label} 수집 영상 {subject.video_count}편 중 이 장소가 언급된 것 0편
                </p>
              </>
            )}
          </Step>

          {/* ── ③ 별로라서가 아니다 (절대 생략 금지) ── */}
          <Step n="③" title={S.s4Step3}>
            <ul className="space-y-1.5 text-sm text-ink2">
              {evidence.hasTourapiRecord && <li>· 한국관광공사 등록 정보 있음</li>}
              {evidence.hasPhoto ? <li>· 공공데이터 사진 있음</li> : <li>· 공공데이터 사진 없음</li>}
              {evidence.peerPlaceCount > 0 && (
                <li>
                  · 같은 소재에서 영상이 잡힌 곳 {evidence.peerPlaceCount}곳의 평균{" "}
                  {evidence.peerAvgVideoCount}편, 여긴{" "}
                  <span className="font-semibold text-open">{detail.ownVideoCount}편</span>
                </li>
              )}
              <li>
                · 전국 {subject.label} {subject.total.toLocaleString()}곳 중 인구감소지역{" "}
                {subject.declining.toLocaleString()}곳
              </li>
            </ul>
          </Step>

          {/* ── ④ 당신이면 이 정도 (범위 + 고지 필수) ── */}
          <Step n="④" title={S.s4Step4}>
            {reachLabels ? (
              <>
                <div className="text-sm text-ink2">
                  {S.s4ReachLabel(channel.subscriber_count)}
                </div>
                <div className="mt-1 text-3xl font-bold tracking-tight tnum">{reachLabels.range}</div>
                <p className="mt-2 text-xs text-ink3">{reachLabels.disclaimer}</p>
              </>
            ) : (
              <p className="text-sm text-ink3">
                {S.insufficientSample} — 표본이 부족해 추정하지 않습니다
              </p>
            )}
          </Step>

          {/* ── ⑤ 이렇게 찍으면 된다 ── */}
          <Step n="⑤" title={S.s4Step5}>
            {shootPlan ? (
              <>
                <ShootPlanBlock plan={shootPlan} />
                <p className="mt-3 font-mono text-xs text-ink3">
                  장날 = 전국전통시장표준데이터 · 해 시각 = 한국천문연구원
                </p>
              </>
            ) : (
              /* 컷 순서·제목 예시는 지어낸 것이라 싣지 않는다 (문구 원칙) */
              <p className="text-sm text-ink3">
                정기 개설일이 등록되지 않은 장소입니다 — 촬영 시각 정보를 표시하지 않습니다
              </p>
            )}
          </Step>

          {/* ── ⑥ 이렇게 머물면 된다 ── */}
          <Step n="⑥" title={S.s4Step6}>
            {nearby.length > 0 ? (
              <>
                <h3 className="text-sm font-medium text-ink2">근처에 같이 찍을 소재</h3>
                <ul className="mt-2 space-y-1.5">
                  {nearby.map((n) => (
                    <li
                      key={n.place_id}
                      className="flex items-baseline justify-between gap-3 rounded border border-hair/70 px-3 py-2 text-sm"
                    >
                      <span>
                        <Link
                          href={`/place/${n.place_id}?channel=${channel.id}&tag=${tagId}`}
                          className="text-ink hover:text-open"
                        >
                          {n.name_ko}
                        </Link>
                        <span className="ml-2 text-xs text-ink3">{n.tag_names.join(" · ")}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ink3 tnum">
                        차로 {formatMinutes(n.drive_minutes)}
                        <span className="ml-2">{S.competition(n.video_count)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-xs text-ink3">
                  좌표 직선거리 기준 40km 이내 · 공공데이터 {formatCount(subject.total)}곳에서
                </p>
              </>
            ) : (
              <p className="text-sm text-ink3">40km 안에 목록에 있는 다른 소재가 없습니다</p>
            )}
          </Step>
        </div>
      </div>
    </main>
  );
}
