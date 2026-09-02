import type { StockStatus } from "@/generated/prisma/enums";

export const STATUS_ORDER: StockStatus[] = ["MANY", "NORMAL", "LOW", "OUT"];

export const STATUS_LABEL: Record<StockStatus, string> = {
  MANY: "多い",
  NORMAL: "普通",
  LOW: "少ない",
  OUT: "切れた",
};

// ステータスが一目でわかることを最優先(緑=多い、黄=少ない、赤=切れた)。
// NORMALは目立たせる必要がないニュートラルな色にしている。
export const STATUS_STYLE: Record<StockStatus, { bg: string; text: string; border: string }> = {
  MANY: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  NORMAL: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
  LOW: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-400" },
  OUT: { bg: "bg-red-100", text: "text-red-800", border: "border-red-400" },
};

export function isShoppingNeeded(status: StockStatus): boolean {
  return status === "LOW" || status === "OUT";
}

export const SUGGESTED_CATEGORIES = ["洗剤", "紙類", "調味料", "日用品", "その他"];
