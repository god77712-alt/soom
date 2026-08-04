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
      ? "border-open/50 bg-open/10 text-open"
      : variant === "explore"
        ? "border-dashed border-hair2 text-ink2 hover:border-ink3"
        : badge.state === "off"
          ? "border-hair text-ink3 hover:border-ink3"
          : "border-hair2 text-ink2 hover:border-ink3";

  const inner = (
    <>
      <span>{tag.name_ko}</span>
      {badge.label && (
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-medium ${
            badge.state === "now" ? "bg-open/20 text-open" : "text-ink3"
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
