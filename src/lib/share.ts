import { customAlphabet } from "nanoid";

const alphabet = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 10);

export function newShareSlug(appName: string): string {
  const base = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "app"}-${alphabet()}`;
}

/**
 * Headers for serving user-generated HTML. `sandbox` gives the document an opaque origin,
 * so generated scripts can't read Architect's cookies or call its APIs as the user.
 */
export function sharedAppHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy":
      "sandbox allow-scripts allow-forms allow-popups allow-modals; frame-ancestors 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "public, max-age=60",
  };
}

export const PREVIEW_SANDBOX = "allow-scripts allow-forms allow-modals";
