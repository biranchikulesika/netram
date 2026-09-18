import Link from "next/link";
import { getFacility, getFacilityCorrectiveActions, getFacilityInspections } from "../../../../lib/facility";
import { formatDate } from "../../../../lib/presentation";
import { IconChevronRight } from "../../../components/icons";

export const dynamic = "force-dynamic";

export default async function FacilityActionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const inspections = await getFacilityInspections(project.id);
  const actions = await getFacilityCorrectiveActions(project.id, inspections);
  const openCount = actions.filter((ca) => ca.status !== "accepted").length;
  const overdueCount = actions.filter((ca) =>
    ["overdue", "escalated", "pending"].includes(ca.status),
  ).length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Corrective Actions <span className="count-chip">{actions.length}</span>
          </h2>
          <p className="muted">Remediation tracking for this facility — inspection findings, deadlines, and closure (§32)</p>
        </div>
        <div className="section-header-stats">
          <span className={`stat-chip ${openCount > 0 ? "warn" : "good"}`}>
            {openCount} outstanding
          </span>
          {overdueCount > 0 && (
            <span className="stat-chip danger">{overdueCount} overdue</span>
          )}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Remediation Item</th>
              <th>Parent Inspection</th>
              <th style={{ width: "150px" }}>Status</th>
              <th style={{ width: "150px" }}>Deadline</th>
              <th style={{ width: "150px" }}>Created</th>
              <th style={{ width: "110px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No corrective actions recorded for this facility.
                  </div>
                </td>
              </tr>
            ) : (
              actions.map((ca) => {
                const isOverdue =
                  ca.status === "overdue" || ca.status === "escalated" || ca.status === "pending";
                return (
                  <tr key={ca.id}>
                    <td>
                      <div>
                        <Link
                          href={`/corrective-actions/${ca.id}`}
                          style={{ fontWeight: 600, color: "var(--color-navy-brand)", textDecoration: "none" }}
                        >
                          Deficiency Remediation
                        </Link>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                          Finding: {ca.findingId.slice(0, 8)}…
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/inspections/${ca.inspectionId}`}
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-primary)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                        }}
                      >
                        Inspection ({ca.inspectionId.slice(0, 8)})
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`status status-${ca.status}`}
                        style={{ color: isOverdue ? "var(--color-error)" : undefined }}
                      >
                        {ca.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>{formatDate(ca.deadline)}</td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>{formatDate(ca.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/corrective-actions/${ca.id}`}
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
                        <span>Manage</span>
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
          <span>
            {actions.length} total · {openCount} outstanding for {project.name}
          </span>
        </div>
      </div>
    </section>
  );
}