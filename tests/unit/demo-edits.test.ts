import { describe, expect, it } from "vitest";
import { applyDemoEdit } from "@/lib/engine/demo-edits";
import { pickScenario, genericBlueprint } from "@/lib/engine/scenarios";

const base = () => pickScenario("dispute");

describe("applyDemoEdit", () => {
  it("changes accent by colour word", () => {
    const r = applyDemoEdit(base(), "Make the buttons green");
    expect(r.blueprint.theme.accent).toBe("#16a34a");
    expect(r.changes[0]).toMatch(/green/);
  });

  it("changes accent by hex", () => {
    expect(applyDemoEdit(base(), "use #FF00aa please").blueprint.theme.accent).toBe("#ff00aa");
  });

  it("toggles dark/light", () => {
    const dark = applyDemoEdit(base(), "switch to dark mode").blueprint;
    expect(dark.theme.mode).toBe("dark");
    expect(applyDemoEdit(dark, "go back to light").blueprint.theme.mode).toBe("light");
  });

  it("renames the app", () => {
    expect(applyDemoEdit(base(), "rename the app to atlas ops").blueprint.appName).toBe("Atlas Ops");
    expect(applyDemoEdit(base(), "call it Beacon.").blueprint.appName).toBe("Beacon");
  });

  it("adds and removes pages without duplicates", () => {
    const added = applyDemoEdit(base(), "add a page called Audit log").blueprint;
    expect(added.pages.at(-1)?.name).toBe("Audit Log");
    expect(applyDemoEdit(added, "add a page called audit log").changes).toHaveLength(0);
    const removed = applyDemoEdit(added, "remove the insights page").blueprint;
    expect(removed.pages.some((p) => p.name === "Insights")).toBe(false);
  });

  it("adds an agent", () => {
    const r = applyDemoEdit(genericBlueprint("x"), "add an agent that sends weekly summaries");
    expect(r.blueprint.agents).toHaveLength(2);
    expect(r.blueprint.agents[1].name).toBe("Sends Weekly Agent");
  });

  it("does not mutate the input", () => {
    const bp = base();
    const snapshot = JSON.stringify(bp);
    applyDemoEdit(bp, "make it red and dark");
    expect(JSON.stringify(bp)).toBe(snapshot);
  });

  it("reports no changes for unknown requests", () => {
    expect(applyDemoEdit(base(), "refactor the reducer").changes).toEqual([]);
  });
});

describe("pickScenario", () => {
  it.each([
    ["handle chargebacks", "DisputeDesk"],
    ["a helpdesk for tickets", "Helpline"],
    ["screen candidates", "Shortlist"],
    ["a CRM for leads", "Pipeline Pilot"],
  ])("%s -> %s", (prompt, name) => {
    expect(pickScenario(prompt).appName).toBe(name);
  });

  it("falls back to a generic blueprint named from the prompt", () => {
    expect(pickScenario("Build me a plant watering tracker").appName).toBe("Plant watering tracker");
  });

  it("returns independent copies", () => {
    const a = pickScenario("dispute");
    a.appName = "changed";
    expect(pickScenario("dispute").appName).toBe("DisputeDesk");
  });
});
