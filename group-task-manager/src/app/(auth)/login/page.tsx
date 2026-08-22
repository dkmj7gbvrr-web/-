"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white shadow-md">
            T
          </div>
          <h1 className="text-2xl font-bold">TaskCircle</h1>
          <p className="mt-1 text-[14px] text-muted">グループでタスクを共有しよう</p>
        </div>

        <Card className="p-5">
          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {state.error && (
              <p className="text-[13px] font-medium text-danger">{state.error}</p>
            )}
            <Button type="submit" disabled={isPending} className="mt-1 w-full">
              {isPending ? "ログイン中…" : "ログイン"}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-[14px] text-muted">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="font-semibold text-accent">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}
