"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Inspection } from "@netram/types";
import { IconSearch, IconList, IconGrid, IconMapPin } from "../../components/icons";
import { getProjectName, getProjectCode, formatDate } from "../../../lib/presentation";
import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";
import { InspectionCard } from "./inspection-card";
import { ScheduleInspectionModal, type ProjectOption } from "./schedule-inspection-modal";

const InspectionsMap = dynamic(() => import("./inspections-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "calc(100vh - 205px)",
        minHeight: "440px",
        background: "var(--bg-subtle)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      Loading map…
    </div>
  ),
});

interface InspectionsViewProps {
  initialInspections: Inspection[];
  total: number;
  availableProjects?: ProjectOption[];
  canCreate?: boolean;
}

type ViewMode = "table" | "cards" | "map";

export function InspectionsView({
  initialInspections,
  total: initialTotal,
  availableProjects = [],
  canCreate = false,
}: InspectionsViewProps) {
  const [inspections, setInspections] = useState<Inspection[]>(initialInspections);
  const [total, setTotal] = useState(initialTotal);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "REVIEW" | "SCHEDULED" | "COMPLETED">("ALL");
  const [search, setSearch] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const handleCreated = (newInspection: Inspection) => {
    setInspections((prev) => [newInspection, ...prev]);
    setTotal((prev) => prev + 1);
  };

  const activeCount = useMemo(
    () =>
      inspections.filter(
        (i) => i.status === "in_progress" || i.status === "evidence_collection",
      ).length,
    [inspections],
  );

  const reviewCount = useMemo(
    () =>
      inspections.filter(
        (i) =>
          i.status === "submitted" ||
          i.status === "under_review" ||
          i.status === "findings" ||
          i.status === "corrective_actions" ||
          i.status === "verification",
      ).length,
    [inspections],
  );

  const scheduledCount = useMemo(
    () =>
      inspections.filter(
        (i) => i.status === "scheduled" || i.status === "assigned",
      ).length,
    [inspections],
  );

  const completedCount = useMemo(
    () => inspections.filter((i) => i.status === "closed").length,
    [inspections],
  );

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
      // Status filter
      if (filter === "ACTIVE") {
        if (i.status !== "in_progress" && i.status !== "evidence_collection") return false;
      } else if (filter === "REVIEW") {
        if (
          i.status !== "submitted" &&
          i.status !== "under_review" &&
          i.status !== "findings" &&
          i.status !== "corrective_actions" &&
          i.status !== "verification"
        )
          return false;
      } else if (filter === "SCHEDULED") {
        if (i.status !== "scheduled" && i.status !== "assigned") return false;
      } else if (filter === "COMPLETED") {
        if (i.status !== "closed") return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const code = i.projectCode?.toLowerCase() ?? "";
        const name = i.projectName?.toLowerCase() ?? "";
        const trigger = i.trigger?.toLowerCase() ?? "";
        const id = i.id?.toLowerCase() ?? "";
        return code.includes(q) || name.includes(q) || trigger.includes(q) || id.includes(q);
      }

      return true;
    });
  }, [inspections, filter, search]);

  const isXl = useMediaQuery("(min-width: 1401px)");
  const isLg = useMediaQuery("(min-width: 1101px) and (max-width: 1400px)");
  const isMd = useMediaQuery("(min-width: 641px) and (max-width: 1100px)");
  const columnCount = isXl ? 4 : isLg ? 3 : isMd ? 2 : 1;
  const cardColumns = useMemo(
    () => distributeIntoColumns(filtered, columnCount),
    [filtered, columnCount],
  );

  return (
    <div>
      {/* Toolbar */}
      <div
        className="registry-toolbar"
        style={{ marginBottom: viewMode === "map" ? "0.6rem" : "1.25rem" }}
      >
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by project code, facility name, or trigger…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter inspections"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Inspection status filters">
            <button
              type="button"
              className={`filter-tab-btn ${filter === "ALL" ? "active" : ""}`}
              onClick={() => setFilter("ALL")}
              role="tab"
              aria-selected={filter === "ALL"}
            >
              <span>All</span>
              {filter === "ALL" && <span className="filter-count-badge">{total}</span>}
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "ACTIVE" ? "active" : ""}`}
              onClick={() => setFilter("ACTIVE")}
              role="tab"
              aria-selected={filter === "ACTIVE"}
            >
              <span>Active Attention</span>
              {filter === "ACTIVE" && <span className="filter-count-badge">{activeCount}</span>}
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "REVIEW" ? "active" : ""}`}
              onClick={() => setFilter("REVIEW")}
              role="tab"
              aria-selected={filter === "REVIEW"}
            >
              <span>Review Pending</span>
              {filter === "REVIEW" && <span className="filter-count-badge">{reviewCount}</span>}
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "SCHEDULED" ? "active" : ""}`}
              onClick={() => setFilter("SCHEDULED")}
              role="tab"
              aria-selected={filter === "SCHEDULED"}
            >
              <span>Scheduled</span>
              {filter === "SCHEDULED" && <span className="filter-count-badge">{scheduledCount}</span>}
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "COMPLETED" ? "active" : ""}`}
              onClick={() => setFilter("COMPLETED")}
              role="tab"
              aria-selected={filter === "COMPLETED"}
            >
              <span>Completed</span>
              {filter === "COMPLETED" && <span className="filter-count-badge">{completedCount}</span>}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="view-mode-toggle" aria-label="Toggle view mode">
            <button
              type="button"
              className={`view-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <IconList style={{ width: 14, height: 14 }} />
              <span>Table</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Cards View"
            >
              <IconGrid style={{ width: 14, height: 14 }} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "map" ? "active" : ""}`}
              onClick={() => setViewMode("map")}
              title="Geographic Map View"
            >
              <IconMapPin style={{ width: 14, height: 14 }} />
              <span>Map</span>
            </button>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              style={{
                background: "var(--color-navy-brand, #1e3a8a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
              }}
            >
              <span>+ Schedule Inspection</span>
            </button>
          )}
        </div>
      </div>

      {/* Inspections Table */}
      {viewMode === "table" && (
        <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "130px" }}>Type</th>
              <th>Facility / Project</th>
              <th>Inspection ID</th>
              <th>Trigger</th>
              <th style={{ width: "140px" }}>Status</th>
              <th>Assignment</th>
              <th>Timing</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    {search || filter !== "ALL"
                      ? "No inspections match the selected filter criteria."
                      : "No inspections currently recorded."}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const isSurprise = i.type === "surprise";
                const dateStr = i.startedAt
                  ? `Started: ${formatDate(i.startedAt)}`
                  : i.scheduledStart
                    ? `Sched: ${formatDate(i.scheduledStart)}`
                    : "—";

                const assignedCount = Array.isArray(i.assignedUserIds) ? i.assignedUserIds.length : 0;

                return (
                  <tr key={i.id}>
                    <td className="table-row-anchor-cell" style={{ cursor: "pointer" }}>
                      <Link
                        href={`/dashboard/inspections/${i.id}`}
                        className="table-row-anchor-link"
                        aria-label={`Open inspection ${i.id}`}
                      />
                      <span style={{ fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", color: isSurprise ? "#b45309" : "var(--text-primary)" }}>
                        {i.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}>
                        {i.projectName || getProjectName(i.projectId)}
                      </div>
                      <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-subtle)", marginTop: "2px" }}>
                        {i.projectCode || getProjectCode(i.projectId)}
                      </div>
                    </td>
                    <td title={i.id} style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-subtle)" }}>
                      {i.id.slice(0, 12)}
                    </td>
                    <td>
                      <span className="trigger-text">{i.trigger.replace(/_/g, " ")}</span>
                    </td>
                    <td>
                      <span className={`status status-${i.status}`}>
                        {i.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </td>
                    <td>
                      {assignedCount > 0 ? (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>
                          {assignedCount} {assignedCount === 1 ? "Officer" : "Officers"}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)", fontStyle: "italic" }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>
                      {dateStr}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>Showing {filtered.length} of {total} inspections</span>
        </div>
        </div>
      )}

      {/* Inspections Cards */}
      {viewMode === "cards" && (
        <div>
          {filtered.length === 0 ? (
            <div className="empty-box" style={{ padding: "3rem 1rem", marginBottom: "2rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                No inspections found
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                {search || filter !== "ALL"
                  ? "No inspections match the selected filter criteria."
                  : "No inspections currently recorded."}
              </div>
            </div>
          ) : (
            <div className="facility-cards-grid">
              {cardColumns.map((column, colIdx) => (
                <div className="facility-cards-column" key={colIdx}>
                  {column.map((i) => (
                    <InspectionCard inspection={i} key={i.id} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inspections Map */}
      {viewMode === "map" && (
        <div className="map-view-wrapper" style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}>
          <InspectionsMap inspections={filtered} />
        </div>
      )}

      {scheduleModalOpen && (
        <ScheduleInspectionModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          onSuccess={handleCreated}
          availableProjects={availableProjects}
        />
      )}
    </div>
  );
}
