"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setUserCookie, clearUserCookie } from "@/lib/session";

const nameSchema = z
  .string()
  .trim()
  .min(1, "名前を入力してください")
  .max(20, "20文字以内で入力してください");

/** 既存ユーザーの選択、または新しい名前でのユーザー作成のどちらもここで扱う。 */
export async function selectUser(formData: FormData) {
  const existingId = formData.get("userId");
  if (typeof existingId === "string" && existingId) {
    const user = await prisma.user.findUnique({ where: { id: existingId } });
    if (user) {
      await setUserCookie(user.id);
      redirect("/");
    }
  }

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    redirect("/welcome?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }

  const user = await prisma.user.create({ data: { name: parsed.data } });
  await setUserCookie(user.id);
  redirect("/");
}

export async function switchUser() {
  await clearUserCookie();
  redirect("/welcome");
}

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getMe() {
  return getCurrentUser();
}
