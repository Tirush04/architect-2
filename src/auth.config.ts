import type { NextAuthConfig } from "next-auth";

const PROTECTED = ["/home", "/p/", "/settings", "/onboarding", "/import", "/templates"];

/** Edge-safe config shared by middleware and the full server config. */
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const needsAuth = PROTECTED.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p));
      if (needsAuth) return !!auth?.user;
      if ((path === "/login" || path === "/signup") && auth?.user) {
        return Response.redirect(new URL("/home", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
