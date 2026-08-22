"use client";

import { useTransition } from "react";
import { markAllNotificationsReadAction } from "@/actions/notifications";

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => markAllNotificationsReadAction())}
      className="text-[13px] font-semibold text-accent disabled:opacity-50"
    >
      すべて既読にする
    </button>
  );
}
