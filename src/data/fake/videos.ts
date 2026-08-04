/**
 * 0단계용 가짜 채널·영상.
 *
 * youtube_id 를 실제 영상 ID 로 채우지 않았다. 가짜 조회수를 실존 크리에이터 영상에
 * 붙여 놓으면 화면을 캡처했을 때 그대로 오해를 만든다.
 * "DEMO_" 로 시작하는 ID 는 화면에서 임베드 대신 자리표시 박스로 그린다.
 * 7단계에서 진짜 ID 로 교체되면 자동으로 임베드가 붙는다.
 */

import type { Channel, Video, VideoPlace } from "@/lib/types";
import type { ChannelProfile } from "@/lib/viewmodels";

export const FAKE_CHANNELS: Channel[] = [
  // 데모 주인공. SPEC S2 예시와 같은 규모(구독자 2.1만 · English)
  { id: "ch_wander", youtube_channel_id: "UCdemo_wander", title: "Wander Korea", subscriber_count: 21_000, sub_band: 2, language: "en" },
  { id: "ch_ddeona", youtube_channel_id: "UCdemo_ddeona", title: "떠나요 브이로그", subscriber_count: 48_000, sub_band: 2, language: "ko" },

  // 아래는 근거 영상(S4 ①②)의 소유 채널
  { id: "ch_slowtrip", youtube_channel_id: "UCdemo_slowtrip", title: "Slow Trip Korea", subscriber_count: 12_000, sub_band: 2, language: "en" },
  { id: "ch_seoulbites", youtube_channel_id: "UCdemo_seoulbites", title: "Seoul Bites", subscriber_count: 80_000, sub_band: 2, language: "en" },
  { id: "ch_offbeat", youtube_channel_id: "UCdemo_offbeat", title: "Offbeat Korea", subscriber_count: 30_000, sub_band: 2, language: "en" },
  { id: "ch_hidden", youtube_channel_id: "UCdemo_hidden", title: "Hidden Korea", subscriber_count: 22_000, sub_band: 2, language: "en" },
  // 구독자 1,000 미만. SPEC 3장에 따라 점수 계산에서는 제외되지만,
  // S4 ②("여긴 비어 있다")에서는 실제로 존재하는 영상이므로 화면에는 보여준다.
  { id: "ch_tiny", youtube_channel_id: "UCdemo_tiny", title: "tiny traveler", subscriber_count: 500, sub_band: 1, language: "en" },
];

/**
 * 채널 프로필.
 *
 * 소재만 뽑으면 "당신은 시장을 찍는군요"로 끝난다 — 크리에이터가 이미 아는 사실이다.
 * 형식·성향·무드·시청자까지 맞춰야 "내 채널을 봤구나" 소리가 나온다.
 *
 * ⚠️ audience 는 추정이다. 시청자 연령·국적 통계는 채널 소유자만 볼 수 있어서
 *    (YouTube Analytics) 우리는 댓글 언어와 영상 언어로 역추정한다. 화면에 그렇게 밝힌다.
 */
export const FAKE_CHANNEL_PROFILES: ChannelProfile[] = [
  {
    channel_id: "ch_wander",
    analyzed_count: 50,
    top_performer_count: 12,
    // 강한 순서. 첫 번째(오일장)가 S3 추천 5곳의 기준 태그가 된다.
    tag_ids: ["t_oil_market", "t_old_diner", "t_small_station"],
    axes: {
      subject: ["t_oil_market", "t_old_diner", "t_small_station"],
      mood: ["t_warmth", "t_unstaged", "t_nostalgia"],
      format: ["t_vlog", "t_no_commentary", "t_interview"],
      persona: ["t_observer", "t_participant"],
      audience: ["t_aud_en", "t_aud_30_40s"],
    },
  },
  {
    channel_id: "ch_ddeona",
    analyzed_count: 50,
    top_performer_count: 9,
    tag_ids: ["t_fish_market", "t_gukbap", "t_dawn_market"],
    axes: {
      subject: ["t_fish_market", "t_gukbap", "t_dawn_market"],
      mood: ["t_bustling", "t_unstaged"],
      format: ["t_vlog", "t_mukbang"],
      persona: ["t_participant", "t_explainer"],
      audience: ["t_aud_ko", "t_aud_20s"],
    },
  },
];

export const FAKE_VIDEOS: Video[] = [
  // ── S4 ① "이 소재는 먹힌다" — 오일장 소재 en 상위 3편 ──
  {
    id: "v_jeongseon_en", youtube_id: "DEMO_jeongseon_en", channel_id: "ch_slowtrip",
    title: "The Korean market tourists never find", description: "Jeongseon five-day market, 5AM.",
    published_at: "2025-11-08", view_count: 410_000, language: "en", duration: 842,
  },
  {
    id: "v_hwagae_en", youtube_id: "DEMO_hwagae_en", channel_id: "ch_seoulbites",
    title: "I ate everything at a 100-year-old Korean market", description: "Hwagae market, Hadong.",
    published_at: "2026-04-19", view_count: 620_000, language: "en", duration: 1_015,
  },
  {
    id: "v_bonghwa_en", youtube_id: "DEMO_bonghwa_en", channel_id: "ch_offbeat",
    title: "Nobody films this Korean mountain market", description: "Bonghwa, Gyeongbuk.",
    published_at: "2025-06-02", view_count: 190_000, language: "en", duration: 736,
  },

  // ── S4 ② "그런데 여긴 비어 있다" — 순창 오일장 en 전체 2편 ──
  {
    // 3년 이내 경계선(2023-08-02) 안쪽. 구독자 500이라 점수 계산에서는 빠진다.
    id: "v_sunchang_old", youtube_id: "DEMO_sunchang_old", channel_id: "ch_tiny",
    title: "a quiet market day in Sunchang", description: "",
    published_at: "2023-09-14", view_count: 12_000, language: "en", duration: 421,
  },
  {
    // 제목에 순창이 없다. 댓글에서 지명이 확인된 케이스 (SPEC 8장의 핵심 사례)
    id: "v_sunchang_mention", youtube_id: "DEMO_sunchang_mention", channel_id: "ch_hidden",
    title: "Korea's countryside is nothing like Seoul", description: "Jeonbuk road trip.",
    published_at: "2026-03-05", view_count: 90_200, language: "en", duration: 1_248,
  },

  // ── weight 0.5(설명란) 케이스 확인용 ko 영상 ──
  {
    id: "v_sunchang_ko", youtube_id: "DEMO_sunchang_ko", channel_id: "ch_ddeona",
    title: "전북 5일장 3곳 털었습니다", description: "00:00 순창 / 08:12 남원 / 15:40 임실",
    published_at: "2026-05-21", view_count: 57_600, language: "ko", duration: 1_402,
  },
];

/**
 * SPEC 3장 가중치 규칙.
 *   제목에 장소명           1.0
 *   설명란 / 타임스탬프     0.5
 *   단순 언급 / 댓글        0.2  (+ 댓글 보너스 0.3, 최대 1.0)
 *
 * 여행 브이로그 한 편에 장소가 5~6곳 나온다. 전부에게 조회수를 100% 주면
 * 스쳐 지나간 곳이 대박 명소로 둔갑한다.
 */
export const FAKE_VIDEO_PLACES: VideoPlace[] = [
  { video_id: "v_jeongseon_en", place_id: "p_jeongseon_market", weight: 1.0, evidence: "title", comment_bonus: false },
  { video_id: "v_hwagae_en", place_id: "p_hwagae_market", weight: 1.0, evidence: "title", comment_bonus: false },
  { video_id: "v_bonghwa_en", place_id: "p_bonghwa_market", weight: 1.0, evidence: "title", comment_bonus: false },
  { video_id: "v_sunchang_old", place_id: "p_sunchang_market", weight: 1.0, evidence: "title", comment_bonus: false },
  // 0.2(댓글) + 0.3(보너스) = 0.5. "여기 어디예요" 질문이 3건 이상 달렸다는 뜻.
  { video_id: "v_sunchang_mention", place_id: "p_sunchang_market", weight: 0.5, evidence: "comment", comment_bonus: true },
  { video_id: "v_sunchang_ko", place_id: "p_sunchang_market", weight: 0.5, evidence: "timestamp", comment_bonus: false },
];
