"use client";

import { useActionState } from "react";
import { delegateTaskAction } from "@/actions/delegations";
import type { ActionState } from "@/actions/auth";
import { Button, Card, Label, Textarea } from "@/components/ui";

const initialState: ActionState = {};

export function DelegateForm({
  taskId,
  members,
}: {
  taskId: string;
  members: { id: string; name: string }[];
}) {
  const action = delegateTaskAction.bind(null, taskId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (members.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-[15px] font-semibold">メンバーに依頼する</h2>
      <form action={formAction} className="flex flex-col gap-3">
        <div>
          <Label htmlFor="toUserId">依頼先</Label>
          <select
            id="toUserId"
            name="toUserId"
            required
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="message">メッセージ(任意)</Label>
          <Textarea id="message" name="message" rows={2} placeholder="お願いします!" />
        </div>
        {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
        {state.success && (
          <p className="text-[13px] font-medium text-success">依頼を送りました</p>
        )}
        <Button type="submit" variant="secondary" disabled={isPending} className="w-full">
          {isPending ? "送信中…" : "承認依頼を送る"}
        </Button>
      </form>
    </Card>
  );
}
