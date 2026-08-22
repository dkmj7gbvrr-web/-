import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { NotificationItem } from "@/components/NotificationItem";
import { MarkAllReadButton } from "@/components/MarkAllReadButton";

export default async function NotificationsPage() {
  const userId = await requireUserId();

  const notifications = await prisma.notification.findMany({
    where: { userId },
    include: { task: { select: { id: true, groupId: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <>
      <PageHeader
        title="通知"
        right={hasUnread ? <MarkAllReadButton /> : undefined}
      />
      <div className="flex flex-col gap-2.5 px-4 py-4">
        {notifications.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-[14px] text-muted">通知はまだありません</p>
          </Card>
        )}
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            id={n.id}
            message={n.message}
            isRead={n.isRead}
            createdAt={n.createdAt.toISOString()}
            href={n.task ? `/groups/${n.task.groupId}/tasks/${n.task.id}` : null}
          />
        ))}
      </div>
    </>
  );
}
