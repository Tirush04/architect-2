import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_PREFIX = "arch_";

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `${API_KEY_PREFIX}${secret}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m || !m[1].startsWith(API_KEY_PREFIX) || m[1].length > 100) return null;
  return m[1];
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
