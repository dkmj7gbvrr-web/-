import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(50),
  email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "グループ名を入力してください").max(50),
});

export const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, "コードは6文字です"),
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

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(50),
  teamsWebhookUrl: z
    .string()
    .trim()
    .url("Webhook URLの形式が正しくありません")
    .optional()
    .or(z.literal("")),
});
