import Link from "next/link";
import { markReplaced } from "@/actions/replacementItems";
import { URGENCY_LABEL, URGENCY_STYLE, getDaysUntilDueLabel } from "@/lib/replacement";
import { formatDate } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { ReplacementUrgency } from "@/lib/replacement";
import type { ReplacementItemModel, UserModel } from "@/generated/prisma/models";

type ReplacementItemWithMeta = ReplacementItemModel & {
  lastUpdatedBy: Pick<UserModel, "id" | "name"> | null;
  nextDueAt: Date;
  daysUntilDue: number;
  urgency: ReplacementUrgency;
};

export function ReplacementCard({ item }: { item: ReplacementItemWithMeta }) {
  const style = URGENCY_STYLE[item.urgency];

  return (
    <li className={clsx("rounded-xl border bg-white p-3 shadow-sm", style.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{item.name}</p>
          <p className="text-xs text-slate-400">{item.intervalDays}日ごと</p>
        </div>
        <Link
          href={`/replacements/${item.id}/edit`}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 active:bg-slate-100"
        >
          編集
        </Link>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={clsx(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            style.bg,
            style.text,
            style.border,
          )}
        >
          {URGENCY_LABEL[item.urgency]}・{getDaysUntilDueLabel(item.daysUntilDue)}
        </span>
        <form action={markReplaced}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white active:bg-slate-700"
          >
            交換した
          </button>
        </form>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        前回交換: {formatDate(item.lastReplacedAt)} ・ 次回目安: {formatDate(item.nextDueAt)}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {item.lastUpdatedBy ? `${item.lastUpdatedBy.name}が記録` : "未記録"}
      </p>
    </li>
  );
}
