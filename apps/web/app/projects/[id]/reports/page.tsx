import Link from "next/link";
import { getFacility, getFacilityReports } from "../../../../lib/facility";
import { formatDate } from "../../../../lib/presentation";

export const dynamic = "force-dynamic";

export default async function FacilityReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const reports = await getFacilityReports(project.code, project.name);
  const finalizedCount = reports.filter((r) => r.status === "ready" || r.status === "finalized").length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Facility Reports <span className="count-chip">{reports.length}</span>
          </h2>
          <p className="muted">Inspection reports generated for this facility</p>
        </div>
        <div className="section-header-stats">
          <span className={`stat-chip ${finalizedCount > 0 ? "good" : ""}`}>
            {finalizedCount} ready
          </span>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Report</th>
              <th style={{ width: "120px" }}>Format</th>
              <th style={{ width: "140px" }}>Status</th>
              <th style={{ width: "150px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No reports generated for this facility yet.
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/inspections/${r.inspectionId}`}
                      style={{ fontWeight: 600, color: "var(--color-navy-brand)", textDecoration: "none" }}
                    >
                      Official Inspection Report
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge-routine">{r.format.toUpperCase()}</span>
                  </td>
                  <td>
                    <span className={`status status-${r.status}`}>{r.status}</span>
                  </td>
                  <td className="muted">{formatDate(r.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>
            {reports.length} total · {finalizedCount} available
          </span>
        </div>
      </div>
    </section>
  );
}