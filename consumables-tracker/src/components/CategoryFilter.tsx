import Link from "next/link";
import { clsx } from "@/lib/clsx";

export function CategoryFilter({
  categories,
  active,
}: {
  categories: string[];
  active?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Link
        href="/"
        className={clsx(
          "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
          !active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500",
        )}
      >
        すべて
      </Link>
      {categories.map((category) => (
        <Link
          key={category}
          href={`/?category=${encodeURIComponent(category)}`}
          className={clsx(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
            active === category
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-500",
          )}
        >
          {category}
        </Link>
      ))}
    </div>
  );
}
