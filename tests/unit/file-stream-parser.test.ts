import { describe, expect, it } from "vitest";
import { FileStreamParser, isSafePath, partialSuffix, type ParserEvent } from "@/lib/engine/file-stream-parser";

function feed(chunks: string[]): ParserEvent[] {
  const p = new FileStreamParser();
  const out: ParserEvent[] = [];
  for (const c of chunks) out.push(...p.push(c));
  out.push(...p.end());
  return out;
}

const ends = (evs: ParserEvent[]) => evs.filter((e) => e.type === "end") as Extract<ParserEvent, { type: "end" }>[];
const text = (evs: ParserEvent[]) =>
  evs
    .filter((e) => e.type === "text")
    .map((e) => (e as { text: string }).text)
    .join("");

describe("FileStreamParser", () => {
  const doc = "<<<FILE index.html>>>\n<html><body>hi</body></html>\n<<<END FILE>>>\nBuilt a tiny page.";

  it("parses a complete block in one chunk", () => {
    const evs = feed([doc]);
    expect(evs[0]).toEqual({ type: "start", path: "index.html" });
    expect(ends(evs)).toEqual([{ type: "end", path: "index.html", content: "<html><body>hi</body></html>" }]);
    expect(text(evs).trim()).toBe("Built a tiny page.");
  });

  it("is chunk-boundary independent (every split point)", () => {
    for (let i = 1; i < doc.length; i++) {
      const evs = feed([doc.slice(0, i), doc.slice(i)]);
      expect(ends(evs)[0]?.content).toBe("<html><body>hi</body></html>");
      expect(text(evs).trim()).toBe("Built a tiny page.");
    }
  });

  it("handles one character at a time", () => {
    const evs = feed(doc.split(""));
    expect(ends(evs)[0].content).toBe("<html><body>hi</body></html>");
    const deltas = evs.filter((e) => e.type === "delta").map((e) => (e as { chunk: string }).chunk).join("");
    expect(deltas.replace(/\n$/, "")).toBe("<html><body>hi</body></html>");
  });

  it("parses multiple files", () => {
    const evs = feed(["<<<FILE a.js>>>\nA\n<<<END FILE>>>\n<<<FILE b/c.py>>>\nB\n<<<END FILE>>>"]);
    expect(ends(evs).map((e) => [e.path, e.content])).toEqual([
      ["a.js", "A"],
      ["b/c.py", "B"],
    ]);
  });

  it("closes an unterminated file at end of stream", () => {
    const evs = feed(["<<<FILE index.html>>>\n<html>partial"]);
    expect(ends(evs)[0]).toEqual({ type: "end", path: "index.html", content: "<html>partial" });
  });

  it("drops files with unsafe paths but still consumes them", () => {
    const evs = feed(["<<<FILE ../etc/passwd>>>\nroot\n<<<END FILE>>>after"]);
    expect(ends(evs)).toHaveLength(0);
    expect(evs.some((e) => e.type === "start")).toBe(false);
    expect(text(evs)).toBe("after");
  });

  it("treats a stray marker without a valid path as text", () => {
    const evs = feed(["see <<<FILE \nnot a file"]);
    expect(ends(evs)).toHaveLength(0);
    expect(text(evs)).toContain("not a file");
  });

  it("handles CRLF after the open marker", () => {
    const evs = feed(["<<<FILE x.txt>>>\r\nhello\r\n<<<END FILE>>>"]);
    expect(ends(evs)[0].content).toBe("hello");
  });
});

describe("isSafePath", () => {
  it.each(["index.html", "agents/intake_agent.py", "src/app/page.tsx", "README.md"])("accepts %s", (p) => {
    expect(isSafePath(p)).toBe(true);
  });
  it.each(["", "/etc/passwd", "../x", "a/../b", "a//b", ".env", "a b.txt", "x".repeat(121)])("rejects %s", (p) => {
    expect(isSafePath(p)).toBe(false);
  });
});

describe("partialSuffix", () => {
  it("finds the longest proper-prefix suffix", () => {
    expect(partialSuffix("abc<<<FI", "<<<FILE ")).toBe(5);
    expect(partialSuffix("abc", "<<<FILE ")).toBe(0);
    expect(partialSuffix("<", "<<<FILE ")).toBe(1);
  });
});
