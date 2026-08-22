"use client";

import { useActionState } from "react";
import { confirmStartAction, startAction, type ActionState } from "@/actions/identity";
import { Button, Card, Input, Label } from "@/components/ui";
import { CopyCodeButton } from "@/components/CopyCodeButton";

const initialState: ActionState = {};

export function WelcomeForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(startAction, initialState);

  if (state.success && state.loginCode && state.pendingUserId) {
    const continueAction = confirmStartAction.bind(
      null,
      state.pendingUserId,
      state.redirectTo || redirectTo
    );
    return (
      <Card className="p-5">
        <h2 className="mb-1 text-[15px] font-semibold">あなたのログインコード</h2>
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          別の端末から開いたときや、この端末のデータを消してしまったときに、このコードでもう一度同じアカウントに戻れます。控えておいてください(あとで設定画面からも確認できます)。
        </p>
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-surface-2 p-4">
          <p className="flex-1 text-center text-[19px] font-bold tracking-[0.08em] text-accent">
            {state.loginCode}
          </p>
          <CopyCodeButton code={state.loginCode} />
        </div>
        <form action={continueAction}>
          <Button type="submit" className="w-full">
            控えました。つづける
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <Label htmlFor="name">お名前(グループ内での表示名)</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="例: 田中太郎"
            maxLength={20}
            autoComplete="nickname"
            required
            autoFocus
          />
        </div>
        {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "準備中…" : "はじめる"}
        </Button>
      </form>
    </Card>
  );
}
