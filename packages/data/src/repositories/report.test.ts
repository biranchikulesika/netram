import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReportRepository } from "./report.repository.js";
import type { DrizzleDB } from "../db/client.js";

describe("ReportRepository (DATA-04)", () => {
  let mockDb: Record<string, unknown>;
  let repo: ReportRepository;

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
          report: {
            id: "rep-1",
            inspectionId: "insp-1",
            format: "json",
            status: "ready",
            storageRef: "reports/rep-1.json",
            requestedBy: "user-1",
            requestedAt: sampleDate,
            generatedBy: null,
            generatedAt: sampleDate,
            error: null,
            finalizedBy: null,
            finalizedAt: null,
            createdAt: sampleDate,
            updatedAt: sampleDate,
          },
          inspectionType: "routine",
          inspectionStatus: "submitted",
          projectCode: "PRJ-001",
          projectName: "Bridge Reconstruction",
          districtId: "dist-1",
        },
      ]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
    };

    repo = new ReportRepository(mockDb as unknown as DrizzleDB);
  });

  it("finds report by id with storageRef and metadata", async () => {
    const report = await repo.findById("rep-1");
    expect(report).not.toBeNull();
    expect(report?.id).toBe("rep-1");
    expect(report?.storageRef).toBe("reports/rep-1.json");
    expect(report?.status).toBe("ready");
  });

  it("generates report with artifact and persists storageRef atomically", async () => {
    const updated = await repo.generateWithArtifact({
      reportId: "rep-1",
      generatedBy: null,
      actorUserId: "user-1",
      requestId: "req-1",
      ipAddress: "127.0.0.1",
      artifact: { summary: "All clear" },
      storageRef: "reports/rep-1.json",
      eventType: "report.generated",
    });

    expect(updated.id).toBe("rep-1");
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalledTimes(2); // auditEvents, outboxEvents
  });
});
