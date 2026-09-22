import Link from "next/link";
import { getFacility, getFacilityInspections } from "../../../../lib/facility";
import { getSessionUser } from "../../../../lib/api";
import { formatDate } from "../../../../lib/presentation";
import { IconChevronRight } from "../../../components/icons";
import { ScheduleFacilityInspectionButton } from "./schedule-facility-inspection-button";

export const dynamic = "force-dynamic";

function inspectionStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FacilityInspectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canCreate = permissions.includes("inspection:create") || permissions.includes("*");

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const inspections = await getFacilityInspections(project.id);
  const activeCount = inspections.filter(
    (i) => i.status === "in_progress" || i.status === "evidence_collection",
  ).length;
  const reviewCount = inspections.filter((i) =>
    ["submitted", "under_review", "findings", "corrective_actions", "verification"].includes(
      i.status,
    ),
  ).length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Facility Inspections <span className="count-chip">{inspections.length}</span>
          </h2>
          <p className="muted">Field inspection oversight for this facility — assignment and verification workflow</p>
        </div>
        <div className="section-header-stats" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {canCreate && <ScheduleFacilityInspectionButton project={project} />}
          <span className={`stat-chip ${activeCount > 0 ? "warn" : ""}`}>
            {activeCount} in the field
          </span>
          <span className={`stat-chip ${reviewCount > 0 ? "warn" : ""}`}>
            {reviewCount} awaiting review
          </span>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "130px" }}>Type</th>
              <th>Inspection ID</th>
              <th>Trigger</th>
              <th style={{ width: "150px" }}>Status</th>
              <th>Assignment</th>
              <th>Timing</th>
              <th style={{ width: "110px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {inspections.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No inspections recorded for this facility.
                  </div>
                </td>
              </tr>
            ) : (
              inspections.map((i) => {
                const isSurprise = i.type === "surprise";
                const dateStr = i.startedAt
                  ? `Started: ${formatDate(i.startedAt)}`
                  : i.scheduledStart
                    ? `Sched: ${formatDate(i.scheduledStart)}`
                    : "—";
                const assignedCount = Array.isArray(i.assignedUserIds) ? i.assignedUserIds.length : 0;

                return (
                  <tr key={i.id}>
                    <td className="table-row-anchor-cell" style={{ cursor: "pointer" }}>
                      <Link
                        href={`/inspections/${i.id}`}
                        className="table-row-anchor-link"
                        aria-label={`Open inspection ${i.id}`}
                      />
                      <span className={`badge ${isSurprise ? "badge-surprise" : "badge-routine"}`}>
                        {i.type.toUpperCase()}
                      </span>
                    </td>
                    <td title={i.id} style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-subtle)" }}>
                      {i.id.slice(0, 12)}
                    </td>
                    <td>
                      <span className="trigger-text">{i.trigger.replace(/_/g, " ")}</span>
                    </td>
                    <td>
                      <span className={`status status-${i.status}`}>
                        {inspectionStatusLabel(i.status)}
                      </span>
                    </td>
                    <td>
                      {assignedCount > 0 ? (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          {assignedCount} {assignedCount === 1 ? "Officer" : "Officers"}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)", fontStyle: "italic" }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>
                      {dateStr}
                    </td>
                    <td style={{ textAlign: "right", position: "relative", zIndex: 2 }}>
                      <Link
                        href={`/inspections/${i.id}`}
                        className="btn-secondary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.78rem",
                          padding: "0.3rem 0.65rem",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        <span>View</span>
                        <IconChevronRight style={{ width: 13, height: 13 }} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>Showing {inspections.length} inspection{inspections.length === 1 ? "" : "s"} for {project.name}</span>
        </div>
      </div>
    </section>
  );
}