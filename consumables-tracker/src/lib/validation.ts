import { z } from "zod";

export const STATUS_VALUES = ["MANY", "NORMAL", "LOW", "OUT"] as const;

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "品目名を入力してください").max(40, "40文字以内で入力してください"),
  category: z.string().trim().min(1, "カテゴリを入力してください").max(20, "20文字以内で入力してください"),
  status: z.enum(STATUS_VALUES),
});

export type ItemInput = z.infer<typeof itemInputSchema>;

export const replacementItemInputSchema = z.object({
  name: z.string().trim().min(1, "品目名を入力してください").max(40, "40文字以内で入力してください"),
  intervalDays: z.coerce
    .number({ message: "日数を入力してください" })
    .int("日数は整数で入力してください")
    .min(1, "1日以上を入力してください")
    .max(3650, "3650日以内で入力してください"),
  lastReplacedAt: z
    .string()
    .min(1, "前回交換日を入力してください")
    .refine((value) => !Number.isNaN(Date.parse(value)), "日付の形式が正しくありません"),
});

export type ReplacementItemInput = z.infer<typeof replacementItemInputSchema>;
