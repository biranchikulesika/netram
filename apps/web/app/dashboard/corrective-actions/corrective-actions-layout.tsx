"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { CorrectiveAction } from "@netram/types";
import { formatDate } from "../../../lib/presentation";
import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";
import { CorrectiveActionCard, getStatusBadge, getSeverityStyle } from "./corrective-action-card";
import { IconSearch, IconList, IconGrid, IconMapPin } from "../../components/icons";

const CorrectiveActionsMap = dynamic(() => import("./corrective-actions-map"), {
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

export interface CorrectiveActionsLayoutProps {
  initialActions: CorrectiveAction[];
  totalActions: number;
  showMap?: boolean;
  showProjectInfo?: boolean;
  searchPlaceholder?: string;
}

type StatusFilter = "ALL" | "PENDING" | "IN_REVIEW" | "OVERDUE" | "ACCEPTED";
type ViewMode = "table" | "cards" | "map";

function matchesFilter(a: CorrectiveAction, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return a.status === "pending" || a.status === "rejected";
  if (filter === "IN_REVIEW") return a.status === "submitted" || a.status === "under_review";
  if (filter === "OVERDUE") return a.status === "overdue" || a.status === "escalated";
  return a.status === "accepted";
}

export function CorrectiveActionsLayout({
  initialActions,
  totalActions: _totalActions,
  showMap = true,
  showProjectInfo = true,
  searchPlaceholder,
}: CorrectiveActionsLayoutProps) {
  const [actionsList, setActionsList] = useState<CorrectiveAction[]>(initialActions);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  React.useEffect(() => {
    setActionsList(initialActions);
  }, [initialActions]);

  // Metrics
  const metrics = useMemo(() => {
    const total = actionsList.length;
    const pending = actionsList.filter((a) => a.status === "pending" || a.status === "rejected").length;
    const inReview = actionsList.filter((a) => a.status === "submitted" || a.status === "under_review").length;
    const overdue = actionsList.filter((a) => a.status === "overdue" || a.status === "escalated").length;
    const accepted = actionsList.filter((a) => a.status === "accepted").length;
    return { total, pending, inReview, overdue, accepted };
  }, [actionsList]);

  // Filtered
  const filtered = useMemo(() => {
    return actionsList.filter((a) => {
      if (!matchesFilter(a, filter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = a.id.toLowerCase().includes(q);
        const matchesFinding = a.findingId.toLowerCase().includes(q);
        const matchesInspection = a.inspectionId.toLowerCase().includes(q);
        const matchesStatus = a.status.toLowerCase().includes(q);
        const matchesProject =
          (a.project?.name.toLowerCase().includes(q) ?? false) ||
          (a.project?.code.toLowerCase().includes(q) ?? false);
        return matchesId || matchesFinding || matchesInspection || matchesStatus || matchesProject;
      }

      return true;
    });
  }, [actionsList, filter, searchQuery]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: metrics.total },
    { key: "PENDING", label: "Pending Compliance", count: metrics.pending },
    { key: "IN_REVIEW", label: "In Review", count: metrics.inReview },
    { key: "OVERDUE", label: "Overdue / Escalated", count: metrics.overdue },
    { key: "ACCEPTED", label: "Accepted / Closed", count: metrics.accepted },
  ];

  const emptyState =
    searchQuery || filter !== "ALL"
      ? "No corrective actions match the selected filter criteria."
      : "No corrective actions recorded.";

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
      {/* Toolbar: Search, Filters & View Toggle (projects pattern) */}
      <div
        className="registry-toolbar"
        style={{ marginBottom: viewMode === "map" ? "0.6rem" : "1.25rem" }}
      >
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder={
                searchPlaceholder ??
                (showProjectInfo
                  ? "Search by action ID, finding ID, ATR code, facility…"
                  : "Search by action ID, finding ID, ATR code…")
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter corrective actions"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Corrective action status filters">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`filter-tab-btn ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
                role="tab"
                aria-selected={filter === tab.key}
              >
                <span>{tab.label}</span>
                {filter === tab.key && <span className="filter-count-badge">{tab.count}</span>}
              </button>
            ))}
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
            {showMap && (
              <button
                type="button"
                className={`view-btn ${viewMode === "map" ? "active" : ""}`}
                onClick={() => setViewMode("map")}
                title="Map"
              >
                <IconMapPin style={{ width: 14, height: 14 }} />
                <span>Map</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View: Table */}
      {viewMode === "table" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Finding Reference</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Statutory Deadline</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2.5rem" }}>
                    {emptyState}
                  </td>
                </tr>
              ) : (
                filtered.map((ca) => {
                  const statusMeta = getStatusBadge(ca.status);
                  const findingMeta = getSeverityStyle(ca.finding?.severity ?? "low");
                  const findingLabel =
                    ca.finding?.categoryName ??
                    (ca.finding ? ca.finding.description : `Finding ${ca.findingId.slice(0, 8)}`);

                  const isOverdue =
                    ca.deadline &&
                    ca.status !== "accepted" &&
                    new Date(ca.deadline) < new Date();

                  return (
                    <tr key={ca.id}>
                      <td>
                        <div>
                          <Link
                            href={`/dashboard/corrective-actions/${ca.id}`}
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              color: "var(--color-navy-brand)",
                              textDecoration: "none",
                            }}
                            title={ca.finding?.description ?? undefined}
                          >
                            {findingLabel}
                          </Link>
                          {showProjectInfo && (
                            <div className="muted" style={{ fontSize: "0.72rem" }}>
                              {ca.project ? `${ca.project.name} (${ca.project.code})` : `Inspection: ${ca.inspectionId.slice(0, 8)}...`}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        {ca.finding ? (
                          <span
                            title={ca.finding.description}
                            style={{ fontSize: "0.72rem", fontWeight: 700, color: findingMeta.color }}
                          >
                            {findingMeta.label}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusMeta.color }}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="muted" style={{ fontSize: "0.8rem" }}>
                        {ca.deadline ? (
                          <span style={{ color: isOverdue ? "#dc2626" : "inherit", fontWeight: isOverdue ? 700 : 400 }}>
                            {formatDate(ca.deadline)}
                            {isOverdue && " (Overdue)"}
                          </span>
                        ) : (
                          "No deadline set"
                        )}
                      </td>

                      <td className="muted" style={{ fontSize: "0.8rem" }}>
                        {formatDate(ca.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View: Cards */}
      {viewMode === "cards" && (
        <div>
          {filtered.length === 0 ? (
            <div className="empty-box" style={{ padding: "3rem 1rem", marginBottom: "2rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                No corrective actions found
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>{emptyState}</div>
            </div>
          ) : (
            <div className="facility-cards-grid">
              {cardColumns.map((column, colIdx) => (
                <div className="facility-cards-column" key={colIdx}>
                  {column.map((ca) => (
                    <CorrectiveActionCard ca={ca} key={ca.id} showProjectInfo={showProjectInfo} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View: Map */}
      {showMap && viewMode === "map" && (
        <div className="map-view-wrapper" style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}>
          <CorrectiveActionsMap actions={filtered} />
        </div>
      )}
    </div>
  );
}
