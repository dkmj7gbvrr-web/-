"use client";

import { useActionState } from "react";
import { createGroupAction, joinGroupAction } from "@/actions/groups";
import type { ActionState } from "@/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export function CreateGroupForm() {
  const [state, formAction, isPending] = useActionState(createGroupAction, initialState);

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-[15px] font-semibold">新しいグループを作る</h2>
      <form action={formAction} className="flex flex-col gap-3">
        <div>
          <Label htmlFor="group-name">グループ名</Label>
          <Input id="group-name" name="name" placeholder="例: 開発チーム" required />
        </div>
        {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "作成中…" : "グループを作成"}
        </Button>
      </form>
    </Card>
  );
}

export function JoinGroupForm() {
  const [state, formAction, isPending] = useActionState(joinGroupAction, initialState);

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-[15px] font-semibold">招待コードで参加する</h2>
      <form action={formAction} className="flex flex-col gap-3">
        <div>
          <Label htmlFor="group-code">6桁の参加コード</Label>
          <Input
            id="group-code"
            name="code"
            placeholder="ABC123"
            maxLength={6}
            className="tracking-[0.3em] text-center uppercase font-semibold"
            required
          />
        </div>
        {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
        <Button type="submit" variant="secondary" disabled={isPending} className="w-full">
          {isPending ? "参加中…" : "参加する"}
        </Button>
      </form>
    </Card>
  );
}
