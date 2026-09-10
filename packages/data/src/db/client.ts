import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

let _client: postgres.Sql | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getClient(databaseUrl: string): postgres.Sql {
  if (!_client) {
    _client = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _client;
}

export function getDb(databaseUrl?: string) {
  if (!_db) {
    const url = databaseUrl ?? process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    const client = getClient(url);
    _db = drizzle(client, { schema });
  }
  return _db;
}

export async function closeClient(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

/** Lightweight connection check used by readiness probes. */
export async function pingDatabase(db: DrizzleDB): Promise<void> {
  await db.execute(sql`SELECT 1`);
}

export type DrizzleDB = ReturnType<typeof getDb>;
