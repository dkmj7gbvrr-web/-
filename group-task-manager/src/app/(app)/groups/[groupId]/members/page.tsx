import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/membership";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, Badge, Card } from "@/components/ui";
import { CopyCodeButton } from "@/components/CopyCodeButton";

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const membership = await requireMembership(groupId);

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <>
      <PageHeader title="メンバー" backHref={`/groups/${groupId}`} />
      <div className="flex flex-col gap-5 px-4 py-4">
        <Card className="p-4">
          <p className="mb-2 text-[13px] font-medium text-muted">参加コード</p>
          <div className="flex items-center gap-3">
            <p className="flex-1 text-center text-[28px] font-bold tracking-[0.3em] text-accent">
              {membership.group.code}
            </p>
            <CopyCodeButton code={membership.group.code} />
          </div>
          <p className="mt-3 text-[12px] text-muted">
            このコードを共有すると、他のメンバーがグループに参加できます。
          </p>
        </Card>

        <div>
          <p className="mb-2 px-1 text-[13px] font-medium text-muted">
            {members.length}人のメンバー
          </p>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <Card key={m.id} className="flex items-center gap-3 p-3.5">
                <Avatar name={m.user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {m.user.name}
                    {m.user.id === membership.userId && (
                      <span className="ml-1.5 text-[12px] font-normal text-muted">(あなた)</span>
                    )}
                  </p>
                </div>
                {m.role === "OWNER" && <Badge tone="accent">管理者</Badge>}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
