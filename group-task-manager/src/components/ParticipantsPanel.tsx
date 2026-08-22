"use client";

import { useActionState, useState, useTransition } from "react";
import {
  toggleMyParticipationAction,
  updateParticipantsAction,
} from "@/actions/tasks";
import type { ActionState } from "@/actions/identity";
import { Avatar, Button, Card } from "@/components/ui";
import { clsx } from "@/lib/clsx";

const initialState: ActionState = {};

export function ParticipantsPanel({
  taskId,
  participants,
  allMembers,
  isOwner,
  currentUserId,
}: {
  taskId: string;
  participants: { userId: string; name: string; completed: boolean }[];
  allMembers: { id: string; name: string }[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const doneCount = participants.filter((p) => p.completed).length;

  const action = updateParticipantsAction.bind(null, taskId);
  const [state, formAction, isSaving] = useActionState(action, initialState);

  // 保存が成功したら編集画面を閉じる(レンダー中に反映し、余分な副作用を避ける)
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && editing) setEditing(false);
  }

  if (editing) {
    const selected = new Set(participants.map((p) => p.userId));
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-[15px] font-semibold">参加メンバーを編集</h2>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2 p-2">
            {allMembers.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[14px]"
              >
                <input
                  type="checkbox"
                  name="participantIds"
                  value={m.id}
                  defaultChecked={selected.has(m.id) || m.id === currentUserId}
                  disabled={m.id === currentUserId}
                  className="h-4 w-4 accent-accent"
                />
                {m.name}
                {m.id === currentUserId && (
                  <span className="text-[11px] text-muted">(作成者)</span>
                )}
              </label>
            ))}
          </div>
          {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving} className="flex-1">
              {isSaving ? "保存中…" : "保存する"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} className="flex-1">
              キャンセル
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">
          参加メンバーの進捗
          {participants.length > 0 && (
            <span className="ml-1.5 text-[12.5px] font-normal text-muted">
              ({doneCount}/{participants.length}完了)
            </span>
          )}
        </h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13px] font-semibold text-accent"
          >
            編集
          </button>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">参加メンバーは設定されていません</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {participants.map((p) => {
            const isMe = p.userId === currentUserId;
            return (
              <div
                key={p.userId}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg px-2 py-2",
                  isMe && "bg-accent/5"
                )}
              >
                <Avatar name={p.name} className="h-6 w-6 text-[11px]" />
                <span className="flex-1 text-[14px]">
                  {p.name}
                  {isMe && <span className="ml-1 text-[11px] text-muted">(あなた)</span>}
                </span>
                {isMe ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(() => toggleMyParticipationAction(taskId))}
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[12px] font-bold transition disabled:opacity-50",
                      p.completed
                        ? "border-success bg-success text-white"
                        : "border-border bg-surface text-transparent"
                    )}
                    aria-label={p.completed ? "完了を取り消す" : "完了にする"}
                  >
                    ✓
                  </button>
                ) : (
                  <span
                    className={clsx(
                      "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[12px] font-bold",
                      p.completed
                        ? "border-success bg-success text-white"
                        : "border-border bg-surface text-transparent"
                    )}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
