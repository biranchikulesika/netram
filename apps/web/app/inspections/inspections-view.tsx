"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Inspection } from "@netram/types";
import { IconSearch, IconChevronRight } from "../components/icons";
import { getProjectName, getProjectCode, formatDate } from "../../lib/presentation";

interface InspectionsViewProps {
  initialInspections: Inspection[];
  total: number;
}

export function InspectionsView({ initialInspections, total }: InspectionsViewProps) {
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "REVIEW" | "SCHEDULED" | "COMPLETED">("ALL");
  const [search, setSearch] = useState("");

  const activeCount = useMemo(
    () =>
      initialInspections.filter(
        (i) => i.status === "in_progress" || i.status === "evidence_collection",
      ).length,
    [initialInspections],
  );

  const reviewCount = useMemo(
    () =>
      initialInspections.filter(
        (i) =>
          i.status === "submitted" ||
          i.status === "under_review" ||
          i.status === "findings" ||
          i.status === "corrective_actions" ||
          i.status === "verification",
      ).length,
    [initialInspections],
  );

  const scheduledCount = useMemo(
    () =>
      initialInspections.filter(
        (i) => i.status === "scheduled" || i.status === "assigned",
      ).length,
    [initialInspections],
  );

  const completedCount = useMemo(
    () => initialInspections.filter((i) => i.status === "closed").length,
    [initialInspections],
  );

  const filtered = useMemo(() => {
    return initialInspections.filter((i) => {
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
  }, [initialInspections, filter, search]);

  return (
    <div>
      <div className="section-title-row" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
            Inspections
          </h2>
          <p className="muted" style={{ marginTop: "0.15rem", fontSize: "0.82rem" }}>
            Field inspection oversight, assignment tracking, and verification workflows
          </p>
        </div>
      </div>

      {/* Interactive Toolbar */}
      <div className="registry-toolbar">
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
              <span className="filter-count-badge">{total}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "ACTIVE" ? "active" : ""}`}
              onClick={() => setFilter("ACTIVE")}
              role="tab"
              aria-selected={filter === "ACTIVE"}
            >
              <span>Active Attention</span>
              <span className="filter-count-badge">{activeCount}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "REVIEW" ? "active" : ""}`}
              onClick={() => setFilter("REVIEW")}
              role="tab"
              aria-selected={filter === "REVIEW"}
            >
              <span>Review Pending</span>
              <span className="filter-count-badge">{reviewCount}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "SCHEDULED" ? "active" : ""}`}
              onClick={() => setFilter("SCHEDULED")}
              role="tab"
              aria-selected={filter === "SCHEDULED"}
            >
              <span>Scheduled</span>
              <span className="filter-count-badge">{scheduledCount}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "COMPLETED" ? "active" : ""}`}
              onClick={() => setFilter("COMPLETED")}
              role="tab"
              aria-selected={filter === "COMPLETED"}
            >
              <span>Completed</span>
              <span className="filter-count-badge">{completedCount}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "130px" }}>Type</th>
              <th>Facility / Project</th>
              <th>Trigger</th>
              <th style={{ width: "140px" }}>Status</th>
              <th>Assignment</th>
              <th>Timing</th>
              <th style={{ width: "130px", textAlign: "right" }}>Action</th>
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
                    <td>
                      <span className={`badge ${isSurprise ? "badge-surprise" : "badge-routine"}`}>
                        {i.type.toUpperCase()}
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
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/inspections/${i.id}`}
                        className="btn-secondary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.78rem",
                          padding: "0.3rem 0.65rem",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        <span>View</span>
                        <IconChevronRight style={{ width: 13, height: 13 }} />
                      </Link>
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
    </div>
  );
}
