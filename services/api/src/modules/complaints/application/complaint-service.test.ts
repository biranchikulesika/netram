import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../infrastructure/errors.js";
import { ComplaintService } from "./complaint-service.js";
import { InvalidComplaintTransitionError } from "../domain/complaint.js";
import type { Complaint } from "@netram/types";
import type { ComplaintRepositoryPort } from "./ports/complaint-repository.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";

function mockCtx(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    userId: "user-officer-1",
    user: {
      id: "user-officer-1",
      email: "officer@netram.gov.in",
      displayName: "Officer One",
      type: "netram",
    },
    permissions: new Set(["complaint:read", "complaint:create", "complaint:resolve"]),
    assignments: [],
    requestId: "req-123",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

function mockStorage(): ObjectStoragePort {
  return { put: vi.fn().mockResolvedValue(undefined), get: vi.fn() };
}

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
    files: [],
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

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());
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

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());
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

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());
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

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());

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

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());

    // cannot skip under_review to resolved
    await expect(
      service.transitionComplaint(mockCtx(), "complaint-1", "resolved", "Fix"),
    ).rejects.toThrow(InvalidComplaintTransitionError);
  });

  it("creates a public complaint without authz but still audits and emits event", async () => {
    const authz = {
      requirePermission: vi.fn(),
    } as unknown as AuthorizationService;

    const projectRepo = {
      findById: vi.fn().mockResolvedValue({ id: "proj-1", name: "Vani Vihar" }),
    } as unknown as ProjectRepositoryPort;

    const repo = {
      createWithAuditAndEvent: vi.fn().mockResolvedValue(sampleComplaint()),
    } as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());
    const created = await service.createPublicComplaint(
      {
        projectId: "proj-1",
        description: "Contaminated water line observed near gate 2",
      },
      [],
      "req-citizen-1",
      "192.168.0.42",
    );

    expect(authz.requirePermission).not.toHaveBeenCalled();
    expect(repo.createWithAuditAndEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        actorUserId: null,
        requestId: "req-citizen-1",
        ipAddress: "192.168.0.42",
        auditAction: "complaint.submitted",
        eventType: "complaint.submitted",
      }),
    );
    expect(created.trackingCode).toBe("CMP-2026-A1B2");
  });

  it("rejects a public complaint for a non-existent project", async () => {
    const authz = {} as AuthorizationService;
    const projectRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ProjectRepositoryPort;
    const repo = {} as unknown as ComplaintRepositoryPort;

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());
    await expect(
      service.createPublicComplaint(
        { projectId: "proj-missing", description: "A genuinely long description text" },
        [],
        "req-x",
        "ip",
      ),
    ).rejects.toThrow(AppError);
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

    const service = new ComplaintService(authz, projectRepo, repo, mockStorage());
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
  });
});
