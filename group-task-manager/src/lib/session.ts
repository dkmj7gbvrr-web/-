import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * 本人確認のしくみ
 * ------------------------------------------------------------------
 * メールアドレスやパスワードは扱わない。初回に入力した表示名で User を
 * 1件つくり、その id を長期間有効なCookieに保存する。以降はそのCookieを
 * 持っているブラウザ = 本人、として扱う。
 *
 * 「自分だけに見えるタスク」もこの id で判定するため、同じ人でも別の
 * ブラウザ・別の端末からは別人として扱われる(その場合はもう一度名前を
 * 入力してグループに参加し直す)。
 */
export const USER_COOKIE = "tc_uid";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年

export async function setUserCookie(userId: string) {
  const store = await cookies();
  store.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearUserCookie() {
  const store = await cookies();
  store.delete(USER_COOKIE);
}

export type CurrentUser = { id: string; name: string; loginCode: string | null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const id = store.get(USER_COOKIE)?.value;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, loginCode: true },
  });

  // Cookieは残っているのにユーザーが消えている(DBを作り直した等)場合は
  // 未ログイン扱いにして、名前入力からやり直してもらう。
  return user ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  return user;
}
