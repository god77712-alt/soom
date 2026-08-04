/**
 * S4. 장소 상세 — 확신을 만드는 6단 구조
 *
 * ⚠️ 순서를 바꾸거나 단계를 요약하지 말 것 (CLAUDE.md 4항).
 * 의심을 하나씩 걷어내는 순서다. 특히 ③ "별로라서가 아니다"를 빼면 크리에이터가 안 움직인다.
 *
 *   ① 이 소재는 먹힌다      다른 곳의 성공 영상
 *   ② 그런데 여긴 비어 있다  여기서 찍힌 영상 전체
 *   ③ 별로라서가 아니다      등록 정보 · 사진 · 접근성 · 동급 대비
 *   ④ 당신이면 이 정도       예상 도달 범위 (단일 숫자 금지)
 *   ⑤ 이렇게 찍으면 된다     장날 · 일출 · 컷 순서 · 제목 예시
 *   ⑥ 이렇게 머물면 된다     숙소 · 축제 · 근처 묶어 찍기
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceVideoCard } from "@/components/EvidenceVideoCard";
import { ShotStrip } from "@/components/ShotStrip";
import { TagScoreList } from "@/components/TagScoreList";
import { reliabilityNote, toneClass } from "@/lib/display";
import { formatMinutes } from "@/lib/geo";
import { formatCount, getStrings } from "@/lib/i18n";
import { reachText } from "@/lib/display";
import { getPlaceDetail } from "@/lib/repo";

const S = getStrings("ko");

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
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

export default async function PlaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ channel?: string; tag?: string }>;
}) {
  const { id } = await params;
  const { channel: channelId = "", tag: tagId = "" } = await searchParams;

  const detail = await getPlaceDetail(id, channelId, tagId);
  if (!detail) notFound();

  const {
    place, tagScores, shots, operation, nearby, channel, tag,
    step1Videos, step1Score, step2Videos, evidence, reach, plan, stay,
  } = detail;

  const note = reliabilityNote(place);
  const reachLabels = reach ? reachText(reach.low, reach.high) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/recommend?channel=${channel.id}&tag=${tag.id}`}
        className="text-xs text-ink3 hover:text-ink2"
      >
        ← 추천 목록
      </Link>

      {/* ── 머리말: 이 장소가 뭔지 ── */}
      <header className="mt-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{place.name_ko}</h1>
          {place.is_declining_area && (
            <span className="mt-2 shrink-0 rounded bg-hair px-2 py-1 text-[10px] text-ink2">
              {S.decliningArea}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-ink3">
          {place.sido} {place.sigungu} · {place.name_en}
        </div>
        <p className="mt-4 leading-relaxed text-ink2">{place.description_ko}</p>
        {note && <p className="mt-3 text-xs text-open-d/70">⚠ {note}</p>}
      </header>

      {/* ── 이 장소의 소재 전부 + 각각의 성적 ── */}
      <section className="mt-8 rounded-xl border border-hair bg-panel/30 p-5">
        <h2 className="text-sm font-medium text-ink2">
          이 장소에서 찍을 수 있는 소재
          <span className="ml-2 text-xs font-normal text-ink3">
            {channel.language === "en" ? "해외" : "국내"} 채널 · 구독자{" "}
            {formatCount(channel.subscriber_count)} 기준
          </span>
        </h2>
        <div className="mt-2">
          <TagScoreList items={tagScores} />
        </div>
      </section>

      {/* ── 찍을 수 있는 컷 ── */}
      {shots.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink2">어떤 그림이 나오나</h2>
          <div className="mt-3">
            <ShotStrip shots={shots} />
          </div>
        </section>
      )}

      <div className="mt-12 space-y-8">
        {/* ── ① 이 소재는 먹힌다 ── */}
        <Step n="①" title={S.s4Step1}>
          {step1Score.score ? (
            <p className="text-sm text-ink2">
              {S.s4Step1Basis(tag.name_ko, step1Score.score.video_count, step1Score.score.median_vsr)}
              {step1Score.status === "fallback" && step1Score.fallback_from && (
                <span className="ml-2 text-open-d/80">
                  ({S.fallbackHelp(step1Score.fallback_from.name_ko)})
                </span>
              )}
            </p>
          ) : (
            <p className={`text-sm ${toneClass("muted")}`}>
              {S.insufficientSample} — {S.insufficientSampleHelp}
            </p>
          )}
          {step1Videos.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {step1Videos.map((v) => (
                <EvidenceVideoCard key={v.video.id} item={v} />
              ))}
            </div>
          )}
        </Step>

        {/* ── ② 그런데 여긴 비어 있다 ── */}
        <Step n="②" title={S.s4Step2}>
          <p className="text-sm text-ink2">{S.s4Step2Basis(place.name_ko)}</p>
          {step2Videos.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {step2Videos.map((v) => (
                <EvidenceVideoCard key={v.video.id} item={v} />
              ))}
            </div>
          ) : (
            <p className={`mt-3 text-sm font-semibold ${toneClass("uncharted")}`}>
              {S.competition(0)} — 이 소재로 여기를 찍은 영상이 아직 없습니다
            </p>
          )}
        </Step>

        {/* ── ③ 별로라서가 아니다 (절대 생략 금지) ── */}
        <Step n="③" title={S.s4Step3}>
          <ul className="space-y-1.5 text-sm text-ink2">
            {evidence.has_tourapi_record && <li>· 한국관광공사 등록 정보 있음</li>}
            <li>· 사진 {evidence.photo_count}장 확보</li>
            <li>· {evidence.access_note}</li>
            <li>
              · 비슷한 규모 {tag.name_ko} 평균 영상 {evidence.peer_avg_video_count}편, 여긴{" "}
              <span className="font-semibold text-open">{evidence.own_video_count}편</span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink3">
            영상이 없는 이유는 품질이 아니라 노출입니다. 등록 정보와 접근성은 이미 갖춰져 있습니다.
          </p>
        </Step>

        {/* ── ④ 당신이면 이 정도 (범위 + 고지 필수) ── */}
        <Step n="④" title={S.s4Step4}>
          {reachLabels ? (
            <>
              <div className="text-sm text-ink2">
                {S.s4ReachLabel(channel.subscriber_count)}
              </div>
              <div className="mt-1 text-3xl font-bold tracking-tight">{reachLabels.range}</div>
              <p className="mt-2 text-xs text-ink3">{reachLabels.disclaimer}</p>
            </>
          ) : (
            <p className={`text-sm ${toneClass("muted")}`}>
              {S.insufficientSample} — 표본이 부족해 추정하지 않습니다
            </p>
          )}
        </Step>

        {/* ── ⑤ 이렇게 찍으면 된다 ── */}
        <Step n="⑤" title={S.s4Step5}>
          <div className="rounded-lg border border-hair bg-panel/30 p-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-ink">{plan.date_label}</span>
              <span className="text-ink2">일출 {plan.sunrise}</span>
              <span className="text-ink2">일몰 {plan.sunset}</span>
            </div>

            {/* 운영 정보. 장날이 안 맞으면 위 계획이 전부 무의미하다 */}
            {(operation.open_cycle || operation.open_hours || operation.parking) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-hair pt-3 text-xs text-ink2">
                {operation.open_cycle && <span>장날 {operation.open_cycle}</span>}
                {operation.open_hours && <span>운영 {operation.open_hours}</span>}
                {operation.parking && <span>주차 {operation.parking}</span>}
                {operation.entrance_fee && <span>입장 {operation.entrance_fee}</span>}
              </div>
            )}
            {operation.filming_note && (
              <p className="mt-2 text-xs text-open-d/70">⚠ {operation.filming_note}</p>
            )}
            {operation.source === "estimate" && (
              <p className="mt-2 text-[10px] text-ink3">
                운영 정보는 공공데이터에 없어 추정한 값입니다. 방문 전 확인하세요.
              </p>
            )}

            <ol className="mt-4 space-y-2 border-t border-hair pt-3">
              {plan.steps.map((s, i) => (
                <li key={i} className="text-sm text-ink2">
                  {s}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4">
            <div className="text-xs text-ink3">제목 예시</div>
            <ul className="mt-1.5 space-y-1">
              {plan.title_examples.map((t, i) => (
                <li key={i} className="text-sm text-ink2">
                  “{t}”
                </li>
              ))}
            </ul>
          </div>

          {/* 출처 없이 내보내면 앞의 데이터까지 신뢰를 잃는다 */}
          <p className="mt-3 text-xs text-ink3">{S.s4Step5Basis(plan.based_on_video_count)}</p>
        </Step>

        {/* ── ⑥ 이렇게 머물면 된다 ── */}
        <Step n="⑥" title={S.s4Step6}>
          {/*
            근처 묶어 찍기.
            크리에이터는 3시간 운전해서 한 곳만 찍고 오지 않는다. 이게 있어야 체류가 생기고,
            체류가 생겨야 명세 1장의 "촬영 때문에 2~3일 머문다"가 성립한다.
          */}
          {nearby.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-ink2">
                근처에 같이 찍을 소재
                <span className="ml-2 text-xs font-normal text-ink3">
                  하루에 2~3곳을 묶으면 이동비가 빠집니다
                </span>
              </h3>
              <ul className="mt-2 space-y-1.5">
                {nearby.map((n) => (
                  <li
                    key={n.place_id}
                    className="flex items-baseline justify-between gap-3 rounded border border-hair/70 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="text-ink">{n.name_ko}</span>
                      <span className="ml-2 text-xs text-ink3">
                        {n.tag_names.join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink3">
                      차로 {formatMinutes(n.drive_minutes)}
                      <span className="ml-2 text-ink3">{S.competition(n.video_count)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-ink3">
                이동시간은 직선거리 기반 어림값입니다.
              </p>
            </div>
          )}

          <h3 className="text-sm font-medium text-ink2">숙소</h3>
          <ul className="mt-2 space-y-1">
            {stay.lodgings.map((l, i) => (
              <li key={i} className="text-sm text-ink2">
                {l.name} <span className="text-ink3">{l.type} · {l.distance}</span>
              </li>
            ))}
          </ul>

          {stay.festivals.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-medium text-ink2">주변 축제</h3>
              <ul className="mt-2 space-y-1">
                {stay.festivals.map((f, i) => (
                  <li key={i} className="text-sm text-ink2">
                    {f.name} <span className="text-ink3">{f.period}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="mt-4 text-sm font-medium text-ink2">예상 동선</h3>
          <p className="mt-1.5 text-sm text-ink2">{stay.route}</p>
        </Step>
      </div>
    </main>
  );
}
