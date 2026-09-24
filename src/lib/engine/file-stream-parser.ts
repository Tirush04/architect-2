export type ParserEvent =
  | { type: "start"; path: string }
  | { type: "delta"; path: string; chunk: string }
  | { type: "end"; path: string; content: string }
  | { type: "text"; text: string };

const OPEN = "<<<FILE ";
const CLOSE = "<<<END FILE>>>";

export function isSafePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 120 &&
    /^[A-Za-z0-9_][A-Za-z0-9_.\-/]*$/.test(path) &&
    !path.split("/").some((seg) => seg === ".." || seg === "") &&
    !path.startsWith("/")
  );
}

/**
 * Incremental parser for `<<<FILE path>>>\n...\n<<<END FILE>>>` blocks in a token stream.
 * Markers may be split across chunks; text outside blocks is surfaced as `text` events.
 */
export class FileStreamParser {
  private buf = "";
  private current: { path: string; content: string; safe: boolean; fresh: boolean } | null = null;

  push(chunk: string): ParserEvent[] {
    this.buf += chunk;
    const out: ParserEvent[] = [];
    for (;;) {
      if (!this.current) {
        const i = this.buf.indexOf(OPEN);
        if (i === -1) {
          const keep = partialSuffix(this.buf, OPEN);
          const text = this.buf.slice(0, this.buf.length - keep);
          if (text) out.push({ type: "text", text });
          this.buf = this.buf.slice(this.buf.length - keep);
          return out;
        }
        const close = this.buf.indexOf(">>>", i + OPEN.length);
        if (close === -1) {
          const text = this.buf.slice(0, i);
          if (text) out.push({ type: "text", text });
          this.buf = this.buf.slice(i);
          return out;
        }
        const path = this.buf.slice(i + OPEN.length, close).trim();
        if (path.includes("\n") || path.length > 200) {
          out.push({ type: "text", text: this.buf.slice(0, i + OPEN.length) });
          this.buf = this.buf.slice(i + OPEN.length);
          continue;
        }
        const before = this.buf.slice(0, i);
        if (before.trim()) out.push({ type: "text", text: before });
        this.buf = this.buf.slice(close + 3);
        const safe = isSafePath(path);
        this.current = { path, content: "", safe, fresh: true };
        if (safe) out.push({ type: "start", path });
      } else {
        if (this.current.fresh) {
          // The newline after the open marker may arrive in a later chunk.
          if (this.buf === "" || this.buf === "\r") return out;
          if (this.buf.startsWith("\r\n")) this.buf = this.buf.slice(2);
          else if (this.buf.startsWith("\n")) this.buf = this.buf.slice(1);
          this.current.fresh = false;
        }
        const j = this.buf.indexOf(CLOSE);
        if (j === -1) {
          const keep = partialSuffix(this.buf, CLOSE);
          const chunkText = this.buf.slice(0, this.buf.length - keep);
          if (chunkText) {
            this.current.content += chunkText;
            if (this.current.safe) out.push({ type: "delta", path: this.current.path, chunk: chunkText });
          }
          this.buf = this.buf.slice(this.buf.length - keep);
          return out;
        }
        const tail = this.buf.slice(0, j);
        this.current.content += tail;
        if (tail && this.current.safe) out.push({ type: "delta", path: this.current.path, chunk: tail });
        const content = this.current.content.replace(/\r?\n$/, "");
        if (this.current.safe) out.push({ type: "end", path: this.current.path, content });
        this.current = null;
        this.buf = this.buf.slice(j + CLOSE.length);
      }
    }
  }

  /** Flush at end of stream. An unterminated file is closed as-is. */
  end(): ParserEvent[] {
    const out: ParserEvent[] = [];
    if (this.current) {
      this.current.content += this.buf;
      if (this.current.safe) out.push({ type: "end", path: this.current.path, content: this.current.content.replace(/\r?\n$/, "") });
      this.current = null;
    } else if (this.buf.trim()) {
      out.push({ type: "text", text: this.buf });
    }
    this.buf = "";
    return out;
  }
}

/** Length of the longest suffix of `s` that is a proper prefix of `marker`. */
export function partialSuffix(s: string, marker: string): number {
  const max = Math.min(s.length, marker.length - 1);
  for (let n = max; n > 0; n--) {
    if (marker.startsWith(s.slice(s.length - n))) return n;
  }
  return 0;
}
