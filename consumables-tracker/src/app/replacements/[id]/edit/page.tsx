import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { updateReplacementItem, listReplacementHistory } from "@/actions/replacementItems";
import { getNextDueDate, getUrgency, getDaysUntilDue, URGENCY_LABEL, URGENCY_STYLE } from "@/lib/replacement";
import { DeleteReplacementItemButton } from "@/components/DeleteReplacementItemButton";
import { formatDate, formatDateTime } from "@/lib/format";
import { clsx } from "@/lib/clsx";

export default async function EditReplacementItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [item, history] = await Promise.all([
    prisma.replacementItem.findUnique({ where: { id } }),
    listReplacementHistory(id),
  ]);
  if (!item) notFound();

  const nextDueAt = getNextDueDate(item.lastReplacedAt, item.intervalDays);
  const urgency = getUrgency(getDaysUntilDue(nextDueAt));
  const style = URGENCY_STYLE[urgency];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link href="/replacements" className="rounded-lg px-2 py-1 text-sm text-slate-400 active:bg-slate-100">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold">定期交換品を編集</h1>
      </header>

      <form action={updateReplacementItem} className="flex flex-col gap-4">
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
          <span className="text-sm font-medium text-slate-600">交換目安(日数)</span>
          <input
            type="number"
            name="intervalDays"
            required
            min={1}
            max={3650}
            defaultValue={item.intervalDays}
            className="rounded-xl border border-slate-300 px-4 py-3 text-base"
          />
        </label>

        <p className="text-xs text-slate-400">
          前回交換日は一覧画面の「交換した」ボタンで更新してください。現在:{" "}
          {formatDate(item.lastReplacedAt)}(次回目安:{" "}
          <span
            className={clsx(
              "inline-flex items-center rounded-full border px-2 py-0.5 font-semibold",
              style.bg,
              style.text,
              style.border,
            )}
          >
            {formatDate(nextDueAt)}・{URGENCY_LABEL[urgency]}
          </span>
          )
        </p>

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white active:bg-slate-700"
        >
          保存する
        </button>
      </form>

      <DeleteReplacementItemButton itemId={item.id} />

      {history.length > 0 && (
        <section className="mt-2 flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-600">交換履歴</h2>
          <ul className="flex flex-col gap-1.5">
            {history.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {formatDateTime(entry.replacedAt)} ・ {entry.user?.name ?? "不明なユーザー"} が交換
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
