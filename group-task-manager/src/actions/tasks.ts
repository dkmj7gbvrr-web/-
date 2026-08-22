"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { normalizeTitle, isSameTask } from "@/lib/similarity";
import { createTaskSchema, updateTaskStatusSchema } from "@/lib/validation";
import type { ActionState } from "@/actions/identity";

export type DuplicateMatch = {
  taskId: string;
  title: string;
  ownerId: string;
  ownerName: string;
};

/** グループ内で似たタイトルのタスクを実施中のメンバーを探す(自分以外)。 */
export async function checkDuplicateTasksAction(
  groupId: string,
  title: string
): Promise<DuplicateMatch[]> {
  const user = await requireUser();
  await requireGroupMember(groupId, user.id);

  if (!title.trim()) return [];

  const candidates = await prisma.task.findMany({
    where: {
      groupId,
      visibility: "GROUP",
      status: { not: "DONE" },
      ownerId: { not: user.id },
    },
    include: { owner: { select: { id: true, name: true } } },
    take: 200,
  });

  const matches = candidates.filter((t) => isSameTask(t.title, title));

  const seenOwners = new Set<string>();
  const result: DuplicateMatch[] = [];
  for (const t of matches) {
    if (seenOwners.has(t.ownerId)) continue;
    seenOwners.add(t.ownerId);
    result.push({
      taskId: t.id,
      title: t.title,
      ownerId: t.ownerId,
      ownerName: t.owner.name,
    });
  }
  return result;
}

export async function createTaskAction(
  groupId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  await requireGroupMember(groupId, user.id);

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { title, description, visibility, dueDate } = parsed.data;

  const task = await prisma.task.create({
    data: {
      groupId,
      ownerId: user.id,
      title,
      normalizedTitle: normalizeTitle(title),
      description: description || null,
      visibility,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  if (visibility === "GROUP") {
    const requested = formData.getAll("participantIds").map(String);
    const memberIds =
      requested.length > 0
        ? (
            await prisma.groupMember.findMany({
              where: { groupId, userId: { in: requested } },
              select: { userId: true },
            })
          ).map((m) => m.userId)
        : [];
    const participantIds = Array.from(new Set([user.id, ...memberIds]));

    await prisma.taskParticipant.createMany({
      data: participantIds.map((userId) => ({ taskId: task.id, userId })),
      skipDuplicates: true,
    });
  }

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}/tasks/${task.id}`);
}

/** グループ公開タスクの参加メンバーを、タスク作成者があとから編集する。 */
export async function updateParticipantsAction(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await requireGroupMember(task.groupId, user.id);

  if (task.ownerId !== user.id) {
    return { error: "参加メンバーを編集できるのはタスクの作成者のみです" };
  }
  if (task.visibility !== "GROUP") {
    return { error: "グループ公開のタスクのみ参加メンバーを設定できます" };
  }

  const requested = formData.getAll("participantIds").map(String);
  const memberIds =
    requested.length > 0
      ? (
          await prisma.groupMember.findMany({
            where: { groupId: task.groupId, userId: { in: requested } },
            select: { userId: true },
          })
        ).map((m) => m.userId)
      : [];
  const nextParticipantIds = new Set([user.id, ...memberIds]);

  await prisma.$transaction([
    prisma.taskParticipant.deleteMany({
      where: { taskId, userId: { notIn: Array.from(nextParticipantIds) } },
    }),
    prisma.taskParticipant.createMany({
      data: Array.from(nextParticipantIds).map((userId) => ({ taskId, userId })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
  return { success: true };
}

/** 自分自身の完了チェックを切り替える(参加メンバーのみ)。他人のチェックは変更できない。 */
export async function toggleMyParticipationAction(taskId: string): Promise<void> {
  const user = await requireUser();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await requireGroupMember(task.groupId, user.id);

  const participant = await prisma.taskParticipant.findUnique({
    where: { taskId_userId: { taskId, userId: user.id } },
  });
  if (!participant) return;

  await prisma.taskParticipant.update({
    where: { id: participant.id },
    data: {
      completed: !participant.completed,
      completedAt: !participant.completed ? new Date() : null,
    },
  });

  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
}

export async function updateTaskStatusAction(
  taskId: string,
  status: string
): Promise<void> {
  const user = await requireUser();

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await requireGroupMember(task.groupId, user.id);

  const parsed = updateTaskStatusSchema.safeParse({ status });
  if (!parsed.success) return;

  if (task.ownerId !== user.id && task.assigneeId !== user.id) {
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: parsed.data.status },
  });

  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
}

export async function toggleVisibilityAction(taskId: string): Promise<void> {
  const user = await requireUser();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  if (task.ownerId !== user.id) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { visibility: task.visibility === "PRIVATE" ? "GROUP" : "PRIVATE" },
  });

  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
}

