"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { delegateTaskSchema } from "@/lib/validation";
import { notifyUser } from "@/lib/notify";
import type { ActionState } from "@/actions/identity";

export async function delegateTaskAction(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await requireGroupMember(task.groupId, user.id);

  if (task.ownerId !== user.id) {
    return { error: "このタスクの担当依頼を送れるのはタスクの作成者のみです" };
  }

  const parsed = delegateTaskSchema.safeParse({
    toUserId: formData.get("toUserId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "依頼先を選択してください" };
  }

  const { toUserId, message } = parsed.data;

  if (toUserId === user.id) {
    return { error: "自分自身には依頼できません" };
  }

  await requireGroupMember(task.groupId, toUserId);

  const existingPending = await prisma.taskDelegation.findFirst({
    where: { taskId, toUserId, status: "PENDING" },
  });
  if (existingPending) {
    return { error: "すでにこのメンバーへ依頼を送っています" };
  }

  await prisma.taskDelegation.create({
    data: { taskId, fromUserId: user.id, toUserId, message: message || null },
  });

  await notifyUser({
    userId: toUserId,
    type: "DELEGATION_REQUEST",
    taskId: task.id,
    fromUserId: user.id,
    message: `${user.name}さんから「${task.title}」の承認依頼が届きました${
      message ? `: ${message}` : ""
    }`,
  });

  revalidatePath(`/groups/${task.groupId}/tasks/${taskId}`);
  revalidatePath("/notifications");

  return { success: true };
}

export async function respondDelegationAction(
  delegationId: string,
  approve: boolean
): Promise<void> {
  const user = await requireUser();

  const delegation = await prisma.taskDelegation.findUniqueOrThrow({
    where: { id: delegationId },
    include: { task: true, from: true },
  });

  if (delegation.toUserId !== user.id) return;
  if (delegation.status !== "PENDING") return;

  await prisma.taskDelegation.update({
    where: { id: delegationId },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      respondedAt: new Date(),
    },
  });

  if (approve) {
    await prisma.task.update({
      where: { id: delegation.taskId },
      data: { assigneeId: user.id },
    });
  }

  await notifyUser({
    userId: delegation.fromUserId,
    type: approve ? "DELEGATION_APPROVED" : "DELEGATION_REJECTED",
    taskId: delegation.taskId,
    fromUserId: user.id,
    message: `${user.name}さんが「${delegation.task.title}」の依頼を${
      approve ? "承認しました" : "却下しました"
    }`,
  });

  revalidatePath(`/groups/${delegation.task.groupId}/tasks/${delegation.taskId}`);
  revalidatePath("/notifications");
}
