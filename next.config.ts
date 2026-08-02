import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 7단계에서 TourAPI 이미지(tong.visitkorea.or.kr)와 유튜브 썸네일을 붙일 때 사용한다.
    // 0단계 가짜 데이터는 외부 이미지를 쓰지 않으므로 지금은 비어 있어도 된다.
    remotePatterns: [],
  },
};

export default nextConfig;
