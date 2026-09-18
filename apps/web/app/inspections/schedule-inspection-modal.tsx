"use client";

import React, { useState } from "react";
import type { Inspection, InspectionType, InspectionTrigger } from "@netram/types";
import { INSPECTION_TYPES, INSPECTION_TRIGGERS } from "@netram/types";

export interface ProjectOption {
  id: string;
  name: string;
  code: string;
  districtId: string | null;
}

export interface ScheduleInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newInspection: Inspection) => void;
  availableProjects: ProjectOption[];
  preselectedProjectId?: string;
}

const TYPE_DESCRIPTIONS: Record<InspectionType, string> = {
  routine: "Standard scheduled periodic compliance inspection.",
  surprise: "Unannounced compliance inspection with immediate disclosure restrictions (§34).",
  special: "Targeted probe or inter-agency inquiry arising from specific intelligence.",
  follow_up: "Follow-up verification of previously ordered corrective remediations.",
};

export function ScheduleInspectionModal({
  isOpen,
  onClose,
  onSuccess,
  availableProjects,
  preselectedProjectId,
}: ScheduleInspectionModalProps) {
  const [projectId, setProjectId] = useState(preselectedProjectId ?? availableProjects[0]?.id ?? "");
  const [type, setType] = useState<InspectionType>("routine");
  const [trigger, setTrigger] = useState<InspectionTrigger>("officer");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError("Please select a valid facility / project.");
      return;
    }

    let startIso: string | undefined;
    let endIso: string | undefined;

    if (scheduledStart) {
      startIso = new Date(scheduledStart).toISOString();
    }
    if (scheduledEnd) {
      endIso = new Date(scheduledEnd).toISOString();
    }

    if (startIso && endIso && startIso >= endIso) {
      setError("Scheduled start time must be before scheduled end time.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type,
          trigger,
          scheduledStart: startIso || undefined,
          scheduledEnd: endIso || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Scheduling failed with status ${res.status}`);
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
      aria-labelledby="schedule-inspection-title"
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
          maxWidth: "560px",
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
              Statutory Field Oversight
            </div>
            <h3
              id="schedule-inspection-title"
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--text-primary, #0f172a)",
              }}
            >
              Schedule New Inspection
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

          {/* Project Selection */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="schedule-inspection-project"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-secondary, #334155)",
                marginBottom: "0.4rem",
              }}
            >
              Target Facility / Project *
            </label>
            <select
              id="schedule-inspection-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
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
              {availableProjects.length === 0 ? (
                <option value="">No facilities available in jurisdiction</option>
              ) : (
                availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Grid: Type & Trigger */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label
                htmlFor="schedule-inspection-type"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary, #334155)",
                  marginBottom: "0.4rem",
                }}
              >
                Inspection Type *
              </label>
              <select
                id="schedule-inspection-type"
                value={type}
                onChange={(e) => setType(e.target.value as InspectionType)}
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
                {INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
              <span
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  color: "var(--text-muted, #64748b)",
                  marginTop: "0.3rem",
                  lineHeight: 1.3,
                }}
              >
                {TYPE_DESCRIPTIONS[type]}
              </span>
            </div>

            <div>
              <label
                htmlFor="schedule-inspection-trigger"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary, #334155)",
                  marginBottom: "0.4rem",
                }}
              >
                Initiation Trigger *
              </label>
              <select
                id="schedule-inspection-trigger"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as InspectionTrigger)}
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
                {INSPECTION_TRIGGERS.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <span
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  color: "var(--text-muted, #64748b)",
                  marginTop: "0.3rem",
                  lineHeight: 1.3,
                }}
              >
                Auditable origin of this inspection mandate.
              </span>
            </div>
          </div>

          {/* Grid: Scheduled Start & End Window */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label
                htmlFor="schedule-inspection-start"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary, #334155)",
                  marginBottom: "0.4rem",
                }}
              >
                Scheduled Window Start
              </label>
              <input
                id="schedule-inspection-start"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-strong, #cbd5e1)",
                  background: "var(--bg-surface, #ffffff)",
                  color: "var(--text-primary, #0f172a)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="schedule-inspection-end"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-secondary, #334155)",
                  marginBottom: "0.4rem",
                }}
              >
                Scheduled Window End
              </label>
              <input
                id="schedule-inspection-end"
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-strong, #cbd5e1)",
                  background: "var(--bg-surface, #ffffff)",
                  color: "var(--text-primary, #0f172a)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

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
            <button
              type="submit"
              disabled={isSubmitting || !projectId}
              style={{
                background: "var(--color-navy-brand, #1e3a8a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: isSubmitting || !projectId ? "not-allowed" : "pointer",
                opacity: isSubmitting || !projectId ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Registering Itinerary…" : "Confirm & Schedule Inspection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
