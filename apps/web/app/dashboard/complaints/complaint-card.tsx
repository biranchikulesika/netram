import Link from "next/link";
import type { Complaint, ComplaintStatus } from "@netram/types";
import { formatDate, formatDistrict } from "../../../lib/presentation";
import {
  IconAlertTriangle,
  IconBuilding,
  IconGavel,
  IconClock,
  IconUser,
} from "../../components/icons";

export function getComplaintStatusBadge(status: ComplaintStatus): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "received":
      return { bg: "#e0f2fe", color: "#0369a1", label: "RECEIVED" };
    case "under_review":
      return { bg: "#fef3c7", color: "#b45309", label: "UNDER REVIEW" };
    case "escalated":
      return { bg: "#fee2e2", color: "#dc2626", label: "ESCALATED" };
    case "resolved":
      return { bg: "#dcfce7", color: "#15803d", label: "RESOLVED" };
    case "closed":
      return { bg: "#f1f5f9", color: "#475569", label: "CLOSED" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: String(status).toUpperCase() };
  }
}

export function ComplaintCard({
  complaint,
  showProjectInfo = true,
}: {
  complaint: Complaint;
  showProjectInfo?: boolean;
}) {
  const statusMeta = getComplaintStatusBadge(complaint.status);
  const districtLabel = formatDistrict(complaint.districtName);

  return (
    <article className="facility-card">
      <Link
        href={`/dashboard/complaints/${complaint.id}`}
        className="facility-card-link"
        aria-label={`Open complaint ${complaint.trackingCode}`}
      >
        <h3 className="facility-card-title">
          <span style={{ fontFamily: "var(--font-mono)" }}>{complaint.trackingCode}</span>
        </h3>

        <p className="facility-card-desc">{complaint.description}</p>

        <dl className="facility-card-meta">
          <div className="facility-card-meta-item">
            <dt title="Status" aria-label="Status">
              <IconAlertTriangle className="meta-label-icon" style={{ color: statusMeta.color }} />
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
            </dd>
          </div>
          {showProjectInfo && (
            <div className="facility-card-meta-item">
              <dt title="Facility" aria-label="Facility">
                <IconBuilding className="meta-label-icon" />
              </dt>
              <dd title={`${complaint.projectName} (${complaint.projectCode})`}>
                {complaint.projectName} ({complaint.projectCode})
              </dd>
            </div>
          )}
          <div className="facility-card-meta-item">
            <dt title="District jurisdiction" aria-label="District jurisdiction">
              <IconGavel className="meta-label-icon" />
            </dt>
            <dd>{districtLabel}</dd>
          </div>
          <div className="facility-card-meta-item">
            <dt title="Complainant" aria-label="Complainant">
              <IconUser className="meta-label-icon" />
            </dt>
            <dd>{complaint.complainantName || "Anonymous Citizen"}</dd>
          </div>
          <div className="facility-card-meta-item">
            <dt title="Filed" aria-label="Filed">
              <IconClock className="meta-label-icon" />
            </dt>
            <dd>{formatDate(complaint.receivedAt)}</dd>
          </div>
        </dl>

        <div className="facility-card-footer">
          <span className="facility-card-date">Filed {formatDate(complaint.receivedAt)}</span>
        </div>
      </Link>
    </article>
  );
}