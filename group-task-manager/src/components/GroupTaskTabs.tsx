"use client";

import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { TaskList } from "@/components/TaskList";
import type { TaskListItem } from "@/types/task";

export function GroupTaskTabs({
  groupId,
  groupTasks,
  myTasks,
}: {
  groupId: string;
  groupTasks: TaskListItem[];
  myTasks: TaskListItem[];
}) {
  const [tab, setTab] = useState<"group" | "mine">("group");

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-black/[.05] p-1">
        <TabButton active={tab === "group"} onClick={() => setTab("group")}>
          みんなのタスク
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          自分のタスク
        </TabButton>
      </div>

      {tab === "group" ? (
        <TaskList
          tasks={groupTasks}
          groupId={groupId}
          emptyMessage="グループに公開されているタスクはまだありません"
        />
      ) : (
        <TaskList
          tasks={myTasks}
          groupId={groupId}
          emptyMessage="タスクを追加してみましょう"
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-lg py-2 text-[13px] font-semibold transition",
        active ? "bg-surface text-foreground shadow-sm" : "text-muted"
      )}
    >
      {children}
    </button>
  );
}
