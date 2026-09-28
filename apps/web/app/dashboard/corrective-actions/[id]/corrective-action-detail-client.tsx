"use client";

import React, { useState } from "react";
import Link from "next/link";
import type {
  CorrectiveAction,
  CorrectiveActionFile,
  CorrectiveActionReviewOutcome,
  CorrectiveActionStatus,
  Finding,
  Project,
} from "@netram/types";
import { formatDate, formatDateTime, formatDistrict } from "../../../../lib/presentation";
import { getStatusBadge } from "../corrective-action-card";
import {
  IconClock,
  IconGavel,
  IconClipboard,
  IconShieldCheck,
  IconCamera,
  IconX,
} from "../../../components/icons";

const ACCEPTED_ATTACHMENT_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export interface CorrectiveActionDetailClientProps {
  initialAction: CorrectiveAction;
  finding: Finding | null;
  project: Project | null;
  canSubmitAtr: boolean;
  canReview: boolean;
}

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  borderRadius: "6px",
  border: "1px solid var(--color-border-strong)",
  fontSize: "0.85rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
  color: "#002449",
  background: "#fff",
} as const;

const LIFECYCLE_STAGES: {
  id: string;
  label: string;
  hint: string;
  statuses: CorrectiveActionStatus[];
}[] = [
  {
    id: "stage-1",
    label: "Ordered",
    hint: "remediation mandate issued",
    statuses: ["pending"],
  },
  { id: "stage-2", label: "Submitted", hint: "ATR lodged by entity", statuses: ["submitted"] },
  { id: "stage-3", label: "Authority Review", hint: "under scrutiny", statuses: ["under_review"] },
  {
    id: "stage-4",
    label: "Outcome",
    hint: "accepted · rejected · escalated",
    statuses: ["accepted", "rejected", "overdue", "escalated"],
  },
];

export function CorrectiveActionDetailClient({
  initialAction,
  finding,
  project,
  canSubmitAtr,
  canReview,
}: CorrectiveActionDetailClientProps) {
  const [action, setAction] = useState<CorrectiveAction>(initialAction);

  const [atrSummary, setAtrSummary] = useState("");
  const [atrFiles, setAtrFiles] = useState<File[]>([]);
  const [reviewOutcome, setReviewOutcome] = useState<CorrectiveActionReviewOutcome>(
    "under_review",
  );
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusMeta = getStatusBadge(action.status);

  const submitAllowed = ["pending", "rejected", "overdue"].includes(action.status);
  const canWorkSubmit = canSubmitAtr && submitAllowed;

  const reviewChoices: { value: CorrectiveActionReviewOutcome; label: string }[] =
    action.status === "submitted"
      ? [
          { value: "under_review", label: "Begin review" },
          { value: "accepted", label: "Accept & close" },
          { value: "rejected", label: "Reject & require resubmission" },
        ]
      : action.status === "under_review"
        ? [
            { value: "accepted", label: "Accept & close" },
            { value: "rejected", label: "Reject & require resubmission" },
          ]
        : [];
  const canWorkReview = canReview && reviewChoices.length > 0;

  const isOverdue =
    action.deadline &&
    action.status !== "accepted" &&
    new Date(action.deadline) < new Date();

  const districtLabel = project?.districtId
    ? formatDistrict(project.districtName, project.stateName)
    : "Odisha State Jurisdiction";

  const lifecycleRendered = (() => {
    const skippedForTerminal =
      action.status === "overdue" || action.status === "escalated";
    const currentIndex = LIFECYCLE_STAGES.findIndex((stage) =>
      stage.statuses.includes(action.status),
    );
    return { skippedForTerminal, currentIndex };
  })();

  const statusLabel = action.status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const handleSubmitAtr = async () => {
    if (!atrSummary.trim()) {
      setActionError("Describe the remediation work performed before submitting.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const form = new FormData();
      form.append("actionSummary", atrSummary.trim());
      for (const file of atrFiles) form.append("files", file, file.name);
      const res = await fetch(`/api/corrective-actions/${action.id}/submit-atr`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? `Submission failed (${res.status})`);
      setAction(data as CorrectiveAction);
      setAtrSummary("");
      setAtrFiles([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/corrective-actions/${action.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: reviewOutcome,
          note: reviewNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? `Review failed (${res.status})`);
      setAction(data as CorrectiveAction);
      setReviewNote("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <header className="inspection-hero">
        <div className="inspection-hero-main">
          <h1 className="inspection-hero-title">
            {project ? project.name : "Remediation Order Record"}
          </h1>
          <div className="inspection-hero-meta">
            {project && (
              <>
                <span className="inspection-meta-chip">
                  <IconGavel width={13} height={13} style={{ color: "#0c2a52" }} />
                  <Link href={`/dashboard/projects/${project.id}`} style={{ fontWeight: 600 }}>
                    Facility: {project.code}
                  </Link>
                </span>
                <span className="inspection-meta-sep" />
              </>
            )}
            <span className="inspection-meta-chip">
              <IconClipboard width={13} height={13} style={{ color: "#0c2a52" }} />
              <Link href={`/dashboard/inspections/${action.inspectionId}`} style={{ fontWeight: 600 }}>
                Inspection #{action.inspectionId.slice(0, 8)}
              </Link>
            </span>
            <span className="inspection-meta-sep" />
            <span>{districtLabel}</span>
            <span className="inspection-meta-sep" />
            <span className="inspection-id">CA ref: {action.id.slice(0, 12)}</span>
          </div>
        </div>
        <div className="inspection-hero-side">
          <span className="status status-large" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </span>
        </div>
      </header>

      {/* Lifecycle Stepper */}
      <div className="workflow-card">
        <div className="workflow-stepper" aria-label={`Corrective action workflow: ${statusLabel}`}>
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const isCurrent = idx === lifecycleRendered.currentIndex;
            const isPassed = lifecycleRendered.skippedForTerminal
              ? idx === 0
              : lifecycleRendered.currentIndex > -1 && idx < lifecycleRendered.currentIndex;
            const nodeClass = isPassed ? "passed" : isCurrent ? "current" : "";

            return (
              <div key={stage.id} className={`workflow-step ${nodeClass}`}>
                <div className="workflow-node" title={stage.label}>
                  {isPassed ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="workflow-step-label" title={stage.label}>
                  {stage.label}
                </div>
                <div className="workflow-step-hint">
                  {stage.hint}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overview Cards */}
      <section className="overview-cards">
        <div className="overview-card">
          <span className="card-label">
            <IconClock width={13} height={13} /> Compliance Deadline
          </span>
          <span className="card-val" style={isOverdue ? { color: "#dc2626" } : undefined}>
            {action.deadline
              ? `${formatDate(action.deadline)}${isOverdue ? " · Overdue" : ""}`
              : "No deadline set"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconGavel width={13} height={13} /> Date Issued
          </span>
          <span className="card-val">{formatDate(action.createdAt)}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconClipboard width={13} height={13} /> Action Taken Report
          </span>
          <span className="card-val">
            {action.submittedAt ? "ATR Submitted" : "Not yet submitted"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconShieldCheck width={13} height={13} /> Verification
          </span>
          <span className="card-val">
            {action.verifiedAt
              ? `Verified on ${formatDate(action.verifiedAt)}`
              : action.status === "accepted"
                ? "Verified & closed"
                : "Pending authority review"}
          </span>
        </div>
      </section>

      {/* Underlying Deficiency */}
      <section className="evidence-section">
        <div className="section-title-row">
          <h3>Underlying Deficiency Finding</h3>
          {finding && (
            <span className={`badge-severity ${finding.severity}`}>
              {finding.severity.toUpperCase()} SEVERITY
            </span>
          )}
        </div>

        {finding ? (
          <div>
            <p className="finding-desc">{finding.description}</p>
            {finding.remediation ? (
              <div className="remediation-box">
                <span className="remediation-label">Required Remediation</span>
                <p className="remediation-text">{finding.remediation}</p>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.8rem" }}>
                No mandatory remediation terms recorded for this finding.
              </p>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Finding: {action.findingId}
          </p>
        )}
      </section>

      {/* Action Taken Report | Authority Review */}
      <div className="section-pair-grid">
        <section className="evidence-section">
          <div className="section-title-row">
            <h3>Action Taken Report</h3>
          </div>

          {action.actionSummary ? (
            <div>
              {action.submittedAt && (
                <div className="muted" style={{ marginBottom: "0.6rem", fontSize: "0.78rem" }}>
                  Submitted {formatDateTime(action.submittedAt)}
                </div>
              )}
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "#002449" }}>
                {action.actionSummary}
              </p>
              {action.atrFiles.length > 0 && (
                <div style={{ marginTop: "0.85rem", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Supporting Attachments ({action.atrFiles.length})
                  </div>
                  <ul style={{ display: "grid", gap: "0.4rem", margin: 0, padding: 0, listStyle: "none" }}>
                    {action.atrFiles.map((f: CorrectiveActionFile) => (
                      <li key={f.id}>
                        <a
                          href={`/api/corrective-actions/${action.id}/files/${f.id}`}
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
                          <IconClipboard width={14} height={14} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.fileName}
                          </span>
                          <span className="muted" style={{ fontSize: "0.72rem", flexShrink: 0 }}>
                            {formatBytes(f.sizeBytes)}
                          </span>
                          <span style={{ color: "#0c2a52", fontSize: "0.72rem", fontWeight: 600, flexShrink: 0 }}>
                            Open &rsaquo;
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <IconClipboard width={20} height={20} />
              </div>
              <div className="empty-state-title">No action taken report</div>
              <p className="empty-state-sub">
                {action.status === "pending"
                  ? "The responsible organisation has not yet lodged remediation evidence."
                  : "Awaiting remediation evidence from the responsible organisation."}
              </p>
            </div>
          )}

          {canWorkSubmit && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                SUBMIT REMEDIATION EVIDENCE
              </div>
              <p className="muted" style={{ margin: "0 0 0.6rem", fontSize: "0.78rem" }}>
                Recording the Action Taken Report automatically advances this order to{" "}
                <strong>Submitted</strong> for authority review.
              </p>
              {actionError && (
                <div
                  style={{
                    background: "var(--tint-red)",
                    border: "1px solid var(--tint-red)",
                    borderRadius: "6px",
                    padding: "0.55rem 0.75rem",
                    marginBottom: "0.6rem",
                    color: "#dc2626",
                    fontSize: "0.8rem",
                  }}
                >
                  {actionError}
                </div>
              )}
              <textarea
                value={atrSummary}
                onChange={(e) => setAtrSummary(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Detail the remediation work performed, contractor certifications, and proof of rectification..."
                style={inputStyle}
              />
              <div style={{ marginTop: "0.6rem" }}>
                <label
                  htmlFor={`atr-files-${action.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px dashed var(--text-subtle)",
                    background: "#edf0f5",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <IconCamera width={15} height={15} style={{ color: "#0c2a52" }} />
                  Attach supporting files (PDF, photos, videos &mdash; up to 5, max 100&nbsp;MB each)
                </label>
                <input
                  id={`atr-files-${action.id}`}
                  type="file"
                  multiple
                  accept={ACCEPTED_ATTACHMENT_TYPES}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setAtrFiles((prev) => {
                      const merged = [...prev, ...picked].slice(0, 5);
                      if (picked.length + prev.length > 5) {
                        setActionError("You can attach at most 5 files with an ATR.");
                      } else {
                        setActionError(null);
                      }
                      return merged;
                    });
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                {atrFiles.length > 0 && (
                  <ul style={{ display: "grid", gap: "0.35rem", margin: "0.5rem 0 0 0", padding: 0, listStyle: "none" }}>
                    {atrFiles.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          background: "#fff",
                          border: "1px solid var(--color-border-subtle)",
                          borderRadius: "6px",
                          padding: "0.4rem 0.6rem",
                          fontSize: "0.8rem",
                          color: "#002449",
                        }}
                      >
                        <IconClipboard width={13} height={13} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.name}
                        </span>
                        <span className="muted" style={{ fontSize: "0.72rem", flexShrink: 0 }}>
                          {formatBytes(f.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAtrFiles((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Remove ${f.name}`}
                          style={{
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: "#dc2626",
                            display: "flex",
                            alignItems: "center",
                            padding: 0,
                          }}
                        >
                          <IconX width={14} height={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.6rem" }}>
                <button
                  type="button"
                  onClick={handleSubmitAtr}
                  disabled={isSubmitting}
                  className="btn-primary"
                  style={{ padding: "0.5rem 1.1rem", fontSize: "0.82rem", background: "#0c2a52", borderColor: "#0c2a52", whiteSpace: "nowrap" }}
                >
                  {isSubmitting ? "Submitting..." : "Submit ATR"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="evidence-section">
          <div className="section-title-row">
            <h3>Authority Review</h3>
          </div>

          {action.reviewRemarks ? (
            <div>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "#002449" }}>
                {action.reviewRemarks}
              </p>
              {(action.verifiedAt || action.verifiedByUserId) && (
                <div className="muted" style={{ marginTop: "0.75rem", fontSize: "0.78rem" }}>
                  {action.verifiedAt && `Verified on ${formatDate(action.verifiedAt)}`}
                  {action.verifiedByUserId &&
                    ` · By ${action.verifiedByUserId.slice(0, 8)}`}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <IconShieldCheck width={20} height={20} />
              </div>
              <div className="empty-state-title">
                {["rejected", "overdue", "escalated"].includes(action.status)
                  ? "No review recorded"
                  : "Awaiting authority review"}
              </div>
              <p className="empty-state-sub">
                {["rejected", "overdue", "escalated"].includes(action.status)
                  ? "The responsible organisation may resubmit remediation evidence for authority review."
                  : "Authority officers will scrutinise the submitted remediation before deciding."}
              </p>
            </div>
          )}

          {canWorkReview && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                RECORD AUTHORITY REVIEW
              </div>
              <p className="muted" style={{ margin: "0 0 0.6rem", fontSize: "0.78rem" }}>
                Your decision here is what advances the workflow automatically.
              </p>
              {actionError && (
                <div
                  style={{
                    background: "var(--tint-red)",
                    border: "1px solid var(--tint-red)",
                    borderRadius: "6px",
                    padding: "0.55rem 0.75rem",
                    marginBottom: "0.6rem",
                    color: "#dc2626",
                    fontSize: "0.8rem",
                  }}
                >
                  {actionError}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                {reviewChoices.map((choice) => {
                  const selected = reviewOutcome === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => {
                        setReviewOutcome(choice.value);
                        setActionError(null);
                      }}
                      style={{
                        padding: "0.45rem 0.8rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: `1.5px solid ${selected ? "#0c2a52" : "var(--color-border-strong)"}`,
                        background: selected ? "var(--tint-navy)" : "#ffffff",
                        color: selected ? "#0c2a52" : "var(--text-muted)",
                      }}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Verification notes, defects found, or formal closure justification..."
                style={inputStyle}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.6rem" }}>
                <button
                  type="button"
                  onClick={handleReview}
                  disabled={isSubmitting}
                  className="btn-primary"
                  style={{
                    padding: "0.5rem 1.1rem",
                    fontSize: "0.82rem",
                    background: reviewOutcome === "rejected" ? "#dc2626" : reviewOutcome === "accepted" ? "#137e3a" : "#dd501e",
                    borderColor: reviewOutcome === "rejected" ? "#dc2626" : reviewOutcome === "accepted" ? "#137e3a" : "#dd501e",
                  }}
                >
                  {isSubmitting
                    ? "Recording..."
                    : reviewOutcome === "under_review"
                      ? "Begin Review"
                      : reviewOutcome === "accepted"
                        ? "Accept & Close"
                        : "Reject & Require Resubmission"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}