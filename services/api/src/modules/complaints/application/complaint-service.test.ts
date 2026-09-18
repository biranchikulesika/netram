import { describe, expect, it, vi, beforeEach } from "vitest";
import { ComplaintService } from "./complaint-service.js";
import type { Complaint } from "@netram/types";
import type { ComplaintRepositoryPort } from "./ports/complaint-repository.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import { AppError } from "../../../infrastructure/errors.js";
import { InvalidComplaintTransitionError } from "../domain/complaint.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@netram.gov.in",
      displayName: "District Officer",
      type: "netram",
    },
    permissions: new Set(["complaint:read", "complaint:create", "complaint:resolve"]),
    assignments: [],
    requestId: "req-cmp-001",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

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
  });
});
