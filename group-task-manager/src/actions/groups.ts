"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { generateUniqueGroupCode } from "@/lib/groupCode";
import { createGroupSchema, joinGroupSchema } from "@/lib/validation";
import type { ActionState } from "@/actions/auth";

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const code = await generateUniqueGroupCode();

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      code,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  redirect(`/groups/${group.id}`);
}

export async function joinGroupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = joinGroupSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "コードを確認してください" };
  }

  const group = await prisma.group.findUnique({
    where: { code: parsed.data.code },
  });

  if (!group) {
    return { error: "そのコードのグループが見つかりませんでした" };
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
  });

  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: "MEMBER" },
    });
  }

  redirect(`/groups/${group.id}`);
}
