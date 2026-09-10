import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { CameraCard } from "./camera-card";
import { AttendanceOverviewSection } from "./attendance-overview";
import type { AttendanceCalculation } from "@netram/types";

export const dynamic = "force-dynamic";

export default async function ControlRoomPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();

  const [camerasPage, anomaliesPage, inspectionsPage, attendanceOverview, attendanceCalculationsPage, attendanceAnomalies] = await Promise.all([
    client
      .listCameras({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listAiAnomalies({ pageSize: 5 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 5 })),
    client
      .listInspections({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listAttendanceOverview({ pageSize: 20 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    client
      .listAttendanceCalculations({ pageSize: 20 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    client
      .listAttendanceAnomalies({ pageSize: 10 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 10 })),
  ]);

  const attendanceCalculations = attendanceCalculationsPage as unknown as { items: AttendanceCalculation[] };

  const activeCamerasCount = camerasPage.items.filter((c) => c.status === "active").length;
  const inProgressInspectionsCount = inspectionsPage.items.filter(
    (i) => i.status === "in_progress",
  ).length;

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="control-room"
      />

      <div className="section-header">
        <div>
          <h2>Control Room & Live Surveillance</h2>
          <p className="muted">
            Centralized monitoring feeds, authorized stream relays, and advisory anomaly oversight
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="control-room-stats">
        <div className="stat-widget">
          <div className="stat-value">{activeCamerasCount}</div>
          <div className="stat-label">Active Cameras</div>
        </div>
        <div className="stat-widget">
          <div className="stat-value">{camerasPage.total}</div>
          <div className="stat-label">Total Endpoints</div>
        </div>
        <div className="stat-widget">
          <div className="stat-value">{anomaliesPage.total}</div>
          <div className="stat-label">Advisory AI Alerts</div>
        </div>
        <div className="stat-widget">
          <div className="stat-value">{inProgressInspectionsCount}</div>
          <div className="stat-label">Field Inspections Active</div>
        </div>
      </div>

      <div className="control-room-container">
        {/* Camera Monitor Grid */}
        <section>
          {camerasPage.items.length === 0 ? (
            <div
              className="empty-state"
              style={{
                padding: "3rem",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3>No Cameras Available</h3>
              <p className="muted">
                No CCTV cameras are configured for your authorized jurisdiction.
              </p>
            </div>
          ) : (
            <div className="camera-grid">
              {camerasPage.items.map((cam) => (
                <CameraCard key={cam.id} camera={cam} />
              ))}
            </div>
          )}
        </section>

        {/* Advisory AI Alerts Sidebar (§7, §36) */}
        <aside className="control-sidebar">
          <h3 className="sidebar-title">
            <span>Advisory AI Alerts</span>
            <span
              style={{
                fontSize: "0.75rem",
                background: "#e2e8f0",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              {anomaliesPage.total}
            </span>
          </h3>

          <div
            style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "1rem", lineHeight: 1.4 }}
          >
            ℹ️ <strong>Advisory Rule (§36):</strong> AI alerts represent reviewable signals for
            officer oversight and never constitute autonomous punitive determinations.
          </div>

          <div className="anomaly-alert-list">
            {anomaliesPage.items.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                No active anomalies detected in your jurisdiction.
              </p>
            ) : (
              anomaliesPage.items.map((alert) => (
                <div key={alert.id} className="anomaly-alert-item">
                  <div className="anomaly-alert-header">
                    <span className={`severity-pill ${alert.severity}`}>{alert.severity}</span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                      Conf: {Math.round(alert.confidence * 100)}%
                    </span>
                  </div>
                  <p className="anomaly-explanation">
                    {alert.explanation ?? "Anomaly flagged for review"}
                  </p>
                  <div className="anomaly-meta">
                    <span>{alert.type.replace("_", " ")}</span>
                    {alert.projectName && <span> • {alert.projectName}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

      {/* Attendance Monitoring Section */}
      <AttendanceOverviewSection
        overviewItems={attendanceOverview.items}
        calculations={attendanceCalculations.items}
        anomalies={attendanceAnomalies.items}
      />

      </div>
    </main>
  );
}

