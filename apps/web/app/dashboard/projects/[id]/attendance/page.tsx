import { getFacility, getFacilityAttendance } from "../../../../../lib/facility";
import { formatDate } from "../../../../../lib/presentation";

export const dynamic = "force-dynamic";

function coverageLabel(value: string | null | undefined): string {
  return value == null ? "UNAVAILABLE" : value;
}

export default async function FacilityAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const { overview, anomalies } = await getFacilityAttendance(project.id);
  const row = overview[0] ?? null;
  const openAnomalies = anomalies.filter(
    (a) => !["DISMISSED", "FALSE_POSITIVE", "ACTIONED"].includes(a.state),
  ).length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Facility Attendance <span className="count-chip">{row?.present ?? "—"}</span>
          </h2>
          <p className="muted">Biometric, institution-reported, and CCTV cross-verification for this facility</p>
        </div>
        <div className="section-header-stats">
          <span className="stat-chip">
            Present {row?.present ?? "—"} / {row?.expected ?? "—"}
          </span>
          <span className={`stat-chip ${openAnomalies > 0 ? "warn" : "good"}`}>
            {openAnomalies} open
          </span>
        </div>
      </div>

      {/* Present-day snapshot */}
      <div className="overview-cards">
        <div className="overview-card">
          <span className="card-label">Operational Day</span>
          <span className="card-val">{row?.operationalDate ?? "—"}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">Present</span>
          <span className="card-val">{row?.present ?? "—"}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">Expected</span>
          <span className="card-val">{row?.expected ?? "—"}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">Coverage</span>
          <span className="card-val">{row ? coverageLabel(row.coverage) : "UNAVAILABLE"}</span>
        </div>
        <div className="overview-card">
          <span className="card-label">Open Anomalies</span>
          <span className="card-val" style={{ color: openAnomalies > 0 ? "var(--color-tag-rust)" : "var(--color-navy-data)" }}>
            {anomalies.length}
          </span>
        </div>
      </div>

      {/* Attendance anomaly signals */}
      <div className="dossier-section-card" style={{ marginTop: "1.25rem" }}>
        <div className="dossier-section-title">ATTENDANCE ANOMALIES</div>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 0, marginBottom: "1rem" }}>
          Analytical signals requiring authority review — not proof of misconduct.
        </p>

        {anomalies.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "0.5rem 0" }}>
            No attendance anomalies recorded for this facility.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ width: "110px" }}>Severity</th>
                <th style={{ width: "110px" }}>Score</th>
                <th style={{ width: "140px" }}>State</th>
                <th>Operational Day</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="badge badge-routine">
                      {a.anomalyType.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          a.severity === "CRITICAL"
                            ? "var(--color-error)"
                            : a.severity === "HIGH"
                              ? "#ea580c"
                              : a.severity === "MEDIUM"
                                ? "#d97706"
                                : "#15803d",
                      }}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    {Math.round(a.score * 100)}%
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "var(--color-navy-data)" }}>{a.state}</span>
                  </td>
                  <td style={{ fontSize: "0.8rem" }}>{a.operationalDate ?? "—"}</td>
                  <td className="muted" style={{ fontSize: "0.78rem" }}>
                    {formatDate(a.observationStart)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}