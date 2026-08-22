import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export const requireGroupMember = cache(async (groupId: string, userId: string) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });

  if (!membership) {
    notFound();
  }

  return membership;
});

/**
 * ページ用のショートカット: Cookieから読んだユーザーIDでそのまま
 * メンバーシップを1クエリで確認する(表示名が必要ない場合、
 * requireUser()+requireGroupMember() の2回問い合わせを1回にまとめる)。
 */
export async function requireMembership(groupId: string) {
  const userId = await requireUserId();
  return requireGroupMember(groupId, userId);
}
