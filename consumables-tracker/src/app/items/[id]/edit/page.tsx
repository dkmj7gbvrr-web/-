import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { updateItemDetails, listCategories, listItemHistory } from "@/actions/items";
import { SUGGESTED_CATEGORIES } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { DeleteItemButton } from "@/components/DeleteItemButton";
import { formatDateTime } from "@/lib/format";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [item, existingCategories, history] = await Promise.all([
    prisma.item.findUnique({ where: { id } }),
    listCategories(),
    listItemHistory(id),
  ]);
  if (!item) notFound();

  const categoryOptions = Array.from(new Set([...SUGGESTED_CATEGORIES, ...existingCategories]));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-slate-400 active:bg-slate-100">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold">品目を編集</h1>
      </header>

      <form action={updateItemDetails} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={item.id} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">品目名</span>
          <input
            type="text"
            name="name"
            required
            maxLength={40}
            defaultValue={item.name}
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">カテゴリ</span>
          <input
            type="text"
            name="category"
            required
            maxLength={20}
            list="category-options"
            defaultValue={item.category}
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
          <datalist id="category-options">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <p className="text-xs text-slate-400">
          残量ステータスは一覧画面のボタンから変更してください。現在: <StatusBadge status={item.status} />
        </p>

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white active:bg-slate-700"
        >
          保存する
        </button>
      </form>

      <DeleteItemButton itemId={item.id} />

      {history.length > 0 && (
        <section className="mt-2 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-600">更新履歴</h2>
          <ul className="flex flex-col gap-1.5">
            {history.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {formatDateTime(entry.createdAt)} ・ {entry.user?.name ?? "不明なユーザー"} が{" "}
                {entry.fromStatus ? "変更" : "登録"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
