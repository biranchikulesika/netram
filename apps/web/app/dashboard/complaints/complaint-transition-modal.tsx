"use client";

import React, { useState } from "react";
import type { Complaint, ComplaintStatus } from "@netram/types";
import { COMPLAINT_TRANSITIONS } from "@netram/types";

export interface ComplaintTransitionModalProps {
  complaint: Complaint | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Complaint) => void;
}

interface TransitionConfig {
  label: string;
  description: string;
  btnColor: string;
  btnHoverColor: string;
  requireResolution: boolean;
}

const TRANSITION_CONFIGS: Record<ComplaintStatus, TransitionConfig> = {
  received: {
    label: "Mark Received",
    description: "Grievance received and registered.",
    btnColor: "#0284c7",
    btnHoverColor: "#0369a1",
    requireResolution: false,
  },
  under_review: {
    label: "Begin Review",
    description: "Assign to grievance officer for initial scrutiny and fact verification.",
    btnColor: "#d97706",
    btnHoverColor: "#b45309",
    requireResolution: false,
  },
  escalated: {
    label: "Escalate Grievance",
    description: "Escalate to state authority or enforcement oversight for formal investigation.",
    btnColor: "#dc2626",
    btnHoverColor: "#b91c1c",
    requireResolution: false,
  },
  resolved: {
    label: "Mark Resolved",
    description: "Grievance addressed and verified with statutory explanation.",
    btnColor: "#16a34a",
    btnHoverColor: "#15803d",
    requireResolution: true,
  },
  closed: {
    label: "Close Without Action",
    description: "Close duplicate, malicious, or non-actionable filing.",
    btnColor: "#475569",
    btnHoverColor: "#334155",
    requireResolution: false,
  },
};

export function ComplaintTransitionModal({
  complaint,
  isOpen,
  onClose,
  onSuccess,
}: ComplaintTransitionModalProps) {
  const [selectedTo, setSelectedTo] = useState<ComplaintStatus | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !complaint) return null;

  const allowableTransitions = COMPLAINT_TRANSITIONS[complaint.status] ?? [];
  const currentConfig = selectedTo ? TRANSITION_CONFIGS[selectedTo] : null;

  const handleSubmit = async () => {
    if (!selectedTo) return;
    if (currentConfig?.requireResolution && !resolutionText.trim()) {
      setError("Resolution explanation is required when resolving a grievance.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/${complaint.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedTo,
          resolutionText: resolutionText.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message || `Failed to transition complaint (status ${res.status})`,
        );
      }

      const updated = (await res.json()) as Complaint;
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
      aria-labelledby="modal-complaint-title"
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
              <span
                style={{
                  fontSize: "0.72rem",
                  background: "#f1f5f9",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "4px",
                  color: "#475569",
                  fontWeight: 600,
                }}
              >
                TRACKING: {complaint.trackingCode}
              </span>
              <span className={`status status-${complaint.status}`}>
                {complaint.status.replace("_", " ")}
              </span>
            </div>
            <h3
              id="modal-complaint-title"
              style={{
                margin: "0.4rem 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Update Grievance Status
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {complaint.projectName} ({complaint.projectCode})
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
              This grievance is in terminal state (
              <strong>{complaint.status.replace("_", " ").toUpperCase()}</strong>). No further
              transitions are permitted under governance policy §35.
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
              Select Next Administrative Action:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                      padding: "0.75rem",
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
                        name="complaintTransition"
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
                          fontSize: "0.88rem",
                          color: isSelected ? config.btnColor : "#1e293b",
                        }}
                      >
                        {config.label}
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
                      {config.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Resolution / Explanation Field */}
        {selectedTo && (
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="complaint-resolution-text"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              {currentConfig?.requireResolution
                ? "Official Resolution Narrative (Required):"
                : "Administrative Notes (Optional):"}
            </label>
            <textarea
              id="complaint-resolution-text"
              rows={4}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder={
                currentConfig?.requireResolution
                  ? "Detail remediation verification, actions taken by the contractor/authority, and final findings..."
                  : "Add internal context, escalation reason, or rationale..."
              }
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
              {isSubmitting ? "Saving..." : currentConfig ? currentConfig.label : "Confirm Action"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
