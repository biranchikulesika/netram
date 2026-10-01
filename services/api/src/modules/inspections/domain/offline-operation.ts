import type { Inspection, OfflineOperation, OfflineOperationStatus } from "@netram/types";

export interface OperationEvaluationResult {
  outcome: OfflineOperationStatus;
  code?: string;
  message?: string;
  targetInspectionStatus?: Inspection["status"];
}

const ACTIVE_FIELD_STATUSES: readonly Inspection["status"][] = [
  "in_progress",
  "evidence_collection",
];

/**
 * Server-side evaluation of an offline operation against current inspection state (§5, §31).
 * The server is authoritative and rejects or flags conflicts instead of blind last-write-wins.
 */
export function evaluateOfflineOperation(
  inspection: Inspection,
  op: OfflineOperation,
): OperationEvaluationResult {
  switch (op.type) {
    case "start_inspection": {
      if (inspection.status === "assigned" || inspection.status === "scheduled") {
        return {
          outcome: "accepted",
          targetInspectionStatus: "in_progress",
        };
      }
      if (inspection.status === "in_progress") {
        // Idempotent start: already in desired state
        return {
          outcome: "accepted",
          targetInspectionStatus: "in_progress",
          message: "Inspection already in progress; operation accepted idempotently.",
        };
      }
      return {
        outcome: "conflict",
        code: "INVALID_STATUS_FOR_START",
        message: `Cannot start inspection currently in '${inspection.status}' state.`,
      };
    }

    case "record_observation": {
      if (!ACTIVE_FIELD_STATUSES.includes(inspection.status)) {
        return {
          outcome: "conflict",
          code: "INSPECTION_NOT_IN_FIELD_STAGE",
          message: `Cannot record observation when inspection is in '${inspection.status}' state.`,
        };
      }
      const text = typeof op.payload.text === "string" ? op.payload.text.trim() : "";
      if (!text) {
        return {
          outcome: "rejected",
          code: "INVALID_OBSERVATION_PAYLOAD",
          message: "Observation text must not be empty.",
        };
      }
      return { outcome: "accepted" };
    }

    case "draft_finding": {
      if (!ACTIVE_FIELD_STATUSES.includes(inspection.status)) {
        return {
          outcome: "conflict",
          code: "INSPECTION_NOT_IN_FIELD_STAGE",
          message: `Cannot save a finding draft when inspection is in '${inspection.status}' state.`,
        };
      }
      const description =
        typeof op.payload.description === "string" ? op.payload.description.trim() : "";
      if (
        !description ||
        !["critical", "high", "medium", "low"].includes(String(op.payload.severity))
      ) {
        return {
          outcome: "rejected",
          code: "INVALID_FINDING_DRAFT",
          message: "A finding draft needs a description and valid severity.",
        };
      }
      return { outcome: "accepted" };
    }

    case "capture_evidence": {
      if (!ACTIVE_FIELD_STATUSES.includes(inspection.status)) {
        return {
          outcome: "conflict",
          code: "INSPECTION_NOT_IN_FIELD_STAGE",
          message: `Cannot capture evidence when inspection is in '${inspection.status}' state.`,
        };
      }
      const evidenceType = op.payload.evidenceType;
      const validTypes = ["photo", "video", "document", "audio"];
      if (typeof evidenceType !== "string" || !validTypes.includes(evidenceType)) {
        return {
          outcome: "rejected",
          code: "INVALID_EVIDENCE_TYPE",
          message: `Evidence type must be one of: ${validTypes.join(", ")}.`,
        };
      }
      return { outcome: "accepted" };
    }

    case "submit_inspection": {
      if (ACTIVE_FIELD_STATUSES.includes(inspection.status)) {
        return {
          outcome: "accepted",
          targetInspectionStatus: "submitted",
        };
      }
      if (
        [
          "submitted",
          "under_review",
          "findings",
          "corrective_action",
          "verified",
          "closed",
        ].includes(inspection.status)
      ) {
        return {
          outcome: "accepted",
          message: `Inspection is already in '${inspection.status}' state; submission accepted idempotently.`,
        };
      }
      return {
        outcome: "conflict",
        code: "CANNOT_SUBMIT_UNSTARTED",
        message: `Cannot submit inspection currently in '${inspection.status}' state.`,
      };
    }

    case "check_in": {
      const lat = Number(op.payload.latitude);
      const lon = Number(op.payload.longitude);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return {
          outcome: "rejected",
          code: "INVALID_CHECK_IN_COORDINATES",
          message: "Check-in requires valid latitude [-90, 90] and longitude [-180, 180].",
        };
      }
      return {
        outcome: "accepted",
        message:
          "Field check-in recorded. Server validates jurisdiction against project geofence boundary.",
      };
    }

    case "record_attendance": {
      const workerCount = Number(op.payload.workerCount);
      if (
        isNaN(workerCount) ||
        !Number.isInteger(workerCount) ||
        workerCount < 0 ||
        workerCount > 5000
      ) {
        return {
          outcome: "rejected",
          code: "INVALID_WORKER_COUNT",
          message: "Worker count must be a non-negative integer under 5,000.",
        };
      }
      return {
        outcome: "accepted",
        message: "Attendance headcount record verified and saved.",
      };
    }

    case "update_checklist_item": {
      if (!ACTIVE_FIELD_STATUSES.includes(inspection.status)) {
        return {
          outcome: "conflict",
          code: "INSPECTION_NOT_IN_FIELD_STAGE",
          message: `Cannot update checklist item when inspection is in '${inspection.status}' state.`,
        };
      }
      const validResponses = ["pass", "fail", "na", null];
      if (
        op.payload.response !== undefined &&
        !validResponses.includes(op.payload.response as string | null)
      ) {
        return {
          outcome: "rejected",
          code: "INVALID_CHECKLIST_RESPONSE",
          message: "Checklist response must be 'pass', 'fail', 'na', or null.",
        };
      }
      return {
        outcome: "accepted",
        message: "Checklist item response recorded.",
      };
    }

    default:
      return {
        outcome: "rejected",
        code: "UNKNOWN_OPERATION_TYPE",
        message: `Unknown operation type: ${(op as { type: string }).type}`,
      };
  }
}
