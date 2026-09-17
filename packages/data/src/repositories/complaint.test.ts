import { describe, expect, it, vi, beforeEach } from "vitest";
import { ComplaintRepository } from "./complaint.repository.js";
import type { DrizzleDB } from "../db/client.js";

describe("ComplaintRepository (DATA-04)", () => {
  let mockDb: Record<string, unknown>;
  let repo: ComplaintRepository;

  const sampleDate = new Date("2026-03-01T00:00:00.000Z");

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => [
        {
          complaint: {
            id: "cmp-1",
            projectId: "prj-1",
            complainantName: "Complainant 1",
            contactInfo: "test@example.com",
            trackingCode: "CMP-2026-0001",
            description: "Cracks observed on bridge pillar",
            status: "received",
            receivedAt: sampleDate,
            resolutionText: null,
            resolvedAt: null,
            createdAt: sampleDate,
            updatedAt: sampleDate,
          },
          projectCode: "PRJ-001",
          projectName: "Bridge Reconstruction",
          districtId: "dist-1",
        },
      ]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: "cmp-1",
          projectId: "prj-1",
          complainantName: "Complainant 1",
          contactInfo: "test@example.com",
          trackingCode: "CMP-2026-0001",
          description: "Cracks observed on bridge pillar",
          status: "received",
          receivedAt: sampleDate,
          resolutionText: null,
          resolvedAt: null,
          createdAt: sampleDate,
          updatedAt: sampleDate,
        },
      ]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
    };

    repo = new ComplaintRepository(mockDb as unknown as DrizzleDB);
  });

  it("finds complaint by tracking code", async () => {
    const res = await repo.findByTrackingCode("CMP-2026-0001");
    expect(res).not.toBeNull();
    expect(res?.trackingCode).toBe("CMP-2026-0001");
    expect(res?.projectCode).toBe("PRJ-001");
  });

  it("finds complaint by id", async () => {
    const res = await repo.findById("cmp-1");
    expect(res).not.toBeNull();
    expect(res?.id).toBe("cmp-1");
  });

  it("atomically creates complaint with audit and outbox events", async () => {
    const created = await repo.createWithAuditAndEvent({
      id: "cmp-new",
      projectId: "prj-1",
      complainantName: "Citizen",
      contactInfo: "cit@example.com",
      trackingCode: "CMP-2026-NEW",
      description: "Hazard detected",
      actorUserId: "user-1",
      requestId: "req-1",
      ipAddress: "127.0.0.1",
      auditAction: "complaint.submitted",
      auditMetadata: {},
      eventType: "complaint.submitted",
      eventPayload: {},
    });

    expect(created.id).toBe("cmp-1");
    expect(mockDb.insert).toHaveBeenCalledTimes(3); // complaint, auditEvents, outboxEvents
  });
});
