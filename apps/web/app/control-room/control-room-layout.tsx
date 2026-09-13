"use client";

import React, { useState } from "react";
import type { PublicCctvCamera, AIAnomaly } from "@netram/types";
import { CameraCard } from "./camera-card";
import {
  IconVideo,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
} from "../components/icons";

export interface ControlRoomLayoutProps {
  cameras: PublicCctvCamera[];
  anomalies: AIAnomaly[];
  anomaliesTotal: number;
}

export function ControlRoomLayout({
  cameras = [],
  anomalies = [],
  anomaliesTotal = 0,
}: ControlRoomLayoutProps) {
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);

  return (
    <div
      className={`control-room-container ${alertsCollapsed ? "alerts-collapsed" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: alertsCollapsed ? "1fr" : "1fr 340px",
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
              <span>Show AI Alerts Sidepanel ({anomaliesTotal})</span>
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
        <aside className="control-sidebar">
          <div className="sidebar-title">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>Advisory AI Alerts</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  background: "#e2e8f0",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {anomaliesTotal}
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
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
