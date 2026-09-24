"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, FieldError, Input, Label } from "@/components/ui";
import { loginAction, oauthAction, signupAction, type FormState } from "./actions";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12Z" />
    </svg>
  );
}

export function OAuthButtons({
  configured,
  prompt,
  callbackUrl,
}: {
  configured: { github: boolean; google: boolean };
  prompt?: string;
  callbackUrl?: string;
}) {
  const providers = [
    { id: "google", label: "Continue with Google", icon: <GoogleIcon />, on: configured.google },
    { id: "github", label: "Continue with GitHub", icon: <GitHubIcon />, on: configured.github },
  ];
  return (
    <div className="grid gap-2">
      {providers.map((p) => (
        <form key={p.id} action={oauthAction}>
          <input type="hidden" name="provider" value={p.id} />
          {prompt && <input type="hidden" name="prompt" value={prompt} />}
          {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full"
            disabled={!p.on}
            title={p.on ? undefined : "Not configured on this deployment"}
          >
            {p.icon}
            {p.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

function PasswordField({ error, autoComplete }: { error?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={!!error}
          aria-describedby={error ? "password-error" : undefined}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError id="password-error">{error}</FieldError>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-ink-3">
      <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function SignupForm({ configured, prompt }: { configured: { github: boolean; google: boolean }; prompt?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <OAuthButtons configured={configured} prompt={prompt} />
      <Divider />
      <form action={action} className="grid gap-4" noValidate>
        {prompt && <input type="hidden" name="prompt" value={prompt} />}
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name} aria-invalid={!!fe.name} aria-describedby={fe.name ? "name-error" : undefined} />
          <FieldError id="name-error">{fe.name}</FieldError>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} aria-invalid={!!fe.email} aria-describedby={fe.email ? "email-error" : undefined} />
          <FieldError id="email-error">{fe.email}</FieldError>
        </div>
        <PasswordField error={fe.password} autoComplete="new-password" />
        <p className="-mt-2 text-[12px] text-ink-3">8+ characters, with a letter and a number.</p>
        <FieldError>{state.error}</FieldError>
        <Button type="submit" size="lg" loading={pending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href={prompt ? `/login?prompt=${encodeURIComponent(prompt)}` : "/login"} className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function LoginForm({
  configured,
  callbackUrl,
  initialError,
}: {
  configured: { github: boolean; google: boolean };
  callbackUrl?: string;
  initialError?: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const error = state.error ?? initialError ?? undefined;
  return (
    <>
      <OAuthButtons configured={configured} callbackUrl={callbackUrl} />
      <Divider />
      <form action={action} className="grid gap-4">
        {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        </div>
        <PasswordField autoComplete="current-password" />
        {error && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}
        <Button type="submit" size="lg" loading={pending}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        New to Architect?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
