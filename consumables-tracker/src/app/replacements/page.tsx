import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listReplacementItems } from "@/actions/replacementItems";
import { ReplacementCard } from "@/components/ReplacementCard";

export default async function ReplacementsPage() {
  await requireUser();
  const items = await listReplacementItems();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">定期交換品</h1>
          <p className="text-xs text-slate-400">浄水器カートリッジなど、日数で交換時期を管理します</p>
        </div>
        <Link href="/" className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 active:bg-slate-100">
          消耗品一覧へ
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400">
          まだ登録がありません。右下の「＋」から追加してください。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <ReplacementCard key={item.id} item={item} />
          ))}
        </ul>
      )}

      <Link
        href="/replacements/new"
        className="safe-bottom fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl font-bold text-white shadow-lg active:bg-slate-700"
        aria-label="定期交換品を追加"
      >
        ＋
      </Link>
    </main>
  );
}
