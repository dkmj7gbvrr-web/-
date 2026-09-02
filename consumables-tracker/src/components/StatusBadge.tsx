import { STATUS_LABEL, STATUS_STYLE } from "@/lib/status";
import { clsx } from "@/lib/clsx";
import type { StockStatus } from "@/generated/prisma/enums";

export function StatusBadge({ status }: { status: StockStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.bg,
        style.text,
        style.border,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
