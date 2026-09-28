import Link from "next/link";
import type { Inspection, InspectionStatus } from "@netram/types";
import { formatDate, formatDistrict } from "../../../lib/presentation";
import {
  IconBuilding,
  IconClipboard,
  IconClock,
  IconMapPin,
  IconUser,
} from "../../components/icons";

export function getInspectionStatusStyle(status: InspectionStatus): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "assigned":
      return { bg: "#edf0f5", color: "var(--text-muted)", label: "ASSIGNED" };
    case "scheduled":
      return { bg: "var(--tint-navy)", color: "#0c2a52", label: "SCHEDULED" };
    case "in_progress":
      return { bg: "var(--tint-navy)", color: "#0c2a52", label: "IN PROGRESS" };
    case "evidence_collection":
      return { bg: "var(--tint-navy)", color: "#0c2a52", label: "EVIDENCE" };
    case "submitted":
      return { bg: "var(--tint-green)", color: "#137e3a", label: "SUBMITTED" };
    case "under_review":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "UNDER REVIEW" };
    case "findings":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "FINDINGS" };
    case "corrective_actions":
      return { bg: "var(--tint-navy)", color: "#0c2a52", label: "CORRECTIVE ACTION" };
    case "verification":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "VERIFICATION" };
    case "closed":
      return { bg: "var(--tint-green)", color: "#137e3a", label: "CLOSED" };
    default:
      return { bg: "#edf0f5", color: "var(--text-muted)", label: status };
  }
}

export function InspectionCard({ inspection }: { inspection: Inspection }) {
  const statusMeta = getInspectionStatusStyle(inspection.status);
  const isSurprise = inspection.type === "surprise";
  const assignedCount = Array.isArray(inspection.assignedUserIds)
    ? inspection.assignedUserIds.length
    : 0;
  const timing = inspection.startedAt
    ? `Started ${formatDate(inspection.startedAt)}`
    : inspection.scheduledStart
      ? `Scheduled ${formatDate(inspection.scheduledStart)}`
      : "Not yet started";

  return (
    <article className="facility-card">
      <Link
        href={`/dashboard/inspections/${inspection.id}`}
        className="facility-card-link"
        aria-label={`Open inspection ${inspection.id}`}
      >
        <h3 className="facility-card-title">
          {inspection.projectName || "Sanctioned facility"}
        </h3>

        <p className="facility-card-desc">
          {isSurprise ? "Surprise inspection" : `${inspection.type.replace(/_/g, " ")} inspection`} —{" "}
          {inspection.trigger.replace(/_/g, " ")} trigger
        </p>

        <dl className="facility-card-meta">
          <div className="facility-card-meta-item">
            <dt title="Status" aria-label="Status">
              <IconClipboard className="meta-label-icon" style={{ color: statusMeta.color }} />
            </dt>
            <dd
              style={{
                fontWeight: 700,
                color: statusMeta.color,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span>{statusMeta.label}</span>
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.4rem",
                  borderRadius: "4px",
                  background: statusMeta.bg,
                  color: statusMeta.color,
                }}
              >
                {inspection.type.toUpperCase()}
              </span>
            </dd>
          </div>
          <div className="facility-card-meta-item">
            <dt title="Facility / Project" aria-label="Facility / Project">
              <IconBuilding className="meta-label-icon" />
            </dt>
            <dd title={`${inspection.projectName} (${inspection.projectCode})`}>
              {inspection.projectName} ({inspection.projectCode})
            </dd>
          </div>
          <div className="facility-card-meta-item">
            <dt title="District" aria-label="District">
              <IconMapPin className="meta-label-icon" />
            </dt>
            {inspection.districtName ? (
              <dd>{formatDistrict(inspection.districtName)}</dd>
            ) : (
              <dd className="meta-placeholder">Not assigned</dd>
            )}
          </div>
          <div className="facility-card-meta-item">
            <dt title="Assignment" aria-label="Assignment">
              <IconUser className="meta-label-icon" />
            </dt>
            {assignedCount > 0 ? (
              <dd>
                {assignedCount} {assignedCount === 1 ? "Officer" : "Officers"}
              </dd>
            ) : (
              <dd className="meta-placeholder">Unassigned</dd>
            )}
          </div>
          <div className="facility-card-meta-item">
            <dt title="Timing" aria-label="Timing">
              <IconClock className="meta-label-icon" />
            </dt>
            <dd>{timing}</dd>
          </div>
        </dl>

        <div className="facility-card-footer">
          <span className="facility-card-date">Created {formatDate(inspection.createdAt)}</span>
        </div>
      </Link>
    </article>
  );
}