"use client";

import React, { useState } from "react";
import type { Inspection, InspectionStatus } from "@netram/types";
import { INSPECTION_TRANSITIONS } from "@netram/types";

export interface InspectionTransitionModalProps {
  inspection: Inspection | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Inspection) => void;
  canTransitionInspector?: boolean;
  canTransitionAuthority?: boolean;
}

interface TransitionConfig {
  label: string;
  badgeText: string;
  description: string;
  btnColor: string;
  btnHoverColor: string;
  placeholder: string;
}

const INSPECTOR_STEPS: readonly InspectionStatus[] = [
  "in_progress",
  "evidence_collection",
  "submitted",
];

const TRANSITION_CONFIGS: Record<InspectionStatus, TransitionConfig> = {
  assigned: {
    label: "Assign Inspection Team",
    badgeText: "Assigned",
    description: "Assign inspector or team to lead the facility inspection.",
    btnColor: "#475569",
    btnHoverColor: "#334155",
    placeholder: "Assignment docket notes...",
  },
  scheduled: {
    label: "Set Window & Schedule",
    badgeText: "Scheduled",
    description: "Formalize inspection window and notify participating inspection officers.",
    btnColor: "#2563eb",
    btnHoverColor: "#1d4ed8",
    placeholder: "Enter scheduling coordination notes or itinerary...",
  },
  in_progress: {
    label: "Start Field Verification",
    badgeText: "Field Operations Active",
    description: "Inspectors arrive on site and commence active field verification and physical checks.",
    btnColor: "#0284c7",
    btnHoverColor: "#0369a1",
    placeholder: "Record site arrival time, physical conditions, or initial inspection notice...",
  },
  evidence_collection: {
    label: "Initiate Evidence Collection",
    badgeText: "Evidence Gathering",
    description: "Active capture of photographic, document, and forensic evidence with tamper-proof hashing.",
    btnColor: "#0891b2",
    btnHoverColor: "#0e7490",
    placeholder: "Specify focus areas for evidence collection, interviews, or sampling...",
  },
  submitted: {
    label: "Submit Inspection",
    badgeText: "Field Submission",
    description: "Inspectors conclude field operations and formally submit observations and evidence to the Authority.",
    btnColor: "#059669",
    btnHoverColor: "#047857",
    placeholder: "Summarize field findings, observations, and inspector sign-off justification...",
  },
  under_review: {
    label: "Commence Authority Scrutiny",
    badgeText: "Under Authority Review",
    description: "Supervisory authority scrutinizes field evidence, observations, and statutory compliance standards.",
    btnColor: "#d97706",
    btnHoverColor: "#b45309",
    placeholder: "Enter regulatory review comments, compliance assessments, or hearing recommendations...",
  },
  findings: {
    label: "Record Formal Findings",
    badgeText: "Deficiencies Documented",
    description: "Authority formulates and records binding regulatory non-compliance findings and deficiencies.",
    btnColor: "#dc2626",
    btnHoverColor: "#b91c1c",
    placeholder: "Detail statutory violations, non-compliant standards, or required remedial measures...",
  },
  corrective_actions: {
    label: "Order Corrective Remediation",
    badgeText: "Remediation Ordered",
    description: "Order facility management to execute binding corrective actions with strict compliance SLA.",
    btnColor: "#ea580c",
    btnHoverColor: "#c2410c",
    placeholder: "Specify mandatory corrective actions, deadlines, and technical verification criteria...",
  },
  verification: {
    label: "Initiate Remediation Verification",
    badgeText: "Verification Phase",
    description: "Verify that facility management has executed all ordered corrective actions to compliance standards.",
    btnColor: "#7c3aed",
    btnHoverColor: "#6d28d9",
    placeholder: "Document verification inspection results, compliance evidence, or follow-up observations...",
  },
  closed: {
    label: "Finalize & Close Inspection",
    badgeText: "Case Concluded",
    description: "Complete all supervisory workflows and archive the inspection in the official state registry.",
    btnColor: "#15803d",
    btnHoverColor: "#166534",
    placeholder: "Enter official closure docket entry, executive approval summary, or final verdict...",
  },
};

export function InspectionTransitionModal({
  inspection,
  isOpen,
  onClose,
  onSuccess,
  canTransitionInspector = true,
  canTransitionAuthority = true,
}: InspectionTransitionModalProps) {
  const [selectedTo, setSelectedTo] = useState<InspectionStatus | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !inspection) return null;

  const allowedTransitions = (INSPECTION_TRANSITIONS[inspection.status] || []).filter((next) => {
    const isInspector = INSPECTOR_STEPS.includes(next);
    if (isInspector && !canTransitionInspector) return false;
    if (!isInspector && !canTransitionAuthority) return false;
    return true;
  });

  const activeTarget: InspectionStatus | null = selectedTo ?? allowedTransitions[0] ?? null;
  const config = activeTarget ? TRANSITION_CONFIGS[activeTarget] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTarget) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/inspections/${inspection.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeTarget,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Transition failed with status ${res.status}`);
      }

      onSuccess(data);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspection-transition-title"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--bg-card, #ffffff)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "580px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--color-border-strong, #cbd5e1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--color-border, #e2e8f0)",
            background: "var(--bg-surface-subtle, #f8fafc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--color-navy-brand, #1e3a8a)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Statutory Inspection Lifecycle
            </div>
            <h3
              id="inspection-transition-title"
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--text-primary, #0f172a)",
              }}
            >
              Advance Inspection State
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "var(--text-muted, #64748b)",
              lineHeight: 1,
              padding: "0.25rem",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {/* Current State Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              background: "var(--bg-surface, #f1f5f9)",
              borderRadius: "8px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "var(--text-muted, #64748b)" }}>Current Status:</span>
            <span
              className={`status status-${inspection.status}`}
              style={{ fontWeight: 600, textTransform: "capitalize" }}
            >
              {inspection.status.replace(/_/g, " ")}
            </span>
            <span style={{ color: "var(--text-muted, #64748b)", marginLeft: "auto", fontSize: "0.78rem" }}>
              ID: {inspection.id.slice(0, 8)}…
            </span>
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

          {allowedTransitions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--text-muted, #64748b)" }}>
              No transitions are permitted from this status under current authority permissions.
            </div>
          ) : (
            <>
              {/* Target Status Selection */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary, #334155)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Select Next Target State *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                  {allowedTransitions.map((nextState) => {
                    const c = TRANSITION_CONFIGS[nextState];
                    const isSelected = activeTarget === nextState;
                    return (
                      <button
                        key={nextState}
                        type="button"
                        onClick={() => setSelectedTo(nextState)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "8px",
                          border: `2px solid ${isSelected ? c.btnColor : "var(--color-border, #e2e8f0)"}`,
                          background: isSelected ? "var(--bg-surface-subtle, #f8fafc)" : "var(--bg-surface, #ffffff)",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="radio"
                          name="targetStatus"
                          checked={isSelected}
                          onChange={() => setSelectedTo(nextState)}
                          style={{ marginTop: "0.2rem", accentColor: c.btnColor }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary, #0f172a)" }}>
                              {c.label}
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                background: `${c.btnColor}15`,
                                color: c.btnColor,
                                border: `1px solid ${c.btnColor}30`,
                              }}
                            >
                              {c.badgeText}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", lineHeight: 1.4 }}>
                            {c.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transition Note */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  htmlFor="inspection-transition-note"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary, #334155)",
                    marginBottom: "0.4rem",
                  }}
                >
                  Auditable Justification & Transition Notes
                </label>
                <textarea
                  id="inspection-transition-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={config?.placeholder ?? "Enter official justification notes..."}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    fontSize: "0.85rem",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border-strong, #cbd5e1)",
                    background: "var(--bg-surface, #ffffff)",
                    color: "var(--text-primary, #0f172a)",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    fontSize: "0.72rem",
                    color: "var(--text-muted, #64748b)",
                    marginTop: "0.25rem",
                  }}
                >
                  Permanently committed to statutory audit log (§37) and outbox event ledger (§27).
                </span>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              borderTop: "1px solid var(--color-border, #e2e8f0)",
              paddingTop: "1rem",
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
            {allowedTransitions.length > 0 && config && (
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: config.btnColor,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {isSubmitting ? "Transitioning…" : `Confirm: ${config.label}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
