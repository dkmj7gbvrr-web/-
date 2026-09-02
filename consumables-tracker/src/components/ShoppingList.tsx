import { setItemStatus } from "@/actions/items";
import { StatusBadge } from "@/components/StatusBadge";
import type { ItemModel } from "@/generated/prisma/models";

/**
 * 残量が LOW / OUT の品目を自動的に表示する買い物リスト。
 * 独立したテーブルは持たず、Itemのstatusから毎回導出している。
 */
export function ShoppingList({ items }: { items: ItemModel[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <h2 className="text-sm font-bold text-amber-900">買い物リスト（{items.length}）</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{item.name}</span>
              <StatusBadge status={item.status} />
            </div>
            <form action={setItemStatus}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value="MANY" />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-emerald-700"
              >
                買った
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
