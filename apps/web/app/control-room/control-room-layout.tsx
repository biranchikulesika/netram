"use client";

<<<<<<< HEAD
import React, { useState } from "react";
import type { PublicCctvCamera, AIAnomaly } from "@netram/types";
=======
import React, { useState, useMemo } from "react";
import type { PublicCctvCamera, AIAnomaly, AnomalyStatus } from "@netram/types";
>>>>>>> origin/production
import { CameraCard } from "./camera-card";
import {
  IconVideo,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
<<<<<<< HEAD
} from "../components/icons";
=======
  IconShieldCheck,
} from "../components/icons";
import { AIAnomalyModal } from "./ai-anomaly-modal";
>>>>>>> origin/production

export interface ControlRoomLayoutProps {
  cameras: PublicCctvCamera[];
  anomalies: AIAnomaly[];
  anomaliesTotal: number;
<<<<<<< HEAD
=======
  canTransition?: boolean;
}

function getStatusStyle(status: AnomalyStatus): { bg: string; color: string; label: string } {
  switch (status) {
    case "new":
      return { bg: "#e0f2fe", color: "#0369a1", label: "NEW" };
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
>>>>>>> origin/production
}

export function ControlRoomLayout({
  cameras = [],
  anomalies = [],
<<<<<<< HEAD
  anomaliesTotal = 0,
}: ControlRoomLayoutProps) {
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
=======
  anomaliesTotal: _anomaliesTotal = 0,
  canTransition = false,
}: ControlRoomLayoutProps) {
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [anomalyList, setAnomalyList] = useState<AIAnomaly[]>(anomalies);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AIAnomaly | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTION_REQUIRED" | "RESOLVED">("ALL");

  const actionRequiredCount = useMemo(
    () =>
      anomalyList.filter(
        (a) => a.status === "new" || a.status === "reviewed" || a.status === "investigated",
      ).length,
    [anomalyList],
  );

  const resolvedCount = useMemo(
    () => anomalyList.filter((a) => a.status === "dismissed" || a.status === "acted_upon").length,
    [anomalyList],
  );

  const filteredAnomalies = useMemo(() => {
    if (filter === "ACTION_REQUIRED") {
      return anomalyList.filter(
        (a) => a.status === "new" || a.status === "reviewed" || a.status === "investigated",
      );
    }
    if (filter === "RESOLVED") {
      return anomalyList.filter(
        (a) => a.status === "dismissed" || a.status === "acted_upon",
      );
    }
    return anomalyList;
  }, [anomalyList, filter]);
>>>>>>> origin/production

  return (
    <div
      className={`control-room-container ${alertsCollapsed ? "alerts-collapsed" : ""}`}
      style={{
        display: "grid",
<<<<<<< HEAD
        gridTemplateColumns: alertsCollapsed ? "1fr" : "1fr 340px",
=======
        gridTemplateColumns: alertsCollapsed ? "1fr" : "1fr 360px",
>>>>>>> origin/production
        gap: "1.5rem",
        alignItems: "start",
        transition: "grid-template-columns 0.2s ease",
      }}
    >
      {/* CCTV Camera Grid Section */}
      <section style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--color-navy-brand)",
              }}
            >
              Surveillance Feeds ({cameras.length} Active)
            </span>
          </div>

          {/* Toggle Alert Sidepanel when collapsed */}
          {alertsCollapsed && (
            <button
              type="button"
              onClick={() => setAlertsCollapsed(false)}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.78rem",
                padding: "0.35rem 0.75rem",
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                color: "#c2410c",
                fontWeight: 600,
              }}
              aria-label="Show AI alerts sidepanel"
            >
              <IconAlertTriangle style={{ width: 14, height: 14 }} />
<<<<<<< HEAD
              <span>Show AI Alerts Sidepanel ({anomaliesTotal})</span>
=======
              <span>Show AI Alerts ({actionRequiredCount} Actionable)</span>
>>>>>>> origin/production
              <IconChevronLeft style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        {cameras.length === 0 ? (
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
            <IconVideo style={{ width: 36, height: 36, color: "var(--text-subtle)", margin: "0 auto 0.75rem auto" }} />
            <h3>No Cameras Available</h3>
            <p className="muted">
              No CCTV cameras are configured for your authorized jurisdiction.
            </p>
          </div>
        ) : (
          <div className="camera-grid">
            {cameras.map((cam) => (
              <CameraCard key={cam.id} camera={cam} />
            ))}
          </div>
        )}
      </section>

      {/* Advisory AI Alerts Collapsible Sidepanel (§7, §36) */}
      {!alertsCollapsed && (
<<<<<<< HEAD
        <aside className="control-sidebar">
          <div className="sidebar-title">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>Advisory AI Alerts</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  background: "#e2e8f0",
                  padding: "0.15rem 0.5rem",
=======
        <aside className="control-sidebar" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem" }}>
          <div className="sidebar-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <IconShieldCheck style={{ width: 16, height: 16, color: "var(--color-navy-brand)" }} />
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--color-navy-brand)" }}>
                Advisory AI Alerts
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  background: "#e2e8f0",
                  padding: "0.15rem 0.45rem",
>>>>>>> origin/production
                  borderRadius: "4px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
<<<<<<< HEAD
                {anomaliesTotal}
=======
                {anomalyList.length}
>>>>>>> origin/production
              </span>
            </div>

            {/* Collapse Sidepanel Button */}
            <button
              type="button"
              onClick={() => setAlertsCollapsed(true)}
              className="btn-secondary"
              style={{
                fontSize: "0.72rem",
                padding: "0.2rem 0.45rem",
                border: "1px solid var(--color-border-subtle)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              title="Collapse AI alerts sidepanel"
              aria-label="Collapse AI alerts sidepanel"
            >
              <span>Hide</span>
              <IconChevronRight style={{ width: 13, height: 13 }} />
            </button>
          </div>

<<<<<<< HEAD
          <div className="anomaly-alert-list">
            {anomalies.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
                No active anomalies detected in your jurisdiction.
              </p>
            ) : (
              anomalies.map((alert) => (
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
                    {alert.projectName && <span> &bull; {alert.projectName}</span>}
                  </div>
                </div>
              ))
=======
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.85rem" }}>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              style={{
                flex: 1,
                fontSize: "0.72rem",
                padding: "0.3rem 0.4rem",
                borderRadius: "4px",
                border: filter === "ALL" ? "1px solid var(--color-navy-brand)" : "1px solid #e2e8f0",
                background: filter === "ALL" ? "var(--color-navy-brand)" : "#f8fafc",
                color: filter === "ALL" ? "#ffffff" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              All ({anomalyList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("ACTION_REQUIRED")}
              style={{
                flex: 1,
                fontSize: "0.72rem",
                padding: "0.3rem 0.4rem",
                borderRadius: "4px",
                border: filter === "ACTION_REQUIRED" ? "1px solid #c2410c" : "1px solid #e2e8f0",
                background: filter === "ACTION_REQUIRED" ? "#fff7ed" : "#f8fafc",
                color: filter === "ACTION_REQUIRED" ? "#c2410c" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Action ({actionRequiredCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("RESOLVED")}
              style={{
                flex: 1,
                fontSize: "0.72rem",
                padding: "0.3rem 0.4rem",
                borderRadius: "4px",
                border: filter === "RESOLVED" ? "1px solid #16a34a" : "1px solid #e2e8f0",
                background: filter === "RESOLVED" ? "#f0fdf4" : "#f8fafc",
                color: filter === "RESOLVED" ? "#16a34a" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          {/* Anomaly list */}
          <div className="anomaly-alert-list">
            {filteredAnomalies.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" }}>
                No anomalies matching this filter.
              </p>
            ) : (
              filteredAnomalies.map((alert) => {
                const statusMeta = getStatusStyle(alert.status);
                const canAct = canTransition && alert.status !== "dismissed" && alert.status !== "acted_upon";

                return (
                  <div
                    key={alert.id}
                    className="anomaly-alert-item"
                    style={{
                      borderLeft: `3px solid ${statusMeta.color}`,
                      transition: "box-shadow 0.15s ease",
                    }}
                  >
                    <div className="anomaly-alert-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span className={`severity-pill ${alert.severity}`}>{alert.severity}</span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "0.1rem 0.35rem",
                            borderRadius: "3px",
                            background: statusMeta.bg,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "var(--font-mono)" }}>
                        {Math.round(alert.confidence * 100)}% conf
                      </span>
                    </div>

                    <p className="anomaly-explanation" style={{ margin: "0.35rem 0" }}>
                      {alert.explanation ?? "Anomaly flagged for review"}
                    </p>

                    <div className="anomaly-meta" style={{ fontSize: "0.72rem", color: "#64748b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>
                        {alert.type.replace(/_/g, " ")}
                        {alert.projectName && ` · ${alert.projectName}`}
                      </span>
                    </div>

                    {/* Action button */}
                    <button
                      type="button"
                      onClick={() => setSelectedAnomaly(alert)}
                      className="btn-secondary"
                      style={{
                        width: "100%",
                        marginTop: "0.55rem",
                        padding: "0.3rem 0.5rem",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.3rem",
                        background: canAct ? "#f0f9ff" : "#f8fafc",
                        borderColor: canAct ? "#bae6fd" : "#e2e8f0",
                        color: canAct ? "#0369a1" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      <span>
                        {canAct ? "Review & Action →" : "View Details"}
                      </span>
                    </button>
                  </div>
                );
              })
>>>>>>> origin/production
            )}
          </div>
        </aside>
      )}
<<<<<<< HEAD
=======

      {/* Review & Transition Modal */}
      <AIAnomalyModal
        anomaly={selectedAnomaly}
        isOpen={!!selectedAnomaly}
        canTransition={canTransition}
        onClose={() => setSelectedAnomaly(null)}
        onSuccess={(updated) => {
          setAnomalyList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }}
      />
>>>>>>> origin/production
    </div>
  );
}
