import { NextResponse } from "next/server";

export const LIMITS = {
  small: 32 * 1024,
  medium: 512 * 1024,
  upload: 4 * 1024 * 1024,
} as const;

type Result = { ok: true; data: unknown } | { ok: false; response: Response };

const tooLarge = (max: number) =>
  NextResponse.json({ error: `Request body too large (max ${Math.round(max / 1024)} KB)` }, { status: 413 });

/** Read a JSON body without buffering more than `max` bytes. Malformed/empty JSON yields `data: null`. */
export async function readJson(req: Request, max: number): Promise<Result> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return { ok: false, response: tooLarge(max) };
  if (!req.body) return { ok: true, data: null };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return { ok: false, response: tooLarge(max) };
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  try {
    return { ok: true, data: text ? JSON.parse(text) : null };
  } catch {
    return { ok: true, data: null };
  }
}
