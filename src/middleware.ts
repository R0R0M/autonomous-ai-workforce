import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/", "/login", "/api/billing/webhook"]);

export default auth((req) => {
  if (!req.auth && !PUBLIC_PATHS.has(req.nextUrl.pathname)) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
