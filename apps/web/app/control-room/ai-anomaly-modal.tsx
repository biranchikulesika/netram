"use client";

import React, { useState } from "react";
import type { AIAnomaly, AnomalyStatus } from "@netram/types";
import { ANOMALY_TRANSITIONS } from "@netram/types";
import {
  IconAlertTriangle,
  IconShieldCheck,
} from "../components/icons";
import { formatDateTime } from "../../lib/presentation";

interface AIAnomalyModalProps {
  anomaly: AIAnomaly | null;
  isOpen: boolean;
  canTransition: boolean;
  onClose: () => void;
  onSuccess: (updated: AIAnomaly) => void;
}

const ACTION_DESCRIPTIONS: Record<
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
    description: "Signal indicates substantial anomaly requiring on-site verification by an inspection team.",
    btnColor: "#d97706",
  },
  acted_upon: {
    label: "Record Action Taken / Resolved",
    description: "Administrative action, formal notice, or operational remedy has been instituted.",
    btnColor: "#16a34a",
  },
  dismissed: {
    label: "Dismiss (False Alarm / Benign)",
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
          maxWidth: "600px",
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
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-mono)",
                  background: "#f1f5f9",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "4px",
                  color: "#475569",
                  fontWeight: 600,
                }}
              >
                STATUS: {anomaly.status.toUpperCase()}
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
              {anomaly.type === "conflict"
                ? "Conflict Detected"
                : anomaly.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {anomaly.projectName ? `${anomaly.projectName} (${anomaly.projectCode})` : "Camera feed · no project assigned"}
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

        {/* Advisory Warning Banner (§36) */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            padding: "0.65rem 0.85rem",
            marginBottom: "1rem",
            fontSize: "0.78rem",
            color: "#1e40af",
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-start",
          }}
        >
          <IconShieldCheck style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: "#2563eb" }} />
          <span>
            <strong>AI is Advisory (§36):</strong> AI model outputs never declare fraud as fact. Administrative review decisions and escalation to physical inspection are audited operations.
          </span>
        </div>

        {/* Signal Key Facts */}
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
              Model Confidence
            </span>
            <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.92rem", color: "#0f172a" }}>
              {Math.round(anomaly.confidence * 100)}%
            </strong>
          </div>
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
              Detection Model
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "#334155" }}>
              {anomaly.modelVersion || "hybrid-rule-v1"}
            </span>
          </div>
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
              Detected Timestamp
            </span>
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>
              {formatDateTime(anomaly.createdAt)}
            </span>
          </div>
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
              Last Review
            </span>
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>
              {anomaly.reviewedAt ? formatDateTime(anomaly.reviewedAt) : "Pending initial review"}
            </span>
          </div>
        </div>

        {/* Explanation text */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
            Model Explanation &amp; Rationale
          </label>
          <div
            style={{
              padding: "0.65rem 0.85rem",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "0.82rem",
              lineHeight: 1.45,
              color: "#1e293b",
            }}
          >
            {anomaly.explanation || "No extended explanation provided."}
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <div
            style={{
              padding: "0.65rem 0.85rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#991b1b",
              fontSize: "0.82rem",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <IconAlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Transition Form */}
        {isTerminal ? (
          <div
            style={{
              padding: "0.85rem",
              background: "#f1f5f9",
              borderRadius: "6px",
              textAlign: "center",
              fontSize: "0.82rem",
              color: "#64748b",
            }}
          >
            This anomaly alert is in a terminal status (<strong>{anomaly.status}</strong>) and cannot be transitioned further.
          </div>
        ) : !canTransition ? (
          <div
            style={{
              padding: "0.85rem",
              background: "#fef3c7",
              borderRadius: "6px",
              fontSize: "0.82rem",
              color: "#92400e",
            }}
          >
            Your account does not hold the <code>ai:anomaly:transition</code> permission required to record an administrative decision on this alert.
          </div>
        ) : (
          <form onSubmit={handleTransition}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.5rem",
                }}
              >
                Select Administrative Action:
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {allowedTransitions.map((targetStatus) => {
                  const meta = ACTION_DESCRIPTIONS[targetStatus];
                  const isSelected = selectedTarget === targetStatus;
                  return (
                    <label
                      key={targetStatus}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.65rem",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "6px",
                        border: isSelected ? `2px solid ${meta.btnColor}` : "1px solid #cbd5e1",
                        background: isSelected ? "#f8fafc" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="radio"
                        name="anomaly-target"
                        value={targetStatus}
                        checked={isSelected}
                        onChange={() => setSelectedTarget(targetStatus)}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.84rem", color: isSelected ? meta.btnColor : "#0f172a" }}>
                          {meta.label}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 2 }}>
                          {meta.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="anomaly-note"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.3rem",
                }}
              >
                Officer Notes / Instructions (Recorded in Audit Trail):
              </label>
              <textarea
                id="anomaly-note"
                rows={3}
                placeholder="Enter rationale for administrative review, instructions for on-site inspectors, or false alarm reasoning..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  width: "100%",
                  font: "inherit",
                  fontSize: "0.82rem",
                  padding: "0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={isSubmitting}
                style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!selectedTarget || isSubmitting}
                style={{
                  fontSize: "0.85rem",
                  padding: "0.45rem 1.25rem",
                  background: selectedTarget ? ACTION_DESCRIPTIONS[selectedTarget].btnColor : "var(--color-navy-brand)",
                }}
              >
                {isSubmitting ? "Recording..." : "Confirm Decision"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
