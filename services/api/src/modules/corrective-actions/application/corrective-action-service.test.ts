import { describe, expect, it, vi, beforeEach } from "vitest";
import { CorrectiveActionService } from "./corrective-action-service.js";
import type { Finding } from "@netram/types";
import type {
  CorrectiveActionRepositoryPort,
  CorrectiveActionWithDistrict,
} from "./ports/corrective-action-repository.js";
import type { FindingRepositoryPort } from "../../findings/application/ports/finding-repository.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AppError } from "../../../infrastructure/errors.js";
import { InvalidCorrectiveActionTransitionError } from "../domain/corrective-action.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@dev.netram.in",
      displayName: "Officer One",
      type: "netram",
    },
    permissions: new Set([
      "corrective_action:read",
      "corrective_action:submit",
      "corrective_action:approve",
      "inspection:review",
    ]),
    assignments: [],
    requestId: "req-ca-001",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

const mockFinding: Finding = {
  id: "finding-1",
  inspectionId: "insp-1",
  observationId: "obs-1",
  severity: "high",
  description: "Debris blocking primary fire exit",
  remediation: null,
  status: "confirmed",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

const mockAction1: CorrectiveActionWithDistrict = {
  id: "ca-1",
  findingId: "finding-1",
  inspectionId: "insp-1",
  organisationId: "org-1",
  status: "pending",
  deadline: "2026-04-01T00:00:00.000Z",
  submittedAt: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  districtId: "district-cuttack",
};

describe("CorrectiveActionService", () => {
  let mockAuthz: AuthorizationService;
  let mockInspectionService: Pick<InspectionService, "getInspection">;
  let mockFindingRepo: FindingRepositoryPort;
  let mockRepo: CorrectiveActionRepositoryPort;
  let service: CorrectiveActionService;

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["district-cuttack"])),
      canAccessDistrict: vi.fn((_ctx, distId) => distId === "district-cuttack"),
    } as unknown as AuthorizationService;

    mockInspectionService = {
      getInspection: vi.fn().mockResolvedValue({
        id: "insp-1",
        districtId: "district-cuttack",
      }),
    };

    mockFindingRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "finding-1") return mockFinding;
        return null;
      }),
    } as unknown as FindingRepositoryPort;

    mockRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "ca-1") return { ...mockAction1 };
        return null;
      }),
      list: vi.fn().mockResolvedValue({
        items: [mockAction1],
        total: 1,
      }),
      createWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        return {
          ...mockAction1,
          id: cmd.id,
          findingId: cmd.findingId,
          inspectionId: cmd.inspectionId,
        };
      }),
      transitionWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        return {
          ...mockAction1,
          status: cmd.to,
          note: cmd.note,
        };
      }),
      markOverdueActions: vi.fn().mockResolvedValue({
        count: 2,
        actionIds: ["ca-old-1", "ca-old-2"],
      }),
    } as unknown as CorrectiveActionRepositoryPort;

    service = new CorrectiveActionService(
      mockAuthz,
      mockInspectionService,
      mockFindingRepo,
      mockRepo,
    );
  });

  it("lists corrective actions with permission and district scoping", async () => {
    const ctx = mockCtx();
    const result = await service.listCorrectiveActions(ctx, { page: 1, pageSize: 20 });

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "corrective_action:read");
    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        jurisdictionIds: ["district-cuttack"],
      }),
    );
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.id).toBe("ca-1");
  });

  it("gets a corrective action and verifies district access", async () => {
    const ctx = mockCtx();
    const action = await service.getCorrectiveAction(ctx, "ca-1");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "corrective_action:read");
    expect(action.id).toBe("ca-1");
  });

  it("creates a corrective action for confirmed finding with audit and outbox event", async () => {
    const ctx = mockCtx();
    const action = await service.createCorrectiveAction(ctx, {
      findingId: "finding-1",
      deadline: "2026-04-15T00:00:00.000Z",
    });

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "inspection:review", {
      districtId: "district-cuttack",
    });
    expect(mockRepo.createWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        findingId: "finding-1",
        auditAction: "corrective_action.created",
        eventType: "corrective_action.created",
      }),
    );
    expect(action.findingId).toBe("finding-1");
  });

  it("rejects creating corrective action if finding is not confirmed", async () => {
    const ctx = mockCtx();
    vi.mocked(mockFindingRepo.findById).mockResolvedValueOnce({
      ...mockFinding,
      status: "new",
    });

    await expect(
      service.createCorrectiveAction(ctx, { findingId: "finding-1" }),
    ).rejects.toThrow(AppError);
  });

  it("transitions corrective action from pending to submitted (institution step)", async () => {
    const ctx = mockCtx();
    const result = await service.transitionCorrectiveAction(ctx, "ca-1", "submitted", "Fixed debris");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "corrective_action:submit", {
      districtId: "district-cuttack",
    });
    expect(mockRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "submitted",
        note: "Fixed debris",
        auditAction: "corrective_action.submitted",
        eventType: "corrective_action.submitted",
      }),
    );
    expect(result.status).toBe("submitted");
  });

  it("transitions corrective action from under_review to accepted (authority step)", async () => {
    const ctx = mockCtx();
    vi.mocked(mockRepo.findById).mockResolvedValueOnce({
      ...mockAction1,
      status: "under_review",
    });

    const result = await service.transitionCorrectiveAction(ctx, "ca-1", "accepted", "Remediation verified");

    expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "corrective_action:approve", {
      districtId: "district-cuttack",
    });
    expect(mockRepo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "accepted",
        auditAction: "corrective_action.accepted",
        eventType: "corrective_action.accepted",
      }),
    );
    expect(result.status).toBe("accepted");
  });

  it("rejects illegal transitions (e.g. pending to accepted directly)", async () => {
    const ctx = mockCtx();
    await expect(
      service.transitionCorrectiveAction(ctx, "ca-1", "accepted"),
    ).rejects.toThrow(InvalidCorrectiveActionTransitionError);
  });

  it("delegates markOverdueActions to repository", async () => {
    const res = await service.markOverdueActions("system-worker");
    expect(res.count).toBe(2);
    expect(res.actionIds).toEqual(["ca-old-1", "ca-old-2"]);
    expect(mockRepo.markOverdueActions).toHaveBeenCalledWith("system-worker");
  });
});
