import type { NextAuthConfig } from "next-auth";

/**
 * Edge Middleware でも読み込める最小構成。
 * Credentials Provider(bcrypt/Prisma に依存)はここに含めず、
 * Node.js ランタイムで動く src/auth.ts 側でのみ追加する。
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
};
