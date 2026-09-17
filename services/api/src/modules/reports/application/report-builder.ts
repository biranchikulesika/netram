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

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Builds a structured CSV export of the inspection snapshot (§34).
 */
export function buildReportCsv(snapshot: ReportSnapshot): string {
  const lines: string[] = [];

  // Header & Metadata
  lines.push("# Netram Inspection Summary Report");
  lines.push(`Inspection ID,${escapeCsv(snapshot.inspection.id)}`);
  lines.push(`Project Code,${escapeCsv(snapshot.inspection.projectCode)}`);
  lines.push(`Project Name,${escapeCsv(snapshot.inspection.projectName)}`);
  lines.push(`Inspection Type,${escapeCsv(snapshot.inspection.type)}`);
  lines.push(`Status,${escapeCsv(snapshot.inspection.status)}`);
  lines.push(`Started At,${escapeCsv(snapshot.inspection.startedAt)}`);
  lines.push(`Submitted At,${escapeCsv(snapshot.inspection.submittedAt)}`);
  lines.push("");

  // Findings Section
  lines.push("Finding ID,Severity,Status,Description,Remediation,Created At");
  for (const f of snapshot.findings) {
    lines.push(
      [
        escapeCsv(f.id),
        escapeCsv(f.severity),
        escapeCsv(f.status),
        escapeCsv(f.description),
        escapeCsv(f.remediation),
        escapeCsv(f.createdAt),
      ].join(","),
    );
  }
  lines.push("");

  // Corrective Actions Section
  lines.push("Corrective Action ID,Finding ID,Status,Deadline,Created At");
  for (const c of snapshot.correctiveActions) {
    lines.push(
      [
        escapeCsv(c.id),
        escapeCsv(c.findingId),
        escapeCsv(c.status),
        escapeCsv(c.deadline),
        escapeCsv(c.createdAt),
      ].join(","),
    );
  }
  lines.push("");

  // Evidence Summary Section
  lines.push("Evidence ID,Type,File Name,Upload State,Integrity State,Captured At");
  for (const e of snapshot.evidence) {
    lines.push(
      [
        escapeCsv(e.id),
        escapeCsv(e.evidenceType),
        escapeCsv(e.fileName),
        escapeCsv(e.uploadState),
        escapeCsv(e.integrityState),
        escapeCsv(e.capturedAt),
      ].join(","),
    );
  }

  return lines.join("\n");
}

/**
 * Builds a formatted text/markdown executive summary of the inspection (§34).
 */
export function buildReportText(snapshot: ReportSnapshot): string {
  const { inspection, findings, observations, correctiveActions, evidence } = snapshot;
  const openFindings = findings.filter((f) => !["closed", "dismissed"].includes(f.status)).length;

  return [
    `================================================================================`,
    `NETRAM INSPECTION REPORT — ${inspection.projectCode ?? "N/A"}: ${inspection.projectName ?? "Project"}`,
    `================================================================================`,
    `Inspection ID : ${inspection.id}`,
    `Type          : ${inspection.type.toUpperCase()}`,
    `Status        : ${inspection.status.toUpperCase()}`,
    `Scheduled     : ${inspection.scheduledStart ?? "N/A"}`,
    `Started       : ${inspection.startedAt ?? "N/A"}`,
    `Submitted     : ${inspection.submittedAt ?? "N/A"}`,
    ``,
    `--------------------------------------------------------------------------------`,
    `EXECUTIVE SUMMARY METRICS`,
    `--------------------------------------------------------------------------------`,
    `Total Findings            : ${findings.length}`,
    `Open / Actionable Findings: ${openFindings}`,
    `Recorded Observations     : ${observations.length}`,
    `Assigned Corrective Actions: ${correctiveActions.length}`,
    `Captured Evidence Items   : ${evidence.length}`,
    ``,
    `--------------------------------------------------------------------------------`,
    `FINDINGS & DEFICIENCIES`,
    `--------------------------------------------------------------------------------`,
    findings.length === 0
      ? `  (No deficiencies flagged)`
      : findings
          .map(
            (f, i) =>
              `[${i + 1}] [${f.severity.toUpperCase()}] ${f.description}\n    Status: ${f.status} | Remediation: ${f.remediation ?? "None"}`,
          )
          .join("\n\n"),
    ``,
    `--------------------------------------------------------------------------------`,
    `CORRECTIVE ACTIONS & DEADLINES`,
    `--------------------------------------------------------------------------------`,
    correctiveActions.length === 0
      ? `  (No active corrective actions assigned)`
      : correctiveActions
          .map(
            (c, i) =>
              `[${i + 1}] Finding: ${c.findingId} | Status: ${c.status.toUpperCase()} | Deadline: ${c.deadline ?? "Immediate"}`,
          )
          .join("\n"),
    ``,
    `================================================================================`,
    `Generated by Netram Automated Reporting Pipeline (DoSJE)`,
    `================================================================================`,
  ].join("\n");
}

