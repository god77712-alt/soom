"use client";

import { useState } from "react";
import Link from "next/link";
import { PlaceThumb } from "@/components/PlaceThumb";
import { TagScoreList } from "@/components/TagScoreList";
import { VideoBreakdownCard } from "@/components/VideoBreakdownCard";
import { reliabilityNote, toneClass } from "@/lib/display";
import { getStrings } from "@/lib/i18n";
import type { PlaceCard } from "@/lib/repo";
import type { Tag } from "@/lib/types";

const S = getStrings("ko");

/**
 * S3 추천 카드.
 *
 * 접힌 상태에 두는 것은 네 가지뿐이다.
 *   썸네일 · 장소명 · 다른 채널이 이 소재로 낸 성과 · 태그
 * 나머지(장날·이동시간·컷 이름·숨 스코어)는 펼침으로 내려갔다. 접힌 카드에 다 얹으면
 * 5장을 훑는 동안 아무것도 눈에 안 들어온다.
 *
 * 펼침은 페이지를 떠나지 않는다. 크리에이터는 5곳을 오가며 비교하기 때문이다.
 * 다만 근거 6단(S4)은 여기서 요약하지 않는다 — 링크로 넘긴다 (CLAUDE.md 4항).
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
  const [open, setOpen] = useState(false);
  const note = reliabilityNote(card.place);
  const isOpen = card.competition.count === 0;
  const perf = card.performance;
  const href = `/place/${card.place.id}?channel=${channelId}&tag=${tag.id}`;
  const otherTags = card.tagScores.filter((t) => t.tag.id !== tag.id);

  return (
    <article className="border-b border-hair">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group grid w-full grid-cols-[7.5rem_1fr] gap-4 py-4 text-left transition-colors hover:bg-panel sm:grid-cols-[10rem_1fr] sm:gap-5"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-panel">
          <PlaceThumb place={card.place} open={isOpen} />
          <span
            className={`absolute left-0 top-0 bg-ground/80 px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              isOpen ? "text-open" : "text-ink3"
            }`}
          >
            {String(rank).padStart(2, "0")}
          </span>
        </div>

        <div className="min-w-0 self-center">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[17px] font-semibold tracking-tight">{card.place.name_ko}</span>
            <span className="font-mono text-xs text-ink3">
              {card.place.sido} {card.place.sigungu}
            </span>
            {card.place.is_declining_area && (
              <span className="border border-hair2 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-ink3">
                {S.decliningArea}
              </span>
            )}
          </div>

          {/*
            성과. 이 장소에서 찍힌 영상이 없으면 같은 소재의 다른 지역 성적이 들어온다.
            그때 scope 가 "재래시장 영상"으로 바뀌고 출처가 아래 붙는다 —
            같은 모양으로 그리면 "여기서 4.1× 나왔다"는 거짓말이 된다.
          */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-mono text-[11px] text-ink3">{perf.scope}</span>
            <span
              className={`font-mono text-lg font-bold tnum ${
                perf.isOwn ? "text-ink" : "text-ink2"
              }`}
            >
              {perf.value}
            </span>
            <span className={`font-mono text-[11px] ${toneClass(card.competition.tone)}`}>
              {card.competition.text}
            </span>
          </div>
          {perf.basis && (
            <div className="mt-0.5 font-mono text-[11px] text-ink3">{perf.basis}</div>
          )}

          {/*
            지금 고른 소재는 뺀다. 위 성과 줄이 이미 그 숫자다 — 같은 값을 두 번 적으면
            카드마다 똑같은 칩이 반복돼서 장소끼리 구별이 안 된다.
            남는 게 없으면 줄 자체를 그리지 않는다 (여기서 찍을 다른 소재가 없다는 뜻).
          */}
          {otherTags.length > 0 && (
            <div className="mt-2.5">
              <TagScoreList items={otherTags} compact limit={4} />
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink3">
            <span className={open ? "text-ink2" : "text-signal"}>
              {open ? S.cardClose : S.cardOpen}
            </span>
            {note && <span className="text-open-d">⚠ {note}</span>}
          </div>
        </div>
      </button>

      {open && (
        <div className="grid gap-6 pb-6 sm:grid-cols-[10rem_1fr] sm:gap-5">
          <div className="hidden sm:block" />
          <div className="min-w-0 space-y-6">
            {card.breakdowns.length > 0 && (
              <section>
                <h3 className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
                  {S.cardBreakdownTitle}
                </h3>
                <div className="mt-2.5 space-y-3">
                  {card.breakdowns.map((b) => (
                    <VideoBreakdownCard key={b.video_id} item={b} />
                  ))}
                </div>
              </section>
            )}

            {card.shots.length > 0 && (
              <section>
                <h3 className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
                  {S.cardShotsTitle}
                </h3>
                <ul className="mt-2.5 space-y-1.5">
                  {card.shots.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2.5 text-sm text-ink2">
                      <span>{s.caption}</span>
                      {s.best_time && (
                        <span className="font-mono text-[11px] text-open tnum">{s.best_time}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 하루에 한 곳만 찍고 오지 않는다. 묶을 곳이 있어야 움직인다 */}
            {card.nearby.length > 0 && (
              <section>
                <h3 className="font-mono text-[11px] tracking-wider text-ink3 uppercase">
                  {S.cardNearbyTitle}
                </h3>
                <ul className="mt-2.5 divide-y divide-hair/70">
                  {card.nearby.map((n) => (
                    <li key={n.place_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                      <span className="text-sm text-ink">{n.name_ko}</span>
                      <span className="font-mono text-[11px] text-ink3 tnum">
                        {S.nearbyDistance(n.distance_km, n.drive_minutes)}
                      </span>
                      {n.tag_names.length > 0 && (
                        <span className="text-[11px] text-ink3">{n.tag_names.join(" · ")}</span>
                      )}
                      <span
                        className={`font-mono text-[11px] ${
                          n.video_count === 0 ? "text-open" : "text-ink3"
                        }`}
                      >
                        {S.competition(n.video_count)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 장날이 안 맞으면 헛걸음이다. 운영 정보는 있는 것만 그린다 */}
            {(card.operation.open_cycle ||
              card.operation.open_hours ||
              card.travelFromSeoul ||
              card.operation.filming_note) && (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-y border-hair py-3 font-mono text-[11px] text-ink3">
                {card.operation.open_cycle && <span>장날 {card.operation.open_cycle}</span>}
                {card.operation.open_hours && <span>{card.operation.open_hours}</span>}
                {card.travelFromSeoul && <span>서울 {card.travelFromSeoul}</span>}
                {card.operation.filming_note && (
                  <span className="text-open-d">{card.operation.filming_note}</span>
                )}
              </div>
            )}

            <Link
              href={href}
              className="inline-flex items-center gap-2 font-mono text-[11px] text-signal transition-colors hover:text-ink"
            >
              {S.cardFullEvidence} →
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}
