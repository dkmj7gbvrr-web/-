"use client";

import { useActionState } from "react";
import { loginWithCodeAction, type ActionState } from "@/actions/identity";
import { Button, Card, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(loginWithCodeAction, initialState);

  return (
    <Card className="p-5">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <Label htmlFor="code">ログインコード</Label>
          <Input
            id="code"
            name="code"
            type="text"
            placeholder="ABCD-EFGH12"
            maxLength={16}
            autoCapitalize="characters"
            className="text-center tracking-[0.08em] uppercase"
            required
            autoFocus
          />
        </div>
        {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "確認中…" : "ログイン"}
        </Button>
      </form>
    </Card>
  );
}
