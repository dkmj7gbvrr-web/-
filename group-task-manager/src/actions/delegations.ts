"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { delegateTaskSchema } from "@/lib/validation";
import { notifyUser } from "@/lib/notify";
import { readOptionalAttachment } from "@/lib/attachments";
import type { ActionState } from "@/actions/identity";

export async function delegateTaskAction(
  taskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // ユーザー情報とタスク本体はお互い独立なので並行して取得する。
  const [user, task] = await Promise.all([
    requireUser(),
    prisma.task.findUniqueOrThrow({ where: { id: taskId } }),
  ]);

  // 送信者が所有者であること自体がメンバーシップの証明になるため、
  // 送信者側の requireGroupMember は呼ばない。
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

  // 依頼先はこちらで確認が必要(所有者チェックは使えないため)。
  await requireGroupMember(task.groupId, toUserId);

  const attachmentResult = await readOptionalAttachment(formData, "attachment");
  if (!attachmentResult.ok) {
    return { error: attachmentResult.error };
  }

  let attachmentId: string | undefined;
  if (attachmentResult.file) {
    const { filename, mimeType, size, data } = attachmentResult.file;
    const attachment = await prisma.attachment.create({
      data: {
        filename,
        mimeType,
        size,
        data: data as unknown as Uint8Array<ArrayBuffer>,
        uploadedById: user.id,
      },
    });
    attachmentId = attachment.id;
  }

  await prisma.taskDelegation.create({
    data: { taskId, fromUserId: user.id, toUserId, message: message || null, attachmentId },
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
  approve: boolean,
  comment?: string
): Promise<void> {
  const [user, delegation] = await Promise.all([
    requireUser(),
    prisma.taskDelegation.findUniqueOrThrow({
      where: { id: delegationId },
      include: { task: true, from: true },
    }),
  ]);

  if (delegation.toUserId !== user.id) return;
  if (delegation.status !== "PENDING") return;

  const trimmedComment = comment?.trim();

  await Promise.all([
    prisma.taskDelegation.update({
      where: { id: delegationId },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        respondedAt: new Date(),
        responseComment: trimmedComment || null,
      },
    }),
    approve
      ? prisma.task.update({
          where: { id: delegation.taskId },
          data: { assigneeId: user.id },
        })
      : Promise.resolve(),
  ]);

  await notifyUser({
    userId: delegation.fromUserId,
    type: approve ? "DELEGATION_APPROVED" : "DELEGATION_REJECTED",
    taskId: delegation.taskId,
    fromUserId: user.id,
    message: `${user.name}さんが「${delegation.task.title}」の依頼を${
      approve ? "承認しました" : "却下しました"
    }${trimmedComment ? `: ${trimmedComment}` : ""}`,
  });

  revalidatePath(`/groups/${delegation.task.groupId}/tasks/${delegation.taskId}`);
  revalidatePath("/notifications");
}
