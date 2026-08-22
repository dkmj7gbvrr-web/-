import { z } from "zod";

export const displayNameSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(20, "名前は20文字以内で入力してください"),
});

export const loginCodeSchema = z.object({
  code: z.string().length(10, "10桁のログインコードを入力してください"),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "グループ名を入力してください").max(50),
});

export const joinGroupSchema = z.object({
  code: z.string().trim().toUpperCase().length(6, "コードは6文字です"),
});

export const taskVisibilityValues = ["PRIVATE", "GROUP"] as const;
export const taskStatusValues = ["TODO", "IN_PROGRESS", "DONE"] as const;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "タスク名を入力してください").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  visibility: z.enum(taskVisibilityValues),
  dueDate: z.string().optional().or(z.literal("")),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatusValues),
});

export const delegateTaskSchema = z.object({
  toUserId: z.string().min(1, "依頼先のメンバーを選択してください"),
  message: z.string().trim().max(500).optional().or(z.literal("")),
});
