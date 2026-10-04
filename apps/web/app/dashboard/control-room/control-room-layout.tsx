"use client";

import React, { useState } from "react";
import type { PublicCctvCamera, AIAnomaly } from "@netram/types";
import { useUrlState } from "../../../lib/url-state";
import { CameraWall } from "./camera-wall";
import { CameraStatusView } from "./camera-status";
import { AlertsScreen } from "./alerts-screen";
import { AIAnomalyModal } from "./ai-anomaly-modal";
import { CameraLiveViewer } from "./camera-live-viewer";
import { IconVideo, IconAlertTriangle, IconBarChart, IconSearch } from "../../components/icons";

export interface ControlRoomLayoutProps {
  cameras: PublicCctvCamera[];
  anomalies: AIAnomaly[];
  anomaliesTotal: number;
  canTransition?: boolean;
  initialTab?: ControlRoomTab;
  initialColumns?: FeedColumns;
  initialQuery?: string;
  initialAlertView?: "active" | "resolved";
  initialStatusFilter?: StatusFilter;
  /** districtId -> district name, for camera context in Status/Feeds. */
  districtNames?: Record<string, string>;
}

export type ControlRoomTab = "feeds" | "alerts" | "status";
export type StatusFilter = "all" | "online" | "offline";
export type FeedColumns = 4 | 3 | 2;

const SEARCH_PLACEHOLDER: Record<ControlRoomTab, string> = {
  feeds: "Search cameras by facility, place or name…",
  alerts: "Search alerts by description, project or code…",
  status: "Search cameras by facility, place, name or district…",
};

export function ControlRoomLayout({
  cameras = [],
  anomalies = [],
  anomaliesTotal: _anomaliesTotal = 0,
  canTransition = false,
  initialTab = "feeds",
  initialColumns = 3,
  initialQuery = "",
  initialAlertView = "active",
  initialStatusFilter = "all",
  districtNames = {},
}: ControlRoomLayoutProps) {
  const setUrlState = useUrlState();

  const applyTab = (next: ControlRoomTab) => {
    setActiveTab(next);
    setUrlState({ tab: next === "feeds" ? null : next });
  };
  const applyColumns = (next: FeedColumns) => {
    setFeedColumns(next);
    setUrlState({ cols: next === 3 ? null : String(next) });
  };
  const applyAlertView = (next: "active" | "resolved") => {
    setAlertView(next);
    setUrlState({ alerts: next === "active" ? null : next });
  };
  const applyStatus = (next: StatusFilter) => {
    setStatusFilter(next);
    setUrlState({ status: next === "all" ? null : next });
  };

  const [activeTab, setActiveTab] = useState<ControlRoomTab>(initialTab);
  const [anomalyList, setAnomalyList] = useState<AIAnomaly[]>(anomalies);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AIAnomaly | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<PublicCctvCamera | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [alertView, setAlertView] = useState<"active" | "resolved">(initialAlertView);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [feedColumns, setFeedColumns] = useState<FeedColumns>(initialColumns);

  const activeAlertsCount = anomalyList.filter(
    (a) => a.status === "new" || a.status === "reviewed" || a.status === "investigated",
  ).length;

  const SECTION_TABS: {
    key: ControlRoomTab;
    label: string;
    icon: React.ReactNode;
    count: number;
  }[] = [
    {
      key: "feeds",
      label: "Live Feeds",
      icon: <IconVideo style={{ width: 15, height: 15 }} />,
      count: cameras.length,
    },
    {
      key: "alerts",
      label: "Alerts",
      icon: <IconAlertTriangle style={{ width: 15, height: 15 }} />,
      count: activeAlertsCount,
    },
    {
      key: "status",
      label: "Status",
      icon: <IconBarChart style={{ width: 15, height: 15 }} />,
      count: cameras.length,
    },
  ];

  return (
    <div className="control-room-page">
      {/* Search + section filter: Live Feeds / Alerts / Status.
          The search bar always searches within the active tab. */}
      <div className="control-room-header">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder={SEARCH_PLACEHOLDER[activeTab]}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setUrlState({ q: e.target.value.trim() || null });
              }}
              className="search-input-with-icon"
              aria-label={`Filter ${activeTab === "feeds" ? "cameras" : activeTab === "alerts" ? "alerts" : "camera status"}`}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Control room sections">
            {SECTION_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => applyTab(t.key)}
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

        {/* Feed grid column switcher: only visible on the Live Feeds tab */}
        {activeTab === "feeds" && (
          <div className="view-mode-toggle" aria-label="Feed grid columns">
            {([4, 3, 2] as FeedColumns[]).map((cols) => (
              <button
                key={cols}
                type="button"
                className={`view-btn ${feedColumns === cols ? "active" : ""}`}
                onClick={() => applyColumns(cols)}
                title={`${cols} column view`}
              >
                <span>{cols}</span>
              </button>
            ))}
          </div>
        )}

        {/* Alert status filter: only visible on the Alerts tab, right-aligned on the same row */}
        {activeTab === "alerts" && (
          <div className="filter-tabs" role="tablist" aria-label="Alert status filter">
            <button
              type="button"
              role="tab"
              aria-selected={alertView === "active"}
              onClick={() => applyAlertView("active")}
              className={`filter-tab-btn ${alertView === "active" ? "active" : ""}`}
            >
              <span>Active</span>
              {alertView === "active" && (
                <span className="filter-count-badge">
                  {
                    anomalyList.filter(
                      (a) =>
                        a.status === "new" ||
                        a.status === "reviewed" ||
                        a.status === "investigated",
                    ).length
                  }
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={alertView === "resolved"}
              onClick={() => applyAlertView("resolved")}
              className={`filter-tab-btn ${alertView === "resolved" ? "active" : ""}`}
            >
              <span>Resolved</span>
              {alertView === "resolved" && (
                <span className="filter-count-badge">
                  {
                    anomalyList.filter((a) => a.status === "acted_upon" || a.status === "dismissed")
                      .length
                  }
                </span>
              )}
            </button>
          </div>
        )}

        {/* Camera status filter: same design as the Alerts Active/Resolved filter */}
        {activeTab === "status" && (
          <div className="filter-tabs" role="tablist" aria-label="Camera status filter">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              onClick={() => applyStatus("all")}
              className={`filter-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            >
              <span>All</span>
              {statusFilter === "all" && (
                <span className="filter-count-badge">{cameras.length}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "online"}
              onClick={() => applyStatus("online")}
              className={`filter-tab-btn ${statusFilter === "online" ? "active" : ""}`}
            >
              <span>Online</span>
              {statusFilter === "online" && (
                <span className="filter-count-badge">
                  {cameras.filter((c) => c.status === "active").length}
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "offline"}
              onClick={() => applyStatus("offline")}
              className={`filter-tab-btn ${statusFilter === "offline" ? "active" : ""}`}
            >
              <span>Offline</span>
              {statusFilter === "offline" && (
                <span className="filter-count-badge">
                  {cameras.filter((c) => c.status !== "active").length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {activeTab === "feeds" ? (
        <CameraWall
          cameras={cameras}
          query={query}
          columns={feedColumns}
          onOpenCamera={(camera) => setSelectedCamera(camera)}
          suspended={selectedCamera !== null}
        />
      ) : activeTab === "status" ? (
        <CameraStatusView
          cameras={cameras}
          districtNames={districtNames}
          filter={statusFilter}
          query={query}
        />
      ) : (
        <AlertsScreen
          anomalies={anomalyList.filter((a) =>
            alertView === "active"
              ? a.status === "new" || a.status === "reviewed" || a.status === "investigated"
              : a.status === "acted_upon" || a.status === "dismissed",
          )}
          cameras={cameras}
          districtNames={districtNames}
          view={alertView}
          searchQuery={query}
          onSelectAnomaly={(a) => setSelectedAnomaly(a)}
        />
      )}

      {/* Camera detail / live viewer (WebRTC session lifecycle owned here) */}
      {selectedCamera && (
        <CameraLiveViewer camera={selectedCamera} onClose={() => setSelectedCamera(null)} />
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
