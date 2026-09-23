"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { FindingSeverity, OrganisationView } from "@netram/types";

export interface OrderCorrectiveActionButtonProps {
  finding: {
    id: string;
    severity: FindingSeverity;
    description: string;
    remediation: string | null;
  };
  inspectionId: string;
  project: { name: string; code: string; organisationId: string | null } | null;
  organisations: OrganisationView[];
}

export function OrderCorrectiveActionButton({
  finding,
  inspectionId,
  project,
  organisations,
}: OrderCorrectiveActionButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [organisationId, setOrganisationId] = useState(project?.organisationId ?? "");
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          findingId: finding.id,
          organisationId: organisationId || null,
          deadline: isoDeadline,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message ?? `Failed to order corrective action (status ${res.status})`,
        );
      }

      const created = (await res.json()) as { id: string };
      setIsOpen(false);
      router.push(`/dashboard/corrective-actions/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-secondary"
        style={{
          fontSize: "0.75rem",
          padding: "0.25rem 0.6rem",
          color: "var(--color-navy-brand)",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Order Corrective Action →
      </button>

      {isOpen && (
        <div
          className="lightbox-backdrop"
          style={{ zIndex: 100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-order-ca-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: "560px", width: "100%" }}>
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
                <h3 id="modal-order-ca-title" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Order Corrective Action
                </h3>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
                  Issue a formal remediation mandate for this confirmed finding (§32)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
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

            {/* Finding context */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "0.4rem" }}>
                DEFICIENCY REFERENCE
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                {finding.description}
              </div>
              {finding.remediation && (
                <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontWeight: 600, color: "#334155" }}>Required remediation:</span>{" "}
                  {finding.remediation}
                </div>
              )}
              <div className="muted" style={{ fontSize: "0.78rem" }}>
                Facility: {project ? `${project.name} (${project.code})` : "Not linked to a facility"} ·{" "}
                Inspection: {inspectionId.slice(0, 8)}
              </div>
            </div>

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
              {/* Responsible organisation */}
              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="order-ca-organisation"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "0.35rem",
                  }}
                >
                  Responsible Organisation:
                </label>
                {organisations.length > 0 ? (
                  <select
                    id="order-ca-organisation"
                    value={organisationId}
                    onChange={(e) => setOrganisationId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      background: "#fff",
                    }}
                  >
                    <option value="">Not assigned</option>
                    {organisations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                    Responsible organisation will be assigned by the programme office.
                  </p>
                )}
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.74rem" }}>
                  The organisation accountable for the facility and liable to submit verified remediation.
                </p>
              </div>

              {/* Compliance deadline */}
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
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                  disabled={isSubmitting}
                  style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                  style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem", background: "var(--color-navy-brand)" }}
                >
                  {isSubmitting ? "Issuing Order..." : "Issue Corrective Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}