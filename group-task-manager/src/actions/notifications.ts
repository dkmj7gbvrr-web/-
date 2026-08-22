"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}
