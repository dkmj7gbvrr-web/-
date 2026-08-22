"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { profileSchema } from "@/lib/validation";
import type { ActionState } from "@/actions/auth";

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    teamsWebhookUrl: formData.get("teamsWebhookUrl"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      teamsWebhookUrl: parsed.data.teamsWebhookUrl || null,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}
