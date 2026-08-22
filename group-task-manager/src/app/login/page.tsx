import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
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
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-1 text-[14px] text-muted">
          はじめて名前を登録したときに発行された
          <br />
          10桁のログインコードを入力してください
        </p>
      </div>

      <LoginForm redirectTo={redirectTo} />

      <p className="mt-5 text-center text-[13px]">
        <Link href={`/welcome?next=${encodeURIComponent(redirectTo)}`} className="font-semibold text-accent">
          コードをお持ちでない方はこちら
        </Link>
      </p>
    </div>
  );
}
