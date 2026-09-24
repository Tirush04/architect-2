import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(secret = process.env.AUTH_SECRET ?? ""): Buffer {
  if (!secret) throw new Error("AUTH_SECRET is required to encrypt secrets");
  return createHash("sha256").update(`architect-env:${secret}`).digest();
}

/** AES-256-GCM; output is base64(iv).base64(tag).base64(ciphertext). */
export function encryptSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string, secret?: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !enc) throw new Error("Malformed secret");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}
