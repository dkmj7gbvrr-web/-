"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { displayNameSchema } from "@/lib/validation";
import { clearUserCookie, getCurrentUser, requireUser, setUserCookie } from "@/lib/session";

export type ActionState = {
  error?: string;
  success?: boolean;
};

/** 初回の名前入力。User をつくって Cookie に保存する。 */
export async function startAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = displayNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "名前を入力してください" };
  }

  const user = await prisma.user.create({ data: { name: parsed.data.name } });
  await setUserCookie(user.id);

  const redirectTo = String(formData.get("redirectTo") || "/groups");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/groups");
}

/** 表示名の変更。グループ内の表示もまとめて変わる。 */
export async function renameAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = displayNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "名前を入力してください" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/** この端末から離れる(Cookieを消すだけ。データは残る)。 */
export async function signOutAction(): Promise<void> {
  await clearUserCookie();
  redirect("/welcome");
}

export async function currentUserOrNull() {
  return getCurrentUser();
}
