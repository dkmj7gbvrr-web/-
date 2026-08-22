import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { isSameTask } from "@/lib/similarity";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, Badge, Card } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, formatDueDate } from "@/lib/labels";
import { StatusSelector } from "@/components/StatusSelector";
import { VisibilityToggle } from "@/components/VisibilityToggle";
import { DelegateForm } from "@/components/DelegateForm";
import { DelegationActions } from "@/components/DelegationActions";
import { ParticipantsPanel } from "@/components/ParticipantsPanel";
import type { TaskStatus, TaskVisibility } from "@/types/task";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; taskId: string }>;
}) {
  const { groupId, taskId } = await params;
  const user = await requireUser();
  await requireGroupMember(groupId, user.id);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      owner: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      delegations: {
        include: {
          from: { select: { id: true, name: true } },
          to: { select: { id: true, name: true } },
          attachment: { select: { id: true, filename: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      participants: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!task || task.groupId !== groupId) {
    notFound();
  }

  const isOwner = task.ownerId === user.id;
  const isAssignee = task.assigneeId === user.id;
  const isRelatedToDelegation = task.delegations.some(
    (d) => d.fromUserId === user.id || d.toUserId === user.id
  );
  const canView =
    task.visibility === "GROUP" || isOwner || isAssignee || isRelatedToDelegation;
  if (!canView) {
    notFound();
  }

  const otherMembers = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: task.ownerId } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const allMembers = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const pendingForMe = task.delegations.find(
    (d) => d.status === "PENDING" && d.toUserId === user.id
  );

  const coRunners: { userId: string; userName: string }[] = [];
  if (task.visibility === "GROUP" && task.status !== "DONE") {
    const others = await prisma.task.findMany({
      where: {
        groupId,
        visibility: "GROUP",
        status: { not: "DONE" },
        ownerId: { not: task.ownerId },
        id: { not: task.id },
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    const seen = new Set<string>();
    for (const other of others) {
      if (seen.has(other.ownerId)) continue;
      if (isSameTask(other.title, task.title)) {
        seen.add(other.ownerId);
        coRunners.push({ userId: other.ownerId, userName: other.owner.name });
      }
    }
  }

  return (
    <>
      <PageHeader title="タスク詳細" backHref={`/groups/${groupId}`} />
      <div className="flex flex-col gap-4 px-4 py-4">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[18px] font-bold">{task.title}</h2>
            <Badge tone={STATUS_TONE[task.status as TaskStatus]} className="shrink-0">
              {STATUS_LABEL[task.status as TaskStatus]}
            </Badge>
          </div>

          {task.description && (
            <p className="mt-2 whitespace-pre-wrap text-[14px] text-muted">
              {task.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <Avatar name={task.owner.name} className="h-5 w-5 text-[10px]" />
              {task.owner.name}
            </span>
            {task.assignee && (
              <>
                <span>→</span>
                <span className="flex items-center gap-1.5 font-medium text-accent">
                  <Avatar name={task.assignee.name} className="h-5 w-5 text-[10px]" />
                  {task.assignee.name}
                </span>
              </>
            )}
            {task.dueDate && <span>· 期限 {formatDueDate(task.dueDate.toISOString())}</span>}
          </div>

          <div className="mt-3">
            <VisibilityToggle
              taskId={task.id}
              visibility={task.visibility as TaskVisibility}
              editable={isOwner}
            />
          </div>
        </Card>

        {coRunners.length > 0 && (
          <Card className="border-warning/40 bg-warning/5 p-4">
            <p className="text-[13px] font-semibold text-warning">
              同じタスクに取り組んでいるメンバー
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {coRunners.map((r) => (
                <span
                  key={r.userId}
                  className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[13px]"
                >
                  <Avatar name={r.userName} className="h-5 w-5 text-[10px]" />
                  {r.userName}
                </span>
              ))}
            </div>
          </Card>
        )}

        <div>
          <p className="mb-2 px-1 text-[13px] font-medium text-muted">ステータスを更新</p>
          <StatusSelector
            taskId={task.id}
            status={task.status as TaskStatus}
            editable={isOwner || isAssignee}
          />
        </div>

        {task.visibility === "GROUP" && (
          <ParticipantsPanel
            taskId={task.id}
            participants={task.participants.map((p) => ({
              userId: p.userId,
              name: p.user.name,
              completed: p.completed,
            }))}
            allMembers={allMembers.map((m) => ({ id: m.user.id, name: m.user.name }))}
            isOwner={isOwner}
            currentUserId={user.id}
          />
        )}

        {pendingForMe && (
          <DelegationActions
            delegationId={pendingForMe.id}
            fromName={pendingForMe.from.name}
            message={pendingForMe.message}
            attachment={pendingForMe.attachment}
          />
        )}

        {isOwner && (
          <DelegateForm
            taskId={task.id}
            members={otherMembers.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        )}

        {task.delegations.length > 0 && (
          <div>
            <p className="mb-2 px-1 text-[13px] font-medium text-muted">依頼の履歴</p>
            <div className="flex flex-col gap-2">
              {task.delegations.map((d) => (
                <Card key={d.id} className="p-3.5 text-[13px]">
                  <p>
                    <span className="font-semibold">{d.from.name}</span> →{" "}
                    <span className="font-semibold">{d.to.name}</span>
                  </p>
                  <p className="mt-0.5 text-muted">
                    {d.status === "PENDING" && "承認待ち"}
                    {d.status === "APPROVED" && "承認済み"}
                    {d.status === "REJECTED" && "却下"}
                  </p>
                  {d.message && (
                    <p className="mt-1.5 text-[12.5px] text-foreground">依頼: 「{d.message}」</p>
                  )}
                  {d.attachment && (
                    <a
                      href={`/api/attachments/${d.attachment.id}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent"
                    >
                      📎 {d.attachment.filename}
                    </a>
                  )}
                  {d.responseComment && (
                    <p className="mt-1.5 text-[12.5px] text-foreground">
                      {d.status === "APPROVED" ? "承認コメント" : "却下コメント"}: 「{d.responseComment}」
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
