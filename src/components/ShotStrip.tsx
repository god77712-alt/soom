import type { PlaceShot } from "@/lib/viewmodels";

/**
 * 여기서 찍을 수 있는 컷.
 *
 * 사진만 있으면 관광지 소개고, 컷 설명이 붙어야 촬영 계획이 된다.
 * photo_url 이 null 인 동안(0단계)은 설명이 주인공이고 사진 자리는 비워둔다.
 * 7단계에서 TourAPI 갤러리 이미지가 들어오면 자동으로 사진이 깔린다.
 */
export function ShotStrip({ shots, columns = 4 }: { shots: PlaceShot[]; columns?: 2 | 3 | 4 }) {
  if (shots.length === 0) return null;

  const grid = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";

  return (
    <div className={`grid grid-cols-2 gap-2 ${grid}`}>
      {shots.map((shot, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
          <div className="flex aspect-[4/3] items-center justify-center bg-neutral-900">
            {shot.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot.photo_url} alt={shot.caption} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-neutral-700">사진 준비 중</span>
            )}
          </div>
          <div className="p-2.5">
            <div className="text-xs leading-relaxed text-neutral-300">{shot.caption}</div>
            {shot.best_time && (
              <div className="mt-1 text-[10px] text-amber-300/70">{shot.best_time}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
