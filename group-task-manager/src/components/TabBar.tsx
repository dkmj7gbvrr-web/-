"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

const TABS = [
  { href: "/groups", label: "グループ", icon: GroupsIcon },
  { href: "/notifications", label: "通知", icon: BellIcon },
  { href: "/settings", label: "設定", icon: GearIcon },
] as const;

export function TabBar({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <span className="relative">
                <Icon
                  className={clsx(
                    "h-6 w-6",
                    active ? "text-accent" : "text-muted"
                  )}
                />
                {tab.href === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={clsx(
                  "text-[11px] font-medium",
                  active ? "text-accent" : "text-muted"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function GroupsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 20c0-3.3 2.7-6 6-6s6 2.7 6 6M13 4.3a3.5 3.5 0 1 1 3.4 6.1M17.5 14c2.5.4 4.5 2.5 4.5 5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={10} cy={8} r={3.5} stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1 5 1.5 6H4.5C5 14 6 12.5 6 9Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M9.5 18a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx={12} cy={12} r={3.2} stroke="currentColor" strokeWidth={1.8} />
      <path
        d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6 6.2 6.2"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
