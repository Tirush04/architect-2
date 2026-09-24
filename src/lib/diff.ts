import type { Files } from "@/lib/schemas";

export type FileChange = { path: string; kind: "added" | "removed" | "modified"; added: number; removed: number };

/** Line-level added/removed counts via LCS (bounded for large files). */
export function lineDiffStats(before: string, after: string): { added: number; removed: number } {
  if (before === after) return { added: 0, removed: 0 };
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);
  if (midA.length * midB.length > 4_000_000) {
    // Too large for LCS: fall back to set-based estimate.
    const setA = new Set(midA);
    const setB = new Set(midB);
    return { added: midB.filter((l) => !setA.has(l)).length, removed: midA.filter((l) => !setB.has(l)).length };
  }
  const prev = new Array<number>(midB.length + 1).fill(0);
  for (let i = 1; i <= midA.length; i++) {
    let diag = 0;
    for (let j = 1; j <= midB.length; j++) {
      const tmp = prev[j];
      prev[j] = midA[i - 1] === midB[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  const lcs = prev[midB.length];
  return { added: midB.length - lcs, removed: midA.length - lcs };
}

export function diffFiles(before: Files, after: Files): FileChange[] {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: FileChange[] = [];
  for (const path of [...paths].sort()) {
    const a = before[path];
    const b = after[path];
    if (a === undefined && b !== undefined) out.push({ path, kind: "added", added: b.split("\n").length, removed: 0 });
    else if (b === undefined && a !== undefined) out.push({ path, kind: "removed", added: 0, removed: a.split("\n").length });
    else if (a !== b) out.push({ path, kind: "modified", ...lineDiffStats(a, b) });
  }
  return out;
}
