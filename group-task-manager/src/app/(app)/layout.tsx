import type { ReactNode } from "react";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TabBar } from "@/components/TabBar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const userId = await requireUserId();

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-1 flex-col bg-background">
      <div className="flex flex-1 flex-col">{children}</div>
      <TabBar unreadCount={unreadCount} />
    </div>
  );
}
