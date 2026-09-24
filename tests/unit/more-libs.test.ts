import { describe, expect, it } from "vitest";
import { generateSchemaSql, pluralTable, sqlIdent } from "@/lib/codegen/sql";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { buildTree, languageFor } from "@/lib/file-tree";
import { authErrorMessage, safeRedirect } from "@/lib/redirects";
import { allowAttempt, resetThrottle } from "@/lib/throttle";
import { pickScenario } from "@/lib/engine/scenarios";

describe("sql codegen", () => {
  it("normalises identifiers", () => {
    expect(sqlIdent("closeDate")).toBe("close_date");
    expect(sqlIdent("Amount ($)")).toBe("amount");
    expect(sqlIdent("2fa")).toBe("c_2fa");
    expect(sqlIdent("!!!")).toBe("col");
    expect(pluralTable("Dispute")).toBe("disputes");
    expect(pluralTable("Company")).toBe("companies");
    expect(pluralTable("Status")).toBe("status");
  });

  it("emits a table per entity with typed columns", () => {
    const sql = generateSchemaSql(pickScenario("dispute"));
    expect(sql).toContain("create table disputes (");
    expect(sql).toContain("id uuid primary key default gen_random_uuid()");
    expect(sql).toContain("amount numeric(12,2)");
    expect(sql).toContain("opened date");
    expect(sql).toContain("status text not null default 'Open'");
    expect(sql.match(/create table/g)).toHaveLength(1);
  });

  it("does not duplicate an id field", () => {
    const sql = generateSchemaSql(pickScenario("support"));
    expect(sql.match(/\bid\b/g)?.length).toBe(1);
  });
});

describe("crypto", () => {
  const secret = "test-secret";
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("sk_live_123", secret);
    const b = encryptSecret("sk_live_123", secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, secret)).toBe("sk_live_123");
  });
  it("fails closed on tampering or wrong key", () => {
    const enc = encryptSecret("value", secret);
    const [iv, tag, ct] = enc.split(".");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64")].join("."), secret)).toThrow();
    expect(() => decryptSecret(enc, "other-secret")).toThrow();
    expect(() => decryptSecret("garbage", secret)).toThrow();
  });
  it("requires a secret", () => {
    expect(() => encryptSecret("x", "")).toThrow(/AUTH_SECRET/);
  });
  it("masks", () => {
    expect(maskSecret("abc")).toBe("••••");
    expect(maskSecret("sk_test_1234567890")).toMatch(/^•+7890$/);
  });
});

describe("file tree", () => {
  it("nests folders first, alphabetically", () => {
    const tree = buildTree(["README.md", "agents/b.py", "agents/a.py", "index.html", "src/app/page.tsx"]);
    expect(tree.map((n) => n.name)).toEqual(["agents", "src", "index.html", "README.md"]);
    expect(tree[0].children?.map((n) => n.path)).toEqual(["agents/a.py", "agents/b.py"]);
    expect(tree[1].children?.[0].children?.[0].path).toBe("src/app/page.tsx");
  });
  it("maps languages", () => {
    expect(languageFor("a.tsx")).toBe("typescript");
    expect(languageFor("agents/x.py")).toBe("python");
    expect(languageFor("Makefile")).toBe("plaintext");
  });
});

describe("redirects", () => {
  it.each([
    [undefined, "/home"],
    ["/p/abc", "/p/abc"],
    ["/settings#developer", "/settings#developer"],
    ["//evil.com", "/home"],
    ["/\\evil.com", "/home"],
    ["https://evil.com/phish?x=1", "/phish?x=1"],
    ["javascript:alert(1)", "/home"],
    ["/ok\r\nSet-Cookie: x", "/home"],
  ])("%s -> %s", (input, out) => {
    expect(safeRedirect(input as string | undefined)).toBe(out);
  });
  it("maps auth error codes", () => {
    expect(authErrorMessage("invalid_credentials")).toMatch(/don't match/);
    expect(authErrorMessage("SomethingNew")).toMatch(/went wrong/);
    expect(authErrorMessage(null)).toBeNull();
  });
});

describe("throttle", () => {
  it("allows up to max in the window, then blocks, then recovers", () => {
    resetThrottle();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allowAttempt("k", 3, 1000, t0 + i)).toBe(true);
    expect(allowAttempt("k", 3, 1000, t0 + 10)).toBe(false);
    expect(allowAttempt("other", 3, 1000, t0 + 10)).toBe(true);
    expect(allowAttempt("k", 3, 1000, t0 + 2000)).toBe(true);
  });
});
