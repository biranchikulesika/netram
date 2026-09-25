"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  totalComplaints: _totalComplaints,
}: ComplaintsLayoutProps) {
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
              placeholder="Search by tracking code, facility, keyword…"
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
            <button
              type="button"
              className={`view-btn ${viewMode === "map" ? "active" : ""}`}
              onClick={() => setViewMode("map")}
              title="Map"
            >
              <IconMapPin style={{ width: 14, height: 14 }} />
              <span>Map</span>
            </button>
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
                <th>Facility / Project</th>
                <th>Grievance Summary</th>
                <th>Status</th>
                <th>Received</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "2.5rem" }}>
                    {emptyState}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const statusMeta = getComplaintStatusBadge(c.status);

                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/dashboard/complaints/${c.id}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: "var(--color-navy-brand)",
                            textDecoration: "none",
                          }}
                        >
                          {c.trackingCode}
                        </Link>
                      </td>

                      <td>
                        <Link
                          href={`/dashboard/projects/${c.projectId}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{c.projectName}</div>
                          <div className="muted" style={{ fontSize: "0.75rem" }}>
                            {c.projectCode}
                          </div>
                        </Link>
                      </td>

                      <td>
                        <div
                          style={{
                            maxWidth: "320px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.82rem",
                          }}
                          title={c.description}
                        >
                          {c.description}
                        </div>
                        {c.complainantName && (
                          <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.15rem" }}>
                            By: {c.complainantName}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="muted" style={{ fontSize: "0.8rem" }}>
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
                            style={{
                              fontSize: "0.78rem",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                              color: "var(--color-navy-brand)",
                            }}
                          >
                            View Complaint
                          </Link>
                        </div>
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
                No grievances found
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>{emptyState}</div>
            </div>
          ) : (
            <div className="facility-cards-grid">
              {cardColumns.map((column, colIdx) => (
                <div className="facility-cards-column" key={colIdx}>
                  {column.map((c) => (
                    <ComplaintCard complaint={c} key={c.id} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View: Map */}
      {viewMode === "map" && (
        <div className="map-view-wrapper" style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}>
          <ComplaintsMap complaints={filtered} />
        </div>
      )}
    </div>
  );
}