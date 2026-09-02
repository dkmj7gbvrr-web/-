import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { selectUser } from "@/actions/identity";
import { redirect } from "next/navigation";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await getCurrentUser();
  if (me) redirect("/");

  const { error } = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">消耗品トラッカー</h1>
        <p className="mt-2 text-sm text-slate-500">
          あなたの名前を選んでください。次回からは同じ端末なら自動的に覚えています。
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {users.length > 0 && (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <form key={user.id} action={selectUser}>
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-base font-medium shadow-sm active:bg-slate-100"
              >
                {user.name}
              </button>
            </form>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {users.length > 0 ? "または新しい名前で始める" : "名前を入力して始める"}
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={selectUser} className="flex flex-col gap-3">
        <input
          type="text"
          name="name"
          placeholder="例: たろう"
          maxLength={20}
          required
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white active:bg-slate-700"
        >
          はじめる
        </button>
      </form>
    </main>
  );
}
