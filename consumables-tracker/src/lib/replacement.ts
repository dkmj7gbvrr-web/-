export type ReplacementUrgency = "OVERDUE" | "SOON" | "OK";

const SOON_THRESHOLD_DAYS = 7;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getNextDueDate(lastReplacedAt: Date, intervalDays: number): Date {
  const due = startOfDay(lastReplacedAt);
  due.setDate(due.getDate() + intervalDays);
  return due;
}

/** 次回交換日までの残り日数(マイナスなら期限切れ)。 */
export function getDaysUntilDue(nextDueAt: Date, now: Date = new Date()): number {
  const diffMs = startOfDay(nextDueAt).getTime() - startOfDay(now).getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function getUrgency(daysUntilDue: number): ReplacementUrgency {
  if (daysUntilDue < 0) return "OVERDUE";
  if (daysUntilDue <= SOON_THRESHOLD_DAYS) return "SOON";
  return "OK";
}

export const URGENCY_LABEL: Record<ReplacementUrgency, string> = {
  OVERDUE: "交換時期を過ぎています",
  SOON: "もうすぐ交換時期",
  OK: "まだ大丈夫",
};

// 残量ステータスと同じ配色ルール(緑=大丈夫、黄=もうすぐ、赤=期限切れ)。
export const URGENCY_STYLE: Record<ReplacementUrgency, { bg: string; text: string; border: string }> = {
  OK: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  SOON: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-400" },
  OVERDUE: { bg: "bg-red-100", text: "text-red-800", border: "border-red-400" },
};

export const SUGGESTED_REPLACEMENT_ITEMS = ["浄水器カートリッジ", "エアコンフィルター", "換気扇フィルター", "電動歯ブラシのブラシ"];

export function getDaysUntilDueLabel(daysUntilDue: number): string {
  if (daysUntilDue > 0) return `あと${daysUntilDue}日`;
  if (daysUntilDue === 0) return "今日が目安";
  return `${-daysUntilDue}日過ぎています`;
}
