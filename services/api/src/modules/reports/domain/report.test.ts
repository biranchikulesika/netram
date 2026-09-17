import { describe, expect, it } from "vitest";
import type { ReportSnapshot } from "@netram/data";
import { evaluateReportTransition, InvalidReportTransitionError } from "./report.js";

describe("evaluateReportTransition", () => {
  it("allows the generation and immutable finalize lifecycle", () => {
    expect(evaluateReportTransition("requested", "generating").to).toBe("generating");
    expect(evaluateReportTransition("generating", "ready").to).toBe("ready");
    expect(evaluateReportTransition("generating", "failed").to).toBe("failed");
    expect(evaluateReportTransition("failed", "generating").to).toBe("generating");
    expect(evaluateReportTransition("ready", "finalized").to).toBe("finalized");
  });

  it("rejects skipping states, retrying finalized reports, and mutating finalized ones", () => {
    expect(() => evaluateReportTransition("requested", "ready")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("requested", "finalized")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("ready", "generating")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("finalized", "generating")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("finalized", "ready")).toThrow(
      InvalidReportTransitionError,
    );
  });
});

describe("buildReportArtifact / buildReportCsv / buildReportText", () => {
  const mockSnapshot: ReportSnapshot = {
    inspectionId: "11111111-1111-1111-1111-111111111111",
    inspection: {
      id: "11111111-1111-1111-1111-111111111111",
      type: "routine",
      status: "submitted",
      projectCode: "PRJ-001",
      projectName: "Bridge Reconstruction",
      districtId: "22222222-2222-2222-2222-222222222222",
      scheduledStart: "2026-09-01T00:00:00.000Z",
      startedAt: "2026-09-01T08:00:00.000Z",
      submittedAt: "2026-09-01T12:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
    },
    findings: [
      {
        id: "f-1",
        severity: "critical",
        description: "Exposed rebar with concrete spalling",
        remediation: "Seal and reinforce",
        status: "open",
        createdAt: "2026-09-01T09:00:00.000Z",
      },
    ],
    observations: [
      {
        id: "o-1",
        userId: "u-1",
        text: "Site perimeter fence compromised",
        createdAt: "2026-09-01T08:30:00.000Z",
      },
    ],
    correctiveActions: [
      {
        id: "c-1",
        findingId: "f-1",
        status: "assigned",
        deadline: "2026-09-15T00:00:00.000Z",
        createdAt: "2026-09-01T09:30:00.000Z",
      },
    ],
    evidence: [
      {
        id: "e-1",
        evidenceType: "photo",
        fileName: "rebar.jpg",
        uploadState: "uploaded",
        integrityState: "verified",
        capturedAt: "2026-09-01T08:45:00.000Z",
      },
    ],
  };

  it("builds deterministic JSON artifact", async () => {
    const { buildReportArtifact } = await import("../application/report-builder.js");
    const artifact = buildReportArtifact(mockSnapshot);
    expect(artifact.generator).toBe("netram.report.v1");
    expect((artifact.metrics as Record<string, unknown>).findingCount).toBe(1);
    expect((artifact.findings as Record<string, unknown>[])[0]!.severity).toBe("critical");
  });

  it("builds structured CSV export with sections", async () => {
    const { buildReportCsv } = await import("../application/report-builder.js");
    const csv = buildReportCsv(mockSnapshot);
    expect(csv).toContain("Inspection ID,11111111-1111-1111-1111-111111111111");
    expect(csv).toContain("Exposed rebar with concrete spalling");
    expect(csv).toContain("rebar.jpg");
  });

  it("builds formatted text executive summary", async () => {
    const { buildReportText } = await import("../application/report-builder.js");
    const text = buildReportText(mockSnapshot);
    expect(text).toContain("NETRAM INSPECTION REPORT");
    expect(text).toContain("Bridge Reconstruction");
    expect(text).toContain("CRITICAL");
  });
});

