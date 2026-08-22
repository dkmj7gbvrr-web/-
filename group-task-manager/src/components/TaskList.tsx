"use client";

import Link from "next/link";
import { Avatar, Badge, Card } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, VISIBILITY_LABEL, formatDueDate } from "@/lib/labels";
import type { TaskListItem } from "@/types/task";

export function TaskList({
  tasks,
  groupId,
  emptyMessage,
}: {
  tasks: TaskListItem[];
  groupId: string;
  emptyMessage: string;
}) {
  if (tasks.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-[14px] text-muted">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tasks.map((task) => (
        <Link key={task.id} href={`/groups/${groupId}/tasks/${task.id}`}>
          <Card className="p-4 active:bg-black/[.03]">
            <div className="flex items-start justify-between gap-2">
              <p
                className={
                  "text-[15px] font-semibold " +
                  (task.status === "DONE" ? "text-muted line-through" : "")
                }
              >
                {task.title}
              </p>
              <Badge tone={STATUS_TONE[task.status]} className="shrink-0">
                {STATUS_LABEL[task.status]}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              <span>{task.ownerName}</span>
              {task.assigneeName && task.assigneeName !== task.ownerName && (
                <>
                  <span>→</span>
                  <span className="font-medium text-accent">{task.assigneeName}</span>
                </>
              )}
              <span>·</span>
              <Badge tone="default">{VISIBILITY_LABEL[task.visibility]}</Badge>
              {task.dueDate && <span>期限 {formatDueDate(task.dueDate)}</span>}
            </div>

            {task.coRunners.length > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5">
                <div className="flex -space-x-1.5">
                  {task.coRunners.slice(0, 4).map((r) => (
                    <Avatar
                      key={r.userId}
                      name={r.userName}
                      className="h-5 w-5 border-2 border-surface text-[10px]"
                    />
                  ))}
                </div>
                <p className="text-[12px] font-medium text-warning">
                  {task.coRunners.map((r) => r.userName).join("・")}も同じタスクを実施中
                </p>
              </div>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
