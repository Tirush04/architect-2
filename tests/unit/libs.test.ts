import { describe, expect, it } from "vitest";
import { diffFiles, lineDiffStats } from "@/lib/diff";
import { SseParser, encodeEvent } from "@/lib/sse";
import { usageStatus, type UsageStore } from "@/lib/rate-limit";
import { API_KEY_PREFIX, generateApiKey, hashApiKey, parseBearer, safeEqualHex } from "@/lib/api-keys";
import { newShareSlug, sharedAppHeaders } from "@/lib/share";
import { cn, slugify, timeAgo, titleFromPrompt } from "@/lib/utils";
import { SignupSchema, CreateProjectSchema } from "@/lib/schemas";

describe("diff", () => {
  it("counts line changes", () => {
    expect(lineDiffStats("a\nb\nc", "a\nb\nc")).toEqual({ added: 0, removed: 0 });
    expect(lineDiffStats("a\nb\nc", "a\nX\nc")).toEqual({ added: 1, removed: 1 });
    expect(lineDiffStats("a", "a\nb\nc")).toEqual({ added: 2, removed: 0 });
  });

  it("classifies file changes", () => {
    const out = diffFiles({ "a.txt": "1", "b.txt": "x" }, { "a.txt": "2", "c.txt": "new\nfile" });
    expect(out).toEqual([
      { path: "a.txt", kind: "modified", added: 1, removed: 1 },
      { path: "b.txt", kind: "removed", added: 0, removed: 1 },
      { path: "c.txt", kind: "added", added: 2, removed: 0 },
    ]);
  });

  it("handles very large inputs without blowing up", () => {
    const a = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join("\n");
    const b = Array.from({ length: 3000 }, (_, i) => `row ${i}`).join("\n");
    expect(lineDiffStats(a, b)).toEqual({ added: 3000, removed: 3000 });
  });
});

describe("SSE", () => {
  it("round-trips events across arbitrary chunking", () => {
    const events = [
      { type: "status" as const, text: "hello\nworld" },
      { type: "file" as const, path: "index.html", content: "<p>data: x</p>\n\n" },
    ];
    const raw = events.map((e) => new TextDecoder().decode(encodeEvent(e))).join("");
    for (let i = 1; i < raw.length; i += 7) {
      const p = new SseParser();
      const got = [...p.push(raw.slice(0, i)), ...p.push(raw.slice(i))];
      expect(got).toEqual(events);
    }
  });

  it("ignores malformed frames", () => {
    expect(new SseParser().push("data: {nope\n\ndata: {\"type\":\"status\",\"text\":\"ok\"}\n\n")).toEqual([
      { type: "status", text: "ok" },
    ]);
  });
});

describe("usageStatus", () => {
  const store = (n: number): UsageStore => ({ countSince: async () => n, record: async () => {} });
  it("computes remaining and overLimit", async () => {
    expect(await usageStatus(store(3), "u", "ai", new Date(), 5)).toEqual({ used: 3, limit: 5, remaining: 2, overLimit: false });
    expect((await usageStatus(store(5), "u", "ai", new Date(), 5)).overLimit).toBe(true);
    expect((await usageStatus(store(9), "u", "ai", new Date(), 5)).remaining).toBe(0);
  });
  it("queries a rolling 24h window", async () => {
    let since: Date | null = null;
    const now = new Date("2026-09-24T12:00:00Z");
    await usageStatus({ countSince: async (_u, _k, s) => ((since = s), 0), record: async () => {} }, "u", "ai", now, 5);
    expect(since!.toISOString()).toBe("2026-09-23T12:00:00.000Z");
  });
});

describe("api keys", () => {
  it("generates prefixed keys whose hash matches", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix).toBe(key.slice(0, 12));
    expect(hashApiKey(key)).toBe(hash);
    expect(safeEqualHex(hash, hashApiKey(key))).toBe(true);
    expect(safeEqualHex(hash, hashApiKey(key + "x"))).toBe(false);
    expect(safeEqualHex("ab", "abcd")).toBe(false);
  });
  it("parses bearer headers strictly", () => {
    expect(parseBearer("Bearer arch_abc")).toBe("arch_abc");
    expect(parseBearer("bearer arch_abc")).toBe("arch_abc");
    expect(parseBearer("Bearer sk-other")).toBeNull();
    expect(parseBearer("arch_abc")).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });
});

describe("share", () => {
  it("builds readable unique slugs", () => {
    const a = newShareSlug("Dispute Desk!");
    expect(a).toMatch(/^dispute-desk-[a-z2-9]{10}$/);
    expect(newShareSlug("Dispute Desk!")).not.toBe(a);
    expect(newShareSlug("***")).toMatch(/^app-/);
  });
  it("serves generated apps in a sandbox without same-origin", () => {
    const csp = sharedAppHeaders()["Content-Security-Policy"];
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
  });
  it("is never cached, so redeploys and rollbacks show up immediately", () => {
    expect(sharedAppHeaders()["Cache-Control"]).toBe("no-store");
  });
});

describe("utils", () => {
  it("slugify", () => expect(slugify("  Hello, World! ")).toBe("hello-world"));
  it("cn merges tailwind classes", () => expect(cn("p-2", false && "x", "p-4")).toBe("p-4"));
  it("timeAgo", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(timeAgo(new Date("2026-09-24T11:59:50Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-09-24T11:30:00Z"), now)).toBe("30m ago");
    expect(timeAgo("2026-09-24T07:00:00Z", now)).toBe("5h ago");
    expect(timeAgo("2026-09-21T12:00:00Z", now)).toBe("3d ago");
  });
  it("titleFromPrompt", () => {
    expect(titleFromPrompt("Build me a habit tracker for runners. It should...")).toBe("Habit tracker for runners");
    expect(titleFromPrompt("create an app")).toBe("App");
    expect(titleFromPrompt("!!")).toBe("Untitled app");
  });
});

describe("schemas", () => {
  it("validates signup", () => {
    expect(SignupSchema.safeParse({ name: "A", email: "A@B.co ", password: "abcdefg1" }).data?.email).toBe("a@b.co");
    expect(SignupSchema.safeParse({ name: "A", email: "a@b.co", password: "short1" }).success).toBe(false);
    expect(SignupSchema.safeParse({ name: "A", email: "a@b.co", password: "noNumbersHere" }).success).toBe(false);
  });
  it("validates project prompts", () => {
    expect(CreateProjectSchema.safeParse({ prompt: "  " }).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ prompt: "x".repeat(4001) }).success).toBe(false);
    expect(CreateProjectSchema.safeParse({ prompt: "todo app" }).success).toBe(true);
  });
});
