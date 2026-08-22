"use client";

import { useState, useTransition } from "react";
import { updatePriorityAction } from "@/actions/tasks";
import { PriorityScale } from "@/components/PriorityScale";
import { Card } from "@/components/ui";

export function PriorityEditor({
  taskId,
  importance,
  urgency,
  editable,
}: {
  taskId: string;
  importance: number;
  urgency: number;
  editable: boolean;
}) {
  const [imp, setImp] = useState(importance);
  const [urg, setUrg] = useState(urgency);
  const [isPending, startTransition] = useTransition();

  function commit(nextImportance: number, nextUrgency: number) {
    setImp(nextImportance);
    setUrg(nextUrgency);
    startTransition(() => updatePriorityAction(taskId, nextImportance, nextUrgency));
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-[15px] font-semibold">優先度</h2>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-muted">重要度 {imp}</p>
          <PriorityScale
            value={imp}
            onChange={(n) => commit(n, urg)}
            disabled={!editable || isPending}
          />
        </div>
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-muted">緊急度 {urg}</p>
          <PriorityScale
            value={urg}
            onChange={(n) => commit(imp, n)}
            disabled={!editable || isPending}
          />
        </div>
      </div>
    </Card>
  );
}
