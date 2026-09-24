import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { LoginSchema } from "@/lib/schemas";
import { authConfig } from "./auth.config";
import { allowAttempt } from "@/lib/throttle";

export const oauthConfigured = {
  github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
};

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

// Compare against a real hash for unknown emails so response time doesn't reveal which emails exist.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("architect-timing-guard", 10));

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const { email, password } = parsed.data;
        if (!allowAttempt(`login:${email}`, 10, 15 * 60 * 1000)) throw new TooManyAttempts();
        const user = await db.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
        if (!user || !user.passwordHash || !ok) throw new InvalidLogin();
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
    ...(oauthConfigured.github
      ? [GitHub({ authorization: { params: { scope: "read:user user:email public_repo" } } })]
      : []),
    ...(oauthConfigured.google ? [Google] : []),
  ],
  events: {
    async linkAccount({ account }) {
      // Keep the newest GitHub token/scope when a user re-connects.
      if (account.provider === "github" && account.access_token) {
        await db.account.update({
          where: { provider_providerAccountId: { provider: "github", providerAccountId: account.providerAccountId } },
          data: { access_token: account.access_token, scope: account.scope },
        });
      }
    },
  },
});
