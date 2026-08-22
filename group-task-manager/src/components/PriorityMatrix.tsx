import Link from "next/link";
import type { TaskListItem } from "@/types/task";

/** 重要度(縦)×緊急度(横)の5×5マトリクスにタスクをマッピングして表示する。 */
export function PriorityMatrix({
  tasks,
  groupId,
}: {
  tasks: TaskListItem[];
  groupId: string;
}) {
  const active = tasks.filter((t) => t.status !== "DONE");

  if (active.length === 0) {
    return (
      <p className="px-1 py-10 text-center text-[13px] text-muted">
        マッピングするタスクがありません
      </p>
    );
  }

  const levels = [5, 4, 3, 2, 1];

  return (
    <div>
      <div className="flex gap-1.5">
        <div className="flex w-6 shrink-0 flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-muted [writing-mode:vertical-rl]">
            重要度
          </span>
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="grid min-w-[420px] grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
            {levels.map((imp) => (
              <div key={imp} className="contents">
                <div className="flex w-5 items-center justify-center text-[11px] font-semibold text-muted">
                  {imp}
                </div>
                {[1, 2, 3, 4, 5].map((urg) => {
                  const cellTasks = active.filter(
                    (t) => t.importance === imp && t.urgency === urg
                  );
                  const intensity = imp + urg;
                  return (
                    <div
                      key={urg}
                      className="flex min-h-[64px] min-w-0 flex-col gap-1 rounded-lg border border-border p-1"
                      style={{
                        backgroundColor:
                          intensity >= 8
                            ? "rgba(255,59,48,0.10)"
                            : intensity >= 6
                              ? "rgba(255,149,0,0.10)"
                              : "rgba(0,0,0,0.02)",
                      }}
                    >
                      {cellTasks.map((t) => (
                        <Link
                          key={t.id}
                          href={`/groups/${groupId}/tasks/${t.id}`}
                          className="truncate rounded-md bg-surface px-1.5 py-1 text-[10.5px] font-medium leading-tight shadow-sm"
                          title={t.title}
                        >
                          {t.title}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
            <div />
            {[1, 2, 3, 4, 5].map((urg) => (
              <div key={urg} className="text-center text-[11px] font-semibold text-muted">
                {urg}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] font-semibold text-muted">緊急度 →</p>
    </div>
  );
}
