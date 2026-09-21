"use client";

import { useMemo, useState } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { IconSearch, IconCamera } from "../components/icons";

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "LIVE", bg: "#dcfce7", color: "#15803d" },
  inactive: { label: "OFFLINE", bg: "#fee2e2", color: "#b91c1c" },
  maintenance: { label: "MAINTENANCE", bg: "#fef3c7", color: "#b45309" },
};

export function formatCameraDuration(iso: string | null | undefined): string {
  if (!iso) return "—";
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

interface CameraStatusViewProps {
  cameras: PublicCctvCamera[];
}

export function CameraStatusView({ cameras }: CameraStatusViewProps) {
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const live = cameras.filter((c) => c.status === "active").length;
    const offline = cameras.filter((c) => c.status === "inactive").length;
    const maintenance = cameras.filter((c) => c.status === "maintenance").length;
    return { live, offline, maintenance, total: cameras.length };
  }, [cameras]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cameras;
    return cameras.filter((c) => c.name.toLowerCase().includes(q));
  }, [cameras, query]);

  return (
    <section>
      <div className="status-grid">
        <div className="stat-widget status-widget status-widget-live">
          <div className="stat-value">{counts.live}</div>
          <div className="stat-label">Live</div>
        </div>
        <div className="stat-widget status-widget status-widget-offline">
          <div className="stat-value">{counts.offline}</div>
          <div className="stat-label">Offline</div>
        </div>
        <div className="stat-widget status-widget status-widget-maint">
          <div className="stat-value">{counts.maintenance}</div>
          <div className="stat-label">Maintenance</div>
        </div>
        <div className="stat-widget status-widget status-widget-total">
          <div className="stat-value">{counts.total}</div>
          <div className="stat-label">Total Cameras</div>
        </div>
      </div>

      <div className="cc-search status-search">
        <IconSearch style={{ width: 14, height: 14 }} />
        <input
          type="search"
          placeholder="Search cameras…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search cameras by name"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <IconCamera style={{ width: 36, height: 36, color: "var(--text-subtle)", margin: "0 auto 0.75rem auto" }} />
          <h3>{query ? "No matching cameras" : "No Cameras Available"}</h3>
          <p className="muted">No CCTV cameras are configured for your authorized jurisdiction.</p>
        </div>
      ) : (
        <div className="status-table-wrap">
          <table className="status-table">
            <thead>
              <tr>
                <th>Camera</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Outage Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cam) => {
                const s = STATUS_STYLES[cam.status] ?? { label: cam.status.toUpperCase(), bg: "#f1f5f9", color: "#475569" };
                const isOffline = cam.status === "inactive" || cam.status === "maintenance";
                return (
                  <tr key={cam.id}>
                    <td className="status-cam-name">{cam.name}</td>
                    <td>
                      <span className="cc-status-pill" style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="status-secondary">{new Date(cam.updatedAt).toLocaleString()}</td>
                    <td className="status-secondary">{isOffline ? formatCameraDuration(cam.updatedAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}