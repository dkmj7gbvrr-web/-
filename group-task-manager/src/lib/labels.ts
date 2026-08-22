import type { TaskStatus, TaskVisibility } from "@/types/task";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
};

export const STATUS_TONE: Record<TaskStatus, "default" | "accent" | "success"> = {
  TODO: "default",
  IN_PROGRESS: "accent",
  DONE: "success",
};

export const VISIBILITY_LABEL: Record<TaskVisibility, string> = {
  PRIVATE: "自分のみ",
  GROUP: "グループ公開",
};

export function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export type DueUrgency = "overdue" | "soon" | "normal";

/** 期限までの緊急度。完了済みタスクは色付けしない。 */
export function dueDateUrgency(dueIso: string | null, status: TaskStatus): DueUrgency {
  if (!dueIso || status === "DONE") return "normal";

  const due = new Date(dueIso);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffDays = Math.round((dueDay.getTime() - todayDay.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "normal";
}

export const DUE_URGENCY_CLASS: Record<DueUrgency, string> = {
  overdue: "text-danger font-bold",
  soon: "text-danger font-bold",
  normal: "text-muted",
};

export const DUE_URGENCY_LABEL: Record<DueUrgency, string> = {
  overdue: "期限超過",
  soon: "期限間近",
  normal: "",
};
