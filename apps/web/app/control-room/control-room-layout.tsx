"use client";

import React, { useState } from "react";
import type { PublicCctvCamera, AIAnomaly } from "@netram/types";
import { CameraWall } from "./camera-wall";
import { CameraStatusView } from "./camera-status";
import { AIAlertsScreen } from "./ai-alerts-screen";
import { AIAnomalyModal } from "./ai-anomaly-modal";
import {
  IconVideo,
  IconAlertTriangle,
  IconBarChart,
  IconSearch,
} from "../components/icons";

export interface ControlRoomLayoutProps {
  cameras: PublicCctvCamera[];
  anomalies: AIAnomaly[];
  anomaliesTotal: number;
  canTransition?: boolean;
  cameraProjectLinks?: Record<string, string>;
}

type ControlRoomTab = "feeds" | "alerts" | "status";

export function ControlRoomLayout({
  cameras = [],
  anomalies = [],
  anomaliesTotal: _anomaliesTotal = 0,
  canTransition = false,
  cameraProjectLinks = {},
}: ControlRoomLayoutProps) {
  const [activeTab, setActiveTab] = useState<ControlRoomTab>("feeds");
  const [anomalyList, setAnomalyList] = useState<AIAnomaly[]>(anomalies);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AIAnomaly | null>(null);
  const [query, setQuery] = useState("");

  const SECTION_TABS: { key: ControlRoomTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "feeds", label: "Live Feeds", icon: <IconVideo style={{ width: 15, height: 15 }} />, count: cameras.length },
    { key: "alerts", label: "AI Alerts", icon: <IconAlertTriangle style={{ width: 15, height: 15 }} />, count: anomalyList.length },
    { key: "status", label: "Status", icon: <IconBarChart style={{ width: 15, height: 15 }} />, count: 0 },
  ];

  return (
    <div className="control-room-page">
      {/* Search + section filter: Live Feeds / AI Alerts / Status */}
      <div className="control-room-header">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search cameras…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter cameras"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Control room sections">
            {SECTION_TABS.map((t) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={`filter-tab-btn ${activeTab === t.key ? "active" : ""}`}
              >
                {t.icon}
                <span>{t.label}</span>
                {activeTab === t.key && t.count > 0 && (
                  <span className="filter-count-badge">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "feeds" ? (
        <CameraWall
          cameras={cameras}
          cameraProjectLinks={cameraProjectLinks}
          query={query}
        />
      ) : activeTab === "status" ? (
        <CameraStatusView cameras={cameras} />
      ) : (
        <AIAlertsScreen
          anomalies={anomalyList}
          onSelect={(a) => setSelectedAnomaly(a)}
        />
      )}

      {/* Review & Transition Modal (shared across tabs) */}
      <AIAnomalyModal
        anomaly={selectedAnomaly}
        isOpen={!!selectedAnomaly}
        canTransition={canTransition}
        onClose={() => setSelectedAnomaly(null)}
        onSuccess={(updated) => {
          setAnomalyList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }}
      />
    </div>
  );
}