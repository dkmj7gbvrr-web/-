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
