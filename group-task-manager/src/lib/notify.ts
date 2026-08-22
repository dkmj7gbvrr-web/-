import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  fromUserId?: string;
}

/** アプリ内通知を1件つくる(「通知」タブに表示される)。 */
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
}
