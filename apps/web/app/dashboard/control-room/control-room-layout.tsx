"use client";

import React, { useState } from "react";
import type { PublicCctvCamera, AIAnomaly } from "@netram/types";
import { CameraWall } from "./camera-wall";
import { CameraStatusView } from "./camera-status";
import { AlertsScreen } from "./alerts-screen";
import { AIAnomalyModal } from "./ai-anomaly-modal";
import { CameraLiveViewer } from "./camera-live-viewer";
import {
  IconVideo,
  IconAlertTriangle,
  IconBarChart,
  IconSearch,
} from "../../components/icons";

export interface ControlRoomLayoutProps {
  cameras: PublicCctvCamera[];
  anomalies: AIAnomaly[];
  anomaliesTotal: number;
  canTransition?: boolean;
  cameraProjectLinks?: Record<string, string>;
  /** districtId -> district name, for camera context in Status/Feeds. */
  districtNames?: Record<string, string>;
}

type ControlRoomTab = "feeds" | "alerts" | "status";
type StatusFilter = "all" | "online" | "offline";
type FeedColumns = 4 | 3 | 2;

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
  cameraProjectLinks = {},
  districtNames = {},
}: ControlRoomLayoutProps) {
  const [activeTab, setActiveTab] = useState<ControlRoomTab>("feeds");
  const [anomalyList, setAnomalyList] = useState<AIAnomaly[]>(anomalies);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AIAnomaly | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<PublicCctvCamera | null>(null);
  /** Max simultaneous HLS wall sessions (bounded viewership, PART 7). */
  const MAX_WALL_TILES = 9;
  /** Camera ids currently playing HLS wall tiles (explicit user enable, PART 7/8). */
  const [hlsEnabled, setHlsEnabled] = useState<Set<string>>(new Set());
  const [wallCapMessage, setWallCapMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [alertView, setAlertView] = useState<"active" | "resolved">("active");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [feedColumns, setFeedColumns] = useState<FeedColumns>(4);

  /**
   * Bounded concurrent wall viewers (PART 7): each HLS tile is one authorized
   * MediaMTX session, so the wall never opens more than MAX_WALL_TILES of
   * them. Users enable tiles explicitly — online cameras never auto-connect.
   */
  const toggleHls = (cameraId: string): void => {
    setWallCapMessage(null);
    setHlsEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(cameraId)) {
        next.delete(cameraId);
      } else if (next.size >= MAX_WALL_TILES) {
        setWallCapMessage(`Wall mode is limited to ${MAX_WALL_TILES} concurrent streams. Disable a tile to enable another.`);
        return prev;
      } else {
        next.add(cameraId);
      }
      return next;
    });
  };

  const SECTION_TABS: { key: ControlRoomTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "feeds", label: "Live Feeds", icon: <IconVideo style={{ width: 15, height: 15 }} />, count: 0 },
    { key: "alerts", label: "Alerts", icon: <IconAlertTriangle style={{ width: 15, height: 15 }} />, count: 0 },
    { key: "status", label: "Status", icon: <IconBarChart style={{ width: 15, height: 15 }} />, count: 0 },
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
              onChange={(e) => setQuery(e.target.value)}
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

        {/* Feed grid column switcher: only visible on the Live Feeds tab */}
        {activeTab === "feeds" && (
          <div className="view-mode-toggle" aria-label="Feed grid columns">
            {([4, 3, 2] as FeedColumns[]).map((cols) => (
              <button
                key={cols}
                type="button"
                className={`view-btn ${feedColumns === cols ? "active" : ""}`}
                onClick={() => setFeedColumns(cols)}
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
              onClick={() => setAlertView("active")}
              className={`filter-tab-btn ${alertView === "active" ? "active" : ""}`}
            >
              <span>Active</span>
              <span className="filter-count-badge">
                {anomalyList.filter((a) => a.status === "new" || a.status === "reviewed" || a.status === "investigated").length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={alertView === "resolved"}
              onClick={() => setAlertView("resolved")}
              className={`filter-tab-btn ${alertView === "resolved" ? "active" : ""}`}
            >
              <span>Resolved</span>
              <span className="filter-count-badge">
                {anomalyList.filter((a) => a.status === "acted_upon" || a.status === "dismissed").length}
              </span>
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
              onClick={() => setStatusFilter("all")}
              className={`filter-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            >
              <span>All</span>
              <span className="filter-count-badge">{cameras.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "online"}
              onClick={() => setStatusFilter("online")}
              className={`filter-tab-btn ${statusFilter === "online" ? "active" : ""}`}
            >
              <span>Online</span>
              <span className="filter-count-badge">
                {cameras.filter((c) => c.status === "active").length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "offline"}
              onClick={() => setStatusFilter("offline")}
              className={`filter-tab-btn ${statusFilter === "offline" ? "active" : ""}`}
            >
              <span>Offline</span>
              <span className="filter-count-badge">
                {cameras.filter((c) => c.status !== "active").length}
              </span>
            </button>
          </div>
        )}
      </div>

      {wallCapMessage && (
        <p className="muted" role="status" style={{ margin: "0 0 0.75rem 0" }}>
          {wallCapMessage}
        </p>
      )}

      {activeTab === "feeds" ? (
        <CameraWall
          cameras={cameras}
          cameraProjectLinks={cameraProjectLinks}
          query={query}
          columns={feedColumns}
          hlsEnabled={hlsEnabled}
          onToggleHls={toggleHls}
          onOpenCamera={(camera) => setSelectedCamera(camera)}
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
          anomalies={
            anomalyList
              .filter((a) =>
                alertView === "active"
                  ? a.status === "new" || a.status === "reviewed" || a.status === "investigated"
                  : a.status === "acted_upon" || a.status === "dismissed",
              )
          }
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
