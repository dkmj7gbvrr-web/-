"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/validation";
import { signIn, signOut } from "@/auth";

export type ActionState = {
  error?: string;
  success?: boolean;
};

export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/groups",
  });

  return { success: true };
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/groups",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }
    throw err;
  }

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
