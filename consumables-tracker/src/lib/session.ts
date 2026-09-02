import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * 本人確認のしくみ
 * ------------------------------------------------------------------
 * メールアドレスやパスワードは扱わない。「誰ですか」画面で選んだ/入力した
 * 表示名で User を1件つくり、その id を長期間有効なCookieに保存する。
 * 以降はそのCookieを持っているブラウザ = 本人、として扱う。
 *
 * 二人暮らしの実用ツールという前提で、認証は「同じURLを知っている人は
 * 使ってよい」レベルの緩さで割り切っている。
 */
export const USER_COOKIE = "ct_uid";

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

export type CurrentUser = { id: string; name: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const id = store.get(USER_COOKIE)?.value;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  return user ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  return user;
}
