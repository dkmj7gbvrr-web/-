import Link from "next/link";
import { StatusButtons } from "@/components/StatusButtons";
import { formatDateTime } from "@/lib/format";
import type { ItemModel, UserModel } from "@/generated/prisma/models";

type ItemWithUpdater = ItemModel & { lastUpdatedBy: Pick<UserModel, "id" | "name"> | null };

export function ItemCard({ item }: { item: ItemWithUpdater }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{item.name}</p>
          <p className="text-xs text-slate-400">{item.category}</p>
        </div>
        <Link
          href={`/items/${item.id}/edit`}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 active:bg-slate-100"
        >
          編集
        </Link>
      </div>

      <div className="mt-2">
        <StatusButtons itemId={item.id} current={item.status} />
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {item.lastUpdatedBy ? `${item.lastUpdatedBy.name}が更新` : "未更新"} ・{" "}
        {formatDateTime(item.updatedAt)}
      </p>
    </li>
  );
}
