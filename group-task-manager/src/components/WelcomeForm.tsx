"use client";

import { useActionState } from "react";
import { startAction, type ActionState } from "@/actions/identity";
import { Button, Card, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export function WelcomeForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(startAction, initialState);

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
