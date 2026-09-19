"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Complaint } from "@netram/types";
import { formatDate, formatDateTime } from "../../../lib/presentation";
import { ComplaintTransitionModal } from "../complaint-transition-modal";

export interface ComplaintDetailClientProps {
  initialComplaint: Complaint;
  canResolve: boolean;
}

function getStatusBadge(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "received":
      return { bg: "#e0f2fe", color: "#0369a1", label: "RECEIVED" };
    case "under_review":
      return { bg: "#fef3c7", color: "#b45309", label: "UNDER REVIEW" };
    case "escalated":
      return { bg: "#fee2e2", color: "#dc2626", label: "ESCALATED" };
    case "resolved":
      return { bg: "#dcfce7", color: "#15803d", label: "RESOLVED" };
    case "closed":
      return { bg: "#f1f5f9", color: "#475569", label: "CLOSED" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: status.toUpperCase() };
  }
}

export function ComplaintDetailClient({
  initialComplaint,
  canResolve,
}: ComplaintDetailClientProps) {
  const [complaint, setComplaint] = useState<Complaint>(initialComplaint);
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);

  const statusMeta = getStatusBadge(complaint.status);
  const isTerminal = complaint.status === "resolved" || complaint.status === "closed";

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: "1rem" }}>
        <Link
          href="/complaints"
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
          <span>&larr; Back to Complaints</span>
        </Link>
      </div>

      {/* Main Dossier Header */}
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
                TRACKING CODE: {complaint.trackingCode}
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
              {complaint.projectName}
            </h1>
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              Project Code:{" "}
              <Link
                href={`/projects/${complaint.projectId}`}
                style={{ color: "var(--color-navy-brand)", fontWeight: 600 }}
              >
                {complaint.projectCode}
              </Link>
            </p>
          </div>

          {canResolve && !isTerminal && (
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
              Update Grievance Status &rarr;
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
          <div style={{ opacity: 1 }}>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>1. RECEIVED</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0369a1", marginTop: "0.15rem" }}>
              Registered
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {formatDate(complaint.receivedAt)}
            </div>
          </div>

          <div
            style={{
              opacity:
                complaint.status === "under_review" ||
                complaint.status === "escalated" ||
                complaint.status === "resolved" ||
                complaint.status === "closed"
                  ? 1
                  : 0.35,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
              2. UNDER REVIEW
            </div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#b45309", marginTop: "0.15rem" }}>
              {complaint.status === "received" ? "Pending" : "Active / Completed"}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              Fact Verification
            </div>
          </div>

          <div
            style={{
              opacity: complaint.status === "escalated" ? 1 : 0.35,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>3. ESCALATED</div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: complaint.status === "escalated" ? "#dc2626" : "#64748b",
                marginTop: "0.15rem",
              }}
            >
              {complaint.status === "escalated" ? "Under Investigation" : "Standard Track"}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              Higher Authority
            </div>
          </div>

          <div
            style={{
              opacity: isTerminal ? 1 : 0.35,
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>4. CONCLUSION</div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color:
                  complaint.status === "resolved"
                    ? "#15803d"
                    : complaint.status === "closed"
                      ? "#475569"
                      : "#64748b",
                marginTop: "0.15rem",
              }}
            >
              {complaint.status === "resolved"
                ? "Resolved"
                : complaint.status === "closed"
                  ? "Closed"
                  : "Awaiting Action"}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {complaint.resolvedAt ? formatDate(complaint.resolvedAt) : "Pending"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Grievance Content & Side Metadata */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Narrative & Resolution */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Grievance Narrative */}
          <div className="table-card" style={{ padding: "1.5rem" }}>
            <h3
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Grievance Narrative
            </h3>
            <p
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.6,
                color: "#1e293b",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {complaint.description}
            </p>
          </div>

          {/* Official Resolution Card (if present) */}
          {complaint.resolutionText && (
            <div
              className="table-card"
              style={{
                padding: "1.5rem",
                background: complaint.status === "resolved" ? "#f0fdf4" : "#f8fafc",
                borderColor: complaint.status === "resolved" ? "#bbf7d0" : "#e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.4rem",
                    borderRadius: "4px",
                    background: complaint.status === "resolved" ? "#dcfce7" : "#e2e8f0",
                    color: complaint.status === "resolved" ? "#15803d" : "#475569",
                  }}
                >
                  OFFICIAL RESOLUTION
                </span>
                {complaint.resolvedAt && (
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    Recorded on {formatDateTime(complaint.resolvedAt)}
                  </span>
                )}
              </div>

              <h4
                style={{
                  margin: "0.5rem 0",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                Statutory Redressal Findings & Actions
              </h4>
              <p
                style={{
                  fontSize: "0.88rem",
                  lineHeight: 1.6,
                  color: "#334155",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {complaint.resolutionText}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Complainant Info & Governance Context */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Complainant Confidentiality Card */}
          <div className="table-card" style={{ padding: "1.25rem" }}>
            <h4
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Complainant Information
            </h4>

            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>NAME</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}>
                {complaint.complainantName || "Anonymous Citizen"}
              </div>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                CONTACT / TELECOM
              </div>
              <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                {complaint.contactInfo || "Not provided"}
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
              <strong>Whistleblower Privacy (§39):</strong> Personal complainant identifiers are
              restricted to authorized scrutiny and protected from non-authorized disclosure.
            </div>
          </div>

          {/* Governance & Tracking Quick Links */}
          <div className="table-card" style={{ padding: "1.25rem" }}>
            <h4
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Governance Context
            </h4>

            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                JURISDICTION DISTRICT
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                {complaint.districtId ?? "State / Unassigned"}
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                LIFECYCLE POLICY
              </div>
              <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                Netram Oversight Framework §35
              </div>
            </div>

            <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <Link
                href={`/track-complaint?code=${encodeURIComponent(complaint.trackingCode)}`}
                target="_blank"
                style={{
                  fontSize: "0.78rem",
                  color: "var(--color-navy-brand)",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>View Citizen Public Tracking View &rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      <ComplaintTransitionModal
        complaint={complaint}
        isOpen={isTransitionOpen}
        onClose={() => setIsTransitionOpen(false)}
        onSuccess={(updated) => setComplaint(updated)}
      />
    </div>
  );
}
