"use client";

import { useActionState } from "react";
import { renameAction, type ActionState } from "@/actions/identity";
import { Button, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export function RenameForm({ name }: { name: string }) {
  const [state, formAction, isPending] = useActionState(renameAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="name">グループ内での表示名</Label>
        <Input id="name" name="name" defaultValue={name} maxLength={20} required />
      </div>
      {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
      {state.success && <p className="text-[13px] font-medium text-success">保存しました</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "保存中…" : "保存する"}
      </Button>
    </form>
  );
}
