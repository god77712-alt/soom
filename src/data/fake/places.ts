/**
 * 0단계용 가짜 장소 30건.
 *
 * ⚠️ 무작위 30건이 아니다. SPEC 의 예외 케이스를 전부 한 번씩 밟도록 짠 것이다.
 * 아무 장소나 30개 넣으면 화면은 예쁘게 나오지만, 정작 까다로운 표시 분기는
 * 7단계에 실데이터가 들어온 다음에야 터진다.
 *
 * 커버하는 케이스 (stats.ts 의 수치와 함께 봐야 한다)
 *   ① 국내 34편 / 해외 2편        → 미개척 강조          p_sunchang_market
 *   ② 양쪽 다 0편                  → 완전 미개척          p_school_uiseong
 *   ③ 국내 0편 / 해외 2편          → 반대 방향도 안 깨지나 p_station_simcheon
 *   ④ 세부 태그 표본 3편           → 폴백("상위 소재 기준") t_flea_market
 *   ⑤ 상위 태그도 표본 부족        → "표본 부족"           t_old_bathhouse
 *   ⑥ data_reliability = low       → "현장 확인 권장"      폐교 3건 · 역 3건
 *   ⑦ 계절 태그 3종 상태           → NOW / N월부터 / 상시  야시장 · 억새 · 오일장
 *   ⑧ 인구감소지역 / 비지역 혼재   → 희소성만으로 순위가 갈리는지
 *   ⑨ 이미 포화된 유명 장소        → 순위에서 밀려나는지    p_jeongseon_market
 *
 * 좌표는 실제 값에 가깝게 넣었지만 소개글은 전부 가짜다. 1단계에서 TourAPI 원문으로 교체된다.
 */

import type { DataReliability, Place, PlaceSource, PlaceTag } from "@/lib/types";

interface Row {
  id: string;
  src: PlaceSource;
  ko: string;
  en: string;
  sido: string;
  sgg: string;
  code: string;
  lat: number;
  lng: number;
  /** 인구감소지역 */
  dec: boolean;
  rel: DataReliability;
  desc: string;
  tags: string[];
}

const ROWS: Row[] = [
  // ── 오일장 (S3 추천 5곳이 여기서 나온다) ──────────────
  {
    id: "p_sunchang_market", src: "tourapi", ko: "순창 오일장", en: "Sunchang Five-day Market",
    sido: "전북", sgg: "순창군", code: "52770", lat: 35.3744, lng: 127.1376, dec: true, rel: "high",
    desc: "매달 1일과 6일에 열리는 전통 오일장. 고추장 마을과 인접해 장날이면 발효식품 노점이 길게 늘어선다.",
    tags: ["oil_market", "merchant"],
  },
  {
    id: "p_gokseong_market", src: "tourapi", ko: "곡성 오일장", en: "Gokseong Five-day Market",
    sido: "전남", sgg: "곡성군", code: "46820", lat: 35.2820, lng: 127.2920, dec: true, rel: "high",
    desc: "3일과 8일에 서는 장. 섬진강 기차마을과 걸어서 10분 거리라 장날 아침 풍경이 함께 잡힌다.",
    tags: ["oil_market"],
  },
  {
    id: "p_muju_market", src: "market", ko: "무주 반딧불장터", en: "Muju Firefly Market",
    sido: "전북", sgg: "무주군", code: "52730", lat: 36.0070, lng: 127.6610, dec: true, rel: "medium",
    desc: "1일과 6일에 열린다. 가을에는 산지 직송 사과와 머루 노점이 장터 절반을 채운다.",
    tags: ["oil_market", "seasonal_market"],
  },
  {
    id: "p_bonghwa_market", src: "market", ko: "봉화 오일장", en: "Bonghwa Five-day Market",
    sido: "경북", sgg: "봉화군", code: "47920", lat: 36.8930, lng: 128.7320, dec: true, rel: "medium",
    desc: "2일과 7일 장. 산나물과 송이 거래가 중심이라 새벽에 상인들이 먼저 모인다.",
    tags: ["oil_market", "merchant"],
  },
  {
    id: "p_cheongsong_market", src: "market", ko: "청송 덕천 오일장", en: "Cheongsong Deokcheon Market",
    sido: "경북", sgg: "청송군", code: "47750", lat: 36.4320, lng: 129.0570, dec: true, rel: "medium",
    desc: "4일과 9일에 서는 소규모 장. 사과 산지 특성상 수확기에 규모가 두 배로 커진다.",
    tags: ["oil_market"],
  },
  {
    // ⑨ 이미 포화된 유명 장소. 태그 점수는 높지만 희소성이 낮아 순위에서 밀려야 정상이다.
    id: "p_jeongseon_market", src: "tourapi", ko: "정선 5일장", en: "Jeongseon Five-day Market",
    sido: "강원", sgg: "정선군", code: "51770", lat: 37.3805, lng: 128.6606, dec: true, rel: "high",
    desc: "2일과 7일에 열리는 전국구 오일장. 아리랑시장과 연결되어 관광버스가 직접 들어온다.",
    tags: ["oil_market", "merchant", "permanent_market"],
  },
  {
    id: "p_hwagae_market", src: "tourapi", ko: "화개장터", en: "Hwagae Market",
    sido: "경남", sgg: "하동군", code: "48880", lat: 35.1707, lng: 127.6470, dec: true, rel: "high",
    desc: "영호남이 만나는 상설 장터. 봄이면 십리벚꽃길과 이어져 장터 전체가 분홍색이 된다.",
    tags: ["oil_market", "cherry_blossom", "old_diner"],
  },

  // ── 수산시장 ──────────────────────────────────────────
  {
    id: "p_ganggu_market", src: "tourapi", ko: "강구항 어시장", en: "Ganggu Port Fish Market",
    sido: "경북", sgg: "영덕군", code: "47770", lat: 36.3620, lng: 129.3960, dec: true, rel: "high",
    desc: "대게 위판이 이뤄지는 항구 시장. 경매는 이른 아침에 끝난다.",
    tags: ["fish_market", "merchant"],
  },
  {
    id: "p_samcheonpo_market", src: "tourapi", ko: "삼천포 용궁수산시장", en: "Samcheonpo Yonggung Fish Market",
    sido: "경남", sgg: "사천시", code: "48240", lat: 34.9270, lng: 128.0700, dec: false, rel: "high",
    desc: "실내 수산시장과 좌판 골목이 붙어 있다. 2층 식당가에서 바로 회를 뜬다.",
    tags: ["fish_market", "market_alley", "old_diner"],
  },
  {
    id: "p_guryongpo_market", src: "tourapi", ko: "구룡포 시장", en: "Guryongpo Market",
    sido: "경북", sgg: "포항시", code: "47111", lat: 35.9880, lng: 129.5540, dec: false, rel: "high",
    desc: "과메기 건조대가 늘어선 항구 시장. 일본인 가옥거리가 시장 바로 뒤에 있다.",
    tags: ["fish_market", "modern_building"],
  },

  // ── 야시장 (⑦ 계절 NOW) ──────────────────────────────
  {
    id: "p_bupyeong_market", src: "tourapi", ko: "부평 깡통야시장", en: "Bupyeong Kkangtong Night Market",
    sido: "부산", sgg: "중구", code: "26110", lat: 35.1000, lng: 129.0270, dec: false, rel: "high",
    desc: "국내 최초 상설 야시장. 저녁 7시 30분부터 매대가 열린다.",
    tags: ["night_market", "permanent_market"],
  },
  {
    id: "p_seomun_market", src: "tourapi", ko: "서문시장 야시장", en: "Seomun Night Market",
    sido: "대구", sgg: "중구", code: "27110", lat: 35.8690, lng: 128.5810, dec: false, rel: "high",
    desc: "80여 개 매대가 늘어서는 대형 야시장. 주말 저녁에는 통행이 어려울 정도로 붐빈다.",
    tags: ["night_market"],
  },

  // ── 새벽시장 · 시장골목 ───────────────────────────────
  {
    id: "p_yeongju_dawn", src: "market", ko: "영주 새벽시장", en: "Yeongju Dawn Market",
    sido: "경북", sgg: "영주시", code: "47210", lat: 36.8250, lng: 128.6240, dec: true, rel: "medium",
    desc: "새벽 4시에 열려 8시면 파한다. 인근 농가가 직접 나와 좌판을 편다.",
    tags: ["dawn_market", "merchant"],
  },
  {
    id: "p_seoho_market", src: "tourapi", ko: "통영 서호시장 골목", en: "Tongyeong Seoho Market Alley",
    sido: "경남", sgg: "통영시", code: "48220", lat: 34.8420, lng: 128.4180, dec: false, rel: "high",
    desc: "새벽에 여는 시장 골목. 시락국 식당이 골목 안쪽에 줄지어 있다.",
    tags: ["market_alley", "dawn_market", "gukbap"],
  },

  // ── ④ 폴백 검증용 (세부 태그 표본 3편) ────────────────
  {
    id: "p_hwanghak_flea", src: "tourapi", ko: "황학동 벼룩시장", en: "Hwanghak-dong Flea Market",
    sido: "서울", sgg: "중구", code: "11140", lat: 37.5680, lng: 127.0180, dec: false, rel: "high",
    desc: "중고 공구와 옛 전자제품이 모이는 골목 시장. 주말 오전에 가장 물건이 많다.",
    tags: ["flea_market", "market_alley"],
  },
  {
    id: "p_yangnyeong_market", src: "tourapi", ko: "대구 약령시", en: "Daegu Herbal Medicine Market",
    sido: "대구", sgg: "중구", code: "27110", lat: 35.8660, lng: 128.5880, dec: false, rel: "high",
    desc: "350년 넘은 한약재 시장. 골목 전체에서 약재 냄새가 난다.",
    tags: ["herb_market", "market_alley"],
  },

  // ── ⑥ 폐교 (data_reliability = low) ──────────────────
  {
    id: "p_school_goheung", src: "school", ko: "옛 봉래초등학교", en: "Former Bongnae Elementary School",
    sido: "전남", sgg: "고흥군", code: "46770", lat: 34.4870, lng: 127.3960, dec: true, rel: "low",
    desc: "1998년 폐교. 운동장의 히말라야시다와 목조 현관이 남아 있다.",
    tags: ["abandoned_school"],
  },
  {
    // ② 양쪽 다 0편. 이 서비스가 가장 강하게 밀어야 하는 유형이다.
    id: "p_school_uiseong", src: "school", ko: "옛 신평초등학교", en: "Former Sinpyeong Elementary School",
    sido: "경북", sgg: "의성군", code: "47730", lat: 36.3520, lng: 128.6980, dec: true, rel: "low",
    desc: "2005년 폐교 후 미활용 상태. 교실 칠판과 급식실이 그대로 남아 있다.",
    tags: ["abandoned_school"],
  },
  {
    id: "p_school_jeongseon", src: "school", ko: "옛 여량초등학교", en: "Former Yeoryang Elementary School",
    sido: "강원", sgg: "정선군", code: "51770", lat: 37.4620, lng: 128.7180, dec: true, rel: "low",
    desc: "아우라지 인근 폐교. 뒷산 능선과 함께 잡히는 각도가 넓다.",
    tags: ["abandoned_school"],
  },

  // ── ⑥ 간이역 · 무인역 (low) ──────────────────────────
  {
    id: "p_station_imp", src: "station", ko: "임피역", en: "Impi Station",
    sido: "전북", sgg: "군산시", code: "52130", lat: 35.9560, lng: 126.8380, dec: false, rel: "low",
    desc: "1936년에 지어진 목조 역사. 현재 여객 취급은 하지 않고 등록문화재로 보존 중이다.",
    tags: ["small_station", "modern_building"],
  },
  {
    id: "p_station_hwabon", src: "station", ko: "화본역", en: "Hwabon Station",
    sido: "경북", sgg: "군위군", code: "27720", lat: 36.2270, lng: 128.6540, dec: true, rel: "low",
    desc: "급수탑이 남아 있는 간이역. 하루 몇 차례 무궁화호가 정차한다.",
    tags: ["small_station"],
  },
  {
    // ③ 국내 0편 / 해외 2편. 해외 철도 유튜버가 무인역 시리즈로 먼저 찍은 경우.
    id: "p_station_simcheon", src: "station", ko: "심천역", en: "Simcheon Station",
    sido: "충북", sgg: "영동군", code: "43800", lat: 36.1830, lng: 127.7550, dec: true, rel: "low",
    desc: "1934년 역사가 그대로 남은 무인역. 금강 철교와 함께 잡힌다.",
    tags: ["unmanned_station", "modern_building"],
  },

  // ── 등대 (S3 하단 '다른 대분류' 확장 태그) ────────────
  {
    id: "p_eocheong_light", src: "tourapi", ko: "어청도 등대", en: "Eocheongdo Lighthouse",
    sido: "전북", sgg: "군산시", code: "52130", lat: 36.1170, lng: 125.9800, dec: false, rel: "high",
    desc: "1912년 점등한 서해 최서단 등대. 여객선으로 2시간 30분 걸린다.",
    tags: ["lighthouse", "modern_building"],
  },
  {
    id: "p_ongdo_light", src: "tourapi", ko: "옹도 등대", en: "Ongdo Lighthouse",
    sido: "충남", sgg: "태안군", code: "44825", lat: 36.6480, lng: 126.0620, dec: true, rel: "high",
    desc: "무인도 위 등대. 유람선이 하루 2회 접안한다.",
    tags: ["lighthouse"],
  },

  // ── 염전 · 계단식논 · 돌담 ───────────────────────────
  {
    id: "p_taepyeong_salt", src: "tourapi", ko: "증도 태평염전", en: "Jeungdo Taepyeong Salt Farm",
    sido: "전남", sgg: "신안군", code: "46910", lat: 35.0130, lng: 126.1450, dec: true, rel: "high",
    desc: "국내 최대 단일 염전. 소금 채취는 오후 늦게 이뤄진다.",
    tags: ["salt_farm", "merchant"],
  },
  {
    id: "p_darangyi", src: "tourapi", ko: "남해 가천 다랭이마을", en: "Namhae Gacheon Terraced Village",
    sido: "경남", sgg: "남해군", code: "48840", lat: 34.7160, lng: 127.9020, dec: true, rel: "high",
    desc: "바다까지 계단식으로 이어진 논. 마을 전체가 명승으로 지정되어 있다.",
    tags: ["terraced_field", "stone_wall"],
  },
  {
    id: "p_cheongsando", src: "tourapi", ko: "청산도 구들장논", en: "Cheongsando Gudeuljang Rice Paddies",
    sido: "전남", sgg: "완도군", code: "46890", lat: 34.1740, lng: 126.8790, dec: true, rel: "high",
    desc: "돌을 깔아 물을 가둔 전통 논. 슬로시티로 지정된 섬 안쪽에 있다.",
    tags: ["terraced_field", "stone_wall"],
  },

  // ── ⑦ 계절 태그 off (억새 · 물안개) ──────────────────
  {
    id: "p_mindungsan", src: "tourapi", ko: "민둥산 억새밭", en: "Mindungsan Silver Grass Field",
    sido: "강원", sgg: "정선군", code: "51770", lat: 37.2100, lng: 128.7960, dec: true, rel: "high",
    desc: "정상 일대가 나무 없이 억새로만 덮여 있다. 등산로 입구까지 차로 접근된다.",
    tags: ["silver_grass"],
  },
  {
    id: "p_jusanji", src: "tourapi", ko: "주산지", en: "Jusanji Pond",
    sido: "경북", sgg: "청송군", code: "47750", lat: 36.3930, lng: 129.1900, dec: true, rel: "high",
    desc: "물에 잠긴 왕버들이 서 있는 저수지. 해뜨기 직전에만 물안개가 오른다.",
    tags: ["dawn_fog"],
  },

  // ── ⑤ 표본 부족 검증용 (상위 태그 bath 도 표본 부족) ──
  {
    id: "p_gunsan_bath", src: "tourapi", ko: "군산 옛 목욕탕 골목", en: "Gunsan Old Bathhouse Alley",
    sido: "전북", sgg: "군산시", code: "52130", lat: 35.9830, lng: 126.7160, dec: false, rel: "high",
    desc: "굴뚝이 남은 옛 대중목욕탕과 적산가옥이 한 골목에 섞여 있다.",
    tags: ["old_bathhouse", "modern_building"],
  },
];

const now = "2026-08-02T00:00:00+09:00";

export const FAKE_PLACES: Place[] = ROWS.map((r) => ({
  id: r.id,
  source: r.src,
  source_id: r.id.replace("p_", ""),
  name_ko: r.ko,
  name_en: r.en,
  description_ko: r.desc,
  // 1단계 전까지는 영문 소개글이 없다. 실제로도 영문 DB는 국문보다 훨씬 비어 있을 것이다.
  description_en: "",
  sido: r.sido,
  sigungu: r.sgg,
  sigungu_code: r.code,
  lat: r.lat,
  lng: r.lng,
  is_declining_area: r.dec,
  image_url: null,
  content_type_id: null,
  data_reliability: r.rel,
  created_at: now,
}));

/**
 * 무드 태그는 소개글이 아니라 **영상과 댓글에서** 나온다. [지지 영상/댓글 수]
 *
 * ⚠️ TourAPI 소개글에서 무드를 뽑으면 안 된다. 관광공사 홍보문은 어디를 읽어도
 *    정겹고 아름다워서 30곳 전부에 '인간미'가 붙는다. 그러면 변별력이 0이다.
 *    "the ajumma gave me extra" 같은 댓글만이 그 장소에 '정'을 붙일 근거가 된다.
 *
 * 그래서 영상이 없는 곳에는 무드 태그가 아예 없다. 그건 결함이 아니라 정직한 상태다.
 */
const MOOD_FROM_VIDEOS: Record<string, Array<[code: string, support: number, from: "video" | "comment"]>> = {
  p_jeongseon_market: [["bustling", 22, "video"], ["warmth", 9, "comment"], ["nostalgia", 6, "video"]],
  p_hwagae_market: [["bustling", 14, "video"], ["warmth", 5, "comment"]],
  p_sunchang_market: [["warmth", 3, "comment"], ["unstaged", 2, "video"]],
  p_bonghwa_market: [["unstaged", 2, "video"], ["craft_pride", 1, "comment"]],
  p_guryongpo_market: [["nostalgia", 11, "video"], ["unstaged", 7, "video"]],
  p_samcheonpo_market: [["bustling", 9, "video"], ["warmth", 4, "comment"]],
  p_seoho_market: [["predawn", 6, "video"], ["warmth", 4, "comment"]],
  p_yeongju_dawn: [["predawn", 3, "video"]],
  p_taepyeong_salt: [["craft_pride", 8, "video"], ["sublime", 6, "video"]],
  p_darangyi: [["sublime", 17, "video"], ["quiet", 8, "video"]],
  p_cheongsando: [["quiet", 5, "video"], ["nostalgia", 3, "video"]],
  p_jusanji: [["sublime", 12, "video"], ["quiet", 9, "video"], ["predawn", 7, "video"]],
  p_mindungsan: [["sublime", 7, "video"]],
  p_station_hwabon: [["nostalgia", 8, "video"], ["quiet", 5, "video"]],
  p_station_simcheon: [["nostalgia", 2, "video"], ["desolate", 1, "video"]],
  p_station_imp: [["nostalgia", 4, "video"], ["desolate", 2, "video"]],
  p_school_goheung: [["desolate", 2, "video"]],
  p_school_jeongseon: [["desolate", 1, "video"]],
  p_gunsan_bath: [["nostalgia", 2, "video"]],
  p_bupyeong_market: [["bustling", 28, "video"]],
  p_seomun_market: [["bustling", 19, "video"]],
  p_ganggu_market: [["unstaged", 6, "video"], ["craft_pride", 3, "video"]],
};

export const FAKE_PLACE_TAGS: PlaceTag[] = [
  // 소재 태그 — 소개글·공공데이터에서
  ...ROWS.flatMap((r) =>
    r.tags.map((code, i) => ({
      place_id: r.id,
      tag_id: `t_${code}`,
      // 첫 번째 태그를 대표 태그로 본다. 4단계에서 LLM 이 실제 confidence 를 넣는다.
      confidence: i === 0 ? 0.92 : 0.71,
      method: (r.src === "tourapi" ? "llm" : "rule") as "llm" | "rule",
      evidence: (r.src === "tourapi" ? "overview" : "rule") as "overview" | "rule",
      support: 1,
    })),
  ),
  // 무드 태그 — 영상·댓글에서 역전파
  ...Object.entries(MOOD_FROM_VIDEOS).flatMap(([placeId, moods]) =>
    moods.map(([code, support, from]) => ({
      place_id: placeId,
      tag_id: `t_${code}`,
      // 근거가 쌓일수록 신뢰도가 올라간다. 1~2편짜리는 낮게 잡는다.
      confidence: Math.min(0.95, 0.4 + support * 0.06),
      method: "llm" as const,
      evidence: from,
      support,
    })),
  ),
];

/**
 * S3 카드의 "서울에서 3시간 20분".
 * 원래는 카카오맵 온디맨드 호출로 얻는 값이라 places 테이블 컬럼이 아니다.
 * 0단계에서는 고정값으로 둔다.
 */
export const FAKE_TRAVEL_FROM_SEOUL: Record<string, string> = {
  p_sunchang_market: "3시간 20분",
  p_gokseong_market: "3시간 40분",
  p_muju_market: "2시간 50분",
  p_bonghwa_market: "3시간 10분",
  p_cheongsong_market: "3시간 30분",
  p_jeongseon_market: "2시간 40분",
  p_hwagae_market: "4시간",
  p_ganggu_market: "4시간 10분",
  p_samcheonpo_market: "4시간",
  p_guryongpo_market: "4시간 20분",
  p_bupyeong_market: "4시간 30분",
  p_seomun_market: "3시간 20분",
  p_yeongju_dawn: "2시간 30분",
  p_seoho_market: "4시간",
  p_hwanghak_flea: "20분",
  p_yangnyeong_market: "3시간 20분",
  p_school_goheung: "4시간 40분",
  p_school_uiseong: "3시간",
  p_school_jeongseon: "2시간 50분",
  p_station_imp: "2시간 40분",
  p_station_hwabon: "3시간 10분",
  p_station_simcheon: "2시간 20분",
  p_eocheong_light: "5시간 30분",
  p_ongdo_light: "3시간 30분",
  p_taepyeong_salt: "4시간 20분",
  p_darangyi: "4시간 30분",
  p_cheongsando: "5시간 10분",
  p_mindungsan: "2시간 50분",
  p_jusanji: "3시간 40분",
  p_gunsan_bath: "2시간 40분",
};
