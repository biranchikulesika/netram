import Link from "next/link";
import { getFacility, getFacilityReports, getFacilityInspections } from "../../../../../lib/facility";
import { getSessionUser } from "../../../../../lib/api";
import { formatDate } from "../../../../../lib/presentation";
import { IconChevronRight } from "../../../../components/icons";
import { CompileFacilityReportButton } from "./compile-facility-report-button";

export const dynamic = "force-dynamic";

export default async function FacilityReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canGenerate = permissions.includes("report:generate") || permissions.includes("*");

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const [reports, inspections] = await Promise.all([
    getFacilityReports(project.code, project.name),
    getFacilityInspections(project.id),
  ]);

  const finalizedCount = reports.filter((r) => r.status === "ready" || r.status === "finalized").length;

  const availableInspections = inspections.map((i) => ({
    id: i.id,
    projectCode: project.code,
    projectName: project.name,
    type: i.type,
    status: i.status,
  }));

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Facility Reports <span className="count-chip">{reports.length}</span>
          </h2>
          <p className="muted">Official statutory inspection reports compiled for this facility (§34/§1310)</p>
        </div>
        <div className="section-header-stats" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {canGenerate && availableInspections.length > 0 && (
            <CompileFacilityReportButton availableInspections={availableInspections} />
          )}
          <span className={`stat-chip ${finalizedCount > 0 ? "good" : ""}`}>
            {finalizedCount} ready
          </span>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Report Dossier</th>
              <th>Inspection</th>
              <th style={{ width: "120px" }}>Format</th>
              <th style={{ width: "140px" }}>Status</th>
              <th style={{ width: "150px" }}>Created</th>
              <th style={{ width: "110px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No statutory reports compiled for this facility yet.
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((r) => {
                const isFinalized = r.status === "finalized";
                return (
                  <tr key={r.id}>
                    <td>
                      <div>
                        <Link
                          href={`/dashboard/reports/${r.id}`}
                          style={{
                            fontWeight: 600,
                            color: "var(--color-navy-brand)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <span>Statutory Report Dossier</span>
                          {isFinalized && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "0.1rem 0.35rem",
                                borderRadius: "3px",
                                background: "#dcfce7",
                                color: "#166534",
                                fontWeight: 700,
                              }}
                            >
                              SEALED
                            </span>
                          )}
                        </Link>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                          ID: {r.id.slice(0, 13)}…
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/inspections/${r.inspectionId}`}
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-primary)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                        }}
                      >
                        {r.inspectionType ? r.inspectionType.toUpperCase() : "INSPECTION"} ({r.inspectionId.slice(0, 8)})
                      </Link>
                    </td>
                    <td>
                      <span className="badge badge-routine">{r.format.toUpperCase()}</span>
                    </td>
                    <td>
                      <span className={`status status-${r.status}`}>{r.status}</span>
                    </td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>{formatDate(r.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/dashboard/reports/${r.id}`}
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
          <span>
            {reports.length} total · {finalizedCount} available for {project.name}
          </span>
        </div>
      </div>
    </section>
  );
}