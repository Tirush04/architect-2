/** Only allow same-site relative paths as post-auth destinations (prevents open redirects). */
export function safeRedirect(target: string | null | undefined, fallback = "/home"): string {
  if (!target) return fallback;
  let t = target;
  try {
    // Accept absolute URLs only if they point at our own path space; strip origin.
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      t = u.pathname + u.search;
    }
  } catch {
    return fallback;
  }
  if (!t.startsWith("/") || t.startsWith("//") || t.startsWith("/\\") || /[\r\n]/.test(t)) return fallback;
  return t;
}

export const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Try again or reset your password.",
  too_many_attempts: "Too many attempts. Wait a few minutes and try again.",
  OAuthAccountNotLinked:
    "This email is already registered with a password. Sign in with your password, then connect this provider from Settings.",
  AccessDenied: "Access was denied by the provider.",
  Configuration: "Sign-in is misconfigured on the server. Try email and password.",
  Default: "Something went wrong signing you in. Please try again.",
};

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERRORS[code] ?? AUTH_ERRORS.Default;
}
