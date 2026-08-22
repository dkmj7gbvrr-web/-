import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  backHref,
  right,
}: {
  title: string;
  backHref?: string;
  right?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-lg"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-accent active:bg-black/[.06]"
            aria-label="戻る"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 truncate text-[17px] font-semibold">{title}</h1>
        {right}
      </div>
    </header>
  );
}
