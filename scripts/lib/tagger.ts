/**
 * 4단계 · 소개글 → 태그 추출기.
 *
 * ── 설계에서 중요한 두 가지 ──────────────────────────────
 * ① 태그 목록이 프롬프트의 대부분을 차지한다 (소분류 153종).
 *    장소마다 이 목록을 다시 보내면 4만 건 × 목록 = 대부분의 비용이 목록값이다.
 *    → 목록을 system 앞머리에 고정하고 `cache_control` 을 건다.
 *      캐시 읽기는 원가의 1/10 이라 이것만으로 비용이 몇 배 줄어든다.
 *      ⚠️ 캐시는 **접두사 일치**다. 목록 앞에 날짜·장소명 같은 게 끼면 전부 무효가 된다.
 *
 * ② 소개글에서 뽑아도 되는 축과 안 되는 축이 다르다 (SPEC / types.ts).
 *    subject·time 은 사실이라 뽑아도 된다.
 *    **mood 는 뽑으면 안 된다** — 관광공사 홍보문이라 어디를 읽어도 정겹고 따뜻해서
 *    전부 같은 태그가 붙고 변별력이 0 이 된다. mood 는 5단계 댓글에서 붙인다.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { DatabaseSync } from "node:sqlite";

export const MODEL = "claude-opus-5";

export const client = new Anthropic();

export type TagRow = { code: string; name: string; parent: string | null };

/** 소분류 목록을 "대분류 > 소분류" 형태로 펼친다. LLM 이 계통을 보고 고르게 하려고. */
export function buildTaxonomy(db: DatabaseSync): {
  text: string;
  nameToCode: Map<string, string>;
  codeToName: Map<string, string>;
  parentOf: Map<string, string>;
} {
  const cat2 = new Map<string, string>();
  for (const r of db
    .prepare("select code, name from category_code where level = 2")
    .all() as TagRow[]) {
    cat2.set(r.code, r.name);
  }

  const lines: string[] = [];
  const nameToCode = new Map<string, string>();
  const codeToName = new Map<string, string>();
  const parentOf = new Map<string, string>();
  const grouped = new Map<string, string[]>();

  for (const r of db
    .prepare("select code, name, parent from category_code where level = 3 order by code")
    .all() as TagRow[]) {
    const parentName = cat2.get(r.parent ?? "") ?? "기타";
    (grouped.get(parentName) ?? grouped.set(parentName, []).get(parentName)!).push(r.name);
    nameToCode.set(r.name, r.code);
    codeToName.set(r.code, r.name);
    if (r.parent) parentOf.set(r.code, r.parent);
  }

  for (const [parent, children] of grouped) {
    lines.push(`${parent}: ${children.join(", ")}`);
  }

  return { text: lines.join("\n"), nameToCode, codeToName, parentOf };
}

/** 소개글에서 뽑을 수 있는 시간대·계절 태그. build-tags.ts 의 time 축과 같은 어휘. */
const TIME_TAGS = [
  "일출",
  "일몰·노을",
  "야경",
  "운무·새벽",
  "벚꽃·봄꽃",
  "여름 녹음",
  "단풍",
  "설경",
];

/**
 * ⚠️ 이 문자열은 **바이트 하나라도 바뀌면 캐시가 통째로 날아간다.**
 *    장소별 정보를 절대 여기 끼워 넣지 말 것. 그건 user 메시지로 간다.
 */
export function buildSystem(taxonomy: string): string {
  return `당신은 한국 관광지 소개글을 읽고 분류하는 작업을 한다.

주어진 소개글 하나를 읽고, 아래 목록에서 해당하는 것만 고른다.

## 소재 분류 (한국관광공사 소분류)

${taxonomy}

## 시간대·계절

${TIME_TAGS.join(", ")}

## 규칙

- 소재는 **소개글이 실제로 말하는 것만** 고른다. 1개가 보통이고, 성격이 겹치면 최대 3개.
- 목록에 있는 이름을 **글자 그대로** 쓴다. 목록에 없는 말을 지어내지 않는다.
- 시간대·계절은 소개글에 **사실로 적혀 있을 때만** 고른다.
  ("일출 명소", "가을 단풍이 유명" → 고른다 / 분위기 묘사나 추측 → 고르지 않는다)
- 판단할 근거가 없으면 빈 배열로 둔다. 억지로 채우지 않는다.
- 무드·정서(정겨움, 한적함 등)는 판단하지 않는다. 소개글은 홍보문이라 근거가 되지 못한다.`;
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    subjects: {
      type: "array",
      items: { type: "string" },
      description: "소재 소분류 이름. 목록에 있는 것만. 최대 3개",
    },
    times: {
      type: "array",
      items: { type: "string" },
      description: "시간대·계절 이름. 소개글에 사실로 적힌 것만",
    },
  },
  required: ["subjects", "times"],
  additionalProperties: false,
} as const;

export type TagResult = { subjects: string[]; times: string[] };

/**
 * 한 건 태깅.
 *
 * system 은 캐시 대상이라 매번 같은 문자열이어야 한다.
 * 장소 정보는 전부 user 메시지에 넣는다 (캐시 경계 뒤).
 */
export async function tagOne(
  system: string,
  name: string,
  overview: string,
): Promise<{ result: TagResult | null; usage: Anthropic.Usage }> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    // 분류 작업이라 깊게 생각할 게 없다. 낮은 effort 로 비용과 지연을 줄인다.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `장소명: ${name}\n\n소개글:\n${overview.slice(0, 4000)}`,
      },
    ],
  });

  // 안전 확인을 먼저 한다. 거부되면 content 가 비어 있어 인덱싱이 깨진다.
  if (res.stop_reason === "refusal") return { result: null, usage: res.usage };

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return { result: null, usage: res.usage };

  try {
    return { result: JSON.parse(block.text) as TagResult, usage: res.usage };
  } catch {
    return { result: null, usage: res.usage };
  }
}
