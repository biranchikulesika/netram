import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../db/client.js";
import {
  organisations,
  programmes,
  roleAssignments,
  users,
  districts,
  states,
} from "../db/schema.js";

export interface OrganisationRow {
  id: string;
  code: string;
  name: string;
  category: string;
  authorityId: string | null;
  createdAt: Date;
}

export interface ProgrammeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  stateId: string | null;
  districtId: string | null;
  authorityId: string | null;
  createdAt: Date;
}

export interface CreateOrganisationCmd {
  code: string;
  name: string;
  category: string;
  authorityId: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
}

export interface CreateProgrammeCmd {
  code: string;
  name: string;
  description: string | null;
  scopeLevel: string;
  stateId: string | null;
  districtId: string | null;
  authorityId: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
}

export interface UpsertInvitedUserCmd {
  email: string;
  displayName: string;
  /** Optional contact phone captured at registration. */
  phone: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
}

/** Registry data access: agencies, programmes, and invited people. */
export class RegistryRepository {
  constructor(private readonly db: DrizzleDB) {}
  async organisationExists(code: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.code, code))
      .limit(1);
    return rows.length > 0;
  }

  async programmeExists(code: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: programmes.id })
      .from(programmes)
      .where(eq(programmes.code, code))
      .limit(1);
    return rows.length > 0;
  }

  async insertOrganisation(cmd: CreateOrganisationCmd): Promise<OrganisationRow> {
    const [row] = await this.db
      .insert(organisations)
      .values({
        code: cmd.code,
        name: cmd.name,
        category: cmd.category,
        authorityId: cmd.authorityId,
      })
      .returning({
        id: organisations.id,
        code: organisations.code,
        name: organisations.name,
        category: organisations.category,
        authorityId: organisations.authorityId,
        createdAt: organisations.createdAt,
      });
    return row!;
  }

  async insertProgramme(cmd: CreateProgrammeCmd): Promise<ProgrammeRow> {
    const [row] = await this.db
      .insert(programmes)
      .values({
        code: cmd.code,
        name: cmd.name,
        description: cmd.description,
        scopeLevel: cmd.scopeLevel,
        stateId: cmd.stateId,
        districtId: cmd.districtId,
        authorityId: cmd.authorityId,
      })
      .returning({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        description: programmes.description,
        scopeLevel: programmes.scopeLevel,
        stateId: programmes.stateId,
        districtId: programmes.districtId,
        authorityId: programmes.authorityId,
        createdAt: programmes.createdAt,
      });
    return row!;
  }

  async listOrganisations(): Promise<OrganisationRow[]> {
    return this.db
      .select({
        id: organisations.id,
        code: organisations.code,
        name: organisations.name,
        category: organisations.category,
        authorityId: organisations.authorityId,
        createdAt: organisations.createdAt,
      })
      .from(organisations)
      .orderBy(organisations.name);
  }

  async listProgrammes(): Promise<ProgrammeRow[]> {
    return this.db
      .select({
        id: programmes.id,
        code: programmes.code,
        name: programmes.name,
        description: programmes.description,
        scopeLevel: programmes.scopeLevel,
        stateId: programmes.stateId,
        districtId: programmes.districtId,
        authorityId: programmes.authorityId,
        createdAt: programmes.createdAt,
      })
      .from(programmes)
      .orderBy(programmes.name);
  }

  /**
   * Invite a person: create the user suspended (or reset an existing record),
   * then attach the given role assignment. Both steps are audited by the
   * caller via the service layer.
   */
  async upsertInvitedUser(
    cmd: UpsertInvitedUserCmd,
    roleCode: string,
    authorityId: string | null,
    jurisdictionId: string | null,
  ): Promise<{ userId: string; assignmentId: string }> {
    const email = cmd.email.toLowerCase();
    const existing = await this.db
      .select({ id: users.id, displayName: users.displayName, status: users.status })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;
    if (existing.length > 0) {
      const row = existing[0]!;
      userId = row.id;
      await this.db
        .update(users)
        .set({
          displayName: row.displayName ?? cmd.displayName,
          phone: cmd.phone,
          status: "suspended",
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      const [row] = await this.db
        .insert(users)
        .values({ email, displayName: cmd.displayName, phone: cmd.phone, status: "suspended" })
        .returning({ id: users.id });
      userId = row!.id;
    }

    const [assignment] = await this.db
      .insert(roleAssignments)
      .values({
        userId,
        roleCode,
        authorityId,
        jurisdictionId,
        scope: roleCode === "inspector" ? "jurisdiction" : "national",
      })
      .returning({ id: roleAssignments.id });
    const assignmentId = assignment?.id;
    if (!assignmentId) throw new Error("Failed to create role assignment.");
    return { userId, assignmentId };
  }

  /** Guard for programme scope: the district must exist (implies a valid state). */
  async districtExists(id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: districts.id })
      .from(districts)
      .where(eq(districts.id, id))
      .limit(1);
    return rows.length > 0;
  }

  /** Guard for programme scope: the state must exist. */
  async stateExists(id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: states.id })
      .from(states)
      .where(eq(states.id, id))
      .limit(1);
    return rows.length > 0;
  }

  /** District IDs belonging to a state - used for state-scope authorization. */
  async districtsInState(stateId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: districts.id })
      .from(districts)
      .where(eq(districts.stateId, stateId));
    return rows.map((r) => r.id);
  }

  /** All states - for scheme scope pickers. */
  async listStates(): Promise<{ id: string; code: string; name: string }[]> {
    return this.db
      .select({ id: states.id, code: states.code, name: states.name })
      .from(states)
      .orderBy(states.name);
  }

  /** All districts with their state name - for scope and agency pickers. */
  async listDistrictsWithState(): Promise<
    { id: string; code: string; name: string; stateId: string; stateName: string }[]
  > {
    return this.db
      .select({
        id: districts.id,
        code: districts.code,
        name: districts.name,
        stateId: districts.stateId,
        stateName: states.name,
      })
      .from(districts)
      .innerJoin(states, eq(districts.stateId, states.id))
      .orderBy(states.name, districts.name);
  }
}
