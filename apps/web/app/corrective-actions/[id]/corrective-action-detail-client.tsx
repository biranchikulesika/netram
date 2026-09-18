"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { CorrectiveAction, CorrectiveActionStatus, Finding, Inspection, Project } from "@netram/types";
import { CORRECTIVE_ACTION_TRANSITIONS } from "@netram/types";
import { formatDate, formatDateTime, getDistrictName } from "../../../lib/presentation";
import { CorrectiveActionTransitionModal } from "../corrective-action-transition-modal";

export interface CorrectiveActionDetailClientProps {
  initialAction: CorrectiveAction;
  finding: Finding | null;
  inspection: Inspection | null;
  project: Project | null;
  canTransition: boolean;
}

function getStatusBadge(status: CorrectiveActionStatus): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "pending":
      return { bg: "#f1f5f9", color: "#475569", label: "PENDING" };
    case "submitted":
      return { bg: "#e0f2fe", color: "#0369a1", label: "SUBMITTED" };
    case "under_review":
      return { bg: "#fef3c7", color: "#b45309", label: "UNDER REVIEW" };
    case "accepted":
      return { bg: "#dcfce7", color: "#15803d", label: "ACCEPTED" };
    case "rejected":
      return { bg: "#fee2e2", color: "#b91c1c", label: "REJECTED" };
    case "overdue":
      return { bg: "#ffedd5", color: "#c2410c", label: "OVERDUE" };
    case "escalated":
      return { bg: "#f3e8ff", color: "#7e22ce", label: "ESCALATED" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: status };
  }
}

export function CorrectiveActionDetailClient({
  initialAction,
  finding,
  inspection,
  project,
  canTransition,
}: CorrectiveActionDetailClientProps) {
  const [action, setAction] = useState<CorrectiveAction>(initialAction);
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);

  const statusMeta = getStatusBadge(action.status);
  const allowableTransitions = CORRECTIVE_ACTION_TRANSITIONS[action.status] ?? [];
  const canAct = canTransition && allowableTransitions.length > 0;

  const isOverdue =
    action.deadline &&
    action.status !== "accepted" &&
    new Date(action.deadline) < new Date();

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1rem" }}>
        <Link
          href="/corrective-actions"
          style={{
            color: "var(--color-navy-brand)",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <span>&larr; Back to Corrective Actions</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div
        className="table-card"
        style={{
          padding: "1.5rem",
          marginBottom: "1.5rem",
          borderLeft: `5px solid ${statusMeta.color}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#475569",
                  background: "#f1f5f9",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                }}
              >
                ACTION: {action.id.slice(0, 10)}...
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  background: statusMeta.bg,
                  color: statusMeta.color,
                }}
              >
                {statusMeta.label}
              </span>
            </div>

            <h1
              style={{
                margin: "0.6rem 0 0.2rem",
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              {project ? project.name : "Remediation Order Dossier"}
            </h1>

            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              {project && (
                <>
                  Project:{" "}
                  <Link
                    href={`/projects/${project.id}`}
                    style={{ color: "var(--color-navy-brand)", fontWeight: 600 }}
                  >
                    {project.code}
                  </Link>{" "}
                  ·{" "}
                </>
              )}
              Inspection:{" "}
              <Link
                href={`/inspections/${action.inspectionId}`}
                style={{ color: "var(--color-navy-brand)", fontWeight: 600 }}
              >
                #{action.inspectionId.slice(0, 8)}
              </Link>
            </p>
          </div>

          {canAct && (
            <button
              type="button"
              onClick={() => setIsTransitionOpen(true)}
              className="btn-primary"
              style={{
                padding: "0.55rem 1.25rem",
                fontSize: "0.85rem",
                background: "var(--color-navy-brand)",
              }}
            >
              Transition Status &rarr;
            </button>
          )}
        </div>

        {/* Lifecycle Stepper */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "0.5rem",
            marginTop: "1.5rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          {/* 1. Ordered */}
          <div style={{ opacity: 1 }}>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>1. ORDERED</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginTop: "0.15rem" }}>
              Action Mandate
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {formatDate(action.createdAt)}
            </div>
          </div>

          {/* 2. Submitted */}
          <div
            style={{
              opacity:
                action.status === "submitted" ||
                action.status === "under_review" ||
                action.status === "accepted"
                  ? 1
                  : 0.35,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
              2. SUBMITTED
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: action.submittedAt ? "#0369a1" : "#64748b",
                marginTop: "0.15rem",
              }}
            >
              {action.submittedAt ? "Evidence Lodged" : "Awaiting Lodgment"}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {action.submittedAt ? formatDate(action.submittedAt) : "Pending Contractor"}
            </div>
          </div>

          {/* 3. Under Review */}
          <div
            style={{
              opacity:
                action.status === "under_review" || action.status === "accepted" ? 1 : 0.35,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
              3. UNDER REVIEW
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color:
                  action.status === "under_review"
                    ? "#b45309"
                    : action.status === "accepted"
                      ? "#15803d"
                      : "#64748b",
                marginTop: "0.15rem",
              }}
            >
              {action.status === "under_review"
                ? "Active Verification"
                : action.status === "accepted"
                  ? "Approved"
                  : "Awaiting Scrutiny"}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              Technical Scrutiny
            </div>
          </div>

          {/* 4. Conclusion */}
          <div
            style={{
              opacity:
                action.status === "accepted" ||
                action.status === "rejected" ||
                action.status === "overdue" ||
                action.status === "escalated"
                  ? 1
                  : 0.35,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
              4. CONCLUSION
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color:
                  action.status === "accepted"
                    ? "#15803d"
                    : action.status === "rejected"
                      ? "#b91c1c"
                      : action.status === "overdue"
                        ? "#c2410c"
                        : action.status === "escalated"
                          ? "#7e22ce"
                          : "#64748b",
                marginTop: "0.15rem",
              }}
            >
              {action.status === "accepted"
                ? "Accepted & Closed"
                : action.status === "rejected"
                  ? "Rejected"
                  : action.status === "overdue"
                    ? "Overdue Breach"
                    : action.status === "escalated"
                      ? "Enforcement Escalated"
                      : "In Progress"}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {action.status === "accepted" ? "Remediation Satisfied" : "Lifecycle Outcome"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Finding Details */}
          <div className="table-card" style={{ padding: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--color-navy-brand)",
                }}
              >
                Underlying Deficiency Finding
              </h3>
              {finding && (
                <span className={`badge-severity ${finding.severity}`}>
                  {finding.severity.toUpperCase()} SEVERITY
                </span>
              )}
            </div>

            {finding ? (
              <div>
                <p
                  style={{
                    fontSize: "0.9rem",
                    lineHeight: 1.6,
                    color: "#1e293b",
                    margin: "0 0 1rem 0",
                  }}
                >
                  {finding.description}
                </p>

                {finding.remediation && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "0.85rem 1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        color: "#475569",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        marginBottom: "0.35rem",
                      }}
                    >
                      Mandatory Remediation Terms:
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.86rem",
                        lineHeight: 1.5,
                        color: "#334155",
                      }}
                    >
                      {finding.remediation}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Finding UUID: {action.findingId}
              </p>
            )}
          </div>

          {/* Compliance Deadlines and Timestamps */}
          <div className="table-card" style={{ padding: "1.5rem" }}>
            <h3
              style={{
                margin: "0 0 1rem 0",
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Statutory Compliance & SLA
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                  COMPLIANCE DEADLINE
                </div>
                <div
                  style={{
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    color: isOverdue ? "#dc2626" : "#1e293b",
                    marginTop: "0.2rem",
                  }}
                >
                  {action.deadline ? formatDate(action.deadline) : "None specified"}
                </div>
                {isOverdue && (
                  <div style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>
                    Breach of statutory compliance window
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                  DATE ISSUED
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1e293b", marginTop: "0.2rem" }}>
                  {formatDate(action.createdAt)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                  LAST UPDATED
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1e293b", marginTop: "0.2rem" }}>
                  {formatDateTime(action.updatedAt)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Governance & Jurisdiction Card */}
          <div className="table-card" style={{ padding: "1.25rem" }}>
            <h4
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Jurisdiction & Authority
            </h4>

            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                DISTRICT JURISDICTION
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                {project?.districtId ? getDistrictName(project.districtId, project.code) : "State Oversight"}
              </div>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                RESPONSIBLE ENTITY
              </div>
              <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                {action.organisationId ? `Org ID: ${action.organisationId.slice(0, 12)}...` : "Contractor / Executing Agency"}
              </div>
            </div>

            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "4px",
                padding: "0.5rem 0.65rem",
                fontSize: "0.72rem",
                color: "#1d4ed8",
                lineHeight: 1.4,
              }}
            >
              <strong>Regulatory Framework (§32):</strong> Deficiency remediation follows two-party separation:
              institution submits work; authority independently verifies and closes.
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="table-card" style={{ padding: "1.25rem" }}>
            <h4
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Related Dossiers
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Link
                href={`/inspections/${action.inspectionId}`}
                style={{
                  fontSize: "0.82rem",
                  color: "var(--color-navy-brand)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {inspection
                  ? `${inspection.type.toUpperCase()} Inspection #${action.inspectionId.slice(0, 8)}`
                  : `Inspection Dossier #${action.inspectionId.slice(0, 8)}`}{" "}
                &rarr;
              </Link>

              {project && (
                <Link
                  href={`/projects/${project.id}`}
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--color-navy-brand)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Facility / Project {project.code} &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      <CorrectiveActionTransitionModal
        correctiveAction={action}
        isOpen={isTransitionOpen}
        onClose={() => setIsTransitionOpen(false)}
        onSuccess={(updated) => setAction(updated)}
      />
    </div>
  );
}
