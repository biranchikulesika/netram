"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Complaint, ComplaintStatus } from "@netram/types";
import { formatDate, formatDateTime, formatDistrict } from "../../../../lib/presentation";
import { getComplaintStatusBadge } from "../complaint-card";
import { ComplaintTransitionModal } from "../complaint-transition-modal";
import { IconClock, IconGavel, IconClipboard, IconShieldCheck } from "../../../components/icons";

export interface ComplaintDetailClientProps {
  initialComplaint: Complaint;
  canResolve: boolean;
}

const LIFECYCLE_STAGES: {
  id: string;
  label: string;
  hint: string;
  statuses: ComplaintStatus[];
}[] = [
  {
    id: "stage-1",
    label: "Registered",
    hint: "logged in public ledger",
    statuses: ["received"],
  },
  {
    id: "stage-2",
    label: "Jurisdiction Review",
    hint: "district authority examination",
    statuses: ["under_review"],
  },
  {
    id: "stage-3",
    label: "Field Inquiry",
    hint: "inspection or state escalation",
    statuses: ["escalated"],
  },
  {
    id: "stage-4",
    label: "Redressal & Closure",
    hint: "official statutory determination",
    statuses: ["resolved", "closed"],
  },
];

export function ComplaintDetailClient({
  initialComplaint,
  canResolve,
}: ComplaintDetailClientProps) {
  const [complaint, setComplaint] = useState<Complaint>(initialComplaint);
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);

  const statusMeta = getComplaintStatusBadge(complaint.status);
  const isTerminal = complaint.status === "resolved" || complaint.status === "closed";
  const currentIndex = LIFECYCLE_STAGES.findIndex((stage) =>
    stage.statuses.includes(complaint.status),
  );

  const districtLabel = formatDistrict(complaint.districtName);
  const statusLabel = complaint.status.replace(/_/g, " ").toUpperCase();

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "1rem" }}>
        <Link
          href="/dashboard/complaints"
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

      {/* Hero */}
      <header className="inspection-hero">
        <div className="inspection-hero-main">
          <h1 className="inspection-hero-title">{complaint.projectName}</h1>
          <div className="inspection-hero-meta">
            <span className="inspection-meta-chip">
              <IconGavel width={13} height={13} style={{ color: "#0c2a52" }} />
              <Link href={`/dashboard/projects/${complaint.projectId}`} style={{ fontWeight: 600 }}>
                Facility: {complaint.projectCode}
              </Link>
            </span>
            <span className="inspection-meta-sep" />
            <span>{districtLabel}</span>
            <span className="inspection-meta-sep" />
            <span className="inspection-id">{complaint.trackingCode}</span>
          </div>
        </div>
        <div className="inspection-hero-side">
          {canResolve && !isTerminal && (
            <button
              type="button"
              onClick={() => setIsTransitionOpen(true)}
              className="btn-primary"
              style={{
                padding: "0.55rem 1.25rem",
                fontSize: "0.85rem",
                background: "var(--color-navy-brand)",
                marginTop: "0.75rem",
              }}
            >
              Update Grievance Status &rarr;
            </button>
          )}
        </div>
      </header>

      {/* Lifecycle Stepper */}
      <div className="workflow-card">
        <div className="workflow-stepper" aria-label={`Complaint workflow: ${statusLabel}`}>
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const isCurrent = idx === currentIndex;
            const isPassed = currentIndex > -1 && idx < currentIndex;
            const nodeClass = isPassed ? "passed" : isCurrent ? "current" : "";

            return (
              <div key={stage.id} className={`workflow-step ${nodeClass}`}>
                <div className="workflow-node" title={stage.label}>
                  {isPassed ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="workflow-step-label" title={stage.label}>
                  {stage.label}
                </div>
                <div className="workflow-step-hint">{stage.hint}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overview Cards */}
      <section className="overview-cards">
        <div className="overview-card">
          <span className="card-label">
            <IconClock width={13} height={13} /> Filed Date
          </span>
          <span className="card-val">{formatDate(complaint.receivedAt)}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconClipboard width={13} height={13} /> Tracking Code
          </span>
          <span className="card-val">{complaint.trackingCode}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconShieldCheck width={13} height={13} /> Status
          </span>
          <span className="card-val" style={{ color: statusMeta.color }}>
            {statusLabel}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconGavel width={13} height={13} /> Jurisdiction
          </span>
          <span className="card-val">{districtLabel}</span>
        </div>
      </section>

      {/* Grievance Narrative */}
      <section className="evidence-section">
        <div className="section-title-row">
          <h3>Grievance Narrative</h3>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            lineHeight: 1.6,
            color: "#002449",
            whiteSpace: "pre-wrap",
          }}
        >
          {complaint.description}
        </p>
      </section>

      {/* Resolution | Complainant */}
      <div className="section-pair-grid">
        <section className="evidence-section">
          <div className="section-title-row">
            <h3>Official Determination</h3>
          </div>

          {complaint.resolutionText ? (
            <div>
              {complaint.resolvedAt && (
                <div className="muted" style={{ marginBottom: "0.6rem", fontSize: "0.78rem" }}>
                  Recorded {formatDateTime(complaint.resolvedAt)}
                </div>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  color: "#002449",
                  whiteSpace: "pre-wrap",
                }}
              >
                {complaint.resolutionText}
              </p>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <IconShieldCheck width={20} height={20} />
              </div>
              <div className="empty-state-title">
                {isTerminal ? "No determination recorded" : "Awaiting statutory determination"}
              </div>
              {isTerminal && (
                <p className="empty-state-sub">
                  This grievance was closed without recording an official resolution.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="evidence-section">
          <div className="section-title-row">
            <h3>Supporting Attachments</h3>
            {complaint.files.length > 0 && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-subtle)", fontWeight: 600 }}>
                {complaint.files.length} file{complaint.files.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {complaint.files.length === 0 ? (
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              No supporting evidence was lodged with this grievance.
            </div>
          ) : (
            <ul
              style={{ display: "grid", gap: "0.4rem", margin: 0, padding: 0, listStyle: "none" }}
            >
              {complaint.files.map((f) => (
                <li key={f.id}>
                  <a
                    href={`/api/complaints/${complaint.id}/files/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "#edf0f5",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "6px",
                      padding: "0.45rem 0.6rem",
                      fontSize: "0.8rem",
                      color: "#002449",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {f.fileName}
                    </span>
                    <span className="muted" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                      {(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <span
                      style={{ color: "var(--color-navy-brand)", fontWeight: 600, flexShrink: 0 }}
                    >
                      Open &rarr;
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="evidence-section">
          <div className="section-title-row">
            <h3>Complainant Information</h3>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)", fontWeight: 600 }}>
              NAME
            </div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#002449" }}>
              {complaint.complainantName || "Anonymous Citizen"}
            </div>
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)", fontWeight: 600 }}>
              CONTACT / TELECOM
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {complaint.contactInfo || "Not provided"}
            </div>
          </div>
        </section>
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
