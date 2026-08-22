"use client";

import { useTransition } from "react";
import { respondDelegationAction } from "@/actions/delegations";
import { Button, Card } from "@/components/ui";

export function DelegationActions({
  delegationId,
  fromName,
  message,
}: {
  delegationId: string;
  fromName: string;
  message: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-accent/40 bg-accent/5 p-4">
      <p className="text-[14px] font-semibold">{fromName}さんから承認依頼が届いています</p>
      {message && <p className="mt-1 text-[13px] text-muted">「{message}」</p>}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => respondDelegationAction(delegationId, true))}
          className="flex-1"
        >
          承認する
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => startTransition(() => respondDelegationAction(delegationId, false))}
          className="flex-1"
        >
          却下する
        </Button>
      </div>
    </Card>
  );
}
