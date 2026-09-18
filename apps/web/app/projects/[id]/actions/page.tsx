import Link from "next/link";
import { getFacility, getFacilityCorrectiveActions, getFacilityInspections } from "../../../../lib/facility";
import { formatDate } from "../../../../lib/presentation";

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
          <p className="muted">Remediation tracking for this facility — inspection findings, deadlines, and closure</p>
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
              <th>Inspection</th>
              <th style={{ width: "150px" }}>Status</th>
              <th style={{ width: "150px" }}>Deadline</th>
              <th style={{ width: "150px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "3rem 1rem" }}>
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
                      <Link
                        href={`/inspections/${ca.inspectionId}`}
                        style={{ fontWeight: 600, color: "var(--color-navy-brand)", textDecoration: "none" }}
                      >
                        Deficiency Remediation
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
                    <td className="muted">{formatDate(ca.deadline)}</td>
                    <td className="muted">{formatDate(ca.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>
            {actions.length} total · {openCount} outstanding
          </span>
        </div>
      </div>
    </section>
  );
}