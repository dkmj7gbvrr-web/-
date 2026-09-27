import Link from "next/link";
import { requireUser } from "@/lib/session";
import { createReplacementItem } from "@/actions/replacementItems";
import { SUGGESTED_REPLACEMENT_ITEMS } from "@/lib/replacement";
import { toDateInputValue } from "@/lib/format";

export default async function NewReplacementItemPage() {
  await requireUser();
  const today = toDateInputValue(new Date());

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link href="/replacements" className="rounded-lg px-2 py-1 text-sm text-slate-400 active:bg-slate-100">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold">定期交換品を追加</h1>
      </header>

      <form action={createReplacementItem} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">品目名</span>
          <input
            type="text"
            name="name"
            required
            maxLength={40}
            list="replacement-options"
            placeholder="例: 浄水器カートリッジ"
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
          <datalist id="replacement-options">
            {SUGGESTED_REPLACEMENT_ITEMS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">交換目安(日数)</span>
          <input
            type="number"
            name="intervalDays"
            required
            min={1}
            max={3650}
            placeholder="例: 90"
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">前回交換日</span>
          <input
            type="date"
            name="lastReplacedAt"
            required
            defaultValue={today}
            max={today}
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
        </label>

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
