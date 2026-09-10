import postgres from "postgres";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../../../.env"));
} catch {
  // Ignore if .env does not exist or already loaded
}

const MIGRATIONS_DIR = join(resolve(import.meta.dirname), "../../../../supabase/migrations");

const MIGRATION_TABLE = "_schema_migrations";

interface MigrationRow {
  filename: string;
  applied_at: Date;
}

function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function guardReset(databaseUrl: string) {
  if (!isLocalUrl(databaseUrl)) {
    const env = process.env.NODE_ENV ?? "production";
    if (["production", "demo"].includes(env)) {
      throw new Error(`Refusing to reset non-local database in environment '${env}'.`);
    }
  }
}

async function ensureMigrationsTable(sql: postgres.Sql) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      filename  text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(sql: postgres.Sql): Promise<Set<string>> {
  const rows = await sql.unsafe<MigrationRow[]>(
    `SELECT filename FROM ${MIGRATION_TABLE} ORDER BY filename`,
  );
  return new Set(rows.map((r) => r.filename));
}

async function listMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((f) => f.endsWith(".sql")).sort();
}

async function applyMigration(sql: postgres.Sql, filename: string) {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(join(MIGRATIONS_DIR, filename), "utf-8");
  if (!content.trim()) return;

  // Drizzle-generated migrations separate statements with "-- > statement-breakpoint".
  const statements = content
    .split(/--> statement-breakpoint\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }
      await tx.unsafe(`INSERT INTO ${MIGRATION_TABLE} (filename) VALUES ('${filename}')`);
    });
  } catch (err) {
    console.error(`Migration ${filename} failed; no changes from it were kept.`);
    throw err;
  }
  console.log(`✓ ${filename}`);
}

export async function migrate(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { max: 1 });
  try {
    await ensureMigrationsTable(sql);
    const applied = await getApplied(sql);
    const files = await listMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("Database is up to date.");
      return;
    }

    for (const file of pending) {
      await applyMigration(sql, file);
    }
    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await sql.end();
  }
}

export async function reset(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  guardReset(url);

  const sql = postgres(url, { max: 1 });
  try {
    console.log("Resetting public schema...");
    await sql.unsafe("DROP SCHEMA public CASCADE;");
    await sql.unsafe("CREATE SCHEMA public;");
    await sql.unsafe("GRANT ALL ON SCHEMA public TO CURRENT_USER;");
    await sql.unsafe("GRANT ALL ON SCHEMA public TO PUBLIC;");
    console.log("Public schema reset complete.");
    await migrate(url);
  } finally {
    await sql.end();
  }
}

const action = process.argv.find((a, i) => process.argv[i - 1] === "action");

if (action === "migrate") {
  migrate()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
if (action === "reset") {
  reset()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
