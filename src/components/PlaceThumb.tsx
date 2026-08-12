import type { Place } from "@/lib/types";

/**
 * 장소 썸네일.
 *
 * 0단계 데이터에는 사진이 없다 (FAKE_PLACES.image_url 이 전부 null).
 * 7단계에서 TourAPI 대표이미지가 들어오면 이 컴포넌트를 고치지 않아도 사진으로 바뀐다.
 *
 * 사진이 없는 동안 회색 빈 박스를 두면 고장난 것처럼 보인다. "이미지 준비 중" 같은
 * 문구로 채우지도 않는다 (문구 원칙: 빈 자리를 문장으로 채우지 말 것).
 * 대신 **좌표에서 만든 도트 패턴**을 깐다 — 장소마다 다르게 생기고, 같은 장소는
 * 항상 같게 생긴다. ShotStrip 과 같은 질감이라 화면 안에서 따로 놀지 않는다.
 */

const COLS = 11;
const ROWS = 8;

/** 좌표를 정수 씨앗으로 접는다. 같은 장소는 언제 그려도 같은 그림이 된다. */
function seedOf(place: Place): number {
  const n = Math.round(place.lat * 10_000) * 31 + Math.round(place.lng * 10_000);
  return Math.abs(n) % 2_147_483_647 || 1;
}

/** 선형 합동 생성기. 외부 의존성 없이 결정적인 난수를 만든다. */
function* rng(seed: number): Generator<number> {
  let s = seed;
  while (true) {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    yield s / 2_147_483_648;
  }
}

export function PlaceThumb({
  place,
  /** 비어 있는 곳(경쟁 0편)은 금색, 아니면 청록 */
  open = false,
  className = "",
}: {
  place: Place;
  open?: boolean;
  className?: string;
}) {
  if (place.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={place.image_url}
        alt={place.name_ko}
        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] ${className}`}
      />
    );
  }

  const seed = seedOf(place);
  const r = rng(seed);
  const tint = open ? "224,164,88" : "88,196,221";
  // 씨앗으로 능선 위치를 정한다. 이게 없으면 전부 같은 잡음으로 보인다.
  const phase = (seed % 360) * (Math.PI / 180);
  const tilt = ((seed >> 8) % 100) / 100;
  const dots: Array<{ x: string; y: string; r: string; o: string }> = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const u = x / (COLS - 1);
      // 낮은 주파수 능선 + 잡음. 장소마다 밝은 띠가 다른 자리에 생긴다
      const ridge = (Math.sin(u * Math.PI * 2 + phase) + Math.cos((y / ROWS) * Math.PI * 2 * tilt + phase)) / 4 + 0.5;
      const v = r.next().value;
      const s = ridge * 0.65 + v * 0.35;
      // 서버와 브라우저가 같은 문자열을 내도록 자릿수를 고정한다.
      // 그냥 number 로 두면 마지막 자리가 갈려 하이드레이션이 깨진다.
      dots.push({
        x: (((x + 0.5) / COLS) * 100).toFixed(2),
        y: (((y + 0.5) / ROWS) * 100).toFixed(2),
        r: ((0.8 + s * 3.2) / 2).toFixed(2),
        o: (0.12 + s * 0.55).toFixed(2),
      });
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      className={`h-full w-full bg-panel ${className}`}
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={`rgba(${tint},${d.o})`} />
      ))}
    </svg>
  );
}
