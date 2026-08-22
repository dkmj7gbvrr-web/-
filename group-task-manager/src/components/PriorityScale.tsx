"use client";

import { clsx } from "@/lib/clsx";

/** 1〜5の5段階を選ぶ入力(重要度・緊急度で共通利用)。 */
export function PriorityScale({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={clsx(
            "flex h-9 w-9 flex-1 items-center justify-center rounded-lg border-2 text-[14px] font-bold transition disabled:opacity-50",
            n <= value
              ? "border-accent bg-accent text-white"
              : "border-border bg-surface text-muted"
          )}
          aria-label={`${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
