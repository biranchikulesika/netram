import { describe, expect, it, vi } from "vitest";
import { FindingService } from "./finding-service.js";
import type { FindingRepositoryPort } from "./ports/finding-repository.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { Finding, FindingAwaitingOrder } from "@netram/types";

function mockCtx(): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@netram.gov.in",
      displayName: "Officer",
      type: "netram",
    },
    permissions: new Set(["inspection:review"]),
    assignments: [],
    requestId: "req-1",
    ipAddress: "127.0.0.1",
  };
}

const finding: Finding = {
  id: "finding-1",
  inspectionId: "insp-1",
  observationId: null,
  severity: "high",
  description: "Kitchen hygiene non-compliance.",
  remediation: null,
  status: "new",
  categoryId: null,
  amountInr: null,
  responsibleOrganisationId: "org-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("FindingService.createFinding responsibleOrganisationId defaulting", () => {
  const baseAuthz = {
    requirePermission: vi.fn(),
  } as unknown as AuthorizationService;

  const inspectionService = {
    getInspection: vi.fn().mockResolvedValue({
      id: "insp-1",
      projectId: "proj-1",
      districtId: "dist-1",
      status: "findings",
    }),
  } as unknown as Pick<InspectionService, "getInspection">;

  function makeRepo() {
    return {
      createWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => ({
        ...finding,
        responsibleOrganisationId: cmd.responsibleOrganisationId,
      })),
    } as unknown as FindingRepositoryPort;
  }

  it("defaults the responsible organisation from the target's operator when omitted", async () => {
    const projectRepo = {
      findById: vi.fn().mockResolvedValue({ organisationId: "org-1" }),
    };
    const repo = makeRepo();
    const service = new FindingService(baseAuthz, inspectionService, projectRepo, repo);

    await service.createFinding(mockCtx(), "insp-1", {
      severity: "high",
      description: "Kitchen hygiene non-compliance.",
    });

    expect(projectRepo.findById).toHaveBeenCalledWith("proj-1");
    expect(repo.createWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({ responsibleOrganisationId: "org-1" }),
    );
  });

  it("keeps the responsible organisation null for village-type targets with no operator", async () => {
    const projectRepo = {
      findById: vi.fn().mockResolvedValue({ organisationId: null }),
    };
    const repo = makeRepo();
    const service = new FindingService(baseAuthz, inspectionService, projectRepo, repo);

    const result = await service.createFinding(mockCtx(), "insp-1", {
      severity: "medium",
      description: "Street lights not energised.",
    });

    expect(result.responsibleOrganisationId).toBeNull();
  });

  it("honours an explicitly provided responsible organisation over the default", async () => {
    const projectRepo = {
      findById: vi.fn(),
    };
    const repo = makeRepo();
    const service = new FindingService(baseAuthz, inspectionService, projectRepo, repo);

    const result = await service.createFinding(mockCtx(), "insp-1", {
      severity: "high",
      description: "Financial irregularity in procurement.",
      responsibleOrganisationId: "org-explicit",
    });

    // No project lookup should occur when the caller is explicit.
    expect(projectRepo.findById).not.toHaveBeenCalled();
    expect(result.responsibleOrganisationId).toBe("org-explicit");
  });
});

describe("FindingService.listFindingsAwaitingOrder", () => {
  const reviewCtx: RequestUserContext = {
    ...mockCtx(),
    permissions: new Set(["inspection:review", "corrective_action:read"]),
  };

  function makeService(overrides?: {
    scope?: Set<string> | null;
    repoResult?: FindingAwaitingOrder[];
  }) {
    const authz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi
        .fn()
        .mockReturnValue(overrides ? overrides.scope : new Set(["dist-1"])),
    } as unknown as AuthorizationService;
    const repo = {
      listAwaitingOrder: vi.fn().mockResolvedValue(overrides?.repoResult ?? []),
    } as unknown as FindingRepositoryPort;
    const service = new FindingService(
      authz,
      { getInspection: vi.fn() } as unknown as Pick<InspectionService, "getInspection">,
      { findById: vi.fn() },
      repo,
    );
    return { authz, repo, service };
  }

  it("requires corrective_action:read and inspection:review", async () => {
    const { authz, service } = makeService();
    await service.listFindingsAwaitingOrder(reviewCtx);
    expect(authz.requirePermission).toHaveBeenCalledWith(reviewCtx, "inspection:review");
    expect(authz.requirePermission).toHaveBeenCalledWith(reviewCtx, "corrective_action:read");
  });

  it("scopes the repository call to the caller's accessible districts", async () => {
    const { repo, service } = makeService();
    await service.listFindingsAwaitingOrder(reviewCtx);
    expect(repo.listAwaitingOrder).toHaveBeenCalledWith(["dist-1"]);
  });

  it("passes no jurisdiction filter when the caller has full reach", async () => {
    const { repo, service } = makeService({ scope: null });
    await service.listFindingsAwaitingOrder(reviewCtx);
    expect(repo.listAwaitingOrder).toHaveBeenCalledWith(undefined);
  });
});
