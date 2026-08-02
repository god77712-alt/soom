"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GUEST_CHANNEL } from "@/lib/repo";
import type { Tag } from "@/lib/types";

/** 채널 URL 없이 들어온 사용자용. 태그 3개까지 고르고 첫 번째 태그로 추천을 시작한다. */
export function GuestTagPicker({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = picked.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                on
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              {t.name_ko}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() =>
            router.push(`/recommend?channel=${GUEST_CHANNEL.id}&tag=${picked[0]}`)
          }
          className="rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition enabled:hover:bg-white disabled:opacity-30"
        >
          이 소재로 찾아보기
        </button>
        <span className="text-xs text-neutral-600">{picked.length}/3 선택</span>
      </div>
    </div>
  );
}
