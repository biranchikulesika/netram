"use client";

import { useMemo, useState } from "react";
import type { AIAnomaly, AnomalySeverity, AnomalyStatus, PublicCctvCamera } from "@netram/types";
import { IconAlertTriangle, IconVideo, IconCamera } from "../components/icons";
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

/** Unified alert item: either an AI anomaly or a camera-outage alert. */
export type UnifiedAlert =
  | { kind: "anomaly"; id: string; anomaly: AIAnomaly }
  | {
      kind: "camera-offline";
      id: string;
      camera: PublicCctvCamera;
      /** Duration the camera has been down, preformatted by the parent. */
      downFor: string;
      district?: string;
    };

interface AlertsScreenProps {
  anomalies: AIAnomaly[];
  cameras: PublicCctvCamera[];
  /** districtId -> district name for camera context. */
  districtNames?: Record<string, string>;
  onSelectAnomaly: (anomaly: AIAnomaly) => void;
  /** Which slice is being displayed, for accurate empty-state copy. */
  view?: "active" | "resolved";
  /** Active search text (filtering already applied by the parent). */
  searchQuery?: string;
}

/**
 * Unified alert list: AI anomaly alerts (ranked by severity, newest first) and
 * camera offline alerts (longest outage first). Each row opens a basic detail
 * popup modal — the anomaly review modal for AI alerts, a simple info modal
 * for camera outages.
 */
export function AlertsScreen({
  anomalies,
  cameras,
  districtNames = {},
  onSelectAnomaly,
  view = "active",
  searchQuery = "",
}: AlertsScreenProps) {
  const [offlineCamera, setOfflineCamera] = useState<PublicCctvCamera | null>(null);

  const items = useMemo<UnifiedAlert[]>(() => {
    const anomalyAlerts: UnifiedAlert[] = anomalies.map((a) => ({
      kind: "anomaly" as const,
      id: `anomaly:${a.id}`,
      anomaly: a,
    }));

    const offlineAlerts: UnifiedAlert[] = cameras
      .filter((c) => c.status !== "active")
      .sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      )
      .map((cam) => ({
        kind: "camera-offline" as const,
        id: `camera-offline:${cam.id}`,
        camera: cam,
        downFor: formatDownDuration(cam.updatedAt),
        district: cam.districtId ? (districtNames[cam.districtId] ?? undefined) : undefined,
      }));

    const both = [...anomalyAlerts, ...offlineAlerts];

    if (view === "resolved") {
      // Only AI anomalies have a resolution lifecycle; resolved view shows those.
      return both.filter((item) => item.kind === "anomaly" && !OPEN_STATUSES.includes(item.anomaly.status));
    }
    return both;
  }, [anomalies, cameras, districtNames, view]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      if (item.kind === "anomaly") {
        const a = item.anomaly;
        return (
          (a.explanation ?? "").toLowerCase().includes(q) ||
          (a.projectName ?? "").toLowerCase().includes(q) ||
          (a.projectCode ?? "").toLowerCase().includes(q)
        );
      }
      const c = item.camera;
      return (
        c.name.toLowerCase().includes(q) ||
        (item.district ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  return (
    <section>
      {visible.length === 0 ? (
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
          <h3>
            {searchQuery
              ? "No matching alerts"
              : view === "resolved"
                ? "No resolved alerts"
                : "No active alerts"}
          </h3>
          <p className="muted">
            {searchQuery
              ? `No ${view === "resolved" ? "resolved " : ""}alerts match "${searchQuery}".`
              : view === "resolved"
                ? "Alerts dismissed or acted upon by authority will appear here."
                : "No anomaly signals or offline cameras in your jurisdiction."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {visible.map((item) => {
            if (item.kind === "anomaly") {
              const alert = item.anomaly;
              const sev = SEVERITY_META[alert.severity];
              const statusMeta = getStatusStyle(alert.status);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectAnomaly(alert)}
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
            }

            // Camera offline alert row
            const cam = item.camera;
            const isMaintenance = cam.status === "maintenance";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setOfflineCamera(cam)}
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
                    background: isMaintenance ? "#ca8a04" : "#b91c1c",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconCamera style={{ width: 17, height: 17 }} />
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
                    {isMaintenance ? "Camera under maintenance" : "Camera offline"}
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
                    <strong style={{ color: isMaintenance ? "#ca8a04" : "#b91c1c" }}>
                      {isMaintenance ? "MAINTENANCE" : "OFFLINE"}
                    </strong>
                    {` · ${cam.name}`}
                    {item.district && <>{` · ${item.district}`}</>}
                    {` · down ${item.downFor}`}
                  </span>
                </span>

                <span
                  style={{
                    flexShrink: 0,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.45rem",
                    borderRadius: "999px",
                    background: isMaintenance ? "#fef3c7" : "#fee2e2",
                    color: isMaintenance ? "#b45309" : "#b91c1c",
                    textTransform: "uppercase",
                  }}
                >
                  {isMaintenance ? "MAINTENANCE" : "OFFLINE"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Basic popup modal for camera offline alerts */}
      {offlineCamera && (
        <div
          className="lightbox-backdrop"
          style={{ zIndex: 100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-camera-alert-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOfflineCamera(null);
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              <h3
                id="modal-camera-alert-title"
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--color-navy-brand)",
                }}
              >
                Camera {offlineCamera.status === "maintenance" ? "Under Maintenance" : "Offline"}
              </h3>
              <button
                type="button"
                onClick={() => setOfflineCamera(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.4rem",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "0.2rem 0.5rem",
                  lineHeight: 1,
                }}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: "0.65rem",
                fontSize: "0.84rem",
                color: "#334155",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
                  Camera
                </span>
                <strong>{offlineCamera.name}</strong>
              </div>
              <div>
                <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
                  Status
                </span>
                {offlineCamera.status === "maintenance"
                  ? "Under maintenance — feed temporarily unavailable."
                  : "The camera is offline and its feed is unavailable."}
              </div>
              <div>
                <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>
                  Down since
                </span>
                {formatDateTime(offlineCamera.updatedAt)} ({formatDownDuration(offlineCamera.updatedAt)})
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOfflineCamera(null)}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function formatDownDuration(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "under 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
