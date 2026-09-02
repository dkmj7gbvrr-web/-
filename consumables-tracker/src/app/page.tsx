import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listItems, listCategories } from "@/actions/items";
import { switchUser } from "@/actions/identity";
import { isShoppingNeeded } from "@/lib/status";
import { ItemCard } from "@/components/ItemCard";
import { ShoppingList } from "@/components/ShoppingList";
import { CategoryFilter } from "@/components/CategoryFilter";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const me = await requireUser();
  const { category } = await searchParams;

  const [items, categories] = await Promise.all([listItems(), listCategories()]);

  const shoppingItems = items.filter((item) => isShoppingNeeded(item.status));
  const visibleItems = category ? items.filter((item) => item.category === category) : items;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">消耗品トラッカー</h1>
          <p className="text-xs text-slate-400">{me.name}としてログイン中</p>
        </div>
        <form action={switchUser}>
          <button type="submit" className="rounded-lg px-2 py-1 text-xs text-slate-400 active:bg-slate-100">
            人を切り替える
          </button>
        </form>
      </header>

      <ShoppingList items={shoppingItems} />

      <CategoryFilter categories={categories} active={category} />

      {visibleItems.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400">
          まだ品目がありません。右下の「＋」から追加してください。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </ul>
      )}

      <Link
        href="/items/new"
        className="safe-bottom fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl font-bold text-white shadow-lg active:bg-slate-700"
        aria-label="品目を追加"
      >
        ＋
      </Link>
    </main>
  );
}
