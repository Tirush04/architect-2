import { describe, expect, it } from "vitest";
import { escapeHtml, jsonForScript, renderAppHtml, safeHex, sampleRows } from "@/lib/engine/render-app";
import { SCENARIOS, genericBlueprint } from "@/lib/engine/scenarios";
import { BlueprintSchema } from "@/lib/schemas";

describe("escaping", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe("&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;");
  });

  it("makes JSON safe inside a script tag", () => {
    const out = jsonForScript({ s: "</script><script>alert(1)</script>", u: "a b" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain(" ");
    expect(JSON.parse(out)).toEqual({ s: "</script><script>alert(1)</script>", u: "a b" });
  });

  it("only accepts 6-digit hex colours", () => {
    expect(safeHex("#AbCdEf")).toBe("#AbCdEf");
    expect(safeHex("red")).toBe("#2346d8");
    expect(safeHex("#fff; background:url(x)")).toBe("#2346d8");
    expect(safeHex(undefined, "#000000")).toBe("#000000");
  });
});

describe("renderAppHtml", () => {
  it("renders every scenario as a complete document", () => {
    for (const s of SCENARIOS) {
      expect(BlueprintSchema.safeParse(s.blueprint).success).toBe(true);
      const html = renderAppHtml(s.blueprint);
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).toContain("</html>");
      expect(html).toContain(escapeHtml(s.blueprint.appName));
    }
  });

  it("neutralises hostile blueprint strings", () => {
    const bp = genericBlueprint("x");
    bp.appName = `<script>alert("pwn")</script>`;
    bp.pages[0].name = "</script><script>alert(2)</script>";
    bp.theme.accent = "red;}</style><script>alert(3)</script>";
    const html = renderAppHtml(bp);
    expect(html).not.toContain('<script>alert("pwn")</script>');
    expect(html).not.toContain("<script>alert(2)</script>");
    expect(html).not.toContain("alert(3)");
    expect(html).toContain("--accent: #2346d8");
  });

  it("applies dark mode", () => {
    const bp = genericBlueprint("todo app");
    bp.theme.mode = "dark";
    expect(renderAppHtml(bp)).toContain('<html lang="en" class="dark">');
  });
});

describe("sampleRows", () => {
  it("is deterministic and typed by field", () => {
    const bp = SCENARIOS[0].blueprint;
    const a = sampleRows(bp);
    expect(sampleRows(bp)).toEqual(a);
    expect(a).toHaveLength(8);
    for (const row of a) {
      expect(typeof row.amount).toBe("number");
      expect(["Open", "In review", "Resolved", "Escalated"]).toContain(row.status);
      expect(row.opened).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("returns [] without entities", () => {
    const bp = genericBlueprint("x");
    bp.dataModel = [];
    expect(sampleRows(bp)).toEqual([]);
  });
});
