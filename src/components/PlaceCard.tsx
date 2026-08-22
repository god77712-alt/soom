
import { PlaceThumb } from "@/components/PlaceThumb";
import { shortSido } from "@/lib/catalog";
import type { CatalogPlace } from "@/lib/catalog";

/**
 * 목록 한 칸.
 *
 * ── 왜 카드를 따로 뺐는가 ────────────────────────────────
 * 우리가 파는 건 예측이 아니라 **목록**이다(가설 B 기각 · 채널 74%).
 * 그런데 목록의 값어치는 점수가 아니라 **카드에 뭐가 적혀 있고 사진이 있느냐**로
 * 결정된다. 그 판단이 `/subject/[slug]` 안에 인라인으로 박혀 있으면 홈에서
 * 같은 카드를 그릴 때 반드시 다르게 그려진다 — 이 저장소가 이미 세 번 겪은
 * 실패다 (`canShowMultiplier` · `SUBJECT_PLAN` · videoplace matcher).
 *
 * ── 무엇을 담고 무엇을 안 담는가 ─────────────────────────
 * 한 칸에 네 가지까지만 둔다. 5장을 훑는 동안 아무것도 눈에 안 들어오게 되면
 * 목록 자체가 무의미해진다 (추천 카드에서 이미 같은 결론을 냈다).
 *
 *   [사진]  이름 · 시도 시군구 · 인구감소
 *           대표 키워드 칩
 *           장날 / 운영 한 줄
 *
 * ⚠️ **빈 자리를 문장으로 채우지 않는다.** 운영정보가 없으면 그 줄을 안 그린다.
 *    "정보 없음" 도 쓰지 않는다 — 없다는 말을 굳이 화면에 둘 이유가 없다.
 */

/** 한 칸이 그릴 키워드 수. 넘치면 줄바꿈이 카드 높이를 들쭉날쭉하게 만든다 */
const MAX_KEYWORDS = 3;

export function PlaceCard({
  place,
  /** 장날·일출 등 날짜 계산 결과. 없으면 그 줄을 안 그린다 */
  shootLine,
}: {
  place: CatalogPlace;
  shootLine?: { label: string; sunrise?: string | null } | null;
}) {
  const p = place;

  /**
   * 운영 한 줄.
   *
   * ⚠️ **아무것도 안 알려주는 값은 안 그린다** (2026-08-22).
   *    `점포별 상이함` 이 철자만 5가지로 100건 가까이 있다 — 여는 시간을
   *    물었더니 "가게마다 달라요" 라고 답한 셈이라 카드에 둘 이유가 없다.
   *    `상시 개방` 은 칩으로 올라가므로 여기서 또 그리지 않는다.
   *
   *    빈 자리를 문장으로 채우지 않는 것과 같은 원칙이다 —
   *    **내용 없는 줄은 빈 줄보다 나쁘다.** 읽고 나서야 쓸모없는 걸 안다.
   */
  const raw = p.info?.usetime ?? null;
  const openLine = raw && !/점포|상이|상시\s*개방/.test(raw) ? raw : null;

  /**
   * ⚠️ **「다음 장날」 줄이 있으면 `장날 …` 칩을 뺀다** (2026-08-22).
   *
   * 둘은 같은 말이다. 게다가 원문이 `매월 4, 9, 14, 19, 24, 29일` 처럼 길어서
   * 칩 하나가 두 줄을 먹고 나머지 키워드를 밀어냈다 — 특산물이 안 보였다.
   *
   * 아래 줄이 **더 낫다.** 원문은 규칙이고 아래 줄은 실제 날짜다
   * (`8월 22일 (토)`). 크리에이터가 필요한 건 후자다.
   */
  const chips = (shootLine ? p.keywords.filter((k) => !k.startsWith("장날")) : p.keywords).slice(
    0,
    MAX_KEYWORDS,
  );

  return (
    <li className="flex gap-3.5">
      <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden">
        <PlaceThumb
          place={{ name_ko: p.name, lat: p.lat, lng: p.lng, image_url: p.image }}
          open={p.declining}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {/*
            🚨 **여기를 `/place/[id]` 로 링크하지 말 것** (2026-08-22 실측).
               걸었다가 프로덕션에서 404 를 냈다.

               `/place/[id]` 는 **채널이 있어야만** 실데이터 상세를 그린다
               (`realPlaceDetail(id, channel, hint)`). 채널 없이 들어오면
               시연 경로로 내려가는데 거긴 카탈로그 id(`t132783`)를 모른다.

               채널 없이도 열리게 하려면 예상 도달(④)을 안 그리는 손님용 상세가
               필요하다 — 구독자 수가 없으면 범위를 못 내고, 단일 숫자로
               때우는 건 금지다(CLAUDE.md 6항). 그건 별도 작업이다.
          */}
          <span className="text-sm text-ink">{p.name}</span>
          {p.declining && (
            <span className="border border-open/40 px-1 font-mono text-[10px] text-open">
              인구감소
            </span>
          )}
        </div>

        {/*
          ⚠️ 사진 장수를 뺐다 (2026-08-22). 크리에이터가 고를 때 쓰는 정보가 아니다 —
             카드에 줄을 하나 더 늘려서 정작 장날·특산물이 밀려났다.
             한 칸에 네 가지까지만 둔다는 원칙에 이게 먼저 밀린다.
        */}
        <div className="mt-0.5 font-mono text-[11px] text-ink2">
          {shortSido(p.sido)} {p.sigungu}
        </div>

        {/*
          대표 키워드 — 이 카드가 옆 카드와 달라지는 유일한 자리다.
          순위로 장소를 가를 근거가 없으니(CLAUDE.md 3항) 차이는 여기서 낸다.
          전부 받은 값이다: 장날·특산물·다른 소재 태그·연중무휴·주차.
        */}
        {chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((k) => (
              <span
                key={k}
                className="border border-hair px-1.5 py-px font-mono text-[10px] text-ink2"
              >
                {k}
              </span>
            ))}
          </div>
        )}

        {/* 장날은 목록에서도 보여준다 — 안 맞춰 가면 빈 공터다 */}
        {shootLine && (
          <div className="mt-1.5 font-mono text-[11px] text-open-d">
            다음 장날 {shootLine.label}
            {shootLine.sunrise && <span className="text-ink3"> · 일출 {shootLine.sunrise}</span>}
          </div>
        )}

        {openLine && (
          <div className="mt-1 truncate font-mono text-[11px] text-ink3" title={openLine}>
            {openLine}
          </div>
        )}

        {/*
          ⚠️ 추정 좌표와 저신뢰 데이터를 반드시 밝힌다.
             폐교는 좌표가 읍면 중심이라 실제 위치와 km 단위로 다를 수 있고,
             현장 상태도 자주 바뀐다. 밝히지 않으면 헛걸음의 책임이 우리에게 온다.
        */}
        {(p.coord_estimated || p.low_reliability) && (
          <div className="mt-1 font-mono text-[10px] text-ink3">
            {p.coord_estimated && "위치는 읍면 중심으로 어림잡았어요"}
            {p.coord_estimated && p.low_reliability && " · "}
            {p.low_reliability && "공공데이터 기준이라 확인이 필요해요"}
          </div>
        )}
      </div>
    </li>
  );
}
