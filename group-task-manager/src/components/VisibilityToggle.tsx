"use client";

import { useTransition } from "react";
import { toggleVisibilityAction } from "@/actions/tasks";
import { VISIBILITY_LABEL } from "@/lib/labels";
import { Badge } from "@/components/ui";
import type { TaskVisibility } from "@/types/task";

export function VisibilityToggle({
  taskId,
  visibility,
  editable,
}: {
  taskId: string;
  visibility: TaskVisibility;
  editable: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!editable) {
    return <Badge tone="default">{VISIBILITY_LABEL[visibility]}</Badge>;
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleVisibilityAction(taskId))}
      className="disabled:opacity-50"
    >
      <Badge tone="accent">{VISIBILITY_LABEL[visibility]} · 変更する</Badge>
    </button>
  );
}
