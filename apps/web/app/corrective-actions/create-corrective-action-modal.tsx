"use client";

import React, { useState } from "react";
import type { CorrectiveAction } from "@netram/types";

export interface CreateCorrectiveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (created: CorrectiveAction) => void;
  prefillFindingId?: string;
  prefillInspectionId?: string;
}

export function CreateCorrectiveActionModal({
  isOpen,
  onClose,
  onSuccess,
  prefillFindingId = "",
  prefillInspectionId: _prefillInspectionId = "",
}: CreateCorrectiveActionModalProps) {
  const [findingId, setFindingId] = useState(prefillFindingId);
  const [deadlineDate, setDeadlineDate] = useState(() => {
    // Default deadline: 14 days from today
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findingId.trim()) {
      setError("Finding UUID is required to order a corrective action.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let isoDeadline: string | null = null;
    if (deadlineDate) {
      try {
        isoDeadline = new Date(`${deadlineDate}T23:59:59Z`).toISOString();
      } catch {
        setError("Invalid deadline date format.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/corrective-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: findingId.trim(),
          deadline: isoDeadline,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message ||
            `Failed to order corrective action (status ${res.status})`,
        );
      }

      const created = (await res.json()) as CorrectiveAction;
      onSuccess(created);
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
      aria-labelledby="modal-order-ca-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "520px",
          width: "100%",
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
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h3
              id="modal-order-ca-title"
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Order Corrective Action
            </h3>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
              Issue formal remediation mandate for a confirmed deficiency (§32)
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

        <form onSubmit={handleSubmit}>
          {/* Finding ID */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="order-ca-finding-id"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              Confirmed Finding UUID: <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              id="order-ca-finding-id"
              type="text"
              required
              value={findingId}
              onChange={(e) => setFindingId(e.target.value)}
              placeholder="e.g. 11111111-1111-4111-8111-111111111111"
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                fontFamily: "var(--font-mono, monospace)",
                boxSizing: "border-box",
              }}
            />
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.74rem" }}>
              Note: A corrective action can only be issued against findings confirmed by an authority officer.
            </p>
          </div>

          {/* Compliance Deadline */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="order-ca-deadline"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              Statutory Remediation Deadline:
            </label>
            <input
              id="order-ca-deadline"
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.74rem" }}>
              Failure to submit verified remediation by this date triggers automated overdue SLA escalation.
            </p>
          </div>

          {/* Actions */}
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
              disabled={isSubmitting || !findingId.trim()}
              className="btn-primary"
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                background: "var(--color-navy-brand)",
              }}
            >
              {isSubmitting ? "Issuing Order..." : "Issue Corrective Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
