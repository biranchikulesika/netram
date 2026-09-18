<<<<<<< HEAD
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ComplaintService } from "./complaint-service.js";
import type { Complaint } from "@netram/types";
import type { ComplaintRepositoryPort } from "./ports/complaint-repository.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AppError } from "../../../infrastructure/errors.js";
import { InvalidComplaintTransitionError } from "../domain/complaint.js";
=======
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../infrastructure/errors.js";
import { ComplaintService } from "./complaint-service.js";
import { InvalidComplaintTransitionError } from "../domain/complaint.js";
import type { Complaint } from "@netram/types";
import type { ComplaintRepositoryPort } from "./ports/complaint-repository.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
>>>>>>> origin/production

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@netram.gov.in",
<<<<<<< HEAD
      displayName: "District Officer",
=======
      displayName: "Officer One",
>>>>>>> origin/production
      type: "netram",
    },
    permissions: new Set(["complaint:read", "complaint:create", "complaint:resolve"]),
    assignments: [],
<<<<<<< HEAD
    requestId: "req-cmp-001",
=======
    requestId: "req-123",
>>>>>>> origin/production
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

<<<<<<< HEAD
const mockComplaint1: Complaint = {
  id: "11111111-1111-1111-1111-111111111111",
  projectId: "prj-1",
  projectCode: "PRJ-001",
  projectName: "Hostel Facility",
  districtId: "dist-1",
  complainantName: "Citizen A",
  contactInfo: "citizen@example.com",
  trackingCode: "CMP-2026-A1B2",
  description: "Delayed construction milestone",
  status: "received",
  receivedAt: "2026-03-01T00:00:00.000Z",
  resolutionText: null,
  resolvedAt: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

describe("ComplaintService", () => {
  let mockAuthz: AuthorizationService;
  let mockProjectRepo: Pick<ProjectRepositoryPort, "findById">;
  let mockRepo: ComplaintRepositoryPort;
  let service: ComplaintService;

  beforeEach(() => {
    mockAuthz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["dist-1"])),
      canAccessDistrict: vi.fn((_ctx, distId) => distId === "dist-1"),
    } as unknown as AuthorizationService;

    mockProjectRepo = {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "prj-1") {
          return {
            id: "prj-1",
            code: "PRJ-001",
            name: "Hostel Facility",
            districtId: "dist-1",
          } as unknown as Awaited<ReturnType<typeof mockProjectRepo.findById>>;
        }
        return null;
      }),
    };

    mockRepo = {
      list: vi.fn().mockResolvedValue({ items: [mockComplaint1], total: 1 }),
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === mockComplaint1.id) return { ...mockComplaint1 };
        return null;
      }),
      findByTrackingCode: vi.fn().mockImplementation(async (code: string) => {
        if (code === mockComplaint1.trackingCode) return { ...mockComplaint1 };
        return null;
      }),
      createWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        return {
          ...mockComplaint1,
          id: cmd.id,
          trackingCode: cmd.trackingCode,
          description: cmd.description,
          complainantName: cmd.complainantName,
          contactInfo: cmd.contactInfo,
        };
      }),
      transitionWithAuditAndEvent: vi.fn().mockImplementation(async (cmd) => {
        return {
          ...mockComplaint1,
          status: cmd.to,
          resolutionText: cmd.resolutionText,
        };
      }),
    };

    service = new ComplaintService(mockAuthz, mockProjectRepo, mockRepo);
  });

  describe("listComplaints", () => {
    it("enforces read permission and returns paginated complaints", async () => {
      const ctx = mockCtx();
      const res = await service.listComplaints(ctx, { page: 1, pageSize: 10 });
      expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "complaint:read");
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe("getComplaint", () => {
    it("returns complaint for authorized district", async () => {
      const ctx = mockCtx();
      const complaint = await service.getComplaint(ctx, mockComplaint1.id);
      expect(complaint.id).toBe(mockComplaint1.id);
    });

    it("throws notFound if complaint does not exist", async () => {
      const ctx = mockCtx();
      await expect(service.getComplaint(ctx, "non-existent")).rejects.toThrow(AppError);
    });
  });

  describe("trackComplaint (Public Tracking)", () => {
    it("returns complaint by tracking code without authentication", async () => {
      const complaint = await service.trackComplaint("CMP-2026-A1B2");
      expect(complaint.trackingCode).toBe("CMP-2026-A1B2");
      expect(mockRepo.findByTrackingCode).toHaveBeenCalledWith("CMP-2026-A1B2");
    });

    it("throws notFound if tracking code does not exist", async () => {
      await expect(service.trackComplaint("INVALID-CODE")).rejects.toThrow(AppError);
    });
  });

  describe("createComplaint (Authorized Intake)", () => {
    it("creates complaint with tracking code and outbox event", async () => {
      const ctx = mockCtx();
      const res = await service.createComplaint(ctx, {
        projectId: "prj-1",
        description: "Materials substandard",
        complainantName: "Citizen B",
      });
      expect(mockAuthz.requirePermission).toHaveBeenCalledWith(ctx, "complaint:create");
      expect(res.description).toBe("Materials substandard");
      expect(mockRepo.createWithAuditAndEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "prj-1",
          auditAction: "complaint.submitted",
          eventType: "complaint.submitted",
          actorUserId: ctx.userId,
        }),
      );
    });

    it("rejects if project does not exist", async () => {
      const ctx = mockCtx();
      await expect(
        service.createComplaint(ctx, {
          projectId: "unknown-prj",
          description: "Materials substandard",
        }),
      ).rejects.toThrow(AppError);
    });
  });

  describe("submitPublicComplaint (Citizen Portal)", () => {
    it("submits complaint without requiring credentials", async () => {
      const res = await service.submitPublicComplaint(
        {
          projectId: "prj-1",
          description: "Noise and safety violations",
        },
        { requestId: "req-pub-1", ipAddress: "192.168.1.1" },
      );
      expect(res.description).toBe("Noise and safety violations");
      expect(mockRepo.createWithAuditAndEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "prj-1",
          actorUserId: null,
          auditAction: "complaint.submitted",
          eventType: "complaint.submitted",
          requestId: "req-pub-1",
          ipAddress: "192.168.1.1",
        }),
      );
    });
  });

  describe("transitionComplaint (Triage Lifecycle)", () => {
    it("allows transition from received to under_review", async () => {
      const ctx = mockCtx();
      const res = await service.transitionComplaint(ctx, mockComplaint1.id, "under_review");
      expect(res.status).toBe("under_review");
    });

    it("requires resolutionText when transitioning to resolved", async () => {
      const ctx = mockCtx();
      vi.mocked(mockRepo.findById).mockResolvedValue({
        ...mockComplaint1,
        status: "under_review",
      });
      await expect(
        service.transitionComplaint(ctx, mockComplaint1.id, "resolved"),
      ).rejects.toThrow(/resolution requires resolutiontext/i);

      const resolved = await service.transitionComplaint(
        ctx,
        mockComplaint1.id,
        "resolved",
        "Contractor replaced materials and passed inspection",
      );
      expect(resolved.status).toBe("resolved");
    });

    it("rejects invalid transitions (e.g. received directly to closed)", async () => {
      const ctx = mockCtx();
      await expect(
        service.transitionComplaint(ctx, mockComplaint1.id, "closed"),
      ).rejects.toThrow(InvalidComplaintTransitionError);
    });
=======
function sampleComplaint(overrides: Partial<Complaint> = {}): Complaint {
  return {
    id: "complaint-1",
    projectId: "proj-1",
    projectCode: "OD-KHD-001",
    projectName: "Vani Vihar Water Works",
    districtId: "district-khordha",
    complainantName: "Deepak Dash",
    contactInfo: "deepak@example.com",
    trackingCode: "CMP-2026-A1B2",
    description: "Contaminated water line observed near gate 2",
    status: "received",
    receivedAt: new Date().toISOString(),
    resolutionText: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ComplaintService", () => {
  it("lists complaints scoped by accessible districts", async () => {
    const authz = {
      requirePermission: vi.fn(),
      accessibleDistrictIds: vi.fn().mockReturnValue(new Set(["district-khordha"])),
    } as unknown as AuthorizationService;

    const projectRepo = { findById: vi.fn() } as unknown as ProjectRepositoryPort;

    const repo = {
      list: vi.fn().mockResolvedValue({
        items: [sampleComplaint()],
        total: 1,
      }),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo);
    const result = await service.listComplaints(mockCtx(), { page: 1, pageSize: 10 });

    expect(authz.requirePermission).toHaveBeenCalledWith(expect.anything(), "complaint:read");
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        jurisdictionIds: ["district-khordha"],
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("creates a complaint with audit and outbox event", async () => {
    const authz = {
      requirePermission: vi.fn(),
    } as unknown as AuthorizationService;

    const projectRepo = {
      findById: vi.fn().mockResolvedValue({ id: "proj-1", name: "Vani Vihar" }),
    } as unknown as ProjectRepositoryPort;

    const repo = {
      createWithAuditAndEvent: vi.fn().mockResolvedValue(sampleComplaint()),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo);
    const created = await service.createComplaint(mockCtx(), {
      projectId: "proj-1",
      description: "Contaminated water line observed near gate 2",
      complainantName: "Deepak Dash",
      contactInfo: "deepak@example.com",
    });

    expect(authz.requirePermission).toHaveBeenCalledWith(expect.anything(), "complaint:create");
    expect(repo.createWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        description: "Contaminated water line observed near gate 2",
        auditAction: "complaint.submitted",
        eventType: "complaint.submitted",
      }),
    );
    expect(created.trackingCode).toBe("CMP-2026-A1B2");
  });

  it("transitions received -> under_review", async () => {
    const authz = {
      requirePermission: vi.fn(),
    } as unknown as AuthorizationService;

    const projectRepo = { findById: vi.fn() } as unknown as ProjectRepositoryPort;

    const current = sampleComplaint({ status: "received" });
    const repo = {
      findById: vi.fn().mockResolvedValue(current),
      transitionWithAuditAndEvent: vi.fn().mockResolvedValue({
        ...current,
        status: "under_review",
      }),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo);
    const updated = await service.transitionComplaint(mockCtx(), "complaint-1", "under_review");

    expect(authz.requirePermission).toHaveBeenCalledWith(
      expect.anything(),
      "complaint:resolve",
      { districtId: "district-khordha" },
    );
    expect(repo.transitionWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        complaintId: "complaint-1",
        to: "under_review",
        auditAction: "complaint.updated",
      }),
    );
    expect(updated.status).toBe("under_review");
  });

  it("requires resolutionText when transitioning to resolved", async () => {
    const authz = {
      requirePermission: vi.fn(),
    } as unknown as AuthorizationService;

    const projectRepo = { findById: vi.fn() } as unknown as ProjectRepositoryPort;

    const current = sampleComplaint({ status: "under_review" });
    const repo = {
      findById: vi.fn().mockResolvedValue(current),
      transitionWithAuditAndEvent: vi.fn(),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo);

    // Missing resolutionText
    await expect(
      service.transitionComplaint(mockCtx(), "complaint-1", "resolved"),
    ).rejects.toThrow(AppError);

    // With resolutionText
    repo.transitionWithAuditAndEvent = vi.fn().mockResolvedValue({
      ...current,
      status: "resolved",
      resolutionText: "Line replaced and sanitized.",
    });

    const resolved = await service.transitionComplaint(
      mockCtx(),
      "complaint-1",
      "resolved",
      "Line replaced and sanitized.",
    );
    expect(resolved.status).toBe("resolved");
  });

  it("rejects invalid state transitions via domain rule", async () => {
    const authz = {
      requirePermission: vi.fn(),
    } as unknown as AuthorizationService;

    const projectRepo = { findById: vi.fn() } as unknown as ProjectRepositoryPort;

    const current = sampleComplaint({ status: "received" });
    const repo = {
      findById: vi.fn().mockResolvedValue(current),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo);

    // cannot skip under_review to resolved
    await expect(
      service.transitionComplaint(mockCtx(), "complaint-1", "resolved", "Fix"),
    ).rejects.toThrow(InvalidComplaintTransitionError);
  });

  it("tracks complaint publicly by tracking code without disclosing PII", async () => {
    const authz = {} as AuthorizationService;
    const projectRepo = {} as ProjectRepositoryPort;

    const repo = {
      findByTrackingCode: vi.fn().mockResolvedValue(
        sampleComplaint({
          complainantName: "CONFIDENTIAL_NAME",
          contactInfo: "CONFIDENTIAL_CONTACT",
          description: "INTERNAL_NARRATIVE",
        }),
      ),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo);
    const tracking = await service.trackComplaint("CMP-2026-A1B2");

    expect(repo.findByTrackingCode).toHaveBeenCalledWith("CMP-2026-A1B2");
    expect(tracking.trackingCode).toBe("CMP-2026-A1B2");
    expect(tracking.projectCode).toBe("OD-KHD-001");
    expect(tracking.status).toBe("received");
    // PII fields must not be present in public tracking result
    const untyped = tracking as unknown as Record<string, unknown>;
    expect(untyped.complainantName).toBeUndefined();
    expect(untyped.contactInfo).toBeUndefined();
    expect(untyped.description).toBeUndefined();
>>>>>>> origin/production
  });
});
