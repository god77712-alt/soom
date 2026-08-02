import Link from "next/link";
import { seasonBadge } from "@/lib/display";
import type { Tag } from "@/lib/types";

/**
 * 태그 칩. 계절 태그는 배지가 붙는다.
 *
 * SPEC S3: 계절 태그를 숨기지 않는다. 크리에이터는 미리 준비하는 사람들이다.
 *   지금 시즌   → 강조색 + NOW
 *   시즌 아님   → 흐린색 + "10월부터"
 */
export function TagChip({
  tag,
  href,
  now,
  variant = "default",
}: {
  tag: Tag;
  href?: string;
  now?: Date;
  /** explore = 전혀 다른 대분류에서 섞어 넣은 탐색용 태그 */
  variant?: "default" | "active" | "explore";
}) {
  const badge = seasonBadge(tag, now ?? new Date());

  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition";
  const style =
    variant === "active"
      ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
      : variant === "explore"
        ? "border-dashed border-neutral-700 text-neutral-400 hover:border-neutral-500"
        : badge.state === "off"
          ? "border-neutral-800 text-neutral-500 hover:border-neutral-600"
          : "border-neutral-700 text-neutral-300 hover:border-neutral-500";

  const inner = (
    <>
      <span>{tag.name_ko}</span>
      {badge.label && (
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-medium ${
            badge.state === "now" ? "bg-amber-400/20 text-amber-200" : "text-neutral-600"
          }`}
        >
          {badge.label}
        </span>
      )}
    </>
  );

  if (!href) return <span className={`${base} ${style}`}>{inner}</span>;
  return (
    <Link href={href} className={`${base} ${style}`}>
      {inner}
    </Link>
  );
}
