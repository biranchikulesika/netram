import Link from "next/link";
import { notFound } from "next/navigation";
import { getDistrictCameras, getFacility, getFacilityAiAnomalies } from "../../../../../lib/facility";
import { getSessionUser } from "../../../../../lib/api";
import { canAny } from "../../../../../lib/permissions";
import { formatDateTime } from "../../../../../lib/presentation";
import { IconChevronRight } from "../../../../components/icons";

export const dynamic = "force-dynamic";

function anomalyStatusLabel(status: string): string {
  return status;
}

function cameraStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FacilityMonitoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // AI signals and CCTV coverage are oversight-side intelligence: institutions
  // are never shown them, on any entry path (§34 — omission, not hiding).
  const session = await getSessionUser();
  if (!session || !canAny(session.permissions, ["cctv:read", "ai:anomaly:read"])) notFound();

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const [anomalies, cameras] = await Promise.all([
    getFacilityAiAnomalies(project.id),
    getDistrictCameras(project.districtId),
  ]);

  const openAnomalies = anomalies.filter(
    (a) => a.status !== "dismissed" && a.status !== "acted_upon",
  ).length;
  const districtLabel = project.districtName ?? "Unknown district";

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Facility Monitoring <span className="count-chip">{anomalies.length}</span>
          </h2>
          <p className="muted">Advisory AI signals and CCTV infrastructure relevant to this facility</p>
        </div>
        <div className="section-header-stats">
          <span className={`stat-chip ${openAnomalies > 0 ? "warn" : "good"}`}>
            {openAnomalies} signal{openAnomalies === 1 ? "" : "s"} open
          </span>
          <span className="stat-chip">{cameras.length} cameras</span>
        </div>
      </div>

      {/* AI anomaly oversight */}
      <div className="dossier-section-card">
        <div className="dossier-section-title">AI / ANOMALY OVERSIGHT</div>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 0, marginBottom: "1rem" }}>
          AI outputs are advisory and reviewable. They never declare misconduct as fact —
          they indicate signals that an authority should examine.
        </p>

        {anomalies.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "0.5rem 0" }}>
            No AI anomaly signals recorded for this facility.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ width: "110px" }}>Severity</th>
                <th style={{ width: "120px" }}>Confidence</th>
                <th style={{ width: "130px" }}>Status</th>
                <th>Explanation</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="badge badge-routine">{a.type.replace(/_/g, " ")}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          a.severity === "critical"
                            ? "var(--color-error)"
                            : a.severity === "high"
                              ? "#ea580c"
                              : a.severity === "medium"
                                ? "#d97706"
                                : "#15803d",
                      }}
                    >
                      {a.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    {Math.round(a.confidence * 100)}%
                  </td>
                  <td>
                    <span className={`status status-${anomalyStatusLabel(a.status)}`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ maxWidth: "360px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {a.explanation ?? "—"}
                  </td>
                  <td className="muted" style={{ fontSize: "0.78rem" }}>
                    {formatDateTime(a.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {openAnomalies > 0 && (
          <p style={{ fontSize: "0.78rem", color: "var(--color-tag-rust)", marginTop: "0.9rem", marginBottom: 0 }}>
            {openAnomalies} anomaly signal{openAnomalies === 1 ? "" : "s"} awaiting review.
          </p>
        )}
      </div>

      {/* District CCTV coverage */}
      <div className="dossier-section-card" style={{ marginTop: "1.5rem" }}>
        <div className="dossier-section-title">CCTV / DISTRICT COVERAGE</div>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 0, marginBottom: "1rem" }}>
          Camera infrastructure is registered at {districtLabel} district level and serves all
          monitored facilities in that jurisdiction. Live feeds are managed in the Control Room.
        </p>

        {cameras.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "0.5rem 0" }}>
            No cameras registered in the {districtLabel} district jurisdiction.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Camera</th>
                <th>Provider</th>
                <th>Protocol</th>
                <th style={{ width: "130px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => (
                <tr key={cam.id}>
                  <td style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}>{cam.name}</td>
                  <td className="muted">{cam.provider}</td>
                  <td className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    {cam.protocol}
                  </td>
                  <td>
                    <span className={`status status-${cam.status === "active" ? "active" : cam.status === "inactive" ? "closed" : "pending"}`}>
                      {cameraStatusLabel(cam.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Link
          href="/dashboard/control-room"
          className="btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            marginTop: "1rem",
            fontSize: "0.8rem",
            padding: "0.4rem 0.85rem",
            textDecoration: "none",
          }}
        >
          <span>Open Control Room</span>
          <IconChevronRight style={{ width: 13, height: 13 }} />
        </Link>
      </div>
    </section>
  );
}