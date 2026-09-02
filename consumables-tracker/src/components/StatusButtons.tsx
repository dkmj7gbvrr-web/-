import { setItemStatus } from "@/actions/items";
import { STATUS_ORDER, STATUS_LABEL, STATUS_STYLE } from "@/lib/status";
import { clsx } from "@/lib/clsx";
import type { StockStatus } from "@/generated/prisma/enums";

/** 一覧からワンタップで残量ステータスを変更するボタン列。 */
export function StatusButtons({ itemId, current }: { itemId: string; current: StockStatus }) {
  return (
    <form action={setItemStatus} className="flex gap-1">
      <input type="hidden" name="id" value={itemId} />
      {STATUS_ORDER.map((status) => {
        const active = status === current;
        const style = STATUS_STYLE[status];
        return (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            aria-pressed={active}
            className={clsx(
              "flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition",
              active ? `${style.bg} ${style.text} ${style.border}` : "border-slate-200 bg-white text-slate-400",
            )}
          >
            {STATUS_LABEL[status]}
          </button>
        );
      })}
    </form>
  );
}
