/**
 * 0단계용 가짜 태그 체계.
 *
 * ⚠️ 이건 3단계에서 확정할 진짜 태그 체계가 아니다.
 * SPEC 7장: "3단계는 머리로 미리 정하면 100% 틀린다. 반드시 실제 소개글 100건을 보고 정할 것."
 * 여기 있는 건 화면이 도는지 보기 위한 임시 골격이며, 3단계에서 전량 교체된다.
 *
 * 대분류는 SPEC 3장의 20개를 그대로 두고, 세부 태그는 화면 검증에 필요한 만큼만 넣었다.
 */

import type { Tag, TagAxis } from "@/lib/types";

/** 대분류 20개 (SPEC 3장) */
const L1: Array<[code: string, ko: string, en: string]> = [
  ["market", "시장·상권", "Markets"],
  ["ruin", "폐허·근대유산", "Ruins & Modern Heritage"],
  ["transit", "교통·역", "Transit & Stations"],
  ["coast", "바다·해안", "Sea & Coast"],
  ["mountain", "산·계곡", "Mountains & Valleys"],
  ["farm", "논밭·농촌", "Farmland & Countryside"],
  ["temple", "사찰·종교", "Temples & Religion"],
  ["alley", "골목·주거", "Alleys & Neighborhoods"],
  ["nightview", "야경·조명", "Night Views"],
  ["flora", "계절식생", "Seasonal Flora"],
  ["festival", "축제·행사", "Festivals"],
  ["food", "음식·식당", "Food & Diners"],
  ["labor", "노동현장", "People at Work"],
  ["island", "섬", "Islands"],
  ["water", "하천·호수", "Rivers & Lakes"],
  ["bath", "목욕·생활", "Bathhouses & Daily Life"],
  ["craft", "공방·장인", "Crafts & Artisans"],
  ["animal", "동물", "Animals"],
  ["sports", "스포츠·레저", "Sports & Leisure"],
  ["etc", "기타", "Other"],
];

/** 세부 태그. [code, ko, en, parentCode, season_months?] */
const L2: Array<[string, string, string, string, number[]?]> = [
  // 시장·상권 — S3 하단 확장 영역(형제 8개)이 여기서 나온다
  ["oil_market", "오일장", "Five-day market", "market"],
  ["fish_market", "수산시장", "Fish market", "market"],
  ["permanent_market", "상설시장", "Permanent market", "market"],
  ["night_market", "야시장", "Night market", "market", [6, 7, 8, 9]],
  ["dawn_market", "새벽시장", "Dawn market", "market"],
  ["market_alley", "시장골목", "Market alley", "market"],
  ["herb_market", "약령시장", "Herbal medicine market", "market"],
  ["flea_market", "벼룩시장", "Flea market", "market"],
  ["seasonal_market", "제철장터", "Seasonal produce market", "market", [9, 10, 11]],

  // 폐허·근대유산
  ["abandoned_school", "폐교", "Abandoned school", "ruin"],
  ["abandoned_factory", "폐공장", "Abandoned factory", "ruin"],
  ["abandoned_rail", "폐선로", "Abandoned railway", "ruin"],
  ["modern_building", "근대건축", "Colonial-era building", "ruin"],

  // 교통·역
  ["small_station", "간이역", "Small rural station", "transit"],
  ["unmanned_station", "무인역", "Unmanned station", "transit"],

  // 바다·해안
  ["lighthouse", "등대", "Lighthouse", "coast"],
  ["breakwater", "방파제", "Breakwater", "coast"],
  ["salt_farm", "염전", "Salt farm", "coast"],

  // 논밭·농촌 / 골목
  ["terraced_field", "계단식논", "Terraced rice field", "farm"],
  ["stone_wall", "돌담길", "Stone wall lane", "alley"],

  // 계절식생 — 계절 배지 3종(NOW / N월부터 / 상시) 검증용
  ["silver_grass", "억새", "Silver grass field", "flora", [10, 11]],
  ["cherry_blossom", "벚꽃", "Cherry blossom", "flora", [3, 4]],
  ["dawn_fog", "새벽물안개", "Dawn mist", "flora", [10, 11]],
  ["bamboo", "대나무숲", "Bamboo forest", "flora"],

  // 음식 / 노동 / 목욕 / 공방
  ["old_diner", "노포", "Old-school eatery", "food"],
  ["gukbap", "국밥집", "Gukbap house", "food"],
  ["merchant", "상인", "Market vendors", "labor"],
  ["old_bathhouse", "목욕탕", "Old bathhouse", "bath"],
  ["bamboo_craft", "죽공예", "Bamboo craft", "craft"],
];

/**
 * 소재 외 축들.
 *
 * ⚠️ mood(무드·정서)는 TourAPI 소개글에서 뽑지 않는다.
 *    관광공사 홍보문은 어디를 읽어도 정겹고 아름다워서 전부 같은 태그가 붙는다.
 *    무드는 영상 내용과 댓글에서 뽑아 장소로 역전파한다 (PlaceTag.evidence 참고).
 *
 * audience(시청자)는 채널에만 붙고, 그마저도 추정이다.
 *    시청자 연령·국적 통계는 채널 소유자만 볼 수 있다(YouTube Analytics).
 *    우리는 댓글 언어·내용으로 역추정하고 화면에 "추정"이라고 밝힌다.
 */
const OTHER: Array<[axis: Exclude<TagAxis, "subject">, code: string, ko: string, en: string]> = [
  // ── 무드·정서 — 영상/댓글에서만 나온다 ──
  ["mood", "warmth", "인간미·정", "Human warmth"],
  ["mood", "unstaged", "날것 그대로", "Unstaged"],
  ["mood", "nostalgia", "향수·옛날", "Nostalgic"],
  ["mood", "quiet", "고요함", "Quiet"],
  ["mood", "bustling", "활기·북적", "Bustling"],
  ["mood", "desolate", "쓸쓸함", "Desolate"],
  ["mood", "sublime", "압도적 풍경", "Sublime"],
  ["mood", "craft_pride", "장인의 자부심", "Craftsmanship"],

  // ── 시간대 ──
  ["time", "predawn", "동트기 전", "Pre-dawn"],
  ["time", "golden_hour", "황금시간", "Golden hour"],
  ["time", "blue_hour", "해질녘", "Blue hour"],
  ["time", "night", "야간", "Night"],

  // ── 영상 형식 — 영상에만 ──
  ["format", "vlog", "브이로그", "Vlog"],
  ["format", "no_commentary", "무해설", "No commentary"],
  ["format", "documentary", "다큐", "Documentary"],
  ["format", "asmr", "ASMR·환경음", "ASMR"],
  ["format", "interview", "인터뷰", "Interview"],
  ["format", "mukbang", "먹방", "Food eating"],
  ["format", "timelapse", "타임랩스", "Timelapse"],
  ["format", "drone", "드론", "Drone"],

  // ── 화자 성향 — 영상에만 ──
  ["persona", "observer", "관찰자형", "Observer"],
  ["persona", "participant", "참여형", "Participant"],
  ["persona", "explainer", "정보전달형", "Explainer"],
  ["persona", "narrator", "감성 내레이션", "Narrator"],

  // ── 시청자 — 채널에만, 추정값 ──
  ["audience", "aud_en", "영어권", "English-speaking"],
  ["audience", "aud_ja", "일본어권", "Japanese-speaking"],
  ["audience", "aud_sea", "동남아", "Southeast Asia"],
  ["audience", "aud_ko", "국내", "Korean"],
  ["audience", "aud_20s", "20대 중심", "20s"],
  ["audience", "aud_30_40s", "30~40대 중심", "30-40s"],
  ["audience", "aud_50p", "50대 이상", "50+"],
];

export const FAKE_TAGS: Tag[] = [
  ...L1.map(([code, ko, en]) => ({
    id: `t_${code}`,
    code,
    name_ko: ko,
    name_en: en,
    axis: "subject" as const,
    parent_id: null,
    level: 1 as const,
    is_seasonal: false,
    season_months: null,
  })),
  ...L2.map(([code, ko, en, parent, months]) => ({
    id: `t_${code}`,
    code,
    name_ko: ko,
    name_en: en,
    axis: "subject" as const,
    parent_id: `t_${parent}`,
    level: 2 as const,
    is_seasonal: months !== undefined,
    season_months: months ?? null,
  })),
  ...OTHER.map(([axis, code, ko, en]) => ({
    id: `t_${code}`,
    code,
    name_ko: ko,
    name_en: en,
    axis,
    parent_id: null,
    level: 1 as const,
    is_seasonal: false,
    season_months: null,
  })),
];

export const tagsByAxis = (axis: TagAxis): Tag[] => FAKE_TAGS.filter((t) => t.axis === axis);

export const tagByCode = (code: string): Tag => {
  const t = FAKE_TAGS.find((x) => x.code === code);
  if (!t) throw new Error(`알 수 없는 태그 code: ${code}`);
  return t;
};
