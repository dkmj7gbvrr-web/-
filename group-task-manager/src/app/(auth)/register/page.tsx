"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type ActionState } from "@/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white shadow-md">
            T
          </div>
          <h1 className="text-2xl font-bold">アカウント作成</h1>
          <p className="mt-1 text-[14px] text-muted">TaskCircleをはじめよう</p>
        </div>

        <Card className="p-5">
          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="name">名前</Label>
              <Input id="name" name="name" type="text" autoComplete="name" required />
            </div>
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
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="mt-1 text-[12px] text-muted">8文字以上で入力してください</p>
            </div>
            {state.error && (
              <p className="text-[13px] font-medium text-danger">{state.error}</p>
            )}
            <Button type="submit" disabled={isPending} className="mt-1 w-full">
              {isPending ? "登録中…" : "登録してはじめる"}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-[14px] text-muted">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="font-semibold text-accent">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
