import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { WelcomeForm } from "@/components/WelcomeForm";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  const redirectTo = next && next.startsWith("/") ? next : "/groups";

  if (user) redirect(redirectTo);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white shadow-md">
          T
        </div>
        <h1 className="text-2xl font-bold">TaskCircle</h1>
        <p className="mt-1 text-[14px] text-muted">グループでタスクを共有しよう</p>
      </div>

      <WelcomeForm redirectTo={redirectTo} />

      <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
        メールアドレスやパスワードは必要ありません。
        <br />
        入力した名前がグループのメンバーに表示されます。
      </p>

      <p className="mt-4 text-center text-[13px]">
        <Link
          href={`/login?next=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-accent"
        >
          ログインコードをお持ちの方はこちら
        </Link>
      </p>
    </div>
  );
}
