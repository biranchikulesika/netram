import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../infrastructure/errors.js";
import { EvidenceService } from "./evidence-service.js";
import type { Evidence, EvidenceType } from "@netram/types";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { EvidenceRepositoryPort } from "./ports/evidence-repository.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { InspectionService } from "../../inspections/application/inspection-service.js";

function mockCtx(): RequestUserContext {
  return {
    userId: "user-inspector-1",
    user: {
      id: "user-inspector-1",
      email: "inspector@netram.gov.in",
      displayName: "Inspector",
      type: "netram",
    },
    permissions: new Set(["evidence:create"]),
    assignments: [],
    requestId: "req-123",
    ipAddress: "127.0.0.1",
  };
}

describe("EvidenceService", () => {
  const fakeAuthz = {
    requirePermission: vi.fn(),
  } as unknown as AuthorizationService;

  const fakeInspectionService = {
    getInspection: vi.fn().mockResolvedValue({
      id: "insp-1",
      districtId: "dist-1",
      status: "in_progress",
    }),
  } as unknown as Pick<InspectionService, "getInspection">;

  const fakeStorage: ObjectStoragePort = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(Readable.from(["test-bytes"])),
  };

  const makeEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({
    id: "evi-1",
    inspectionId: "insp-1",
    findingId: null,
    capturedAt: new Date().toISOString(),
    latitude: 20.2961,
    longitude: 85.8245,
    evidenceType: "photo" as EvidenceType,
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 100,
    contentHash: null,
    storageKey: null,
    deviceId: "device-1",
    uploadState: "pending",
    integrityState: "unknown",
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it("captures evidence during an active field stage", async () => {
    const fakeRepo: EvidenceRepositoryPort = {
      listByInspection: vi.fn(),
      findById: vi.fn(),
      captureWithAuditAndEvent: vi
        .fn()
        .mockImplementation((cmd) => Promise.resolve(makeEvidence({ id: cmd.id }))),
      markUploadedWithAuditAndEvent: vi.fn(),
      verifyIntegrityWithAuditAndEvent: vi.fn(),
    };

    const service = new EvidenceService(fakeAuthz, fakeInspectionService, fakeRepo, fakeStorage);
    const result = await service.captureEvidence(mockCtx(), "insp-1", {
      capturedAt: new Date().toISOString(),
      evidenceType: "photo",
      fileName: "photo.jpg",
    });

    expect(result.id).toBeDefined();
    expect(fakeRepo.captureWithAuditAndEvent).toHaveBeenCalledOnce();
  });

  it("rejects capturing evidence if inspection is not in field stage", async () => {
    const fakeRepo: EvidenceRepositoryPort = {
      listByInspection: vi.fn(),
      findById: vi.fn(),
      captureWithAuditAndEvent: vi.fn(),
      markUploadedWithAuditAndEvent: vi.fn(),
      verifyIntegrityWithAuditAndEvent: vi.fn(),
    };

    const closedInspectionService = {
      getInspection: vi.fn().mockResolvedValue({
        id: "insp-1",
        districtId: "dist-1",
        status: "closed",
      }),
    } as unknown as Pick<InspectionService, "getInspection">;

    const service = new EvidenceService(fakeAuthz, closedInspectionService, fakeRepo, fakeStorage);
    await expect(
      service.captureEvidence(mockCtx(), "insp-1", {
        capturedAt: new Date().toISOString(),
        evidenceType: "photo",
      }),
    ).rejects.toThrow(AppError);
  });

  it("uploads evidence with matching content hash, verifying integrity", async () => {
    const payload = Buffer.from("correct-file-contents");
    const expectedHash = `sha256:${createHash("sha256").update(payload).digest("hex")}`;

    const existing = makeEvidence({
      id: "evi-1",
      uploadState: "pending",
      contentHash: expectedHash,
    });

    const fakeRepo: EvidenceRepositoryPort = {
      listByInspection: vi.fn(),
      findById: vi.fn().mockResolvedValue(existing),
      captureWithAuditAndEvent: vi.fn(),
      markUploadedWithAuditAndEvent: vi.fn().mockImplementation((cmd) =>
        Promise.resolve(
          makeEvidence({
            id: cmd.evidenceId,
            uploadState: "uploaded",
            integrityState: cmd.integrityTo ?? "unknown",
            storageKey: cmd.storageKey,
          }),
        ),
      ),
      verifyIntegrityWithAuditAndEvent: vi.fn(),
    };

    const service = new EvidenceService(fakeAuthz, fakeInspectionService, fakeRepo, fakeStorage);
    const result = await service.uploadEvidence(mockCtx(), "evi-1", {
      data: payload,
      fileName: "upload.jpg",
      mimeType: "image/jpeg",
    });

    expect(fakeStorage.put).toHaveBeenCalledWith("evidence/insp-1/evi-1", payload, "image/jpeg");
    expect(result.uploadState).toBe("uploaded");
    expect(result.integrityState).toBe("verified");
  });

  it("flags integrity mismatch when uploaded payload hash differs from capture-time hash", async () => {
    const existing = makeEvidence({
      id: "evi-2",
      uploadState: "pending",
      contentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    });

    const fakeRepo: EvidenceRepositoryPort = {
      listByInspection: vi.fn(),
      findById: vi.fn().mockResolvedValue(existing),
      captureWithAuditAndEvent: vi.fn(),
      markUploadedWithAuditAndEvent: vi.fn().mockImplementation((cmd) =>
        Promise.resolve(
          makeEvidence({
            id: cmd.evidenceId,
            uploadState: "uploaded",
            integrityState: cmd.integrityTo ?? "unknown",
          }),
        ),
      ),
      verifyIntegrityWithAuditAndEvent: vi.fn(),
    };

    const service = new EvidenceService(fakeAuthz, fakeInspectionService, fakeRepo, fakeStorage);
    const result = await service.uploadEvidence(mockCtx(), "evi-2", {
      data: Buffer.from("altered-file-contents"),
    });

    expect(result.uploadState).toBe("uploaded");
    expect(result.integrityState).toBe("mismatch");
  });

  it("retrieves evidence content stream", async () => {
    const existing = makeEvidence({
      id: "evi-1",
      storageKey: "evidence/insp-1/evi-1",
      uploadState: "uploaded",
    });

    const fakeRepo: EvidenceRepositoryPort = {
      listByInspection: vi.fn(),
      findById: vi.fn().mockResolvedValue(existing),
      captureWithAuditAndEvent: vi.fn(),
      markUploadedWithAuditAndEvent: vi.fn(),
      verifyIntegrityWithAuditAndEvent: vi.fn(),
    };

    const service = new EvidenceService(fakeAuthz, fakeInspectionService, fakeRepo, fakeStorage);
    const { evidence, stream } = await service.getEvidenceContent(mockCtx(), "evi-1");
    expect(evidence.id).toBe("evi-1");
    expect(stream).toBeDefined();
  });
});
