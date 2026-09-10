import { and, eq } from "drizzle-orm";
import { users, identities } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
}

function toUser(row: {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
}): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
  };
}

export class UserRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const r = rows[0];
    return r ? toUser(r) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const r = rows[0];
    return r ? toUser(r) : null;
  }

  async findByIdentity(provider: string, providerSubject: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select({ user: users })
      .from(identities)
      .innerJoin(users, eq(identities.userId, users.id))
      .where(
        and(eq(identities.provider, provider), eq(identities.providerSubject, providerSubject)),
      )
      .limit(1);
    const r = rows[0];
    return r ? toUser(r.user) : null;
  }
}
