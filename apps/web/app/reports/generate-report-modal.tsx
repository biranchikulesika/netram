"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Report } from "@netram/types";

export interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newReport: Report) => void;
  availableInspections?: Array<{
    id: string;
    projectCode: string;
    projectName: string;
    type: string;
    status: string;
  }>;
  preselectedInspectionId?: string;
}

export function GenerateReportModal({
  isOpen,
  onClose,
  onSuccess,
  availableInspections = [],
  preselectedInspectionId,
}: GenerateReportModalProps) {
  const router = useRouter();
  const [inspectionId, setInspectionId] = useState(
    preselectedInspectionId ?? availableInspections[0]?.id ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionId) {
      setError("Please select a target inspection.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId,
          format: "json",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Report generation failed with status ${res.status}`);
      }

      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
      router.push(`/reports/${data.id}`);
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
      aria-labelledby="generate-report-title"
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
          maxWidth: "520px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--color-border-strong, #cbd5e1)",
          overflow: "hidden",
        }}
      >
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
              Statutory Oversight Dossier
            </div>
            <h3
              id="generate-report-title"
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--text-primary, #0f172a)",
              }}
            >
              Compile Inspection Report
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

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
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

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="target-inspection-id"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary, #334155)",
                marginBottom: "0.4rem",
              }}
            >
              Select Target Inspection *
            </label>
            {preselectedInspectionId ? (
              <input
                id="target-inspection-id"
                value={preselectedInspectionId}
                disabled
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-strong, #cbd5e1)",
                  background: "var(--bg-surface, #f1f5f9)",
                  color: "var(--text-primary, #0f172a)",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <select
                id="target-inspection-id"
                value={inspectionId}
                onChange={(e) => setInspectionId(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-strong, #cbd5e1)",
                  background: "var(--bg-surface, #ffffff)",
                  color: "var(--text-primary, #0f172a)",
                }}
              >
                {availableInspections.length === 0 ? (
                  <option value="">No inspections available</option>
                ) : (
                  availableInspections.map((i) => (
                    <option key={i.id} value={i.id}>
                      [{i.projectCode}] {i.projectName} — {i.type.toUpperCase()} ({i.status})
                    </option>
                  ))
                )}
              </select>
            )}
            <span
              style={{
                display: "block",
                fontSize: "0.72rem",
                color: "var(--text-muted, #64748b)",
                marginTop: "0.3rem",
              }}
            >
              Compiles findings, field observations, corrective actions, and cryptographic evidence hashes.
            </span>
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--bg-surface, #f8fafc)",
              borderRadius: "6px",
              border: "1px solid var(--color-border, #e2e8f0)",
              fontSize: "0.8rem",
              color: "var(--text-secondary, #334155)",
              marginBottom: "1.25rem",
            }}
          >
            <strong>Format:</strong> Structured JSON Deterministic Dossier (§34/§1310). Immutable derivation compiled asynchronously via worker.
          </div>

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
            <button
              type="submit"
              disabled={isSubmitting || !inspectionId}
              style={{
                background: "var(--color-navy-brand, #1e3a8a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: isSubmitting || !inspectionId ? "not-allowed" : "pointer",
                opacity: isSubmitting || !inspectionId ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Queueing Report…" : "Compile Official Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
