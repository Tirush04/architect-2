// Local Postgres for dev/tests without Docker. Usage: node scripts/dev-db.mjs [--fresh]
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const port = Number(process.env.PGPORT_LOCAL ?? 5433);
const dataDir = path.resolve(process.env.PGDATA_LOCAL ?? ".data/pg");
const fresh = process.argv.includes("--fresh");

if (fresh && existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "architect",
  password: "architect",
  port,
  persistent: true,
  onLog: () => {},
});

const initialised = existsSync(path.join(dataDir, "PG_VERSION"));
if (!initialised) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("architect");
} catch {
  // already exists
}
console.log(`postgres ready on :${port}  DATABASE_URL=postgresql://architect:architect@localhost:${port}/architect`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
