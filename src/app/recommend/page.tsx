/**
 * 옛 S3 경로. 홈 플로우에 흡수됐다.
 *
 * 게스트(채널 없이 소재만 고른 경우)는 guest=1 로, 채널이 있으면 ?q= 로 넘긴다.
 */

import { redirect } from "next/navigation";
import { getChannel } from "@/lib/repo";

export default async function RecommendRedirect({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; tag?: string }>;
}) {
  const { channel: channelId = "", tag } = await searchParams;
  const channel = await getChannel(channelId);

  if (!channel) redirect("/");
  if (channel.id === "guest") {
    redirect(tag ? `/?guest=1&tag=${tag}#result` : "/start");
  }
  redirect(
    `/?q=${encodeURIComponent(channel.title)}${tag ? `&tag=${tag}` : ""}#result`,
  );
}
