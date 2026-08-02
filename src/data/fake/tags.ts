/**
 * 0단계용 가짜 태그 체계.
 *
 * ⚠️ 이건 3단계에서 확정할 진짜 태그 체계가 아니다.
 * SPEC 7장: "3단계는 머리로 미리 정하면 100% 틀린다. 반드시 실제 소개글 100건을 보고 정할 것."
 * 여기 있는 건 화면이 도는지 보기 위한 임시 골격이며, 3단계에서 전량 교체된다.
 *
 * 대분류는 SPEC 3장의 20개를 그대로 두고, 세부 태그는 화면 검증에 필요한 만큼만 넣었다.
 */

import type { Tag } from "@/lib/types";

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

export const FAKE_TAGS: Tag[] = [
  ...L1.map(([code, ko, en]) => ({
    id: `t_${code}`,
    code,
    name_ko: ko,
    name_en: en,
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
    parent_id: `t_${parent}`,
    level: 2 as const,
    is_seasonal: months !== undefined,
    season_months: months ?? null,
  })),
];

export const tagByCode = (code: string): Tag => {
  const t = FAKE_TAGS.find((x) => x.code === code);
  if (!t) throw new Error(`알 수 없는 태그 code: ${code}`);
  return t;
};
