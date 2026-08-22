"use client";

import { useState, useTransition } from "react";
import { respondDelegationAction } from "@/actions/delegations";
import { Button, Card, Label, Textarea } from "@/components/ui";

export function DelegationActions({
  delegationId,
  fromName,
  message,
  attachment,
}: {
  delegationId: string;
  fromName: string;
  message: string | null;
  attachment: { id: string; filename: string } | null;
}) {
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-accent/40 bg-accent/5 p-4">
      <p className="text-[14px] font-semibold">{fromName}さんから承認依頼が届いています</p>
      {message && <p className="mt-1 text-[13px] text-muted">「{message}」</p>}
      {attachment && (
        <a
          href={`/api/attachments/${attachment.id}`}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent"
        >
          📎 {attachment.filename}
        </a>
      )}
      <div className="mt-3">
        <Label htmlFor={`comment-${delegationId}`}>コメント(任意)</Label>
        <Textarea
          id={`comment-${delegationId}`}
          rows={2}
          placeholder="承認・却下の理由など"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => respondDelegationAction(delegationId, true, comment))}
          className="flex-1"
        >
          承認する
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => startTransition(() => respondDelegationAction(delegationId, false, comment))}
          className="flex-1"
        >
          却下する
        </Button>
      </div>
    </Card>
  );
}
