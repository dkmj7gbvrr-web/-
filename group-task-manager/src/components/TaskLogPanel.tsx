"use client";

import { useActionState, useEffect, useRef } from "react";
import { addLogEntryAction } from "@/actions/tasks";
import type { ActionState } from "@/actions/identity";
import { Button, Card, Textarea } from "@/components/ui";
import { clsx } from "@/lib/clsx";

const initialState: ActionState = {};

function formatLogDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskLogPanel({
  taskId,
  editable,
  entries,
}: {
  taskId: string;
  editable: boolean;
  entries: { id: string; content: string; createdAt: string; authorName: string }[];
}) {
  const action = addLogEntryAction.bind(null, taskId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const lastState = useRef<ActionState>(initialState);

  useEffect(() => {
    if (state !== lastState.current && state.success) {
      formRef.current?.reset();
    }
    lastState.current = state;
  }, [state]);

  return (
    <div>
      <p className="mb-2 px-1 text-[13px] font-medium text-muted">進捗メモ</p>
      <Card className="p-4">
        {editable && (
          <form ref={formRef} action={formAction} className="flex flex-col gap-2">
            <Textarea
              name="content"
              rows={3}
              placeholder="例: 今日は〇〇までやった。いつまでに△△をやる"
            />
            {state.error && (
              <p className="text-[12.5px] font-medium text-danger">{state.error}</p>
            )}
            <Button type="submit" disabled={isPending} className="self-end px-4">
              {isPending ? "追加中…" : "メモを追加"}
            </Button>
          </form>
        )}

        {entries.length === 0 && !editable && (
          <p className="text-[13px] text-muted">まだメモはありません</p>
        )}

        {entries.length > 0 && (
          <div className={clsx("flex flex-col gap-3", editable && "mt-4 border-t border-border pt-4")}>
            {entries.map((e) => (
              <div key={e.id} className="text-[13px]">
                <p className="font-semibold text-muted">
                  {formatLogDate(e.createdAt)} · {e.authorName}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{e.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
