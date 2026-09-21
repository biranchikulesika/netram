"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { Inspection, InspectionStatus } from "@netram/types";
import { INSPECTION_TRANSITIONS } from "@netram/types";
import { InspectionTransitionModal } from "../inspection-transition-modal";

interface InspectionLifecyclePanelProps {
  inspection: Inspection;
  canTransitionInspector: boolean;
  canTransitionAuthority: boolean;
}

const LIFECYCLE_STAGES: {
  id: string;
  label: string;
  statuses: InspectionStatus[];
}[] = [
  { id: "stage-1", label: "Scheduled", statuses: ["assigned", "scheduled"] },
  { id: "stage-2", label: "Field Active", statuses: ["in_progress", "evidence_collection"] },
  { id: "stage-3", label: "Submitted", statuses: ["submitted"] },
  { id: "stage-4", label: "Authority Review", statuses: ["under_review"] },
  { id: "stage-5", label: "Findings & Remediation", statuses: ["findings", "corrective_actions", "verification"] },
  { id: "stage-6", label: "Closed", statuses: ["closed"] },
];

const INSPECTOR_STEPS: readonly InspectionStatus[] = [
  "in_progress",
  "evidence_collection",
  "submitted",
];

export function InspectionLifecyclePanel({
  inspection: initialInspection,
  canTransitionInspector,
  canTransitionAuthority,
}: InspectionLifecyclePanelProps) {
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection>(initialInspection);
  const [modalOpen, setModalOpen] = useState(false);

  // Determine current stage index
  const currentStageIndex = LIFECYCLE_STAGES.findIndex((stage) =>
    stage.statuses.includes(inspection.status),
  );

  const allowedTransitions = (INSPECTION_TRANSITIONS[inspection.status] || []).filter((next) => {
    const isInspector = INSPECTOR_STEPS.includes(next);
    if (isInspector && !canTransitionInspector) return false;
    if (!isInspector && !canTransitionAuthority) return false;
    return true;
  });

  const handleSuccess = (updated: Inspection) => {
    setInspection(updated);
    router.refresh();
  };

  return (
    <div
      style={{
        background: "var(--bg-card, #ffffff)",
        borderRadius: "10px",
        border: "1px solid var(--color-border, #e2e8f0)",
        padding: "1.25rem 1.5rem",
        marginBottom: "1.5rem",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--color-navy-brand, #1e3a8a)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Statutory Lifecycle Stepper (§32)
          </div>
          <h3 style={{ margin: "0.2rem 0 0 0", fontSize: "1.05rem", fontWeight: 700 }}>
            Workflow Stage:{" "}
            <span style={{ color: "var(--color-navy-brand, #1e3a8a)" }}>
              {inspection.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          </h3>
        </div>

        {/* Transition Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {allowedTransitions.length > 0 ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                background: "var(--color-navy-brand, #1e3a8a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.45rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              }}
            >
              <span>Advance Status &rarr;</span>
            </button>
          ) : inspection.status === "closed" ? (
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "0.3rem 0.6rem",
                borderRadius: "4px",
                background: "#dcfce7",
                color: "#15803d",
                border: "1px solid #bbf7d0",
              }}
            >
              ✓ Concluded & Sealed
            </span>
          ) : (
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)" }}>
              No transitions available for current credentials
            </span>
          )}
        </div>
      </div>

      {/* Stepper Visualization */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.5rem",
          position: "relative",
        }}
      >
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isCurrent = idx === currentStageIndex;
          const isPassed = currentStageIndex > -1 && idx < currentStageIndex;

          let badgeBg = "var(--bg-surface-subtle, #f8fafc)";
          let borderColor = "var(--color-border, #e2e8f0)";
          let textColor = "var(--text-muted, #64748b)";
          let stepNumberBg = "#e2e8f0";
          let stepNumberColor = "#475569";

          if (isCurrent) {
            badgeBg = "#eff6ff";
            borderColor = "#3b82f6";
            textColor = "#1e3a8a";
            stepNumberBg = "#2563eb";
            stepNumberColor = "#ffffff";
          } else if (isPassed) {
            badgeBg = "#f0fdf4";
            borderColor = "#86efac";
            textColor = "#15803d";
            stepNumberBg = "#16a34a";
            stepNumberColor = "#ffffff";
          }

          return (
            <div
              key={stage.id}
              style={{
                background: badgeBg,
                border: `1.5px solid ${borderColor}`,
                borderRadius: "8px",
                padding: "0.6rem 0.5rem",
                textAlign: "center",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: stepNumberBg,
                  color: stepNumberColor,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 0.35rem auto",
                }}
              >
                {isPassed ? "✓" : idx + 1}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: isCurrent ? 700 : 600,
                  color: textColor,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={stage.label}
              >
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transition Modal */}
      {modalOpen && (
        <InspectionTransitionModal
          inspection={inspection}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
          canTransitionInspector={canTransitionInspector}
          canTransitionAuthority={canTransitionAuthority}
        />
      )}
    </div>
  );
}
