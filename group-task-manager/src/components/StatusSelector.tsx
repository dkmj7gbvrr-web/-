"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/actions/tasks";
import { STATUS_LABEL } from "@/lib/labels";
import { clsx } from "@/lib/clsx";
import type { TaskStatus } from "@/types/task";

const OPTIONS: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export function StatusSelector({
  taskId,
  status,
  editable,
}: {
  taskId: string;
  status: TaskStatus;
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!editable) {
    return null;
  }

  return (
    <div className="flex gap-1.5 rounded-xl bg-black/[.05] p-1">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => updateTaskStatusAction(taskId, option))}
          className={clsx(
            "flex-1 rounded-lg py-2 text-[13px] font-semibold transition disabled:opacity-50",
            status === option ? "bg-surface text-accent shadow-sm" : "text-muted"
          )}
        >
          {STATUS_LABEL[option]}
        </button>
      ))}
    </div>
  );
}
