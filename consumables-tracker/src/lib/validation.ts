import { z } from "zod";

export const STATUS_VALUES = ["MANY", "NORMAL", "LOW", "OUT"] as const;

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "品目名を入力してください").max(40, "40文字以内で入力してください"),
  category: z.string().trim().min(1, "カテゴリを入力してください").max(20, "20文字以内で入力してください"),
  status: z.enum(STATUS_VALUES),
});

export type ItemInput = z.infer<typeof itemInputSchema>;
