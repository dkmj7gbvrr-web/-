import { requireUser } from "@/lib/session";
import { createItem, listCategories } from "@/actions/items";
import { STATUS_ORDER, STATUS_LABEL, SUGGESTED_CATEGORIES } from "@/lib/status";
import Link from "next/link";

export default async function NewItemPage() {
  await requireUser();
  const existingCategories = await listCategories();
  const categoryOptions = Array.from(new Set([...SUGGESTED_CATEGORIES, ...existingCategories]));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-slate-400 active:bg-slate-100">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold">品目を追加</h1>
      </header>

      <form action={createItem} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">品目名</span>
          <input
            type="text"
            name="name"
            required
            maxLength={40}
            placeholder="例: 食器用洗剤"
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
            placeholder="例: 洗剤"
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
          <datalist id="category-options">
            {categoryOptions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium text-slate-600">残量</legend>
          <div className="grid grid-cols-4 gap-2">
            {STATUS_ORDER.map((status, index) => (
              <label
                key={status}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-slate-200 px-2 py-3 text-center text-xs font-semibold has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white"
              >
                <input
                  type="radio"
                  name="status"
                  value={status}
                  defaultChecked={index === 1}
                  className="sr-only"
                />
                {STATUS_LABEL[status]}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white active:bg-slate-700"
        >
          追加する
        </button>
      </form>
    </main>
  );
}
