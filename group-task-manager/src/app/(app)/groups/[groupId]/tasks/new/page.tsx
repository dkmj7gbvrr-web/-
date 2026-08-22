import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireGroupMember } from "@/lib/membership";
import { PageHeader } from "@/components/PageHeader";
import { NewTaskForm } from "@/components/NewTaskForm";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await requireUser();
  await requireGroupMember(groupId, user.id);

  const members = await prisma.groupMember.findMany({
    where: { groupId, userId: { not: user.id } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <>
      <PageHeader title="タスクを追加" backHref={`/groups/${groupId}`} />
      <div className="px-4 py-4">
        <NewTaskForm
          groupId={groupId}
          members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
        />
      </div>
    </>
  );
}
