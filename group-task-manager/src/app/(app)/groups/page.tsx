import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { PageHeader } from "@/components/PageHeader";
import { Card, Badge } from "@/components/ui";
import { CreateGroupForm, JoinGroupForm } from "@/components/GroupForms";

export default async function GroupsPage() {
  const userId = await requireUserId();

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <>
      <PageHeader title="グループ" />
      <div className="flex flex-col gap-5 px-4 py-4">
        {memberships.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {memberships.map((m) => (
              <Link key={m.group.id} href={`/groups/${m.group.id}`}>
                <Card className="flex items-center justify-between p-4 active:bg-black/[.03]">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{m.group.name}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {m.group._count.members}人のメンバー · コード {m.group.code}
                    </p>
                  </div>
                  {m.role === "OWNER" && <Badge tone="accent">管理者</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        )}

        {memberships.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-[14px] text-muted">
              まだグループがありません。作成するか、参加コードを入力してグループに参加しましょう。
            </p>
          </Card>
        )}

        <CreateGroupForm />
        <JoinGroupForm />
      </div>
    </>
  );
}
