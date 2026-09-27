import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionInboxService } from "./action-inbox-service.js";
import type { ActionInboxServiceDeps } from "./action-inbox-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { Project, FindingAwaitingOrder, CorrectiveAction, Complaint, AIAnomaly } from "@netram/types";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@netram.gov.in",
      displayName: "District Officer",
      type: "netram",
    },
    permissions: new Set<string>(),
    assignments: [],
    requestId: "req-abc",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    code: "PRJ-001",
    name: "Vani Vihar SC/ST Hostel",
    type: "institution",
    description: null,
    organisationId: null,
    authorityId: null,
    districtId: "dist-khordha",
    villageId: null,
    schemeComponentId: null,
    status: "Pending Verification",
    approvedById: null,
    approvedAt: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    programmeIds: [],
    createdAt: new Date("2026-09-20T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-09-20T10:00:00Z").toISOString(),
    ...overrides,
  };
}

function makeFinding(overrides: Partial<FindingAwaitingOrder> = {}): FindingAwaitingOrder {
  return {
    id: "find-1",
    inspectionId: "insp-1",
    observationId: null,
    severity: "high",
    description: "Toilets non-functional for two weeks",
    remediation: "Repair sanitation block",
    status: "confirmed",
    categoryId: null,
    amountInr: null,
    responsibleOrganisationId: null,
    createdAt: new Date("2026-09-21T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-09-21T10:00:00Z").toISOString(),
    inspectionStatus: "under_review",
    project: {
      id: "proj-1",
      code: "PRJ-001",
      name: "Vani Vihar SC/ST Hostel",
      districtId: "dist-khordha",
      organisationId: null,
    },
    ...overrides,
  };
}

function makeCorrectiveAction(overrides: Partial<CorrectiveAction> = {}): CorrectiveAction {
  return {
    id: "ca-1",
    findingId: "find-1",
    inspectionId: "insp-1",
    organisationId: null,
    status: "submitted",
    deadline: null,
    submittedAt: new Date("2026-09-22T10:00:00Z").toISOString(),
    actionSummary: "Sanitation block repaired on 21 Sep.",
    atrFiles: [],
    verifiedAt: null,
    verifiedByUserId: null,
    reviewRemarks: null,
    createdAt: new Date("2026-09-20T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-09-22T10:00:00Z").toISOString(),
    project: null,
    finding: null,
    ...overrides,
  };
}

function makeComplaint(overrides: Partial<Complaint> = {}): Complaint {
  return {
    id: "cpl-1",
    projectId: "proj-1",
    projectCode: "PRJ-001",
    projectName: "Vani Vihar SC/ST Hostel",
    districtId: "dist-khordha",
    districtName: "Khordha",
    complainantName: "A. Citizen",
    contactInfo: null,
    trackingCode: "CMP-2026-AB12",
    description: "Food quality has degraded",
    status: "received",
    receivedAt: new Date("2026-09-22T08:00:00Z").toISOString(),
    resolutionText: null,
    resolvedAt: null,
    createdAt: new Date("2026-09-22T08:00:00Z").toISOString(),
    updatedAt: new Date("2026-09-22T08:00:00Z").toISOString(),
    files: [],
    ...overrides,
  };
}

function makeAiAnomaly(overrides: Partial<AIAnomaly> = {}): AIAnomaly {
  return {
    id: "anom-1",
    inspectionId: "insp-1",
    evidenceId: null,
    type: "conflict",
    severity: "high",
    confidence: 0.9,
    modelVersion: "conflict-detector-0.1",
    explanation: "Altercation on gate feed",
    status: "new",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date("2026-09-23T10:00:00Z").toISOString(),
    projectId: "proj-1",
    projectCode: "PRJ-001",
    projectName: "Vani Vihar SC/ST Hostel",
    districtId: "dist-khordha",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ActionInboxServiceDeps> = {}): ActionInboxServiceDeps {
  return {
    authz: {
      hasPermission: vi.fn(() => false),
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn(() => null),
      canAccessDistrict: vi.fn(() => true),
    } as unknown as AuthorizationService,
    projectService: { listVerificationQueue: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })) },
    findingService: { listFindingsAwaitingOrder: vi.fn(async () => []) },
    correctiveActionService: {
      listCorrectiveActions: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })),
    },
    complaintService: { listComplaints: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })) },
    aiAnomalyService: { listAiAnomalies: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })) },
    attendanceService: {
      listAnomalies: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      listPendingCorrections: vi.fn(async () => []),
    },
    expenseService: { listExpenses: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })) },
    financialDocumentService: { listPendingDocuments: vi.fn(async () => []) },
    financialRiskService: { listFlags: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100 })) },
    ...overrides,
  };
}

describe("ActionInboxService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits every section when the caller holds no decision permissions (§34)", async () => {
    const deps = makeDeps();
    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    expect(res.sections).toEqual([]);
    expect(res.total).toBe(0);
    // No section fetcher may run without the gating permission.
    expect(deps.projectService.listVerificationQueue).not.toHaveBeenCalled();
    expect(deps.findingService.listFindingsAwaitingOrder).not.toHaveBeenCalled();
  });

  it("includes only the sections matching the caller's permissions", async () => {
    const deps = makeDeps({
      projectService: {
        listVerificationQueue: vi.fn(async () => ({
          items: [makeProject()],
          total: 1,
          page: 1,
          pageSize: 100,
        })),
      },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "project:approve",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    expect(res.sections).toHaveLength(1);
    expect(res.sections[0]!.kind).toBe("project_verification");
    expect(res.total).toBe(1);
    expect(res.sections[0]!.items[0]!.title).toBe("Approve facility registration");
    // Adjacent sections stay untouched.
    expect(deps.findingService.listFindingsAwaitingOrder).not.toHaveBeenCalled();
  });

  it("maps awaiting-order findings into review items with project context", async () => {
    const deps = makeDeps({
      findingService: { listFindingsAwaitingOrder: vi.fn(async () => [makeFinding()]) },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "inspection:review",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    const section = res.sections.find((s) => s.kind === "finding_review");
    expect(section).toBeDefined();
    expect(section!.items[0]!.actionType).toBe("review");
    expect(section!.items[0]!.project.code).toBe("PRJ-001");
    expect(section!.items[0]!.link.href).toBe("/dashboard/inspections/insp-1");
  });

  it("carries the responsible organisation so the order dialog preselects it", async () => {
    const deps = makeDeps({
      findingService: {
        listFindingsAwaitingOrder: vi.fn(async () => [
          makeFinding({
            project: {
              id: "proj-1",
              code: "PRJ-001",
              name: "Vani Vihar SC/ST Hostel",
              districtId: "dist-khordha",
              organisationId: "org-9",
            },
          }),
        ]),
      },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "inspection:review",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    const section = res.sections.find((s) => s.kind === "finding_review");
    expect(section!.items[0]!.context.organisationId).toBe("org-9");
    expect(section!.items[0]!.context.inspectionId).toBe("insp-1");
  });

  it("omits the responsible organisation key when the facility has no operator", async () => {
    const deps = makeDeps({
      findingService: { listFindingsAwaitingOrder: vi.fn(async () => [makeFinding()]) },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "inspection:review",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    const section = res.sections.find((s) => s.kind === "finding_review");
    // null, not a fabricated id — the client falls back to its own selection.
    expect(section!.items[0]!.context.organisationId).toBeNull();
  });

  it("surfaces only reviewable ATR statuses (submitted, under_review, overdue)", async () => {
    const deps = makeDeps({
      correctiveActionService: {
        listCorrectiveActions: vi.fn(async () => ({
          items: [
            makeCorrectiveAction(),
            makeCorrectiveAction({ id: "ca-2", status: "accepted" }),
            makeCorrectiveAction({ id: "ca-3", status: "pending" }),
          ],
          total: 3,
          page: 1,
          pageSize: 100,
        })),
      },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "corrective_action:approve",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    const section = res.sections.find((s) => s.kind === "corrective_action_review");
    expect(section).toBeDefined();
    expect(section!.items).toHaveLength(1);
    expect(section!.items[0]!.id).toBe("ca-1");
  });

  it("surfaces only received/under_review complaints", async () => {
    const deps = makeDeps({
      complaintService: {
        listComplaints: vi.fn(async () => ({
          items: [
            makeComplaint(),
            makeComplaint({ id: "cpl-2", status: "resolved" }),
            makeComplaint({ id: "cpl-3", status: "closed" }),
          ],
          total: 3,
          page: 1,
          pageSize: 100,
        })),
      },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "complaint:resolve",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    const section = res.sections.find((s) => s.kind === "complaint_review");
    expect(section).toBeDefined();
    expect(section!.items.map((i) => i.id)).toEqual(["cpl-1"]);
  });

  it("passes advisory status=new to AI anomalies and never marks them decided (§36)", async () => {
    const listAiAnomalies = vi.fn(async () => ({
      items: [makeAiAnomaly()],
      total: 1,
      page: 1,
      pageSize: 100,
    }));
    const deps = makeDeps({ aiAnomalyService: { listAiAnomalies } });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "ai:anomaly:transition",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    expect(listAiAnomalies).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "new" }),
    );
    const section = res.sections.find((s) => s.kind === "ai_anomaly_review");
    expect(section).toBeDefined();
    expect(section!.items[0]!.context.modelVersion).toBe("conflict-detector-0.1");
  });

  it("aggregates totals across multiple sections", async () => {
    const deps = makeDeps({
      projectService: {
        listVerificationQueue: vi.fn(async () => ({
          items: [makeProject(), makeProject({ id: "proj-2", code: "PRJ-002" })],
          total: 2,
          page: 1,
          pageSize: 100,
        })),
      },
      complaintService: {
        listComplaints: vi.fn(async () => ({
          items: [makeComplaint()],
          total: 1,
          page: 1,
          pageSize: 100,
        })),
      },
    });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) =>
        permission === "project:approve" || permission === "complaint:resolve",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    expect(res.sections).toHaveLength(2);
    expect(res.total).toBe(3);
  });

  it("discloses vendor/payment context for expense verification items (popup dossier)", async () => {
    const listExpenses = vi.fn(async () => ({
      items: [
        {
          id: "exp-1",
          projectId: "proj-1",
          organisationId: null,
          allocationId: null,
          category: "Works",
          description: "Boundary wall repair",
          amount: "25000",
          transactionDate: "2026-09-01T00:00:00.000Z",
          vendorName: "Acme Traders",
          vendorGstin: null,
          invoiceNumber: "INV-7",
          invoiceDate: null,
          paymentReference: null,
          paymentMethod: null,
          status: "submitted" as const,
          submittedById: null,
          submittedAt: null,
          verifiedById: null,
          verifiedAt: null,
          voidReason: null,
          voidedById: null,
          voidedAt: null,
          createdById: null,
          createdAt: "2026-09-02T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
    }));
    const deps = makeDeps({ expenseService: { listExpenses } });
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockImplementation(
      (_ctx, permission: string) => permission === "expense:verify",
    );

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    const section = res.sections.find((s) => s.kind === "expense_verification");
    expect(section).toBeDefined();
    const item = section!.items[0]!;
    expect(item.amountInr).toBe(25000);
    // The verify-payment popup renders from context: the full vendor/payment
    // field set the funds workspace shows must ride with the item (§34).
    expect(item.context.vendorName).toBe("Acme Traders");
    expect(item.context.invoiceNumber).toBe("INV-7");
    expect(item.context.category).toBe("Works");
    expect(item.context.description).toBe("Boundary wall repair");
    expect(item.context.transactionDate).toBe("2026-09-01T00:00:00.000Z");
    // Nulls are still sent ("Not provided" in the popup), not dropped.
    expect(item.context.vendorGstin).toBeNull();
    expect(item.context.paymentMethod).toBeNull();
  });

  it("returns an empty-but-valid inbox when every fetcher resolves empty", async () => {
    const deps = makeDeps();
    (deps.authz.hasPermission as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const service = new ActionInboxService(deps);
    const res = await service.list(mockCtx());

    expect(res.total).toBe(0);
    expect(res.generatedAt).toBeTruthy();
    expect(Object.keys(res)).toEqual(["sections", "total", "generatedAt"]);
  });
});
