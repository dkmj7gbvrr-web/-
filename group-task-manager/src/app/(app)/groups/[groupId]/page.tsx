import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { isSameTask } from "@/lib/similarity";
import { PageHeader } from "@/components/PageHeader";
import { GroupTaskTabs } from "@/components/GroupTaskTabs";
import type { TaskListItem } from "@/types/task";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  const membership = await requireGroupMember(groupId, user.id);

  const [groupTaskRows, myTaskRows] = await Promise.all([
    prisma.task.findMany({
      where: { groupId, visibility: "GROUP" },
      include: {
        owner: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.task.findMany({
      where: {
        groupId,
        OR: [{ ownerId: user.id }, { assigneeId: user.id }],
      },
      include: {
        owner: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const activeGroupTasks = groupTaskRows.filter((t) => t.status !== "DONE");

  function coRunnersFor(task: (typeof groupTaskRows)[number]) {
    const seen = new Set<string>([task.ownerId]);
    const runners: { userId: string; userName: string }[] = [];
    if (task.status === "DONE") return runners;
    for (const other of activeGroupTasks) {
      if (other.id === task.id) continue;
      if (seen.has(other.ownerId)) continue;
      if (isSameTask(other.title, task.title)) {
        seen.add(other.ownerId);
        runners.push({ userId: other.ownerId, userName: other.owner.name });
      }
    }
    return runners;
  }

  const toItem = (
    t: (typeof groupTaskRows)[number],
    withCoRunners: boolean
  ): TaskListItem => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskListItem["status"],
    visibility: t.visibility as TaskListItem["visibility"],
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    ownerId: t.ownerId,
    ownerName: t.owner.name,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    coRunners: withCoRunners ? coRunnersFor(t) : [],
  });

  const groupTasks = groupTaskRows.map((t) => toItem(t, true));
  const myTasks = myTaskRows.map((t) => toItem(t, false));

  return (
    <>
      <PageHeader
        title={membership.group.name}
        backHref="/groups"
        right={
          <Link
            href={`/groups/${groupId}/members`}
            className="text-[13px] font-semibold text-accent"
          >
            メンバー
          </Link>
        }
      />
      <div className="flex flex-1 flex-col px-4 py-4">
        <GroupTaskTabs groupId={groupId} groupTasks={groupTasks} myTasks={myTasks} />
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="relative mx-auto max-w-lg">
          <Link
            href={`/groups/${groupId}/tasks/new`}
            className="pointer-events-auto absolute bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-white shadow-lg active:opacity-80"
            aria-label="タスクを追加"
          >
            +
          </Link>
        </div>
      </div>
    </>
  );
}
