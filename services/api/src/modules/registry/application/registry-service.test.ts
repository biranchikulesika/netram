import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../infrastructure/errors.js";
import { RegistryService } from "./registry-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { OrganisationRow, ProgrammeRow } from "@netram/data";

function mockCtx(permissions: string[]): RequestUserContext {
  return {
    userId: "user-admin-1",
    user: {
      id: "user-admin-1",
      email: "admin@netram.gov.in",
      displayName: "System Admin",
      type: "netram",
    },
    permissions: new Set(permissions as never),
    assignments: [
      {
        allowedDistrictIds: null,
        authorityId: "auth-1",
      },
    ] as never,
    requestId: "req-1",
    ipAddress: "127.0.0.1",
  };
}

function makeOrg(overrides: Partial<OrganisationRow> = {}): OrganisationRow {
  return {
    id: "org-1",
    code: "ORG-TEST",
    name: "Test Welfare Society",
    category: "SC/ST Hostel",
    authorityId: "auth-1",
    districtId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeProgramme(overrides: Partial<ProgrammeRow> = {}): ProgrammeRow {
  return {
    id: "pgm-1",
    code: "PGM-TEST",
    name: "Test Programme",
    description: null,
    scopeLevel: "national",
    stateId: null,
    districtId: null,
    authorityId: "auth-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    organisationExists: vi.fn().mockResolvedValue(false),
    programmeExists: vi.fn().mockResolvedValue(false),
    insertOrganisation: vi.fn().mockImplementation(async (cmd) => makeOrg({ ...cmd })),
    insertProgramme: vi.fn().mockImplementation(async (cmd) => makeProgramme({ ...cmd })),
    listOrganisations: vi.fn().mockResolvedValue([makeOrg()]),
    listProgrammes: vi.fn().mockResolvedValue([makeProgramme()]),
    upsertInvitedUser: vi.fn().mockResolvedValue({ userId: "user-9", assignmentId: "ra-9" }),
    districtExists: vi.fn().mockResolvedValue(true),
    stateExists: vi.fn().mockResolvedValue(true),
    districtsInState: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("RegistryService — capability gating", () => {
  it("throws forbidden when creating an organisation without organisation:create", async () => {
    const authz = new AuthorizationService();
    const service = new RegistryService(authz, makeRepo() as never);
    const ctx = mockCtx(["project:create"]);

    await expect(
      service.createOrganisation(ctx, {
        code: "ORG-NEW",
        name: "New Society",
        category: "NGO Trust",
      }),
    ).rejects.toMatchObject({ code: AppError.forbidden("").code });
  });

  it("throws forbidden when creating a programme without programme:create", async () => {
    const authz = new AuthorizationService();
    const service = new RegistryService(authz, makeRepo() as never);
    const ctx = mockCtx(["project:create", "project:read"]);

    await expect(
      service.createProgramme(ctx, {
        code: "PGM-NEW",
        name: "New Scheme",
        scopeLevel: "national",
      }),
    ).rejects.toMatchObject({ code: AppError.forbidden("").code });
  });

  it("throws forbidden when inviting an inspector without inspector:register", async () => {
    const authz = new AuthorizationService();
    const service = new RegistryService(authz, makeRepo() as never);
    const ctx = mockCtx(["project:create"]);

    await expect(
      service.registerInspector(ctx, {
        email: "Insp@authority.gov.in",
        displayName: "New Inspector",
        jurisdictionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({ code: AppError.forbidden("").code });
  });

  it("throws forbidden when inviting an official without official:register", async () => {
    const authz = new AuthorizationService();
    const service = new RegistryService(authz, makeRepo() as never);
    const ctx = mockCtx(["user:manage"]);

    await expect(
      service.registerOfficial(ctx, {
        email: "new@authority.gov.in",
        displayName: "New Official",
        roleCode: "authority_official",
        scope: "national",
      }),
    ).rejects.toMatchObject({ code: AppError.forbidden("").code });
  });
});

describe("RegistryService — organisation & programme registration", () => {
  it("creates an organisation with uppercased code and registrar's authority", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo();
    const service = new RegistryService(authz, repo as never);
    const ctx = mockCtx(["organisation:create", "project:read"]);

    const result = await service.createOrganisation(ctx, {
      code: "org-lower",
      name: "Lower Case Society",
      category: "Model Hostel",
    });

    expect(result.code).toBe("ORG-LOWER");
    expect(repo.insertOrganisation).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ORG-LOWER",
        authorityId: "auth-1",
      }),
    );
  });

  it("rejects duplicate organisation codes with a conflict", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo({ organisationExists: vi.fn().mockResolvedValue(true) });
    const service = new RegistryService(authz, repo as never);
    const ctx = mockCtx(["organisation:create"]);

    await expect(
      service.createOrganisation(ctx, {
        code: "ORG-DUP",
        name: "Duplicate Society",
        category: "NGO Trust",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects duplicate programme codes with a conflict", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo({ programmeExists: vi.fn().mockResolvedValue(true) });
    const service = new RegistryService(authz, repo as never);
    const ctx = mockCtx(["programme:create"]);

    await expect(
      service.createProgramme(ctx, {
        code: "PGM-DUP",
        name: "Duplicate Scheme",
        scopeLevel: "national",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates a state-scoped scheme with the state reference", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo({ districtsInState: vi.fn().mockResolvedValue(["d-1"]) });
    const service = new RegistryService(authz, repo as never);
    const ctx = mockCtx(["programme:create"]);

    const result = await service.createProgramme(ctx, {
      code: "PGM-STATE",
      name: "State Hostel Scheme",
      scopeLevel: "state",
      stateId: "s-1",
    });

    expect(result.scopeLevel).toBe("state");
    expect(result.stateId).toBe("s-1");
    expect(result.districtId).toBeNull();
  });

  it("rejects a state-scoped scheme with no state reference", async () => {
    const authz = new AuthorizationService();
    const service = new RegistryService(authz, makeRepo() as never);
    const ctx = mockCtx(["programme:create"]);

    await expect(
      service.createProgramme(ctx, {
        code: "PGM-BAD",
        name: "State Scheme Missing State",
        scopeLevel: "state",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a district-scoped scheme outside the registrar's jurisdiction", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo();
    const service = new RegistryService(authz, repo as never);
    // Jurisdiction-limited registrar: no accessible districts.
    const ctx = {
      ...mockCtx(["programme:create"]),
      assignments: [{ allowedDistrictIds: new Set<string>(), authorityId: "auth-1" }] as never,
    };

    await expect(
      service.createProgramme(ctx, {
        code: "PGM-FAR",
        name: "Far District Scheme",
        scopeLevel: "district",
        districtId: "d-999",
      }),
    ).rejects.toMatchObject({ code: AppError.forbidden("").code });
  });

  it("lists organisations only with project:read", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo();
    const service = new RegistryService(authz, repo as never);

    const allowed = await service.listOrganisations(mockCtx(["project:read"]));
    expect(allowed).toHaveLength(1);

    await expect(service.listOrganisations(mockCtx([]))).rejects.toMatchObject({
      code: AppError.forbidden("").code,
    });
  });
});

describe("RegistryService — people registration", () => {
  it("invites an inspector as suspended with the inspector role", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo();
    const service = new RegistryService(authz, repo as never);
    const ctx = mockCtx(["inspector:register"]);

    const result = await service.registerInspector(ctx, {
      email: "Ramesh@authority.gov.in",
      displayName: "Ramesh K.",
      jurisdictionId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.status).toBe("suspended");
    expect(result.roleCode).toBe("inspector");
    expect(repo.upsertInvitedUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ramesh@authority.gov.in" }),
      "inspector",
      "auth-1",
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects official registration for a role outside the registrable allow-list", async () => {
    const authz = new AuthorizationService();
    const service = new RegistryService(authz, makeRepo() as never);
    const ctx = mockCtx(["official:register"]);

    await expect(
      service.registerOfficial(ctx, {
        email: "sneaky@authority.gov.in",
        displayName: "Privilege Escalation Attempt",
        roleCode: "super_admin",
        scope: "national",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("invites an official with the requested role and national scope", async () => {
    const authz = new AuthorizationService();
    const repo = makeRepo();
    const service = new RegistryService(authz, repo as never);
    const ctx = mockCtx(["official:register"]);

    const result = await service.registerOfficial(ctx, {
      email: "official@authority.gov.in",
      displayName: "Dr. Official",
      roleCode: "district_officer",
      scope: "national",
    });

    expect(result.roleCode).toBe("district_officer");
    expect(result.status).toBe("suspended");
    expect(repo.upsertInvitedUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "official@authority.gov.in" }),
      "district_officer",
      expect.anything(),
      null,
    );
  });
});

describe("REGISTRY_CAPABILITIES matrix", () => {
  it("maps every capability to a real permission and requires official:register for officials", async () => {
    const { REGISTRY_CAPABILITIES, PERMISSIONS } = await import("@netram/types");

    for (const capability of REGISTRY_CAPABILITIES) {
      expect(PERMISSIONS).toContain(capability.permission);
    }

    const official = REGISTRY_CAPABILITIES.find((c) => c.key === "official");
    expect(official?.permission).toBe("official:register");

    const facility = REGISTRY_CAPABILITIES.find((c) => c.key === "facility");
    expect(facility?.permission).toBe("project:create");
  });
});
