import type { Blueprint } from "@/lib/schemas";

const SQL_TYPES: Record<string, string> = {
  string: "text",
  number: "integer",
  boolean: "boolean",
  date: "date",
  email: "text",
  currency: "numeric(12,2)",
  status: "text",
};

export function sqlIdent(name: string): string {
  const snake = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = snake || "col";
  return /^[0-9]/.test(safe) ? `c_${safe}` : safe;
}

export function pluralTable(entity: string): string {
  const base = sqlIdent(entity);
  return base.endsWith("s") ? base : base.endsWith("y") ? `${base.slice(0, -1)}ies` : `${base}s`;
}

/** Postgres DDL for the Blueprint's data model. */
export function generateSchemaSql(bp: Blueprint): string {
  return bp.dataModel
    .map((e) => {
      const cols = ["  id uuid primary key default gen_random_uuid()"];
      for (const f of e.fields) {
        const col = sqlIdent(f.name);
        if (col === "id") continue;
        let line = `  ${col} ${SQL_TYPES[f.type] ?? "text"}`;
        if (f.type === "email") line += ` check (${col} ~* '^[^@]+@[^@]+$')`;
        if (f.type === "status") line += ` not null default 'Open'`;
        cols.push(line);
      }
      cols.push("  created_at timestamptz not null default now()");
      return `create table ${pluralTable(e.entity)} (\n${cols.join(",\n")}\n);`;
    })
    .join("\n\n");
}
