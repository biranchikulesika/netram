import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFacility,
  getFacilityAttendance,
  getFacilityAudit,
  getFacilityComplaints,
  getFacilityCorrectiveActions,
  getFacilityInspections,
  getFacilityAiAnomalies,
  getFacilityReports,
} from "../../../../lib/facility";
import {
  getAuthorityName,
  getDistrictName,
  getOrganisationName,
  getProgrammeName,
  getUserDisplayName,
  formatDate,
  formatDateTime,
  formatShortDate,
} from "../../../../lib/presentation";
import { IconChevronRight } from "../../../components/icons";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = new Set(["in_progress", "evidence_collection"]);
const REVIEW_STATUSES = new Set([
  "submitted",
  "under_review",
  "findings",
  "corrective_actions",
  "verification",
]);
const CA_ALERT_STATUSES = new Set(["overdue", "escalated", "pending"]);

interface AttentionRow {
  key: string;
  tone: string;
  title: string;
  sub: string;
  pill: string;
  pillSerious: boolean;
  href: string;
}

export default async function FacilityOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) notFound();

  const [inspections, complaints, attendance, aiAnomalies, reports, audit] =
    await Promise.all([
      getFacilityInspections(project.id),
      getFacilityComplaints(project.id),
      getFacilityAttendance(project.id),
      getFacilityAiAnomalies(project.id, project.code, project.name),
      getFacilityReports(project.code, project.name),
      getFacilityAudit(project.id),
    ]);
  const correctiveActions = await getFacilityCorrectiveActions(project.id, inspections);
  const facilityTab = (section: string) => `/dashboard/projects/${project.id}/${section}`;

  const activeInspections = inspections.filter((i) => ACTIVE_STATUSES.has(i.status));
  const reviewInspections = inspections.filter((i) => REVIEW_STATUSES.has(i.status));
  const attentionInspections = activeInspections.length + reviewInspections.length;

  const openComplaints = complaints.filter(
    (c) => c.status !== "resolved" && c.status !== "closed",
  );
  const openAiAnomalies = aiAnomalies.filter(
    (a) => a.status !== "dismissed" && a.status !== "acted_upon",
  );
  const openAttendanceAnomalies = attendance.anomalies.filter(
    (a) => !["DISMISSED", "FALSE_POSITIVE", "ACTIONED"].includes(a.state),
  );
  const outstandingActions = correctiveActions.filter((ca) => ca.status !== "accepted");
  const overdueActions = outstandingActions.filter((ca) => CA_ALERT_STATUSES.has(ca.status));
  const finalizedReports = reports.filter((r) => r.status === "ready" || r.status === "finalized");

  const attendanceToday = attendance.overview[0] ?? null;

  const kpis = [
    {
      label: "Inspections",
      value: String(inspections.length),
      sub: attentionInspections > 0 ? `${attentionInspections} need attention` : "Nothing pending",
      href: facilityTab("inspections"),
      alert: attentionInspections > 0,
    },
    {
      label: "Complaints",
      value: String(complaints.length),
      sub:
        openComplaints.length > 0
          ? `${openComplaints.length} open`
          : "No open grievances",
      href: facilityTab("complaints"),
      alert: openComplaints.length > 0,
    },
    {
      label: "AI Signals",
      value: String(aiAnomalies.length),
      sub:
        openAiAnomalies.length > 0
          ? `${openAiAnomalies.length} to review`
          : "Cleared",
      href: facilityTab("monitoring"),
      alert: openAiAnomalies.length > 0,
    },
    {
      label: "Attendance",
      value:
        attendanceToday !== null
          ? `${attendanceToday.present} / ${attendanceToday.expected ?? "—"}`
          : "—",
      sub:
        openAttendanceAnomalies.length > 0
          ? `${openAttendanceAnomalies.length} anomaly${openAttendanceAnomalies.length === 1 ? "" : "ies"}`
          : "Nominal",
      href: facilityTab("attendance"),
      alert: openAttendanceAnomalies.length > 0,
    },
    {
      label: "Corrective Actions",
      value: String(correctiveActions.length),
      sub:
        outstandingActions.length > 0
          ? `${outstandingActions.length} outstanding${overdueActions.length > 0 ? ` · ${overdueActions.length} overdue` : ""}`
          : "All closed",
      href: facilityTab("actions"),
      alert: outstandingActions.length > 0,
    },
    {
      label: "Reports",
      value: String(reports.length),
      sub: `${finalizedReports.length} ready`,
      href: facilityTab("reports"),
      alert: false,
    },
  ];

  const rows: AttentionRow[] = [];

  for (const ca of outstandingActions
    .filter((ca) => CA_ALERT_STATUSES.has(ca.status))
    .slice(0, 3)) {
    rows.push({
      key: `ca-${ca.id}`,
      tone: "#dc2626",
      title: `Corrective action ${ca.status.replace("_", " ")}`,
      sub: `Deadline ${formatShortDate(ca.deadline)} · linked to inspection findings`,
      pill: ca.status === "overdue" ? "Overdue" : ca.status.replace("_", " "),
      pillSerious: ca.status === "overdue" || ca.status === "escalated",
      href: facilityTab("actions"),
    });
  }

  for (const a of openAiAnomalies.slice(0, 3)) {
    const isHigh = a.severity === "critical" || a.severity === "high";
    rows.push({
      key: `anom-${a.id}`,
      tone: isHigh ? "#dc2626" : "#ea580c",
      title: `Anomaly: ${a.type.replace(/_/g, " ")} (${a.severity})`,
      sub: a.explanation ?? "AI advisory signal awaiting review",
      pill: `${Math.round(a.confidence * 100)}% signal`,
      pillSerious: isHigh,
      href: facilityTab("monitoring"),
    });
  }

  for (const i of activeInspections.slice(0, 3)) {
    rows.push({
      key: `inspect-${i.id}`,
      tone: "#2563eb",
      title: `${i.type === "surprise" ? "Surprise" : "Routine"} inspection in the field`,
      sub: `Started ${formatShortDate(i.startedAt ?? i.scheduledStart)} · ${i.trigger.replace(/_/g, " ")}`,
      pill: "In the field",
      pillSerious: false,
      href: facilityTab("inspections"),
    });
  }

  for (const c of openComplaints.slice(0, 3)) {
    rows.push({
      key: `comp-${c.id}`,
      tone: "#b91c1c",
      title: `Complaint ${c.trackingCode}`,
      sub: `${c.description}`,
      pill: c.status.replace(/_/g, " "),
      pillSerious: false,
      href: facilityTab("complaints"),
    });
  }

  for (const i of reviewInspections.slice(0, 2)) {
    rows.push({
      key: `review-${i.id}`,
      tone: "#d97706",
      title: `${i.type === "surprise" ? "Surprise" : "Routine"} inspection awaiting review`,
      sub: `Submitted ${formatShortDate(i.submittedAt ?? i.updatedAt)}`,
      pill: "Awaiting review",
      pillSerious: false,
      href: facilityTab("inspections"),
    });
  }

  for (const a of openAttendanceAnomalies.slice(0, 3)) {
    rows.push({
      key: `att-${a.id}`,
      tone: "#ea580c",
      title: `Attendance signal: ${a.anomalyType.replace(/_/g, " ").toLowerCase()}`,
      sub: `Observed ${formatShortDate(a.observationStart)} · ${Math.round(a.score * 100)}% score`,
      pill: a.state.replace(/_/g, " "),
      pillSerious: false,
      href: facilityTab("attendance"),
    });
  }

  const factItems: { label: string; value: string; full?: boolean }[] = [
    {
      label: "Facility Type",
      value:
        project.type === "institution"
          ? "Institution / NGO Facility"
          : project.type === "authority_project"
            ? "Authority Infrastructure Project"
            : "General Sanctioned Initiative",
    },
    { label: "District Jurisdiction", value: getDistrictName(project.districtId, project.code) },
    {
      label: "Managing Organisation",
      value: getOrganisationName(project.organisationId, project.name),
    },
    { label: "Sanctioning Authority", value: getAuthorityName(project.authorityId) },

    { label: "Enrolled Schemes", value: project.programmeIds.map(getProgrammeName).join(", ") || "None linked", full: true },
    { label: "Registered", value: formatDate(project.createdAt) },
    { label: "Last Update", value: formatShortDate(project.updatedAt) },
  ];

  const recentAudit = audit.slice(0, 8);

  return (
    <>
      {/* KPI metric strip */}
      <div className="facility-kpis">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className={`facility-kpi ${kpi.alert ? "facility-kpi-alert" : ""}`}
            style={{ textDecoration: "none" }}
          >
            <span className="facility-kpi-label">{kpi.label}</span>
            <span className="facility-kpi-value">
              {kpi.value}
              {kpi.alert && <span className="facility-kpi-alert-dot" aria-hidden="true" />}
            </span>
            <span className="facility-kpi-sub">{kpi.sub}</span>
          </Link>
        ))}
      </div>

      <div className="facility-grid">
        {/* Attention queue */}
        <div className="facility-panel">
          <div className="facility-panel-head">
            <span className="facility-panel-title">Operational Attention</span>
            {rows.length > 0 && (
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {rows.length} item{rows.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="attention-empty">
              No open items require attention at this facility.
            </div>
          ) : (
            <div className="attention-list">
              {rows.map((row) => (
                <Link key={row.key} href={row.href} className="attention-row" style={{ textDecoration: "none" }}>
                  <span
                    className="attention-dot"
                    style={{ background: row.tone }}
                    aria-hidden="true"
                  />
                  <span className="attention-body">
                    <span className="attention-title">{row.title}</span>
                    <span className="attention-sub">{row.sub}</span>
                  </span>
                  <span className={`attention-pill ${row.pillSerious ? "serious" : ""}`}>
                    {row.pill}
                  </span>
                  <IconChevronRight
                    style={{ width: 13, height: 13, flex: "none", color: "var(--text-subtle)" }}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Facility facts */}
        <div className="facility-panel">
          <div className="facility-panel-head">
            <span className="facility-panel-title">Facility Facts</span>
          </div>
          <div className="facility-facts">
            {factItems.map((item) => (
              <div key={item.label} className={`ff-item ${item.full ? "ff-full" : ""}`}>
                <span className="ff-label">{item.label}</span>
                <span className="ff-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent facility activity */}
      <div className="facility-panel" style={{ marginBottom: "1.25rem" }}>
        <div className="facility-panel-head">
          <span className="facility-panel-title">Recent Facility Activity</span>
          <Link className="facility-panel-link" href="/dashboard/audit">
            Full audit log →
          </Link>
        </div>
        {recentAudit.length === 0 ? (
          <div className="attention-empty">No recorded activity for this facility yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "220px" }}>Action</th>
                <th>Actor</th>
                <th style={{ width: "220px" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="badge badge-routine">{e.action}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {getUserDisplayName(e.actorUserId, "Automated System")}
                  </td>
                  <td className="muted">{formatDateTime(e.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}