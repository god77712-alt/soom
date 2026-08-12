import Link from "next/link";
import { getStrings } from "@/lib/i18n";

const S = getStrings("ko");

/**
 * 문서형 페이지 껍데기 (방침·약관·데이터 출처).
 *
 * 추천 화면과 달리 여기는 **읽으라고 만든 페이지**다.
 * 그래서 문구 원칙("설명 문장 금지")이 적용되지 않는 유일한 구역이다.
 */
export function DocPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 font-mono text-[11px] text-ink3">최종 갱신 {updated}</p>

        <div className="mt-10 space-y-9 text-[13px] leading-relaxed text-ink2">{children}</div>

        <div className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-hair pt-6 font-mono text-[11px] text-ink3">
          <Link href="/" className="transition-colors hover:text-ink2">
            ← {S.appName}
          </Link>
          <Link href="/data-sources" className="transition-colors hover:text-ink2">
            데이터 출처
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-ink2">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink2">
            이용약관
          </Link>
        </div>
      </div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] font-bold text-ink">{title}</h2>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink3" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-open underline decoration-open-d/50 underline-offset-2 transition-colors hover:decoration-open"
    >
      {children}
    </a>
  );
}
