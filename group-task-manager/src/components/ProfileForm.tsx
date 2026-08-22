"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/actions/profile";
import type { ActionState } from "@/actions/auth";
import { Button, Input, Label } from "@/components/ui";

const initialState: ActionState = {};

export function ProfileForm({
  name,
  teamsWebhookUrl,
}: {
  name: string;
  teamsWebhookUrl: string;
}) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">名前</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div>
        <Label htmlFor="teamsWebhookUrl">Teams Webhook URL</Label>
        <Input
          id="teamsWebhookUrl"
          name="teamsWebhookUrl"
          type="url"
          placeholder="https://xxxx.webhook.office.com/..."
          defaultValue={teamsWebhookUrl}
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          設定すると、タスクの承認依頼が届いたときにMicrosoft
          Teamsにも通知されます。Teamsのチャンネルで「ワークフロー」→「Webhook要求を受信したときに投稿する」を追加し、発行されたURLを貼り付けてください。
        </p>
      </div>
      {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
      {state.success && (
        <p className="text-[13px] font-medium text-success">保存しました</p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "保存中…" : "保存する"}
      </Button>
    </form>
  );
}
