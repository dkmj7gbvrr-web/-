import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function requireGroupMember(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });

  if (!membership) {
    notFound();
  }

  return membership;
}
