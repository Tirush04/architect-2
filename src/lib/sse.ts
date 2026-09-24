import type { BuildEvent } from "@/lib/schemas";

const encoder = new TextEncoder();

export function encodeEvent(event: BuildEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/** Wrap an event generator as a text/event-stream Response. `after` runs once the generator finishes. */
export function sseResponse(
  run: (emit: (e: BuildEvent) => void, signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (e: BuildEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encodeEvent(e));
        } catch {
          open = false;
        }
      };
      try {
        await run(emit, signal);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // already closed by client disconnect
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Client-side incremental SSE parser: feed raw text, get parsed events. */
export class SseParser {
  private buf = "";
  push(text: string): BuildEvent[] {
    this.buf += text.replace(/\r\n/g, "\n");
    const out: BuildEvent[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf("\n\n")) !== -1) {
      const frame = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        out.push(JSON.parse(data) as BuildEvent);
      } catch {
        // ignore malformed frame
      }
    }
    return out;
  }
}
