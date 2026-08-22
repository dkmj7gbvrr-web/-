"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { checkDuplicateTasksAction, createTaskAction, type DuplicateMatch } from "@/actions/tasks";
import type { ActionState } from "@/actions/identity";
import { Avatar, Button, Input, Label, Textarea } from "@/components/ui";
import { PriorityScale } from "@/components/PriorityScale";
import { clsx } from "@/lib/clsx";

const initialState: ActionState = {};

export function NewTaskForm({
  groupId,
  members,
}: {
  groupId: string;
  members: { id: string; name: string }[];
}) {
  const action = createTaskAction.bind(null, groupId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "GROUP">("PRIVATE");
  const [importance, setImportance] = useState(3);
  const [urgency, setUrgency] = useState(3);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [isChecking, startCheck] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!title.trim()) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      startCheck(async () => {
        const matches = await checkDuplicateTasksAction(groupId, title);
        setDuplicates(matches);
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, groupId]);

  const visibleDuplicates = title.trim() ? duplicates : [];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="title">タスク名</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 資料のレビュー"
          autoComplete="off"
        />
        {isChecking && (
          <p className="mt-1.5 text-[12px] text-muted">同じタスクがないか確認中…</p>
        )}
        {!isChecking && visibleDuplicates.length > 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-warning/10 p-3">
            <div className="flex -space-x-1.5 pt-0.5">
              {visibleDuplicates.slice(0, 4).map((d) => (
                <Avatar
                  key={d.ownerId}
                  name={d.ownerName}
                  className="h-6 w-6 border-2 border-surface text-[11px]"
                />
              ))}
            </div>
            <p className="text-[13px] text-warning">
              <span className="font-semibold">
                {visibleDuplicates.map((d) => d.ownerName).join("・")}
              </span>
              さんも同じようなタスクに取り組んでいます。重複していないか確認しましょう。
            </p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="description">メモ(任意)</Label>
        <Textarea id="description" name="description" rows={3} placeholder="詳細やメモ" />
      </div>

      <div>
        <Label htmlFor="dueDate">期限(任意)</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>

      <div>
        <Label>重要度</Label>
        <PriorityScale value={importance} onChange={setImportance} />
        <input type="hidden" name="importance" value={importance} />
      </div>

      <div>
        <Label>緊急度</Label>
        <PriorityScale value={urgency} onChange={setUrgency} />
        <input type="hidden" name="urgency" value={urgency} />
      </div>

      <div>
        <Label>公開範囲</Label>
        <div className="flex gap-2">
          <VisibilityOption
            label="自分のみ"
            description="自分だけに表示"
            selected={visibility === "PRIVATE"}
            onSelect={() => setVisibility("PRIVATE")}
          />
          <VisibilityOption
            label="グループ公開"
            description="メンバー全員に表示"
            selected={visibility === "GROUP"}
            onSelect={() => setVisibility("GROUP")}
          />
        </div>
        <input type="hidden" name="visibility" value={visibility} />
      </div>

      {visibility === "GROUP" && members.length > 0 && (
        <div>
          <Label>参加メンバー(任意)</Label>
          <p className="mb-2 text-[11px] text-muted">
            このタスクに一緒に取り組むメンバーを選ぶと、それぞれの完了状況が個別に表示されます。
          </p>
          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[14px] active:bg-black/[.03]"
              >
                <input
                  type="checkbox"
                  name="participantIds"
                  value={m.id}
                  className="h-4 w-4 accent-accent"
                />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {state.error && <p className="text-[13px] font-medium text-danger">{state.error}</p>}

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending ? "追加中…" : "タスクを追加"}
      </Button>
    </form>
  );
}

function VisibilityOption({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "flex-1 rounded-xl border p-3 text-left transition",
        selected ? "border-accent bg-accent/10" : "border-border bg-surface"
      )}
    >
      <p className={clsx("text-[13px] font-semibold", selected && "text-accent")}>
        {label}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{description}</p>
    </button>
  );
}
