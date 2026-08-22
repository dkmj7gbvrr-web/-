import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico";

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/groups", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
