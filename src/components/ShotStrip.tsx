import type { PlaceShot } from "@/lib/viewmodels";

/**
 * 촬영 컷 갤러리.
 *
 * 사진이 주인공이다. 크리에이터는 글보다 그림을 보고 판단한다.
 * photo_url 이 null 인 동안(0단계)은 도트 질감 자리표시를 깔고 컷 이름만 얹는다.
 * 회색 빈 박스로 두면 고장난 것처럼 보이는데, 질감이 있으면 의도된 자리로 읽힌다.
 * 7단계에서 관광사진 갤러리 이미지가 들어오면 그대로 사진이 깔린다.
 */

const DOTS =
  "radial-gradient(rgba(88,196,221,.16) 1px, transparent 1px), radial-gradient(rgba(35,107,142,.12) 1px, transparent 1px)";

export function ShotStrip({ shots }: { shots: PlaceShot[] }) {
  if (shots.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
      {shots.map((shot, i) => (
        <figure
          key={i}
          /* 첫 컷은 두 칸을 쓴다. 대표 그림이라 크게 보여준다 */
          className={`group relative overflow-hidden bg-panel ${
            i === 0 ? "col-span-2 md:row-span-2" : ""
          }`}
        >
          <div className={i === 0 ? "aspect-[4/3] md:aspect-square" : "aspect-[4/3]"}>
            {shot.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shot.photo_url}
                alt={shot.caption}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  backgroundImage: DOTS,
                  backgroundSize: "12px 12px, 12px 12px",
                  backgroundPosition: "0 0, 6px 6px",
                }}
              />
            )}
          </div>

          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-8">
            <div className={`leading-snug text-ink ${i === 0 ? "text-sm" : "text-xs"}`}>
              {shot.caption}
            </div>
            {shot.best_time && (
              <div className="mt-1 font-mono text-[10px] text-open tnum">{shot.best_time}</div>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
