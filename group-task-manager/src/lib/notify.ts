import { prisma } from "@/lib/prisma";
import { sendTeamsNotification } from "@/lib/teams";

export type NotificationType =
  | "DELEGATION_REQUEST"
  | "DELEGATION_APPROVED"
  | "DELEGATION_REJECTED";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  fromUserId?: string;
  groupId?: string;
}

const TEAMS_TITLES: Record<NotificationType, string> = {
  DELEGATION_REQUEST: "タスクの承認依頼が届きました",
  DELEGATION_APPROVED: "タスクの依頼が承認されました",
  DELEGATION_REJECTED: "タスクの依頼が却下されました",
};

/**
 * アプリ内通知を作成し、受信者が個人のTeams Webhook URLを設定していれば
 * あわせてTeamsへも通知する。
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      taskId: input.taskId,
      fromUserId: input.fromUserId,
      message: input.message,
    },
  });

  const recipient = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { teamsWebhookUrl: true },
  });

  if (recipient?.teamsWebhookUrl) {
    const appUrl = process.env.APP_URL ?? "";
    const taskUrl =
      input.taskId && input.groupId && appUrl
        ? `${appUrl}/groups/${input.groupId}/tasks/${input.taskId}`
        : undefined;

    await sendTeamsNotification({
      webhookUrl: recipient.teamsWebhookUrl,
      title: TEAMS_TITLES[input.type],
      text: input.message,
      taskUrl,
    });
  }
}
