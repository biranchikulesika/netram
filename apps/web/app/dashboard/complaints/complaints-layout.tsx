"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Complaint } from "@netram/types";
import { formatDate } from "../../../lib/presentation";
import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";
import { ComplaintCard, getComplaintStatusBadge } from "./complaint-card";
import {
  IconSearch,
  IconList,
  IconGrid,
  IconMapPin,
} from "../../components/icons";
import { PaginationBar, useClientPagination } from "../../components/pagination-bar";

const ComplaintsMap = dynamic(() => import("./complaints-map"), {
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

export interface ComplaintsLayoutProps {
  initialComplaints: Complaint[];
  totalComplaints: number;
  showMap?: boolean;
  showProjectInfo?: boolean;
  searchPlaceholder?: string;
}

type StatusFilter = "ALL" | "ACTION_REQUIRED" | "ESCALATED" | "RESOLVED";
type ViewMode = "table" | "cards" | "map";

function matchesFilter(c: Complaint, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "ACTION_REQUIRED") return c.status === "received" || c.status === "under_review";
  if (filter === "ESCALATED") return c.status === "escalated";
  return c.status === "resolved" || c.status === "closed";
}

function matchesSearch(c: Complaint, q: string): boolean {
  return (
    c.trackingCode.toLowerCase().includes(q) ||
    c.projectCode.toLowerCase().includes(q) ||
    c.projectName.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    (c.complainantName?.toLowerCase().includes(q) ?? false)
  );
}

export function ComplaintsLayout({
  initialComplaints,
  showMap = true,
  showProjectInfo = true,
  searchPlaceholder,
}: ComplaintsLayoutProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Metrics
  const metrics = useMemo(() => {
    const total = initialComplaints.length;
    const actionRequired = initialComplaints.filter(
      (c) => c.status === "received" || c.status === "under_review",
    ).length;
    const escalated = initialComplaints.filter((c) => c.status === "escalated").length;
    const resolved = initialComplaints.filter(
      (c) => c.status === "resolved" || c.status === "closed",
    ).length;
    return { total, actionRequired, escalated, resolved };
  }, [initialComplaints]);

  // Filtered
  const filtered = useMemo(() => {
    return initialComplaints.filter((c) => {
      if (!matchesFilter(c, filter)) return false;
      if (searchQuery.trim()) return matchesSearch(c, searchQuery.toLowerCase());
      return true;
    });
  }, [initialComplaints, filter, searchQuery]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: metrics.total },
    { key: "ACTION_REQUIRED", label: "Pending Action", count: metrics.actionRequired },
    { key: "ESCALATED", label: "Escalated", count: metrics.escalated },
    { key: "RESOLVED", label: "Resolved / Closed", count: metrics.resolved },
  ];

  const emptyState =
    searchQuery || filter !== "ALL"
      ? "No grievances match the selected filter criteria."
      : "No grievances recorded.";

  const pagination = useClientPagination(filtered, 20, [filter, searchQuery]);

  const isXl = useMediaQuery("(min-width: 1401px)");
  const isLg = useMediaQuery("(min-width: 1101px) and (max-width: 1400px)");
  const isMd = useMediaQuery("(min-width: 641px) and (max-width: 1100px)");
  const columnCount = isXl ? 4 : isLg ? 3 : isMd ? 2 : 1;
  const cardColumns = useMemo(
    () => distributeIntoColumns(pagination.paginatedItems, columnCount),
    [pagination.paginatedItems, columnCount],
  );

  return (
    <div>
      {/* Toolbar: Search, Filters & View Toggle (projects/CA pattern) */}
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
                  ? "Search by tracking code, facility, keyword…"
                  : "Search by tracking code, keyword…")
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter grievances"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Complaint status filters">
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
                <th>Tracking Code</th>
                {showProjectInfo && <th>Facility / Project</th>}
                <th>Grievance Summary</th>
                <th>Status</th>
                <th>Received</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={showProjectInfo ? 6 : 5}
                    className="table-empty-state"
                  >
                    <IconSearch width={22} height={22} className="table-empty-icon" />
                    <div className="table-empty-title">No complaints found</div>
                    <div className="table-empty-desc">
                      {filter !== "ALL" || searchQuery
                        ? "Try adjusting your filter or search criteria."
                        : "Grievances regarding facilities will appear here once submitted."}
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((c) => {
                  const statusMeta = getComplaintStatusBadge(c.status);

                  return (
                    <tr
                      key={c.id}
                      className="table-row"
                      onClick={() => router.push(`/dashboard/complaints/${c.id}`)}
                      title="View complaint details"
                    >
                      <td>
                        <Link
                          href={`/dashboard/complaints/${c.id}`}
                          className="table-code-link"
                          onClick={(e) => e.stopPropagation()}
                          title={`Tracking code: ${c.trackingCode}`}
                        >
                          {c.trackingCode}
                        </Link>
                      </td>

                      {showProjectInfo && (
                        <td>
                          {c.projectId ? (
                            <Link
                              href={`/dashboard/projects/${c.projectId}`}
                              className="table-name-link"
                              onClick={(e) => e.stopPropagation()}
                              title={`Open facility dossier for ${c.projectName}`}
                            >
                              <div>{c.projectName}</div>
                              {c.projectCode && (
                                <div className="table-subtext">{c.projectCode}</div>
                              )}
                            </Link>
                          ) : (
                            <span className="table-name-link" style={{ cursor: "default" }}>
                              {c.projectName}
                            </span>
                          )}
                        </td>
                      )}

                      <td>
                        <div
                          style={{
                            maxWidth: "320px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.85rem",
                          }}
                          title={c.description}
                        >
                          {c.description}
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="table-date">
                        {formatDate(c.receivedAt)}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "0.4rem",
                            alignItems: "center",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Link
                            href={`/dashboard/complaints/${c.id}`}
                            className="btn-secondary"
                            style={{ fontSize: "0.74rem", padding: "0.22rem 0.55rem" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <PaginationBar
            from={pagination.from}
            to={pagination.to}
            total={pagination.total}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            itemName="grievances"
            onPageClick={pagination.onPageClick}
            onPageSizeChange={pagination.onPageSizeChange}
          />
        </div>
      )}

      {/* View: Cards */}
      {viewMode === "cards" && (
        <div>
          {filtered.length === 0 ? (
            <div className="empty-box" style={{ padding: "3rem 1rem", marginBottom: "2rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                No grievances found
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>{emptyState}</div>
            </div>
          ) : (
            <div className="facility-cards-grid">
              {cardColumns.map((column, colIdx) => (
                <div className="facility-cards-column" key={colIdx}>
                  {column.map((c) => (
                    <ComplaintCard complaint={c} key={c.id} showProjectInfo={showProjectInfo} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <PaginationBar
              from={pagination.from}
              to={pagination.to}
              total={pagination.total}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              itemName="grievances"
              onPageClick={pagination.onPageClick}
              onPageSizeChange={pagination.onPageSizeChange}
            />
          )}
        </div>
      )}

      {/* View: Map */}
      {showMap && viewMode === "map" && (
        <div className="map-view-wrapper" style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}>
          <ComplaintsMap complaints={filtered} />
        </div>
      )}
    </div>
  );
}