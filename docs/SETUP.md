# Deploying Architect 2.0

About 20 minutes. Order matters, because the OAuth callback URLs need the final domain.

## 1. GitHub repo
Create an **empty public** repo (e.g. `architect-2`) and push this branch:
```bash
git remote add origin https://github.com/<you>/architect-2.git
git push -u origin build:main
```

## 2. Vercel + Neon
1. vercel.com → **Add New Project** → import the repo. Framework: Next.js (defaults are fine).
2. In the project → **Storage** → **Create Database** → **Neon Postgres** (free). This sets `DATABASE_URL`.
3. **Settings → Environment Variables**:
   | Key | Value |
   |---|---|
   | `AUTH_SECRET` | output of `npx auth secret` |
   | `AUTH_TRUST_HOST` | `true` |
   | `ANTHROPIC_API_KEY` | your key (optional: without it the demo engine runs) |
   | `ARCHITECT_MODEL` | `claude-opus-5` (or `claude-sonnet-5` for lower cost) |
   | `ARCHITECT_DAILY_LIMIT` | `25` |
4. Create the tables once, from your machine, against Neon:
   ```bash
   DATABASE_URL="<neon url>" npx prisma db push
   ```
5. Deploy. Note the domain, e.g. `https://architect-2.vercel.app`.

## 3. GitHub OAuth (sign-in, import, push)
github.com → Settings → Developer settings → **OAuth Apps → New**
- Homepage: `https://architect-2.vercel.app`
- Callback: `https://architect-2.vercel.app/api/auth/callback/github`

Add `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` to Vercel. For local dev, create a second OAuth app with
`http://localhost:3000/api/auth/callback/github`.

## 4. Google sign-in
console.cloud.google.com → APIs & Services → **Credentials → Create OAuth client ID** (Web application)
- Authorised redirect URI: `https://architect-2.vercel.app/api/auth/callback/google`
- OAuth consent screen: External, add your email as a test user (or publish)

Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to Vercel, then **Redeploy**.

## 5. Smoke test the live site
```bash
npx playwright install chromium
BASE_URL=https://architect-2.vercel.app ARCHITECT_FAKE_LLM=1 npx playwright test tests/e2e/public.spec.ts tests/e2e/security.spec.ts
```
(The full golden path also runs against production, but it creates real users and projects.)
