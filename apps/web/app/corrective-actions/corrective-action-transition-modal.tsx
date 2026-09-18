"use client";

import React, { useState } from "react";
import type { CorrectiveAction, CorrectiveActionStatus } from "@netram/types";
import { CORRECTIVE_ACTION_TRANSITIONS } from "@netram/types";

export interface CorrectiveActionTransitionModalProps {
  correctiveAction: CorrectiveAction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: CorrectiveAction) => void;
}

interface TransitionConfig {
  label: string;
  badgeText: string;
  description: string;
  btnColor: string;
  btnHoverColor: string;
  placeholder: string;
}

const TRANSITION_CONFIGS: Record<CorrectiveActionStatus, TransitionConfig> = {
  submitted: {
    label: "Submit Remediation Evidence",
    badgeText: "Institution Submission",
    description:
      "Submit official documentation and evidence of corrective work performed to resolve the finding.",
    btnColor: "#0284c7",
    btnHoverColor: "#0369a1",
    placeholder:
      "Detail the remediation work performed, contractor certifications, and proof of rectification...",
  },
  under_review: {
    label: "Begin Authority Review",
    badgeText: "Authority Review",
    description:
      "Initiate technical scrutiny and compliance review of submitted remediation measures.",
    btnColor: "#d97706",
    btnHoverColor: "#b45309",
    placeholder: "Enter internal review docket notes or assign technical verification officer...",
  },
  accepted: {
    label: "Accept Remediation & Close",
    badgeText: "Acceptance & Closure",
    description:
      "Verify that corrective action satisfactorily addresses the deficiency. Closes the deficiency in official records.",
    btnColor: "#16a34a",
    btnHoverColor: "#15803d",
    placeholder:
      "Document compliance verification, test outcomes, and formal closure justification...",
  },
  rejected: {
    label: "Reject & Require Re-submission",
    badgeText: "Deficiency Rejection",
    description:
      "Remediation is incomplete or substandard. Demand re-execution and submission of compliant evidence.",
    btnColor: "#dc2626",
    btnHoverColor: "#b91c1c",
    placeholder:
      "Detail defects found during review, non-compliant standards, and mandatory corrective terms...",
  },
  pending: {
    label: "Reset to Pending",
    badgeText: "Pending",
    description: "Re-queue corrective order as pending compliance.",
    btnColor: "#64748b",
    btnHoverColor: "#475569",
    placeholder: "Administrative reset notes...",
  },
  overdue: {
    label: "Mark Overdue",
    badgeText: "Overdue",
    description: "SLA deadline expired without verified completion.",
    btnColor: "#ea580c",
    btnHoverColor: "#c2410c",
    placeholder: "Escalation notes...",
  },
  escalated: {
    label: "Escalate to Enforcement",
    badgeText: "Escalated",
    description: "Escalate unresolved deficiency to administrative enforcement.",
    btnColor: "#9333ea",
    btnHoverColor: "#7e22ce",
    placeholder: "Enforcement referral notes...",
  },
};

export function CorrectiveActionTransitionModal({
  correctiveAction,
  isOpen,
  onClose,
  onSuccess,
}: CorrectiveActionTransitionModalProps) {
  const [selectedTo, setSelectedTo] = useState<CorrectiveActionStatus | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !correctiveAction) return null;

  const allowableTransitions = CORRECTIVE_ACTION_TRANSITIONS[correctiveAction.status] ?? [];
  const currentConfig = selectedTo ? TRANSITION_CONFIGS[selectedTo] : null;

  const handleSubmit = async () => {
    if (!selectedTo) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/corrective-actions/${correctiveAction.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedTo,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message ||
            `Failed to transition corrective action (status ${res.status})`,
        );
      }

      const updated = (await res.json()) as CorrectiveAction;
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
      aria-labelledby="modal-ca-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "580px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Header */}
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
              <span
                style={{
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-mono)",
                  background: "#f1f5f9",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "4px",
                  color: "#475569",
                  fontWeight: 600,
                }}
              >
                ACTION: {correctiveAction.id.slice(0, 8)}...
              </span>
              <span className={`status status-${correctiveAction.status}`}>
                {correctiveAction.status.replace("_", " ")}
              </span>
            </div>
            <h3
              id="modal-ca-title"
              style={{
                margin: "0.4rem 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Transition Corrective Action
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              Inspection Finding Order ID: {correctiveAction.findingId.slice(0, 13)}...
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

        {/* Transition Options */}
        {allowableTransitions.length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              background: "#f8fafc",
              borderRadius: "6px",
              marginBottom: "1.25rem",
            }}
          >
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
              This corrective action is in terminal state (
              <strong>{correctiveAction.status.replace("_", " ").toUpperCase()}</strong>).
              {correctiveAction.status === "accepted"
                ? " Deficiency has been verified and formally resolved."
                : " Further transitions require background job evaluation or authority reassignment."}
            </p>
          </div>
        ) : (
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
              Select Target Workflow Transition:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {allowableTransitions.map((targetStatus) => {
                const config = TRANSITION_CONFIGS[targetStatus];
                const isSelected = selectedTo === targetStatus;

                return (
                  <button
                    key={targetStatus}
                    type="button"
                    onClick={() => {
                      setSelectedTo(targetStatus);
                      setError(null);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "6px",
                      border: `1.5px solid ${isSelected ? config.btnColor : "#e2e8f0"}`,
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
                        name="correctiveActionTransition"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedTo(targetStatus);
                          setError(null);
                        }}
                        style={{ accentColor: config.btnColor, cursor: "pointer" }}
                      />
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          color: isSelected ? config.btnColor : "#1e293b",
                        }}
                      >
                        {config.label}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {config.badgeText}
                      </span>
                    </div>
                    <p
                      className="muted"
                      style={{
                        margin: "0.3rem 0 0 1.5rem",
                        fontSize: "0.8rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {config.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Note / Justification Input */}
        {selectedTo && (
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="ca-transition-note"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              Transition / Review Documentation Note (Optional):
            </label>
            <textarea
              id="ca-transition-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={currentConfig?.placeholder}
              maxLength={500}
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "0.25rem",
                fontSize: "0.72rem",
                color: "#94a3b8",
              }}
            >
              {note.length} / 500 characters
            </div>
          </div>
        )}

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

          {allowableTransitions.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedTo || isSubmitting}
              className="btn-primary"
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                background: currentConfig?.btnColor ?? "var(--color-navy-brand)",
                borderColor: currentConfig?.btnColor ?? "var(--color-navy-brand)",
                opacity: !selectedTo || isSubmitting ? 0.6 : 1,
                cursor: !selectedTo || isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Processing..." : currentConfig ? currentConfig.label : "Confirm Action"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
