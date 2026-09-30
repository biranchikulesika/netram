"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Inspection } from "@netram/types";
import { IconSearch } from "../../../../components/icons";
import { formatDate } from "../../../../../lib/presentation";
import { ScheduleFacilityInspectionButton } from "./schedule-facility-inspection-button";
import { PaginationBar, useClientPagination } from "../../../../components/pagination-bar";

type StatusFilter = "ALL" | "ACTIVE" | "REVIEW" | "SCHEDULED" | "COMPLETED";

/**
 * The inspections section's toolbar and table, minus the Facility / Project
 * column and the table/cards/map view toggle (this page is table-only and the
 * project is the page). Search, the five status buckets, the filter-aware
 * empty state and the "Showing N of M" footer are the section's own.
 */
export function FacilityInspectionsTable({
  inspections,
  project,
  canCreate,
}: {
  inspections: Inspection[];
  project: { id: string; name: string; code: string; districtId: string | null };
  canCreate: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      ALL: inspections.length,
      ACTIVE: inspections.filter(
        (i) => i.status === "in_progress" || i.status === "evidence_collection",
      ).length,
      REVIEW: inspections.filter(
        (i) =>
          i.status === "submitted" ||
          i.status === "under_review" ||
          i.status === "findings" ||
          i.status === "corrective_actions" ||
          i.status === "verification",
      ).length,
      SCHEDULED: inspections.filter((i) => i.status === "scheduled" || i.status === "assigned")
        .length,
      COMPLETED: inspections.filter((i) => i.status === "closed").length,
    }),
    [inspections],
  );

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
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

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const trigger = i.trigger?.toLowerCase() ?? "";
        const id = i.id?.toLowerCase() ?? "";
        const type = i.type?.toLowerCase() ?? "";
        const status = i.status?.toLowerCase().replace(/_/g, " ") ?? "";
        return trigger.includes(q) || id.includes(q) || type.includes(q) || status.includes(q);
      }

      return true;
    });
  }, [inspections, filter, search]);

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "ACTIVE", label: "Active Attention" },
    { key: "REVIEW", label: "Review Pending" },
    { key: "SCHEDULED", label: "Scheduled" },
    { key: "COMPLETED", label: "Completed" },
  ];

  const pagination = useClientPagination(filtered, 20, [filter, search]);

  return (
    <div>
      {/* Toolbar - the inspections section's, minus the view-mode toggle */}
      <div className="registry-toolbar" style={{ marginBottom: "1.25rem" }}>
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by inspection ID, trigger, type, or status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter inspections"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Inspection status filters">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`filter-tab-btn ${filter === t.key ? "active" : ""}`}
                onClick={() => setFilter(t.key)}
                role="tab"
                aria-selected={filter === t.key}
              >
                <span>{t.label}</span>
                {filter === t.key && <span className="filter-count-badge">{counts[t.key]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {canCreate && <ScheduleFacilityInspectionButton project={project} />}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "130px" }}>Type</th>
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
                <td colSpan={6} className="table-empty-state">
                  <IconSearch width={22} height={22} className="table-empty-icon" />
                  <div className="table-empty-title">
                    {search || filter !== "ALL"
                      ? "No inspections found"
                      : "No inspections currently recorded"}
                  </div>
                  <div className="table-empty-desc">
                    {search || filter !== "ALL"
                      ? "Adjust the status filter or search query to see more."
                      : "Inspections scheduled for this facility will appear here."}
                  </div>
                </td>
              </tr>
            ) : (
              pagination.paginatedItems.map((i) => {
                const isSurprise = i.type === "surprise";
                const dateStr = i.startedAt
                  ? `Started: ${formatDate(i.startedAt)}`
                  : i.scheduledStart
                    ? `Sched: ${formatDate(i.scheduledStart)}`
                    : "-";
                const assignedCount = Array.isArray(i.assignedUserIds) ? i.assignedUserIds.length : 0;

                return (
                  <tr
                    key={i.id}
                    className="table-row"
                    onClick={() => router.push(`/dashboard/inspections/${i.id}`)}
                    title={`Open inspection record ${i.id}`}
                  >
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          textTransform: "uppercase",
                          color: isSurprise ? "#dd501e" : "var(--text-primary)",
                        }}
                      >
                        {i.type}
                      </span>
                    </td>
                    <td title={i.id}>
                      <Link
                        href={`/dashboard/inspections/${i.id}`}
                        className="table-code-link"
                        onClick={(e) => e.stopPropagation()}
                        title={`Inspection identifier: ${i.id}`}
                      >
                        {i.id.slice(0, 12)}
                      </Link>
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
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-subtle)",
                            fontStyle: "italic",
                          }}
                        >
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="table-date">{dateStr}</td>
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
          itemName="inspections"
          onPageClick={pagination.onPageClick}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      </div>
    </div>
  );
}
