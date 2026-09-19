/** @jsxRuntime automatic */
import type { AttendanceOverviewItem, AttendanceAnomaly, AttendanceCalculation } from "@netram/types";
import { getProjectName, getProjectCode } from "../../lib/presentation";

interface AttendanceOverviewProps {
  overviewItems: AttendanceOverviewItem[];
  calculations: AttendanceCalculation[];
  anomalies: AttendanceAnomaly[];
}

function severityColor(severity: string): string {
  return {
    LOW: "#22c55e",
    MEDIUM: "#eab308",
    HIGH: "#f97316",
    CRITICAL: "#ef4444",
  }[severity] ?? "#6b7280";
}

export function AttendanceOverviewSection({ overviewItems, calculations, anomalies }: AttendanceOverviewProps) {
  const openAnomalyCount = anomalies.length;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Attendance Monitoring</h2>
          <p className="muted">Biometric, reported, and CCTV cross-verification</p>
        </div>
      </div>

      {/* Attendance summary stats */}
      <div className="control-room-stats">
        <div className="stat-widget">
          <div className="stat-value">{overviewItems.length}</div>
          <div className="stat-label">Projects Monitored</div>
        </div>
        <div className="stat-widget">
          <div className="stat-value">
            {overviewItems.reduce((sum, i) => sum + i.present, 0)}
          </div>
          <div className="stat-label">Total Present (today)</div>
        </div>
        <div className="stat-widget">
          <div className="stat-value">{openAnomalyCount}</div>
          <div className="stat-label">Open Anomalies</div>
        </div>
        <div className="stat-widget">
          <div className="stat-value">
            {overviewItems.filter((i) => i.coverage === "COMPLETE").length}
          </div>
          <div className="stat-label">Full Coverage</div>
        </div>
      </div>

      {/* Anomaly alerts */}
      {openAnomalyCount > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 className="sidebar-title">
            <span>Attendance Anomalies</span>
            <span
              style={{
                fontSize: "0.75rem",
                background: "#fef2f2",
                color: "#dc2626",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                marginLeft: "0.5rem",
              }}
            >
              {openAnomalyCount} open
            </span>
          </h3>

          <div className="anomaly-alert-list">
            {anomalies.map((anomaly) => (
              <div key={anomaly.id} className="anomaly-alert-item">
                <div className="anomaly-alert-header">
                  <span
                    className="severity-pill"
                    style={{ background: severityColor(anomaly.severity) + "20", color: severityColor(anomaly.severity) }}
                  >
                    {anomaly.severity}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    Score: {Math.round(anomaly.score * 100)}% · Conf: {Math.round(anomaly.confidence * 100)}%
                  </span>
                </div>
                <p style={{ margin: 0 }}>
                  {anomaly.supportingSignals?.note != null ? (anomaly.supportingSignals.note as React.ReactNode) : `${anomaly.anomalyType.replace(/_/g, " ")} - review recommended`}
                </p>
                <div className="anomaly-meta">
                  {anomaly.projectCode ? <span>{anomaly.projectCode}</span> : null}
                  {anomaly.projectName ? <span> • {anomaly.projectName}</span> : null}
                </div>
                <div className="anomaly-meta" style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                  {anomaly.operationalDate ? <span>Op day: {anomaly.operationalDate}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project attendance table */}
      {calculations.length === 0 ? (
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
          <h3>No Attendance Data</h3>
          <p className="muted">
            No attendance calculations available for your authorized jurisdiction.
          </p>
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            marginTop: "1.5rem",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
              background: "#ffffff",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <th style={thStyle}>Project</th>
                <th style={thStyle}>Op Day</th>
                <th style={thStyle}>Expected</th>
                <th style={thStyle}>Present</th>
                <th style={thStyle}>Absent</th>
                <th style={thStyle}>Unknown</th>
                <th style={thStyle}>Coverage</th>
                <th style={thStyle}>Data Quality</th>
                <th style={thStyle}>Sources</th>
                <th style={thStyle}>Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {calculations.map((calc) => (
                <tr
                  key={`${calc.projectId}:${calc.operationalDate}`}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                  }}
                >
                  <td style={tdStyle}>
                    <strong>{getProjectName(calc.projectId)}</strong>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "#64748b",
                        marginTop: "2px",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {getProjectCode(calc.projectId)}
                    </div>
                  </td>
                  <td style={tdStyle}>{calc.operationalDate}</td>
                  <td style={tdStyle}>
                    {calc.expected !== null ? calc.expected : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 600,
                      color:
                        calc.coverage === "COMPLETE"
                          ? "#16a34a"
                          : calc.coverage === "PARTIAL"
                          ? "#d97706"
                          : "#6b7280",
                    }}
                  >
                    {calc.present}
                  </td>
                  <td style={tdStyle}>
                    {calc.absent !== null ? calc.absent : "—"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color:
                        calc.unknown > 0 ? "#dc2626" : "#94a3b8",
                    }}
                  >
                    {calc.unknown}
                  </td>
                  <td style={tdStyle}>
                    <span
                      className="coverage-pill"
                      style={{
                        background:
                          calc.coverage === "COMPLETE"
                            ? "#dcfce7"
                            : calc.coverage === "PARTIAL"
                            ? "#fef9c3"
                            : calc.coverage === "INSUFFICIENT"
                            ? "#fee2e2"
                            : "#f1f5f9",
                        color:
                          calc.coverage === "COMPLETE"
                            ? "#16a34a"
                            : calc.coverage === "PARTIAL"
                            ? "#a16207"
                            : calc.coverage === "INSUFFICIENT"
                            ? "#dc2626"
                            : "#64748b",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: 500,
                      }}
                    >
                      {calc.coverage}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      className="coverage-pill"
                      style={{
                        background:
                          calc.dataQuality === "GOOD"
                            ? "#dcfce7"
                            : calc.dataQuality === "DEGRADED"
                            ? "#fef9c3"
                            : calc.dataQuality === "POOR"
                            ? "#fee2e2"
                            : "#f1f5f9",
                        color:
                          calc.dataQuality === "GOOD"
                            ? "#16a34a"
                            : calc.dataQuality === "DEGRADED"
                            ? "#a16207"
                            : calc.dataQuality === "POOR"
                            ? "#dc2626"
                            : "#64748b",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: 500,
                      }}
                    >
                      {calc.dataQuality}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontSize: "0.75rem",
                      color: "#64748b",
                    }}
                  >
                    B: {calc.sourceCounts.BIOMETRIC ?? 0}
                    {calc.sourceCounts.INSTITUTION_REPORTED !== undefined &&
                      calc.sourceCounts.INSTITUTION_REPORTED !== 0 && (
                        <> · R: {calc.sourceCounts.INSTITUTION_REPORTED}</>
                      )}
                    {calc.sourceCounts.CCTV !== undefined &&
                      calc.sourceCounts.CCTV !== 0 && (
                        <> · C: {calc.sourceCounts.CCTV}</>
                      )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 600,
                      color: "#94a3b8",
                    }}
                  >
                    —
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  fontWeight: 600,
  color: "#475569",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  verticalAlign: "middle",
};
