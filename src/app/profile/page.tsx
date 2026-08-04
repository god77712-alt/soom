/**
 * 옛 S2 경로. 홈 플로우에 흡수됐다.
 *
 * 흐름이 두 갈래로 갈리면 어디를 고쳐야 하는지 알 수 없게 된다.
 * 공유된 링크나 북마크가 살아 있을 수 있으니 지우지 않고 홈으로 넘긴다.
 */

import { redirect } from "next/navigation";

export default async function ProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  redirect(q ? `/?q=${encodeURIComponent(q)}` : "/");
}
