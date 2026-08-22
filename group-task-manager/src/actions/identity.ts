"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { displayNameSchema, loginCodeSchema } from "@/lib/validation";
import { generateUniqueLoginCode, normalizeLoginCode } from "@/lib/loginCode";
import {
  clearUserCookie,
  getCurrentUser,
  requireUserId,
  setUserCookie,
} from "@/lib/session";

export type ActionState = {
  error?: string;
  success?: boolean;
  loginCode?: string;
  pendingUserId?: string;
  redirectTo?: string;
};

/**
 * 初回の名前入力。User をつくり、復帰用のログインコードを発行する。
 *
 * ここではまだCookieをセットしない: セットすると、この直後にNext.jsが
 * /welcome を自動で再描画し、そのサーバーコンポーネントの
 * 「ログイン済みなら/groupsへ」という分岐が働いて、ログインコードの
 * 画面を見せる前に飛んでしまう。確定は confirmStartAction 側で行う。
 */
export async function startAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = displayNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "名前を入力してください" };
  }

  const loginCode = await generateUniqueLoginCode();
  const user = await prisma.user.create({
    data: { name: parsed.data.name, loginCode },
  });

  const redirectTo = String(formData.get("redirectTo") || "/groups");
  return {
    success: true,
    loginCode,
    pendingUserId: user.id,
    redirectTo: redirectTo.startsWith("/") ? redirectTo : "/groups",
  };
}

/** ログインコードを確認した後の「つづける」。ここでCookieを確定して遷移する。 */
export async function confirmStartAction(userId: string, redirectTo: string): Promise<void> {
  await setUserCookie(userId);
  redirect(redirectTo.startsWith("/") ? redirectTo : "/groups");
}

/** ログインコードで既存のアカウントに戻る(別端末・キャッシュ削除後)。 */
export async function loginWithCodeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = String(formData.get("code") || "");
  const parsed = loginCodeSchema.safeParse({ code: normalizeLoginCode(raw) });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "コードを確認してください" };
  }

  const user = await prisma.user.findFirst({
    where: {
      loginCode: {
        // 保存形式(ハイフンあり)・入力形式(ハイフンなし)どちらでも一致させる
        in: [parsed.data.code, formatWithDash(parsed.data.code)],
      },
    },
  });

  if (!user) {
    return { error: "そのログインコードのアカウントが見つかりません" };
  }

  await setUserCookie(user.id);

  const redirectTo = String(formData.get("redirectTo") || "/groups");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/groups");
}

function formatWithDash(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 10)}`;
}

/** 表示名の変更。グループ内の表示もまとめて変わる。 */
export async function renameAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = displayNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "名前を入力してください" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/** この端末から離れる(Cookieを消すだけ。データは残る。ログインコードで戻れる)。 */
export async function signOutAction(): Promise<void> {
  await clearUserCookie();
  redirect("/welcome");
}

export async function currentUserOrNull() {
  return getCurrentUser();
}
