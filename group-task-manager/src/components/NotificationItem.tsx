"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationReadAction } from "@/actions/notifications";
import { Card } from "@/components/ui";
import { clsx } from "@/lib/clsx";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export function NotificationItem({
  id,
  message,
  isRead,
  createdAt,
  href,
}: {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  href: string | null;
}) {
  const [, startTransition] = useTransition();

  const content = (
    <Card
      className={clsx(
        "flex items-start gap-2.5 p-4",
        !isRead && "border-accent/40 bg-accent/5"
      )}
    >
      {!isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
      <div className={clsx("min-w-0 flex-1", isRead && "pl-4")}>
        <p className="text-[14px]">{message}</p>
        <p className="mt-1 text-[12px] text-muted">{relativeTime(createdAt)}</p>
      </div>
    </Card>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      onClick={() => {
        if (!isRead) startTransition(() => markNotificationReadAction(id));
      }}
    >
      {content}
    </Link>
  );
}
