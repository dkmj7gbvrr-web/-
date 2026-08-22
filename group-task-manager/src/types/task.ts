export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskVisibility = "PRIVATE" | "GROUP";

export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  visibility: TaskVisibility;
  dueDate: string | null;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  coRunners: { userId: string; userName: string }[];
  participantProgress: { total: number; done: number } | null;
  importance: number;
  urgency: number;
}
