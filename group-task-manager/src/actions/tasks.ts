"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { normalizeTitle, isSameTask } from "@/lib/similarity";
import {
  addLogEntrySchema,
  createTaskSchema,
  updatePrioritySchema,
  updateTaskStatusSchema,
} from "@/lib/validation";
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
  const userId = await requireUserId();
  await requireGroupMember(groupId, userId);

  if (!title.trim()) return [];

  const candidates = await prisma.task.findMany({
    where: {
      groupId,
      visibility: "GROUP",
      status: { not: "DONE" },
      ownerId: { not: userId },
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
  const userId = await requireUserId();
  await requireGroupMember(groupId, userId);

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    dueDate: formData.get("dueDate"),
    importance: formData.get("importance"),
    urgency: formData.get("urgency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { title, description, visibility, dueDate, importance, urgency } = parsed.data;

  const task = await prisma.task.create({
    data: {
      groupId,
      ownerId: userId,
      title,
      normalizedTitle: normalizeTitle(title),
      description: description || null,
      visibility,
      dueDate: dueDate ? new Date(dueDate) : null,
      importance,
      urgency,
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
    const participantIds = Array.from(new Set([userId, ...memberIds]));

    await prisma.taskParticipant.createMany({
      data: participantIds.map((pid) => ({ taskId: task.id, userId: pid })),
      skipDuplicates: true,
    });
  }

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}/tasks/${task.id}`);
}

/**
 * グループ公開タスクの参加メンバーを、タスク作成者があとから編集する。
 * 所有者チェックがそのままメンバーシップの証明になるため、
 * 別途 requireGroupMember は呼ばない(所有者は必ずメンバーであるため)。
 */
export async function updateParticipantsAction(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  if (task.ownerId !== userId) {
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
  const nextParticipantIds = new Set([userId, ...memberIds]);

  await prisma.$transaction([
    prisma.taskParticipant.deleteMany({
      where: { taskId, userId: { notIn: Array.from(nextParticipantIds) } },
    }),
    prisma.taskParticipant.createMany({
      data: Array.from(nextParticipantIds).map((pid) => ({ taskId, userId: pid })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
  return { success: true };
}

/**
 * 自分自身の完了チェックを切り替える(参加メンバーのみ)。他人のチェックは変更できない。
 * 参加メンバーの行が存在すること自体がメンバーシップの証明になる。
 */
export async function toggleMyParticipationAction(taskId: string): Promise<void> {
  const userId = await requireUserId();

  const participant = await prisma.taskParticipant.findUnique({
    where: { taskId_userId: { taskId, userId } },
    include: { task: { select: { groupId: true } } },
  });
  if (!participant) return;

  await prisma.taskParticipant.update({
    where: { id: participant.id },
    data: {
      completed: !participant.completed,
      completedAt: !participant.completed ? new Date() : null,
    },
  });

  revalidatePath(`/groups/${participant.task.groupId}`);
  revalidatePath(`/groups/${participant.task.groupId}/tasks/${taskId}`);
}

export async function updateTaskStatusAction(
  taskId: string,
  status: string
): Promise<void> {
  const userId = await requireUserId();

  const parsed = updateTaskStatusSchema.safeParse({ status });
  if (!parsed.success) return;

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.ownerId !== userId && task.assigneeId !== userId) {
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
  const userId = await requireUserId();
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  if (task.ownerId !== userId) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { visibility: task.visibility === "PRIVATE" ? "GROUP" : "PRIVATE" },
  });

  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
}

/** 重要度・緊急度を変更する(作成者のみ)。 */
export async function updatePriorityAction(
  taskId: string,
  importance: number,
  urgency: number
): Promise<void> {
  const userId = await requireUserId();
  const parsed = updatePrioritySchema.safeParse({ importance, urgency });
  if (!parsed.success) return;

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.ownerId !== userId) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { importance: parsed.data.importance, urgency: parsed.data.urgency },
  });

  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
}

/** 日付ごとの進捗メモを追加する(作成者・担当者のみ)。 */
export async function addLogEntryAction(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = addLogEntrySchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const [task, participant] = await Promise.all([
    prisma.task.findUniqueOrThrow({ where: { id: taskId } }),
    prisma.taskParticipant.findUnique({
      where: { taskId_userId: { taskId, userId } },
    }),
  ]);
  const isAuthorized = task.ownerId === userId || task.assigneeId === userId || participant !== null;
  if (!isAuthorized) {
    return { error: "メモを追加できるのはタスクの作成者・担当者・参加メンバーのみです" };
  }

  await prisma.taskLogEntry.create({
    data: { taskId, authorId: userId, content: parsed.data.content },
  });

  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
  return { success: true };
}
