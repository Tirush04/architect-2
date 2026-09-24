import NextAuth, { CredentialsSignin } from "next-auth";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { LoginSchema } from "@/lib/schemas";
import { authConfig } from "./auth.config";
import { allowAttempt } from "@/lib/throttle";
import { encryptSecret } from "@/lib/crypto";

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

const enc = (v: string | null | undefined) => (v ? encryptSecret(v) : v);

/** Prisma adapter that encrypts OAuth tokens at rest and drops the unused id_token. */
function encryptingAdapter(): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    linkAccount: (account: AdapterAccount) =>
      base.linkAccount!({
        ...account,
        access_token: enc(account.access_token) ?? undefined,
        refresh_token: enc(account.refresh_token) ?? undefined,
        id_token: undefined,
      }),
  };
}

function clientIp(req: Request | undefined): string {
  const fwd = req?.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req?.headers.get("x-real-ip") || "unknown";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: encryptingAdapter(),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const { email, password } = parsed.data;
        const window = 15 * 60 * 1000;
        if (!allowAttempt(`login-ip:${clientIp(request)}`, 50, window) || !allowAttempt(`login:${email}`, 10, window)) {
          throw new TooManyAttempts();
        }
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
    // Re-connecting GitHub returns a fresh token (and maybe new scopes); linkAccount only runs the first time.
    async signIn({ account }) {
      if (account?.provider === "github" && account.access_token) {
        await db.account.updateMany({
          where: { provider: "github", providerAccountId: account.providerAccountId },
          data: { access_token: encryptSecret(account.access_token), scope: account.scope ?? null },
        });
      }
    },
  },
});
