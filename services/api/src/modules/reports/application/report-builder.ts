import type { ReportSnapshot } from "@netram/data";

/**
 * Deterministic derived-artifact builder (§34). Produces a stable JSON report
 * from authoritative structured records; never mutates source records.
 */
export function buildReportArtifact(snapshot: ReportSnapshot): Record<string, unknown> {
  const { inspection, findings, observations, correctiveActions, evidence } = snapshot;
  return {
    generator: "netram.report.v1",
    generatedAt: new Date().toISOString(),
    inspection: {
      id: inspection.id,
      type: inspection.type,
      status: inspection.status,
      projectCode: inspection.projectCode,
      projectName: inspection.projectName,
      districtId: inspection.districtId,
      scheduledStart: inspection.scheduledStart,
      startedAt: inspection.startedAt,
      submittedAt: inspection.submittedAt,
    },
    metrics: {
      findingCount: findings.length,
      openFindings: findings.filter((f) => !["closed", "dismissed"].includes(f.status)).length,
      observationCount: observations.length,
      correctiveActionCount: correctiveActions.length,
      evidenceCount: evidence.length,
    },
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      status: f.status,
      description: f.description,
      remediation: f.remediation,
      createdAt: f.createdAt,
    })),
    observations: observations.map((o) => ({
      id: o.id,
      text: o.text,
      createdAt: o.createdAt,
    })),
    correctiveActions: correctiveActions.map((c) => ({
      id: c.id,
      status: c.status,
      deadline: c.deadline,
      createdAt: c.createdAt,
    })),
    evidence: evidence.map((e) => ({
      id: e.id,
      type: e.evidenceType,
      fileName: e.fileName,
      uploadState: e.uploadState,
      integrityState: e.integrityState,
      capturedAt: e.capturedAt,
    })),
  };
}
