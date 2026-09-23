"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { AIAnomaly, AnomalyStatus } from "@netram/types";
import { ANOMALY_TRANSITIONS } from "@netram/types";
import { formatDateTime } from "../../../lib/presentation";
import { getStatusStyle } from "./alerts-screen";

interface AIAnomalyModalProps {
  anomaly: AIAnomaly | null;
  isOpen: boolean;
  canTransition: boolean;
  onClose: () => void;
  onSuccess: (updated: AIAnomaly) => void;
}

const ACTION_OPTIONS: Record<
  AnomalyStatus,
  { label: string; description: string; btnColor: string }
> = {
  new: {
    label: "Mark New",
    description: "Reset status to newly detected signal",
    btnColor: "#0284c7",
  },
  reviewed: {
    label: "Acknowledge & Mark Reviewed",
    description: "Authority officer has examined the signal. Regular monitoring continues.",
    btnColor: "#7c3aed",
  },
  investigated: {
    label: "Escalate for Field Investigation",
    description: "Creates a follow-up inspection on the project and assigns you as lead for on-site verification.",
    btnColor: "#d97706",
  },
  acted_upon: {
    label: "Record Action Taken / Resolved",
    description: "Administrative action, formal notice, or operational remedy has been instituted.",
    btnColor: "#16a34a",
  },
  dismissed: {
    label: "Dismiss Alert",
    description: "Signal reviewed and confirmed as benign lighting, angle variation, or false positive.",
    btnColor: "#64748b",
  },
};

export function AIAnomalyModal({
  anomaly,
  isOpen,
  canTransition,
  onClose,
  onSuccess,
}: AIAnomalyModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<AnomalyStatus | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !anomaly) return null;

  const allowedTransitions = ANOMALY_TRANSITIONS[anomaly.status] || [];
  const isTerminal = allowedTransitions.length === 0;
  const statusStyle = getStatusStyle(anomaly.status);

  const title =
    anomaly.type === "conflict"
      ? "Conflict Detected"
      : anomaly.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai-anomalies/${anomaly.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedTarget,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => null);
        throw new Error(
          errPayload?.error?.message || `Failed to transition anomaly (HTTP ${res.status})`,
        );
      }

      const updated = (await res.json()) as AIAnomaly;
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="lightbox-backdrop"
      style={{ zIndex: 100 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ai-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "560px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className={`severity-pill ${anomaly.severity}`}>
                {anomaly.severity.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "4px",
                  background: statusStyle.bg,
                  color: statusStyle.color,
                }}
              >
                {statusStyle.label}
              </span>
            </div>
            <h3
              id="modal-ai-title"
              style={{
                margin: "0.4rem 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              {title}
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {anomaly.projectName ? (
                <>
                  {anomaly.projectName}
                  {anomaly.projectCode && (
                    <>
                      {" ("}
                      {anomaly.projectId ? (
                        <Link
                          href={`/dashboard/projects/${anomaly.projectId}`}
                          style={{ color: "var(--color-navy-brand)", fontWeight: 600 }}
                        >
                          {anomaly.projectCode}
                        </Link>
                      ) : (
                        anomaly.projectCode
                      )}
                      {")"}
                    </>
                  )}
                </>
              ) : (
                "Camera feed (no project assigned)"
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              color: "#64748b",
              cursor: "pointer",
              padding: "0.2rem 0.5rem",
              lineHeight: 1,
            }}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              padding: "0.65rem 0.85rem",
              marginBottom: "1rem",
              color: "#991b1b",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Signal Details */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem 1rem",
            fontSize: "0.82rem",
          }}
        >
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
              Detected
            </span>
            <span style={{ fontSize: "0.8rem" }}>{formatDateTime(anomaly.createdAt)}</span>
          </div>
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
              Last Review
            </span>
            <span style={{ fontSize: "0.8rem" }}>
              {anomaly.reviewedAt ? formatDateTime(anomaly.reviewedAt) : "Pending review"}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.3rem",
            }}
          >
            Model Explanation:
          </label>
          <p style={{ margin: 0, fontSize: "0.84rem", lineHeight: 1.5, color: "#334155" }}>
            {anomaly.explanation || "No extended explanation provided."}
          </p>
        </div>

        {/* Transition Options */}
        {isTerminal ? (
          <div
            style={{
              padding: "1.25rem",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: "6px",
              marginBottom: "1.25rem",
            }}
          >
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              This alert is in a terminal status (
              <strong>{anomaly.status.replace("_", " ").toUpperCase()}</strong>). No further
              transitions are permitted.
            </p>
          </div>
        ) : !canTransition ? (
          <div
            style={{
              padding: "0.85rem",
              background: "#fef3c7",
              borderRadius: "6px",
              fontSize: "0.82rem",
              color: "#92400e",
              marginBottom: "1.25rem",
            }}
          >
            Your account does not hold the <code>ai:anomaly:transition</code> permission required
            to record an administrative decision on this alert.
          </div>
        ) : (
          <form onSubmit={handleTransition}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.5rem",
                }}
              >
                Select Administrative Action:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {allowedTransitions.map((targetStatus) => {
                  const meta = ACTION_OPTIONS[targetStatus];
                  const isSelected = selectedTarget === targetStatus;

                  return (
                    <button
                      key={targetStatus}
                      type="button"
                      onClick={() => setSelectedTarget(targetStatus)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        padding: "0.75rem",
                        borderRadius: "6px",
                        border: `1.5px solid ${isSelected ? meta.btnColor : "#e2e8f0"}`,
                        background: isSelected ? "#f8fafc" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          width: "100%",
                        }}
                      >
                        <input
                          type="radio"
                          name="anomaly-target"
                          checked={isSelected}
                          onChange={() => setSelectedTarget(targetStatus)}
                          style={{ accentColor: meta.btnColor, cursor: "pointer" }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.86rem",
                            color: isSelected ? meta.btnColor : "#1e293b",
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p
                        className="muted"
                        style={{
                          margin: "0.3rem 0 0 1.5rem",
                          fontSize: "0.78rem",
                          lineHeight: 1.4,
                        }}
                      >
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Officer Notes */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="anomaly-note"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.35rem",
                }}
              >
                Officer Notes (Recorded in Audit Trail):
              </label>
              <textarea
                id="anomaly-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Rationale for the review, instructions for inspectors, or false alarm reasoning..."
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Action Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "0.85rem",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isSubmitting}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!selectedTarget || isSubmitting}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  background: selectedTarget
                    ? ACTION_OPTIONS[selectedTarget].btnColor
                    : "var(--color-navy-brand)",
                  borderColor: selectedTarget
                    ? ACTION_OPTIONS[selectedTarget].btnColor
                    : "var(--color-navy-brand)",
                  opacity: !selectedTarget || isSubmitting ? 0.6 : 1,
                  cursor: !selectedTarget || isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting
                  ? "Saving..."
                  : selectedTarget
                    ? ACTION_OPTIONS[selectedTarget].label
                    : "Confirm Action"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
