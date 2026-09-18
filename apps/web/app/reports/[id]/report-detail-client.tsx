"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Report } from "@netram/types";
import { formatDate, formatDateTime, getDistrictName, getUserDisplayName } from "../../../lib/presentation";

interface ReportDetailClientProps {
  report: Report;
  canFinalize: boolean;
}

export function ReportDetailClient({ report: initialReport, canFinalize }: ReportDetailClientProps) {
  const router = useRouter();
  const [report, setReport] = useState<Report>(initialReport);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const artifact = (report.artifact ?? null) as {
    generator?: string;
    generatedAt?: string;
    metrics?: {
      findingCount: number;
      openFindings: number;
      observationCount: number;
      correctiveActionCount: number;
      evidenceCount: number;
    };
    findings?: Array<{
      id: string;
      severity: string;
      status: string;
      description: string;
      remediation: string;
      createdAt: string;
    }>;
    observations?: Array<{
      id: string;
      text: string;
      createdAt: string;
    }>;
    correctiveActions?: Array<{
      id: string;
      status: string;
      deadline: string | null;
      createdAt: string;
    }>;
    evidence?: Array<{
      id: string;
      type: string;
      fileName: string;
      uploadState: string;
      integrityState: string;
      capturedAt: string;
    }>;
  } | null;

  const handleFinalize = async () => {
    if (!window.confirm("Are you sure you want to finalize this report? Once finalized, official statutory reports are immutable (§34).")) {
      return;
    }

    setIsFinalizing(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${report.id}/finalize`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Finalize failed with status ${res.status}`);
      }

      setReport(data);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadJson = () => {
    const dataToDownload = report.artifact ?? report;
    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `official-report-${report.projectCode ?? "inspection"}-${report.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    const dataToCopy = report.artifact ?? report;
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const metrics = artifact?.metrics ?? {
    findingCount: artifact?.findings?.length ?? 0,
    openFindings: artifact?.findings?.filter((f) => f.status !== "closed" && f.status !== "dismissed").length ?? 0,
    observationCount: artifact?.observations?.length ?? 0,
    correctiveActionCount: artifact?.correctiveActions?.length ?? 0,
    evidenceCount: artifact?.evidence?.length ?? 0,
  };

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/reports" style={{ color: "var(--color-navy-brand)", textDecoration: "none" }}>
          &larr; Return to Reports
        </Link>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#991b1b",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Statutory Header */}
      <header
        style={{
          background: "var(--bg-card, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "10px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span className="badge badge-routine" style={{ fontWeight: 700 }}>
                STATUTORY REPORT
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)" }}>
                ID: {report.id}
              </span>
            </div>
            <h2 style={{ margin: "0.2rem 0", fontSize: "1.4rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
              {report.projectName ?? "Facility Inspection Report"}
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Facility Code: <strong style={{ color: "var(--text-primary)" }}>{report.projectCode ?? "—"}</strong> ·{" "}
              Jurisdiction: {report.districtId ? getDistrictName(report.districtId, report.projectCode ?? undefined) : "State Oversight"} ·{" "}
              Inspection Type: <span style={{ textTransform: "capitalize" }}>{report.inspectionType}</span>
            </p>
          </div>

          {/* Actions & Status */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.6rem" }}>
            <span
              className={`status status-${report.status}`}
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                padding: "0.35rem 0.85rem",
                borderRadius: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {report.status === "finalized" ? "✓ FINALIZED (SEALED)" : report.status.replace(/_/g, " ")}
            </span>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {canFinalize && report.status === "ready" && (
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  style={{
                    background: "#15803d",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.45rem 1rem",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: isFinalizing ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {isFinalizing ? "Sealing Report…" : "✓ Finalize Statutory Report"}
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadJson}
                className="btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.82rem",
                  padding: "0.45rem 0.85rem",
                  fontWeight: 600,
                }}
              >
                <span>Download Dossier (JSON)</span>
              </button>

              <Link
                href={`/inspections/${report.inspectionId}`}
                className="btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.82rem",
                  padding: "0.45rem 0.85rem",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                <span>View Source Inspection &rarr;</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Audit Meta Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--color-border-subtle, #f1f5f9)",
            fontSize: "0.8rem",
          }}
        >
          <div>
            <span style={{ color: "var(--text-muted, #64748b)", display: "block" }}>Requested By:</span>
            <span style={{ fontWeight: 600 }}>{getUserDisplayName(report.requestedBy, "Supervisory Officer")}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted, #64748b)", display: "block" }}>Requested On:</span>
            <span style={{ fontWeight: 600 }}>{formatDateTime(report.requestedAt)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted, #64748b)", display: "block" }}>Generated At:</span>
            <span style={{ fontWeight: 600 }}>
              {report.generatedAt ? formatDateTime(report.generatedAt) : "Processing…"}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-muted, #64748b)", display: "block" }}>Finalized At:</span>
            <span style={{ fontWeight: 600 }}>
              {report.finalizedAt ? formatDateTime(report.finalizedAt) : "Pending Review"}
            </span>
          </div>
        </div>
      </header>

      {/* Metrics Summary Strip */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="overview-card" style={{ padding: "1rem" }}>
          <span className="card-label">Total Findings</span>
          <span className="card-val" style={{ fontSize: "1.4rem", color: "var(--color-navy-brand)" }}>
            {metrics.findingCount}
          </span>
        </div>
        <div className="overview-card" style={{ padding: "1rem" }}>
          <span className="card-label">Open Deficiencies</span>
          <span className="card-val" style={{ fontSize: "1.4rem", color: metrics.openFindings > 0 ? "#dc2626" : "#16a34a" }}>
            {metrics.openFindings}
          </span>
        </div>
        <div className="overview-card" style={{ padding: "1rem" }}>
          <span className="card-label">Corrective Orders</span>
          <span className="card-val" style={{ fontSize: "1.4rem", color: "#ea580c" }}>
            {metrics.correctiveActionCount}
          </span>
        </div>
        <div className="overview-card" style={{ padding: "1rem" }}>
          <span className="card-label">Verified Evidence</span>
          <span className="card-val" style={{ fontSize: "1.4rem", color: "#0284c7" }}>
            {metrics.evidenceCount}
          </span>
        </div>
        <div className="overview-card" style={{ padding: "1rem" }}>
          <span className="card-label">Observations</span>
          <span className="card-val" style={{ fontSize: "1.4rem", color: "#475569" }}>
            {metrics.observationCount}
          </span>
        </div>
      </section>

      {/* Findings Section */}
      <div className="table-card" style={{ marginBottom: "1.5rem" }}>
        <div className="section-header" style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
              Regulatory Findings Matrix ({artifact?.findings?.length ?? 0})
            </h3>
            <p className="muted" style={{ margin: "0.15rem 0 0 0", fontSize: "0.78rem" }}>
              Identified deficiencies, statutory standard non-compliances, and required rectifications
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "100px" }}>Severity</th>
              <th style={{ width: "100px" }}>Status</th>
              <th>Deficiency Description</th>
              <th>Mandatory Remediation</th>
              <th style={{ width: "120px" }}>Recorded</th>
            </tr>
          </thead>
          <tbody>
            {(!artifact?.findings || artifact.findings.length === 0) ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                  No statutory deficiencies or non-compliance findings recorded in this report.
                </td>
              </tr>
            ) : (
              artifact.findings.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className={`badge ${f.severity === "critical" ? "badge-critical" : f.severity === "major" ? "badge-major" : "badge-routine"}`}>
                      {f.severity.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`status status-${f.status}`}>
                      {f.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, fontSize: "0.85rem", lineHeight: 1.4 }}>
                    {f.description}
                  </td>
                  <td className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.4 }}>
                    {f.remediation}
                  </td>
                  <td className="muted" style={{ fontSize: "0.78rem" }}>
                    {formatDate(f.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Corrective Actions & Evidence Two-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Corrective Actions */}
        <div className="table-card">
          <div className="section-header" style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              Corrective Remediation Orders ({artifact?.correctiveActions?.length ?? 0})
            </h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Action ID</th>
                <th>Status</th>
                <th>SLA Deadline</th>
              </tr>
            </thead>
            <tbody>
              {(!artifact?.correctiveActions || artifact.correctiveActions.length === 0) ? (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                    No corrective actions attached.
                  </td>
                </tr>
              ) : (
                artifact.correctiveActions.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/corrective-actions/${c.id}`}
                        style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 600, color: "var(--color-navy-brand)" }}
                      >
                        CA-{c.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <span className={`status status-${c.status}`}>{c.status}</span>
                    </td>
                    <td className="muted" style={{ fontSize: "0.78rem" }}>
                      {c.deadline ? formatDate(c.deadline) : "Standard SLA"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Tamper-Evident Evidence Register */}
        <div className="table-card">
          <div className="section-header" style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              Tamper-Evident Evidence Chain ({artifact?.evidence?.length ?? 0})
            </h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>File Reference</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {(!artifact?.evidence || artifact.evidence.length === 0) ? (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "1.5rem" }}>
                    No physical or digital evidence captured.
                  </td>
                </tr>
              ) : (
                artifact.evidence.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="badge badge-routine" style={{ fontSize: "0.7rem" }}>
                        {e.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.fileName}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: e.integrityState === "verified" ? "#dcfce7" : "#f1f5f9",
                          color: e.integrityState === "verified" ? "#15803d" : "#64748b",
                        }}
                      >
                        {e.integrityState === "verified" ? "✓ SHA-256 Verified" : e.integrityState}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Statutory Artifact Dossier Inspector */}
      <div className="table-card">
        <div
          style={{
            padding: "0.85rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface-subtle, #f8fafc)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
              Deterministic Statutory JSON Dossier (§34/§1310)
            </h4>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Tamper-evident snapshot derived from authoritative domain records
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleCopyJson}
              className="btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            >
              {copied ? "✓ Copied!" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            >
              {showJson ? "Collapse" : "Expand Raw JSON"}
            </button>
          </div>
        </div>

        {showJson && (
          <pre
            style={{
              padding: "1.25rem",
              margin: 0,
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: "0.78rem",
              fontFamily: "var(--font-mono)",
              overflowX: "auto",
              maxHeight: "400px",
            }}
          >
            {JSON.stringify(report.artifact ?? report, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
