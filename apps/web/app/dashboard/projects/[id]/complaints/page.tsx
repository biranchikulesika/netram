import Link from "next/link";
import { getFacility, getFacilityComplaints } from "../../../../../lib/facility";
import { formatDate } from "../../../../../lib/presentation";
import { IconChevronRight } from "../../../../components/icons";

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
            Grievances regarding this facility — oversight inputs, not automatic findings of misconduct (§35)
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
              <th style={{ width: "170px" }}>Tracking Code</th>
              <th>Description</th>
              <th style={{ width: "140px" }}>Status</th>
              <th style={{ width: "150px" }}>Received</th>
              <th style={{ width: "110px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {complaints.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No complaints recorded for this facility.
                  </div>
                </td>
              </tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div>
                      <Link
                        href={`/dashboard/complaints/${c.id}`}
                        className="code-badge"
                        style={{
                          textDecoration: "none",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-block",
                        }}
                      >
                        {c.trackingCode}
                      </Link>
                      <div style={{ marginTop: "4px" }}>
                        <Link
                          href={`/track-complaint?code=${c.trackingCode}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            textDecoration: "underline",
                          }}
                        >
                          Citizen portal &nearr;
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td style={{ maxWidth: "420px" }}>
                    <Link
                      href={`/dashboard/complaints/${c.id}`}
                      style={{
                        color: "var(--color-navy-data)",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      {c.description}
                    </Link>
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
                  <td className="muted" style={{ fontSize: "0.8rem" }}>{formatDate(c.receivedAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/dashboard/complaints/${c.id}`}
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
                      <span>Review</span>
                      <IconChevronRight style={{ width: 13, height: 13 }} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>
            {complaints.length} total · {openCount} open for {project.name}
          </span>
        </div>
      </div>
    </section>
  );
}