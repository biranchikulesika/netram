"use client";

import type { Inspection, InspectionStatus } from "@netram/types";

interface InspectionLifecyclePanelProps {
  inspection: Inspection;
}

const LIFECYCLE_STAGES: {
  id: string;
  label: string;
  hint: string;
  statuses: InspectionStatus[];
}[] = [
  {
    id: "stage-1",
    label: "Scheduled",
    hint: "inspection scheduled",
    statuses: ["assigned", "scheduled"],
  },
  {
    id: "stage-2",
    label: "Field Active",
    hint: "inspector on site",
    statuses: ["in_progress", "evidence_collection"],
  },
  { id: "stage-3", label: "Submitted", hint: "inspector submitted", statuses: ["submitted"] },
  { id: "stage-4", label: "Authority Review", hint: "under review", statuses: ["under_review"] },
  {
    id: "stage-5",
    label: "Findings & Remediation",
    hint: "findings · corrective action · verify",
    statuses: ["findings", "corrective_actions", "verification"],
  },
  { id: "stage-6", label: "Closed", hint: "concluded & sealed", statuses: ["closed"] },
];

export function InspectionLifecyclePanel({ inspection }: InspectionLifecyclePanelProps) {
  const currentStageIndex = LIFECYCLE_STAGES.findIndex((stage) =>
    stage.statuses.includes(inspection.status),
  );

  const stageLabel = inspection.status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="workflow-card">
      <div className="workflow-stepper" aria-label={`Workflow: ${stageLabel}`}>
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isCurrent = idx === currentStageIndex;
          const isPassed = currentStageIndex > -1 && idx < currentStageIndex;
          const nodeClass = isPassed ? "passed" : isCurrent ? "current" : "";

          return (
            <div key={stage.id} className={`workflow-step ${nodeClass}`}>
              <div className="workflow-node" title={stage.label}>
                {isPassed ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <div className="workflow-step-label" title={stage.label}>
                {stage.label}
              </div>
              <div className="workflow-step-hint">
                {isCurrent ? stageLabel.toLowerCase() : stage.hint}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}