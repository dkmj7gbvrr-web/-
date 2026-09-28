import Link from "next/link";
import { clsx } from "@/lib/clsx";
import type { ReplacementUrgency } from "@/lib/replacement";

type ReplacementSummary = { id: string; name: string; urgency: ReplacementUrgency }[];

/**
 * ホーム画面から定期交換品へ誘導するバナー。何か対応が必要なときだけ
 * 目立つ配色にし、無いときは控えめな導線として常に表示しておく。
 */
export function ReplacementBanner({ items }: { items: ReplacementSummary }) {
  if (items.length === 0) {
    return (
      <Link
        href="/replacements"
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-500 shadow-sm active:bg-slate-100"
      >
        定期交換品を登録する
      </Link>
    );
  }

  const urgent = items.filter((item) => item.urgency !== "OK");

  if (urgent.length === 0) {
    return (
      <Link
        href="/replacements"
        className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-emerald-700 shadow-sm active:bg-emerald-50"
      >
        定期交換品：すべて順調です
      </Link>
    );
  }

  const hasOverdue = urgent.some((item) => item.urgency === "OVERDUE");
  const label = urgent.length === 1 ? urgent[0].name : `${urgent[0].name} 他${urgent.length - 1}件`;

  return (
    <Link
      href="/replacements"
      className={clsx(
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 shadow-sm",
        hasOverdue
          ? "border-red-300 bg-red-50 text-red-800 active:bg-red-100"
          : "border-amber-300 bg-amber-50 text-amber-800 active:bg-amber-100",
      )}
    >
      <span className="truncate text-sm font-bold">交換時期：{label}</span>
      <span
        className={clsx(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white",
          hasOverdue ? "bg-red-600" : "bg-amber-500",
        )}
      >
        {urgent.length}
      </span>
    </Link>
  );
}
