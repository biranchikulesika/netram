import { getFacility, getFacilityComplaints } from "../../../../lib/facility";
import { formatDate } from "../../../../lib/presentation";

export const dynamic = "force-dynamic";

export default async function FacilityComplaintsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const complaints = await getFacilityComplaints(project.id);
  const openCount = complaints.filter(
    (c) => c.status !== "resolved" && c.status !== "closed",
  ).length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Facility Complaints <span className="count-chip">{complaints.length}</span>
          </h2>
          <p className="muted">
            Grievances regarding this facility — oversight inputs, not automatic findings of misconduct
          </p>
        </div>
        <div className="section-header-stats">
          <span className={`stat-chip ${openCount > 0 ? "danger" : "good"}`}>
            {openCount} open
          </span>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "150px" }}>Tracking Code</th>
              <th>Description</th>
              <th style={{ width: "140px" }}>Status</th>
              <th style={{ width: "150px" }}>Received</th>
            </tr>
          </thead>
          <tbody>
            {complaints.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No complaints recorded for this facility.
                  </div>
                </td>
              </tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="code-badge">{c.trackingCode}</span>
                  </td>
                  <td style={{ maxWidth: "420px" }}>
                    <span style={{ color: "var(--color-navy-data)" }}>{c.description}</span>
                    {c.complainantName && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)", marginTop: "2px" }}>
                        Reported by {c.complainantName}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`status status-${c.status}`}>
                      {c.status.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    </span>
                  </td>
                  <td className="muted">{formatDate(c.receivedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>
            {complaints.length} total · {openCount} open
          </span>
        </div>
      </div>
    </section>
  );
}