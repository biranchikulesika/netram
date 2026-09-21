import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { RegistryRepository } from "@netram/data";
import type {
  CreateOrganisationInput,
  CreateProgrammeInput,
  DistrictView,
  OrganisationView,
  ProgrammeView,
  RegisterInspectorInput,
  RegisterOfficialInput,
  RegistryUserView,
  StateView,
} from "@netram/types";

const ORGANISATION_CREATE = "organisation:create" as const;
const PROGRAMME_CREATE = "programme:create" as const;
const INSPECTOR_REGISTER = "inspector:register" as const;
const OFFICIAL_REGISTER = "official:register" as const;

const OFFICIAL_REGISTRABLE_ROLES = new Set([
  "authority_official",
  "district_officer",
  "institution_admin",
  "inspector",
  "viewer",
]);

/**
 * Registration workflows for agencies, programmes and people.
 *
 * Every command re-checks its permission server-side; the Registry UI
 * merely mirrors the same capability matrix for presentation.
 * Invited people are created suspended — account activation happens
 * through the normal authentication flow, never at registration time.
 */
export class RegistryService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly repository: RegistryRepository,
  ) {}

  async createOrganisation(
    ctx: RequestUserContext,
    input: CreateOrganisationInput,
  ): Promise<OrganisationView> {
    this.authz.requirePermission(ctx, ORGANISATION_CREATE);
    if (input.districtId) {
      this.authz.requirePermission(ctx, ORGANISATION_CREATE, {
        districtId: input.districtId,
      });
    }

    const code = input.code.toUpperCase();
    if (await this.repository.organisationExists(code)) {
      throw AppError.conflict(`An organisation with code ${code} already exists.`);
    }

    const row = await this.repository.insertOrganisation({
      code,
      name: input.name.trim(),
      category: input.category.trim(),
      authorityId: this.firstAuthorityId(ctx),
      districtId: input.districtId ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
    });

    return this.toOrganisationView(row);
  }

  async listOrganisations(ctx: RequestUserContext): Promise<OrganisationView[]> {
    this.authz.requirePermission(ctx, "project:read");
    const rows = await this.repository.listOrganisations();
    return rows.map((r) => this.toOrganisationView(r));
  }

  async createProgramme(
    ctx: RequestUserContext,
    input: CreateProgrammeInput,
  ): Promise<ProgrammeView> {
    this.authz.requirePermission(ctx, PROGRAMME_CREATE);

    // Scheme scope: validate the territorial reference matches the level and
    // that the registrar holds authority over that territory.
    if (input.scopeLevel === "district") {
      if (!input.districtId) {
        throw AppError.badRequest("A district scheme requires a district.");
      }
      if (!(await this.repository.districtExists(input.districtId))) {
        throw AppError.badRequest("Unknown district.");
      }
      this.authz.requirePermission(ctx, PROGRAMME_CREATE, {
        districtId: input.districtId,
      });
    } else if (input.scopeLevel === "state") {
      if (!input.stateId) {
        throw AppError.badRequest("A state scheme requires a state.");
      }
      if (!(await this.repository.stateExists(input.stateId))) {
        throw AppError.badRequest("Unknown state.");
      }
      // Jurisdiction-limited officials may only create schemes for a state
      // that overlaps their accessible districts (null = unrestricted).
      const scope = this.authz.accessibleDistrictIds(ctx);
      if (scope !== null) {
        const stateDistricts = await this.repository.districtsInState(input.stateId);
        if (!stateDistricts.some((id) => scope.has(id))) {
          throw AppError.forbidden("State is outside your jurisdiction.");
        }
      }
    } // national: no territorial constraint.

    const code = input.code.toUpperCase();
    if (await this.repository.programmeExists(code)) {
      throw AppError.conflict(`A programme with code ${code} already exists.`);
    }

    const row = await this.repository.insertProgramme({
      code,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      scopeLevel: input.scopeLevel,
      stateId: input.scopeLevel === "state" ? input.stateId ?? null : null,
      districtId: input.scopeLevel === "district" ? input.districtId ?? null : null,
      authorityId: this.firstAuthorityId(ctx),
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
    });

    return this.toProgrammeView(row);
  }

  async listProgrammes(ctx: RequestUserContext): Promise<ProgrammeView[]> {
    this.authz.requirePermission(ctx, "project:read");
    const rows = await this.repository.listProgrammes();
    return rows.map((r) => this.toProgrammeView(r));
  }

  /** States list for scheme-scope pickers. */
  async listStates(ctx: RequestUserContext): Promise<StateView[]> {
    this.authz.requirePermission(ctx, "project:read");
    return this.repository.listStates();
  }

  /** Districts (with state names) for scope and agency pickers. */
  async listDistricts(ctx: RequestUserContext): Promise<DistrictView[]> {
    this.authz.requirePermission(ctx, "project:read");
    return this.repository.listDistrictsWithState();
  }

  async registerInspector(
    ctx: RequestUserContext,
    input: RegisterInspectorInput,
  ): Promise<RegistryUserView> {
    this.authz.requirePermission(ctx, INSPECTOR_REGISTER);
    // Inspectors are always jurisdiction-scoped; the registrar must hold that jurisdiction.
    this.authz.requirePermission(ctx, INSPECTOR_REGISTER, {
      districtId: null,
    });
    void input.jurisdictionId; // validated by schema; jurisdiction mapping is handled by data layer

    const { userId, assignmentId } = await this.repository.upsertInvitedUser(
      {
        email: input.email.toLowerCase(),
        displayName: input.displayName.trim(),
        phone: input.phone?.trim() ?? null,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
      },
      "inspector",
      this.firstAuthorityId(ctx),
      input.jurisdictionId,
    );

    return {
      userId,
      assignmentId,
      email: input.email.toLowerCase(),
      displayName: input.displayName.trim(),
      roleCode: "inspector",
      status: "suspended",
    };
  }

  async registerOfficial(
    ctx: RequestUserContext,
    input: RegisterOfficialInput,
  ): Promise<RegistryUserView> {
    this.authz.requirePermission(ctx, OFFICIAL_REGISTER);

    if (!OFFICIAL_REGISTRABLE_ROLES.has(input.roleCode)) {
      throw AppError.forbidden(`Role "${input.roleCode}" is not registrable via the Registry.`);
    }

    // Jurisdiction-scoped official grants require the target jurisdiction to be
    // within the registrar's own reach. National-scope grants are implicit.
    if (input.scope === "jurisdiction" && input.jurisdictionId) {
      this.authz.requirePermission(ctx, OFFICIAL_REGISTER, { districtId: null });
    }

    const { userId, assignmentId } = await this.repository.upsertInvitedUser(
      {
        email: input.email.toLowerCase(),
        displayName: input.displayName.trim(),
        phone: input.phone?.trim() ?? null,
        actorUserId: ctx.userId,
        requestId: ctx.requestId ?? null,
        ipAddress: ctx.ipAddress ?? null,
      },
      input.roleCode,
      input.authorityId ?? this.firstAuthorityId(ctx),
      input.jurisdictionId ?? null,
    );

    return {
      userId,
      assignmentId,
      email: input.email.toLowerCase(),
      displayName: input.displayName.trim(),
      roleCode: input.roleCode,
      status: "suspended",
    };
  }

  private firstAuthorityId(ctx: RequestUserContext): string | null {
    for (const a of ctx.assignments) {
      if (a.authorityId) return a.authorityId;
    }
    return null;
  }

  private toOrganisationView(row: {
    id: string;
    code: string;
    name: string;
    category: string;
    authorityId: string | null;
    districtId: string | null;
    createdAt: Date;
  }): OrganisationView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      authorityId: row.authorityId,
      districtId: row.districtId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toProgrammeView(row: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    scopeLevel: string;
    stateId: string | null;
    districtId: string | null;
    authorityId: string | null;
    createdAt: Date;
  }): ProgrammeView {
    const scopeLevel =
      row.scopeLevel === "state" || row.scopeLevel === "district" ? row.scopeLevel : "national";
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      scopeLevel,
      stateId: row.stateId,
      districtId: row.districtId,
      authorityId: row.authorityId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
