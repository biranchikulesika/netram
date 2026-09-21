"use client";

import type { AIAnomaly, AnomalySeverity, AnomalyStatus } from "@netram/types";
import { IconAlertTriangle, IconVideo } from "../components/icons";
import { formatDateTime } from "../../lib/presentation";

const SEVERITY_META: Record<AnomalySeverity, { rank: number; color: string; label: string }> = {
  critical: { rank: 0, color: "#dc2626", label: "Critical" },
  high: { rank: 1, color: "#ea580c", label: "High" },
  medium: { rank: 2, color: "#ca8a04", label: "Medium" },
  low: { rank: 3, color: "#0d9488", label: "Low" },
};

const OPEN_STATUSES: AnomalyStatus[] = ["new", "reviewed", "investigated"];

export function getStatusStyle(status: AnomalyStatus): { bg: string; color: string; label: string } {
  switch (status) {
    case "new":
      return { bg: "#fee2e2", color: "#b91c1c", label: "NEW" };
    case "reviewed":
      return { bg: "#ede9fe", color: "#6d28d9", label: "REVIEWED" };
    case "investigated":
      return { bg: "#ffedd5", color: "#c2410c", label: "INVESTIGATING" };
    case "acted_upon":
      return { bg: "#dcfce7", color: "#15803d", label: "ACTED UPON" };
    case "dismissed":
      return { bg: "#f1f5f9", color: "#64748b", label: "DISMISSED" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: String(status).toUpperCase() };
  }
}

interface AIAlertsScreenProps {
  anomalies: AIAnomaly[];
  onSelect: (anomaly: AIAnomaly) => void;
}

/**
 * Cameras in a Dependabot-style alert list: ranked by severity (critical →
 * low), open alerts ahead of resolved ones, then newest first. Each row opens
 * the detail modal.
 *
 * The detection model today flags only conflict (violence) in live camera
 * feeds. Head-count vs attendance deviation is planned: the model will
 * compare people detected against the day's attendance register and only
 * raise an alert when a sustained deviation persists over a long period.
 * Nothing else is a supported detection.
 */
export function AIAlertsScreen({ anomalies, onSelect }: AIAlertsScreenProps) {
  const sorted = [...anomalies].sort((a, b) => {
    const aOpen = OPEN_STATUSES.includes(a.status) ? 0 : 1;
    const bOpen = OPEN_STATUSES.includes(b.status) ? 0 : 1;
    return (
      SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank ||
      aOpen - bOpen ||
      b.createdAt.localeCompare(a.createdAt)
    );
  });

  return (
    <section>
      {sorted.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: "2.5rem",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <IconVideo style={{ width: 30, height: 30, color: "var(--text-subtle)", margin: "0 auto 0.75rem auto" }} />
          <h3>No conflict alerts</h3>
          <p className="muted">No violence or altercation detected on camera feeds in your jurisdiction.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {sorted.map((alert) => {
            const sev = SEVERITY_META[alert.severity];
            const statusMeta = getStatusStyle(alert.status);
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => onSelect(alert)}
                className="anomaly-alert-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  textAlign: "left",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.7rem 0.85rem",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: "6px",
                    background: sev.color,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconAlertTriangle style={{ width: 17, height: 17 }} />
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: "0.84rem",
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {alert.explanation ?? "Conflict flagged on camera feed for review"}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.72rem",
                      color: "#64748b",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <strong style={{ color: sev.color }}>{sev.label}</strong>
                    {alert.projectName && <>{` · ${alert.projectName}`}</>}
                    {alert.projectCode && <>{` (${alert.projectCode})`}</>}
                    {` · ${formatDateTime(alert.createdAt)}`}
                  </span>
                </span>

                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.45rem",
                    borderRadius: "999px",
                    background: statusMeta.bg,
                    color: statusMeta.color,
                    textTransform: "uppercase",
                  }}
                >
                  {statusMeta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}