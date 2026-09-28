export interface ISqliteDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastInsertRowId?: number; changes?: number }>;
  getAllAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
}

/**
 * In-memory SQLite emulator for Vitest test environments or environments
 * without native Expo SQLite bindings.
 */
export class InMemorySqliteDatabase implements ISqliteDatabase {
  private tables = new Map<string, Array<Record<string, unknown>>>();

  async execAsync(sql: string): Promise<void> {
    // Extract CREATE TABLE IF NOT EXISTS tableName
    const matches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
    for (const match of matches) {
      const name = match[1]?.toLowerCase();
      if (name && !this.tables.has(name)) {
        this.tables.set(name, []);
      }
    }
  }

  async runAsync(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastInsertRowId?: number; changes?: number }> {
    const trimmed = sql.replace(/\s+/g, " ").trim();
    const insertMatch = trimmed.match(
      /^INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
    );
    if (insertMatch) {
      const table = insertMatch[1]?.toLowerCase();
      const cols = insertMatch[2]?.split(",").map((c) => c.trim()) ?? [];
      const valExprs = insertMatch[3]?.split(",").map((v) => v.trim()) ?? [];
      let rows = this.tables.get(table ?? "") ?? [];
      const newRow: Record<string, unknown> = {};
      let paramIdx = 0;
      cols.forEach((col, idx) => {
        const valExpr = valExprs[idx];
        if (valExpr === "?") {
          newRow[col] = params[paramIdx++];
        } else if (valExpr?.startsWith("'") && valExpr.endsWith("'")) {
          newRow[col] = valExpr.slice(1, -1);
        } else if (valExpr !== undefined && !Number.isNaN(Number(valExpr))) {
          newRow[col] = Number(valExpr);
        } else {
          newRow[col] = params[paramIdx++];
        }
      });
      const pk = newRow.id ? "id" : newRow.operation_id ? "operation_id" : null;
      if (pk) {
        rows = rows.filter((r) => r[pk] !== newRow[pk]);
      }
      rows.push(newRow);
      this.tables.set(table ?? "", rows);
      return { changes: 1, lastInsertRowId: rows.length };
    }

    const updateMatch = trimmed.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (updateMatch) {
      const table = updateMatch[1]?.toLowerCase();
      const setClause = updateMatch[2] ?? "";
      const whereClause = updateMatch[3] ?? "";
      const rows = this.tables.get(table ?? "") ?? [];

      const setPairs = setClause.split(",").map((p) => p.trim());
      let whereVal: unknown = undefined;
      let whereCol: string | null = null;
      const whereMatch = whereClause.match(/(\w+)\s*=\s*(?:\?|'([^']*)')/i);
      if (whereMatch && whereMatch[1]) {
        whereCol = whereMatch[1].toLowerCase();
        whereVal = whereMatch[2] !== undefined ? whereMatch[2] : params[params.length - 1];
      }

      for (const row of rows) {
        if (!whereCol || row[whereCol] === whereVal) {
          let paramIdx = 0;
          for (const pair of setPairs) {
            const parts = pair.split("=").map((s) => s.trim());
            const col = parts[0]?.toLowerCase();
            const valExpr = parts[1];
            if (col) {
              if (valExpr === "?") {
                row[col] = params[paramIdx++];
              } else if (valExpr === "null") {
                row[col] = null;
              } else if (valExpr?.startsWith("'") && valExpr.endsWith("'")) {
                row[col] = valExpr.slice(1, -1);
              }
            }
          }
        }
      }
      return { changes: rows.length };
    }

    const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
    if (deleteMatch) {
      const table = deleteMatch[1]?.toLowerCase();
      const whereClause = deleteMatch[2];
      if (table) {
        if (!whereClause) {
          this.tables.set(table, []);
        } else {
          const whereMatch = whereClause.match(/(\w+)\s*=\s*(?:\?|'([^']*)')/i);
          if (whereMatch && whereMatch[1]) {
            const whereCol = whereMatch[1].toLowerCase();
            const whereVal = whereMatch[2] !== undefined ? whereMatch[2] : params[0];
            const rows = (this.tables.get(table) ?? []).filter((r) => r[whereCol] !== whereVal);
            this.tables.set(table, rows);
          }
        }
      }
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const trimmed = sql.replace(/\s+/g, " ").trim();
    const fromMatch = trimmed.match(/FROM\s+(\w+)(?:\s+WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s*$))?/i);
    if (!fromMatch) return [];
    const table = fromMatch[1]?.toLowerCase();
    const whereClause = fromMatch[2]?.trim() ?? "";
    const rows = this.tables.get(table ?? "") ?? [];

    let filtered = [...rows];
    if (whereClause) {
      const whereMatch = whereClause.match(/(\w+)\s*=\s*(?:\?|'([^']*)')/i);
      if (whereMatch && whereMatch[1]) {
        const col = whereMatch[1].toLowerCase();
        const val = whereMatch[2] !== undefined ? whereMatch[2] : params[0];
        filtered = filtered.filter((r) => r[col] === val);
      }
    }

    const orderMatch = trimmed.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch && orderMatch[1]) {
      const orderCol = orderMatch[1].toLowerCase();
      const isDesc = orderMatch[2]?.toUpperCase() === "DESC";
      filtered.sort((a, b) => {
        const valA = a[orderCol];
        const valB = b[orderCol];
        if (valA === valB) return 0;
        if (valA == null) return isDesc ? 1 : -1;
        if (valB == null) return isDesc ? -1 : 1;
        const cmp = valA < valB ? -1 : 1;
        return isDesc ? -cmp : cmp;
      });
    }

    return filtered as T[];
  }

  async getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all.length > 0 ? (all[0] ?? null) : null;
  }
}

export const DDL_SCHEMA = `
CREATE TABLE IF NOT EXISTS offline_operations (
  operation_id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  code TEXT,
  error_message TEXT,
  result_data TEXT,
  client_timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS cached_inspections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_code TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  district_id TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  started_at TEXT,
  submitted_at TEXT,
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_observations (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_local INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cached_finding_drafts (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  observation_id TEXT,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  remediation TEXT,
  sync_state TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cached_evidence (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  file_name TEXT,
  content_hash TEXT,
  upload_state TEXT NOT NULL,
  integrity_state TEXT NOT NULL,
  local_file_uri TEXT,
  created_at TEXT NOT NULL,
  is_local INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media_upload_queue (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  local_file_uri TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  content_hash TEXT NOT NULL,
  upload_status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  uploaded_at TEXT
);

CREATE TABLE IF NOT EXISTS cached_checklist_items (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  is_required INTEGER NOT NULL DEFAULT 1,
  response TEXT,
  note TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cached_call_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_online INTEGER NOT NULL DEFAULT 1,
  avatar_color TEXT NOT NULL,
  video_uri TEXT
);

CREATE TABLE IF NOT EXISTS cached_call_history (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_title TEXT NOT NULL,
  role TEXT NOT NULL,
  project_name TEXT NOT NULL,
  project_code TEXT NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'video',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  condition TEXT NOT NULL,
  review_text TEXT NOT NULL,
  flag_inspection INTEGER NOT NULL DEFAULT 0,
  video_uri TEXT,
  inspector_video_uri TEXT,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  status TEXT NOT NULL DEFAULT 'answered',
  created_at TEXT NOT NULL
);
`;

interface ExpoSQLiteLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown): Promise<{ lastInsertRowId?: number; changes?: number }>;
  getAllAsync<T>(sql: string, params?: unknown): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown): Promise<T | null>;
}

class ExpoSqliteAdapter implements ISqliteDatabase {
  constructor(private readonly db: ExpoSQLiteLike) { }

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastInsertRowId?: number; changes?: number }> {
    const res = await this.db.runAsync(sql, params ?? []);
    return {
      lastInsertRowId: res?.lastInsertRowId,
      changes: res?.changes,
    };
  }

  async getAllAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params ?? []);
  }

  async getFirstAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params ?? []);
  }
}

let currentDb: ISqliteDatabase | null = null;

export async function getOfflineDatabase(): Promise<ISqliteDatabase> {
  if (currentDb) return currentDb;

  // Detect React Native lazily: a static import here would pull react-native's
  // Flow-typed source into every plain-node import chain (runtime verification
  // scripts, tsx), which cannot parse it. A dynamic require fails cleanly
  // outside the mobile bundle, mirroring the expo-sqlite pattern below.
  let isNativeMobile = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native");
    isNativeMobile = Platform.OS === "android" || Platform.OS === "ios";
  } catch {
    isNativeMobile = false;
  }

  if (isNativeMobile && !(typeof process !== "undefined" && process.env?.VITEST)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const SQLite = require("expo-sqlite");
      if (SQLite && typeof SQLite.openDatabaseAsync === "function") {
        const nativeDb = await SQLite.openDatabaseAsync("netram_inspector.db");
        await nativeDb.execAsync(DDL_SCHEMA);
        const adapter = new ExpoSqliteAdapter(nativeDb);
        currentDb = adapter;
        return adapter;
      }
    } catch {
      // Fall back to in-memory database in case native module is unavailable
    }
  }

  const inMem = new InMemorySqliteDatabase();
  await inMem.execAsync(DDL_SCHEMA);
  currentDb = inMem;
  return inMem;
}

export function setTestDatabase(db: ISqliteDatabase | null) {
  currentDb = db;
}
