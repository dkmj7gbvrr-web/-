"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { generateUniqueGroupCode } from "@/lib/groupCode";
import { createGroupSchema, joinGroupSchema } from "@/lib/validation";
import type { ActionState } from "@/actions/identity";

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = createGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const code = await generateUniqueGroupCode();

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      code,
      ownerId: userId,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
  });

  redirect(`/groups/${group.id}`);
}

export async function joinGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = joinGroupSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "コードを確認してください" };
  }

  const group = await prisma.group.findUnique({
    where: { code: parsed.data.code },
    select: { id: true },
  });

  if (!group) {
    return { error: "そのコードのグループが見つかりませんでした" };
  }

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    create: { groupId: group.id, userId, role: "MEMBER" },
    update: {},
  });

  redirect(`/groups/${group.id}`);
}
