"use client";

import { useEffect, useRef } from "react";

/**
 * 도트 지도 + 움직이는 배차 경로.
 *
 * 배경 이미지를 깔지 않는다. 좌표를 점으로 찍어서 국토 모양이 나오게 한다.
 * 지금은 해안선 근사 폴리곤 안을 채워 흉내내지만, 7단계에 실제 4만 8천 건이 들어오면
 * places 좌표를 그대로 뿌린다. 그러면 수도권은 빽빽하고 인구감소지역은 성기게 나오는데,
 * 그 대비 자체가 이 서비스의 논지라 따로 설명할 필요가 없어진다.
 */

export interface MapPoint {
  name: string;
  lat: number;
  lng: number;
}

/** 남한 해안선 근사. 도트 마스크용이라 정밀할 필요는 없다 */
const OUTLINE: Array<[number, number]> = [
  [126.65, 37.8], [127.0, 38.28], [127.55, 38.3], [128.35, 38.58], [128.75, 38.05],
  [129.0, 37.4], [129.3, 36.6], [129.45, 36.05], [129.36, 35.5], [129.1, 35.1],
  [128.6, 34.85], [127.75, 34.72], [126.95, 34.58], [126.4, 34.3], [126.28, 34.82],
  [126.45, 35.45], [126.5, 35.95], [126.2, 36.6], [126.15, 36.92], [126.6, 37.42],
  [126.65, 37.8],
];
const JEJU = { lng: 126.55, lat: 33.38, rx: 0.44, ry: 0.2 };
const BOUNDS = { w: 125.6, e: 129.9, s: 33.0, n: 38.8 };

const inPoly = (x: number, y: number) => {
  let hit = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const inJeju = (x: number, y: number) =>
  ((x - JEJU.lng) / JEJU.rx) ** 2 + ((y - JEJU.lat) / JEJU.ry) ** 2 <= 1;

/** 결정적 유사난수 — 디더링 질감. 매번 같은 그림이 나와야 한다 */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 국제선이 들어오는 공항.
 *
 * 목적지는 **가장 가까운 공항**에 붙는다. 해외 크리에이터는 어차피 공항으로 들어오고,
 * 어느 공항으로 들어와야 하는지가 실제로 필요한 정보다.
 */
export const AIRPORTS: MapPoint[] = [
  { name: "인천", lat: 37.4602, lng: 126.4407 },
  { name: "김해", lat: 35.1795, lng: 128.9382 },
  { name: "제주", lat: 33.5113, lng: 126.493 },
];

export function MapHero({
  origins = AIRPORTS,
  open,
  held,
  className = "",
}: {
  /** 출발 공항들. 목적지는 가장 가까운 공항에 연결된다 */
  origins?: MapPoint[];
  /** 추천 구역 — 금색으로 맥동한다 */
  open: MapPoint[];
  /** 이미 관광지가 된 곳 — 가라앉는다 */
  held: MapPoint[];
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let dots: Array<[number, number, number]> = [];
    let routes: Array<{ path: Path2D; p0: [number, number]; c: [number, number]; p1: [number, number] }> = [];
    let pos: Record<string, [number, number]> = {};
    let raf = 0;
    const t0 = performance.now();

    /**
     * 축척과 위치.
     *
     * ⚠️ 가로/세로 중 작은 쪽에 맞추면 안 된다. 한국은 세로로 긴데 히어로는 가로로 길어서,
     *    세로 기준이 이기면 지도가 화면 한가운데 좁은 띠로 쪼그라든다.
     *    높이를 살짝 넘기게 키우고, 글자가 앉는 왼쪽을 피해 오른쪽에 놓는다.
     */
    const metrics = () => {
      const fitH = (H * 1.18) / (BOUNDS.n - BOUNDS.s);
      const fitW = (W * 0.9) / (BOUNDS.e - BOUNDS.w);
      const narrow = W < 720;
      const scale = narrow ? Math.min(fitH, fitW) : fitH;
      return { scale, cx: narrow ? W * 0.5 : W * 0.7, cy: H * 0.5 };
    };

    const project = (lat: number, lng: number): [number, number] => {
      const { scale, cx, cy } = metrics();
      return [
        cx + (lng - (BOUNDS.w + BOUNDS.e) / 2) * scale,
        cy - (lat - (BOUNDS.s + BOUNDS.n) / 2) * scale,
      ];
    };

    /**
     * 항공 노선도처럼 휘는 호.
     *
     * 두 점을 잇는 이차 베지에인데, 제어점을 현(弦)의 수직 방향으로 밀어 부풀린다.
     * 모든 호를 같은 회전 방향으로 부풀려야 노선도처럼 보인다 — 제각각이면 그냥 지저분하다.
     * 부푸는 정도는 거리에 비례한다. 가까운 곳은 거의 직선, 먼 곳은 크게 휜다.
     */
    type Arc = { path: Path2D; p0: [number, number]; c: [number, number]; p1: [number, number] };

    const arc = (a: [number, number], b: [number, number]): Arc => {
      const [x1, y1] = a;
      const [x2, y2] = b;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy) || 1;
      // 현의 수직 단위벡터. 부호를 고정해 모든 호가 같은 쪽으로 휜다.
      const nx = -dy / dist;
      const ny = dx / dist;
      const bow = Math.min(dist * 0.22, 74);
      const c: [number, number] = [x1 + dx / 2 + nx * bow, y1 + dy / 2 + ny * bow];

      const path = new Path2D();
      path.moveTo(x1, y1);
      path.quadraticCurveTo(c[0], c[1], x2, y2);
      return { path, p0: a, c, p1: b };
    };

    /** 이차 베지에 위의 점 */
    const atT = (a: Arc, t: number): [number, number] => {
      const u = 1 - t;
      return [
        u * u * a.p0[0] + 2 * u * t * a.c[0] + t * t * a.p1[0],
        u * u * a.p0[1] + 2 * u * t * a.c[1] + t * t * a.p1[1],
      ];
    };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = cv.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      if (W === 0 || H === 0) return;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const { scale, cx, cy } = metrics();
      for (let py = -20; py < H + 20; py += 4) {
        for (let px = 0; px < W; px += 4) {
          const lng = (px - cx) / scale + (BOUNDS.w + BOUNDS.e) / 2;
          const lat = (BOUNDS.s + BOUNDS.n) / 2 - (py - cy) / scale;
          if (!inPoly(lng, lat) && !inJeju(lng, lat)) continue;
          const n = hash(px * 0.37, py * 0.53);
          if (n < 0.26) continue;
          dots.push([px + (hash(px, py) - 0.5) * 2, py + (hash(py, px) - 0.5) * 2, n]);
        }
      }

      pos = {};
      for (const p of [...open, ...held, ...origins]) pos[p.name] = project(p.lat, p.lng);

      // 목적지마다 가장 가까운 공항을 찾아 잇는다
      routes = open.map((p) => {
        const hub = origins.reduce((best, a) => {
          const d = (a.lat - p.lat) ** 2 + (a.lng - p.lng) ** 2;
          const bd = (best.lat - p.lat) ** 2 + (best.lng - p.lng) ** 2;
          return d < bd ? a : best;
        }, origins[0]);
        return arc(pos[hub.name], pos[p.name]);
      });
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      for (const [x, y, n] of dots) {
        ctx.fillStyle = n > 0.82 ? "rgba(88,196,221,0.62)" : "rgba(35,107,142,0.72)";
        ctx.fillRect(x, y, 1.6, 1.6);
      }

      // 노선 바탕선 — 항상 떠 있는 얇은 실선
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(138,98,52,0.45)";
      for (const r of routes) ctx.stroke(r.path);

      // 출발지에서 목적지로 뻗어나가는 빛
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(224,164,88,0.9)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([30, 260]);
      ctx.lineDashOffset = reduce ? 0 : -((t * 62) % 290);
      ctx.shadowColor = "rgba(224,164,88,0.85)";
      ctx.shadowBlur = 7;
      for (const r of routes) ctx.stroke(r.path);
      ctx.restore();

      // 노선을 따라 이동하는 기체
      if (!reduce) {
        routes.forEach((r, i) => {
          // 노선마다 출발 시각을 어긋나게 해서 동시에 뜨지 않게 한다
          const phase = (t * 0.24 + i * 0.19) % 1;
          const [px, py] = atT(r, phase);
          const [ax, ay] = atT(r, Math.min(1, phase + 0.02));
          const angle = Math.atan2(ay - py, ax - px);

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(angle);
          // 도착 직전·직후에 흐려진다
          ctx.globalAlpha = Math.min(1, Math.sin(phase * Math.PI) * 2.2);
          ctx.fillStyle = "rgba(255,214,160,0.98)";
          ctx.beginPath();
          ctx.moveTo(4.4, 0);
          ctx.lineTo(-2.6, 2.4);
          ctx.lineTo(-1.2, 0);
          ctx.lineTo(-2.6, -2.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      }

      // 이미 관광지가 된 곳
      for (const p of held) {
        const at = pos[p.name];
        if (!at) continue;
        ctx.fillStyle = "rgba(42,55,66,0.95)";
        ctx.beginPath();
        ctx.arc(at[0], at[1], 3, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "rgba(76,89,102,0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(at[0], at[1], 6, 0, 7);
        ctx.stroke();
      }

      // 추천 구역 — 맥동
      open.forEach((p, i) => {
        const at = pos[p.name];
        if (!at) return;
        const ph = reduce ? 0.5 : (Math.sin(t * 1.5 - i * 0.7) + 1) / 2;
        ctx.strokeStyle = `rgba(224,164,88,${0.1 + ph * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(at[0], at[1], 8 + ph * 7, 0, 7);
        ctx.stroke();
        ctx.fillStyle = "rgba(224,164,88,0.95)";
        ctx.beginPath();
        ctx.arc(at[0], at[1], 3.2, 0, 7);
        ctx.fill();
      });

      // 공항 — 관제탑처럼 링이 퍼져나간다
      origins.forEach((a, ai) => {
        const o = pos[a.name];
        if (!o) return;
        if (!reduce) {
          for (let k = 0; k < 3; k++) {
            const ph = (t * 0.45 + k / 3 + ai * 0.28) % 1;
            ctx.strokeStyle = `rgba(88,196,221,${(1 - ph) * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(o[0], o[1], 5 + ph * 32, 0, 7);
            ctx.stroke();
          }
        }
        ctx.strokeStyle = "rgba(88,196,221,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(o[0], o[1], 7, 0, 7);
        ctx.stroke();
        ctx.fillStyle = "rgba(88,196,221,0.95)";
        ctx.beginPath();
        ctx.arc(o[0], o[1], 3, 0, 7);
        ctx.fill();

        ctx.fillStyle = "rgba(88,196,221,0.62)";
        ctx.font = "500 9px ui-monospace, Consolas, monospace";
        ctx.fillText(a.name, o[0] + 11, o[1] + 3);
      });

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const start = () => {
      build();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    start();

    let tid: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(tid);
      tid = setTimeout(start, 160);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tid);
      window.removeEventListener("resize", onResize);
    };
  }, [origins, open, held]);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
