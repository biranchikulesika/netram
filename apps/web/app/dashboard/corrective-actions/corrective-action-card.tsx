import Link from "next/link";
import type { CorrectiveAction, CorrectiveActionStatus } from "@netram/types";
import { formatDate, formatDistrict } from "../../../lib/presentation";
import {
  IconAlertTriangle,
  IconBuilding,
  IconGavel,
  IconClock,
} from "../../components/icons";

export function getStatusBadge(status: CorrectiveActionStatus): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "pending":
      return { bg: "#edf0f5", color: "var(--text-muted)", label: "PENDING" };
    case "submitted":
      return { bg: "var(--tint-navy)", color: "#0c2a52", label: "SUBMITTED" };
    case "under_review":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "UNDER REVIEW" };
    case "accepted":
      return { bg: "var(--tint-green)", color: "#137e3a", label: "ACCEPTED" };
    case "rejected":
      return { bg: "var(--tint-red)", color: "#dc2626", label: "REJECTED" };
    case "overdue":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "OVERDUE" };
    case "escalated":
      return { bg: "var(--tint-navy)", color: "#0c2a52", label: "ESCALATED" };
    default:
      return { bg: "#edf0f5", color: "var(--text-muted)", label: status };
  }
}

export function getSeverityStyle(severity: string): { bg: string; color: string; label: string } {
  switch (severity) {
    case "critical":
      return { bg: "var(--tint-red)", color: "#dc2626", label: "CRITICAL" };
    case "high":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "HIGH" };
    case "medium":
      return { bg: "var(--tint-orange)", color: "#dd501e", label: "MEDIUM" };
    case "low":
      return { bg: "#edf0f5", color: "var(--text-muted)", label: "LOW" };
    default:
      return { bg: "#edf0f5", color: "var(--text-muted)", label: severity.toUpperCase() };
  }
}

export function CorrectiveActionCard({
  ca,
  showProjectInfo = true,
}: {
  ca: CorrectiveAction;
  showProjectInfo?: boolean;
}) {
  const statusMeta = getStatusBadge(ca.status);
  const findingMeta = getSeverityStyle(ca.finding?.severity ?? "low");
  const findingLabel =
    ca.finding?.categoryName ??
    (ca.finding ? ca.finding.description : `Finding ${ca.findingId.slice(0, 8)}`);
  const isOverdue = ca.deadline && ca.status !== "accepted" && new Date(ca.deadline) < new Date();

  return (
    <article className="facility-card">
      <Link
        href={`/dashboard/corrective-actions/${ca.id}`}
        className="facility-card-link"
        aria-label={`Open corrective action ${ca.id}`}
      >
        <h3 className="facility-card-title">{findingLabel}</h3>

        {ca.finding?.description ? (
          <p className="facility-card-desc">{ca.finding.description}</p>
        ) : (
          <p className="facility-card-desc facility-card-desc-placeholder">
            No finding description recorded.
          </p>
        )}

        <dl className="facility-card-meta">
          <div className="facility-card-meta-item">
            <dt title="Severity" aria-label="Severity">
              <IconAlertTriangle className="meta-label-icon" style={{ color: findingMeta.color }} />
            </dt>
            <dd
              style={{
                fontWeight: 700,
                color: findingMeta.color,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span>{findingMeta.label}</span>
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
                {statusMeta.label}
              </span>
            </dd>
          </div>
          {showProjectInfo && (
            <div className="facility-card-meta-item">
              <dt title="Facility" aria-label="Facility">
                <IconBuilding className="meta-label-icon" />
              </dt>
              {ca.project ? (
                <dd title={`${ca.project.name} (${ca.project.code})`}>
                  {ca.project.name} ({ca.project.code})
                </dd>
              ) : (
                <dd className="meta-placeholder">No facility linked</dd>
              )}
            </div>
          )}
          <div className="facility-card-meta-item">
            <dt title="District jurisdiction" aria-label="District jurisdiction">
              <IconGavel className="meta-label-icon" />
            </dt>
            {ca.project?.districtId ? (
              <dd>{formatDistrict(ca.project.districtName, ca.project.stateName)}</dd>
            ) : (
              <dd className="meta-placeholder">Not assigned</dd>
            )}
          </div>
          <div className="facility-card-meta-item">
            <dt title="Statutory deadline" aria-label="Statutory deadline">
              <IconClock className="meta-label-icon" />
            </dt>
            {ca.deadline ? (
              <dd style={isOverdue ? { color: "#dc2626", fontWeight: 700 } : undefined}>
                {formatDate(ca.deadline)}
                {isOverdue ? " (Overdue)" : ""}
              </dd>
            ) : (
              <dd className="meta-placeholder">No deadline set</dd>
            )}
          </div>
        </dl>

        <div className="facility-card-footer">
          <span className="facility-card-date">Ordered {formatDate(ca.createdAt)}</span>
        </div>
      </Link>
    </article>
  );
}