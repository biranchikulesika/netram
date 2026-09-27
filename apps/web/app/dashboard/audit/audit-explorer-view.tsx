"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AuditEvent } from "@netram/types";
import { formatTimestamp } from "../../../lib/presentation";
import {
  categoryLabel,
  formatAuditActivity,
  matchesTimeRange,
  resolveActor,
  TIME_RANGE_PRESETS,
  type AuditFormatContext,
  type AuditActivity,
  type AuditActor,
  type TimeRangePreset,
} from "../../../lib/audit-activity";
import {
  IconSearch,
  IconLock,
  IconClock,
  IconCalendar,
  IconRotateCcw,
} from "../../components/icons";

export interface AuditExplorerViewProps {
  initialEvents: AuditEvent[];
  initialTotal: number;
  userNames?: Record<string, string>;
  headerAction?: React.ReactNode;
}

type CategoryId =
  | "all"
  | "facilities"
  | "inspections"
  | "remediations"
  | "grievances"
  | "surveillance"
  | "security"
  | "attendance"
  | "finance";

const ALL_CATEGORIES: Array<{ id: CategoryId; label: string }> = [
  { id: "all", label: "All" },
  { id: "facilities", label: "Facilities" },
  { id: "inspections", label: "Inspections" },
  { id: "remediations", label: "Remediation" },
  { id: "grievances", label: "Grievances" },
  { id: "surveillance", label: "Surveillance" },
  { id: "security", label: "Security" },
  { id: "attendance", label: "Attendance" },
  { id: "finance", label: "Finance" },
];

function categoryMatches(action: string, category: CategoryId): boolean {
  if (category === "all") return true;
  const map: Record<Exclude<CategoryId, "all">, string[]> = {
    facilities: ["project."],
    inspections: ["inspection.", "finding.", "observation.", "evidence."],
    remediations: ["corrective_action."],
    grievances: ["complaint."],
    surveillance: ["cctv.", "ai.", "vc."],
    security: ["auth.", "user.", "role.", "admin."],
    attendance: ["attendance."],
    finance: ["fund.", "expense.", "financial_document.", "financial_risk.", "scheduled_job."],
  };
  return (map[category] ?? []).some((p) => action.startsWith(p));
}


const TONE_COLORS: Record<AuditActivity["tone"], { dot: string; text: string }> = {
  routine: { dot: "#0284c7", text: "#0369a1" },
  attention: { dot: "#f59e0b", text: "#b45309" },
  critical: { dot: "#ef4444", text: "#dc2626" },
  positive: { dot: "#16a34a", text: "#15803d" },
};

function matchesSearch(e: AuditEvent, activity: AuditActivity, actor: AuditActor | null, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    activity.summary,
    activity.subject ?? "",
    activity.status,
    activity.category,
    activity.transition ?? "",
    actor ? `${actor.role} ${actor.account}` : "system",
    e.action,
    e.resourceType ?? "",
    e.resourceId ?? "",
    ...activity.context.map((c) => c.value),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}



export function AuditExplorerView({
  initialEvents,
  initialTotal: _initialTotal,
  userNames,
  headerAction,
}: AuditExplorerViewProps) {
  const [events] = useState<AuditEvent[]>(initialEvents);
  const [categoryFilter, setCategoryFilter] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("all");
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");
  const [dateRangeModalOpen, setDateRangeModalOpen] = useState<boolean>(false);
  const [pendingStartDate, setPendingStartDate] = useState<string>("");
  const [pendingEndDate, setPendingEndDate] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const isCustomRangeActive = Boolean(appliedStartDate || appliedEndDate);
  const hasActiveTimeFilter = timePreset !== "all" || isCustomRangeActive;

  const formatContext: AuditFormatContext = useMemo(
    () => ({ userNames }),
    [userNames],
  );

  const presented = useMemo(
    () =>
      events.map((e) => ({
        event: e,
        activity: formatAuditActivity(e, formatContext),
        actor: resolveActor(e, formatContext),
      })),
    [events, formatContext],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryId, number> = {
      all: events.length,
      facilities: 0,
      inspections: 0,
      remediations: 0,
      grievances: 0,
      surveillance: 0,
      security: 0,
      attendance: 0,
      finance: 0,
    };
    for (const e of events) {
      for (const cat of ALL_CATEGORIES) {
        if (cat.id !== "all" && categoryMatches(e.action, cat.id)) {
          counts[cat.id] = (counts[cat.id] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [events]);

  const filterTabs = useMemo(() => {
    const coreKeys: CategoryId[] = [
      "all",
      "facilities",
      "inspections",
      "remediations",
      "grievances",
      "surveillance",
      "security",
    ];
    return ALL_CATEGORIES.filter(
      (cat) => coreKeys.includes(cat.id) || (categoryCounts[cat.id] ?? 0) > 0,
    ).map((cat) => ({
      key: cat.id,
      label: cat.label,
      count: categoryCounts[cat.id] ?? 0,
    }));
  }, [categoryCounts]);

  const filtered = useMemo(
    () =>
      presented.filter(({ event, activity, actor }) => {
        if (!categoryMatches(event.action, categoryFilter)) return false;
        if (!matchesTimeRange(event.occurredAt, timePreset, appliedStartDate, appliedEndDate)) return false;
        return matchesSearch(event, activity, actor, searchQuery);
      }),
    [presented, categoryFilter, timePreset, appliedStartDate, appliedEndDate, searchQuery],
  );

  const closeDialog = useCallback(() => setSelectedEvent(null), []);
  const closeDateRangeModal = useCallback(() => setDateRangeModalOpen(false), []);

  const openDateRangeModal = useCallback(() => {
    setPendingStartDate(appliedStartDate);
    setPendingEndDate(appliedEndDate);
    setDateRangeModalOpen(true);
  }, [appliedStartDate, appliedEndDate]);

  const applyDateRange = useCallback(() => {
    setAppliedStartDate(pendingStartDate);
    setAppliedEndDate(pendingEndDate);
    if (pendingStartDate || pendingEndDate) {
      setTimePreset("all");
    }
    setDateRangeModalOpen(false);
  }, [pendingStartDate, pendingEndDate]);

  const clearDateRange = useCallback(() => {
    setPendingStartDate("");
    setPendingEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setDateRangeModalOpen(false);
  }, []);

  const resetAllTimeFilters = useCallback(() => {
    setTimePreset("all");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setPendingStartDate("");
    setPendingEndDate("");
  }, []);

  // Dialog: escape closes, background scroll locked while open.
  useEffect(() => {
    if (!selectedEvent && !dateRangeModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dateRangeModalOpen) closeDateRangeModal();
        else if (selectedEvent) closeDialog();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selectedEvent, dateRangeModalOpen, closeDialog, closeDateRangeModal]);

  const selected = selectedEvent
    ? presented.find((p) => p.event.id === selectedEvent.id) ?? null
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Toolbar: Search, Filters & Time Range */}
      <div className="registry-toolbar" style={{ marginBottom: "0.25rem" }}>
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by action, facility, actor, reference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter activity"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Activity category filters">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`filter-tab-btn ${categoryFilter === tab.key ? "active" : ""}`}
                onClick={() => setCategoryFilter(tab.key)}
                role="tab"
                aria-selected={categoryFilter === tab.key}
              >
                <span>{tab.label}</span>
                {categoryFilter === tab.key && (
                  <span className="filter-count-badge">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Time Filters (Top Right) */}
        <div
          className="audit-time-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          {headerAction}

          {/* Pop-up Date Range Trigger */}
          <button
            type="button"
            className={`filter-tab-btn ${isCustomRangeActive ? "active" : ""}`}
            onClick={openDateRangeModal}
            aria-haspopup="dialog"
            aria-expanded={dateRangeModalOpen}
            title={isCustomRangeActive ? "Date range filter active — click to edit" : "Select date range"}
            style={{
              padding: "0.42rem 0.75rem",
              border: isCustomRangeActive
                ? "1px solid var(--color-navy-brand)"
                : "1px solid var(--color-border-strong)",
              background: "var(--bg-surface)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <IconCalendar style={{ width: 14, height: 14 }} />
            <span>Date Range</span>
            {isCustomRangeActive && (
              <span className="filter-count-badge">Active</span>
            )}
          </button>

          {/* Standard Presets Dropdown (hidden when custom date range is active to save space) */}
          {!isCustomRangeActive && (
            <div className="toolbar-select-wrap">
              <IconClock className="select-icon-svg" style={{ width: 14, height: 14 }} />
              <select
                value={timePreset}
                onChange={(e) => {
                  const val = e.target.value as TimeRangePreset;
                  setTimePreset(val);
                  if (val !== "all") {
                    setAppliedStartDate("");
                    setAppliedEndDate("");
                  }
                }}
                className="toolbar-select"
                aria-label="Filter by standard time range"
              >
                {TIME_RANGE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Reset Button with Icon */}
          {hasActiveTimeFilter && (
            <button
              type="button"
              className="filter-tab-btn"
              onClick={resetAllTimeFilters}
              title="Reset time range filter"
              aria-label="Reset time range filter"
              style={{
                padding: "0.42rem 0.55rem",
                border: "1px solid var(--color-border-subtle)",
                background: "var(--bg-surface)",
                borderRadius: "6px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <IconRotateCcw style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* Activity table */}
      <div className="table-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: "1.25rem", width: "140px" }}>Status</th>
              <th>Activity</th>
              <th style={{ width: "260px" }}>Performed by</th>
              <th style={{ textAlign: "right", paddingRight: "1.25rem", width: "190px" }}>Time Stamp</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                  <IconLock style={{ width: 28, height: 28, margin: "0 auto 0.75rem auto", opacity: 0.3 }} />
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {searchQuery || categoryFilter !== "all" || hasActiveTimeFilter
                      ? "No matching activity"
                      : "No activity yet"}
                  </div>
                  {searchQuery || categoryFilter !== "all" || hasActiveTimeFilter ? (
                    <div style={{ fontSize: "0.825rem", marginTop: "0.25rem" }}>
                      Try adjusting your search, category, or time range filter.
                    </div>
                  ) : null}
                  {searchQuery || categoryFilter !== "all" || hasActiveTimeFilter ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginTop: "0.75rem", fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                      onClick={() => {
                        setCategoryFilter("all");
                        setSearchQuery("");
                        resetAllTimeFilters();
                      }}
                    >
                      Reset filters
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              filtered.map(({ event, activity, actor }) => (
                <tr
                  key={event.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details: ${activity.summary}`}
                  onClick={() => setSelectedEvent(event)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedEvent(event);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                  className="audit-row"
                >
                  {/* Status (Clean text, no dot) */}
                  <td style={{ paddingLeft: "1.25rem", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        color: TONE_COLORS[activity.tone].text,
                        letterSpacing: "0.01em",
                      }}
                    >
                      {activity.status}
                    </span>
                  </td>

                  {/* Activity (Primary summary only, no secondary text) */}
                  <td
                    style={{
                      whiteSpace: "nowrap",
                      verticalAlign: "middle",
                      maxWidth: "540px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: "0.84rem",
                        color: "var(--text-primary, #0c2a52)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                      title={activity.summary}
                    >
                      {activity.summary}
                    </span>
                  </td>

                  {/* Performed by (Actor account name only, no secondary role text) */}
                  <td
                    style={{
                      whiteSpace: "nowrap",
                      verticalAlign: "middle",
                      maxWidth: "240px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: actor ? "var(--text-data, #1c3a63)" : "var(--text-muted, #64748b)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                      title={actor ? `${actor.account} (${actor.role})` : "System"}
                    >
                      {actor ? actor.account : "System"}
                    </span>
                  </td>

                  {/* Time Stamp (When) */}
                  <td
                    className="muted"
                    style={{
                      fontSize: "0.8125rem",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                      paddingRight: "1.25rem",
                      verticalAlign: "middle",
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {formatTimestamp(event.occurredAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail pop up dialog */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 26, 56, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            className="table-card"
            style={{
              maxWidth: "620px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              borderRadius: "10px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1.15rem",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <h3
                id="audit-detail-title"
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--color-navy-brand, #0c2a52)",
                  lineHeight: 1.35,
                }}
              >
                {selected.activity.summary}
              </h3>
              <button
                type="button"
                onClick={closeDialog}
                className="audit-dialog-close"
                aria-label="Close details"
              >
                &times;
              </button>
            </div>

            {/* Unique narrative note (only shown when providing unique context, not when repeating the transition) */}
            {selected.activity.detail &&
              !selected.activity.transition &&
              selected.activity.detail !== selected.activity.summary && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
                    color: "var(--text-muted, #475569)",
                  }}
                >
                  {selected.activity.detail}
                </p>
              )}

            {/* Key Information Table */}
            <div
              style={{
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                borderRadius: "8px",
                overflow: "hidden",
                background: "var(--bg-surface, #ffffff)",
              }}
            >
              <table style={{ width: "100%", margin: 0, fontSize: "0.825rem", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td className="muted" style={{ width: "32%", padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      Category
                    </td>
                    <td style={{ padding: "0.6rem 0.9rem", color: "var(--text-data, #1c3a63)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      {categoryLabel(selected.activity.category)}
                    </td>
                  </tr>

                  <tr>
                    <td className="muted" style={{ width: "32%", padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      Status
                    </td>
                    <td style={{ padding: "0.6rem 0.9rem", fontWeight: 600, color: TONE_COLORS[selected.activity.tone].text, borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      {selected.activity.status}
                    </td>
                  </tr>

                  {selected.activity.transition && (
                    <tr>
                      <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                        Transition
                      </td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "var(--text-primary, #0c2a52)", fontFamily: "var(--font-mono, monospace)", fontSize: "0.8rem", fontWeight: 600, borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                        {selected.activity.transition}
                      </td>
                    </tr>
                  )}


                  <tr>
                    <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      Performed by
                    </td>
                    <td style={{ padding: "0.6rem 0.9rem", color: "var(--text-primary, #0c2a52)", fontWeight: 500, borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      {selected.actor ? (
                        <span>
                          {selected.actor.account}{" "}
                          <span className="muted" style={{ fontWeight: 400 }}>· {selected.actor.role}</span>
                        </span>
                      ) : (
                        <span className="muted">System (Automated)</span>
                      )}
                    </td>
                  </tr>

                  {selected.activity.subject && (
                    <tr>
                      <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                        Facility / Target
                      </td>
                      <td style={{ padding: "0.6rem 0.9rem", color: "var(--text-data, #1c3a63)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                        {selected.activity.subject}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      Action Code
                    </td>
                    <td style={{ padding: "0.6rem 0.9rem", fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      {selected.event.action}
                    </td>
                  </tr>

                  {selected.activity.context
                    .filter(
                      (c) =>
                        c.label !== "Performed by" &&
                        c.label !== "Account" &&
                        c.label !== "Facility / project" &&
                        c.label !== "Facility / Target" &&
                        c.value !== selected.activity.subject,
                    )
                    .map((item) => (
                      <tr key={item.label}>
                        <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                          {item.label}
                        </td>
                        <td style={{ padding: "0.6rem 0.9rem", color: "var(--text-data, #1c3a63)" }}>
                          {item.value}
                        </td>
                      </tr>
                    ))}

                  {selected.event.ipAddress && (
                    <tr>
                      <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                        IP Address
                      </td>
                      <td style={{ padding: "0.6rem 0.9rem", fontFamily: "var(--font-mono, monospace)", fontSize: "0.78rem", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                        {selected.event.ipAddress}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      Time Stamp
                    </td>
                    <td style={{ padding: "0.6rem 0.9rem", fontFamily: "var(--font-mono, monospace)", fontSize: "0.8rem", borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      {formatTimestamp(selected.event.occurredAt)}
                    </td>
                  </tr>

                  <tr>
                    <td className="muted" style={{ padding: "0.6rem 0.9rem", fontWeight: 500, background: "var(--bg-subtle, #f8fafc)" }}>
                      Event ID
                    </td>
                    <td style={{ padding: "0.6rem 0.9rem", fontFamily: "var(--font-mono, monospace)", fontSize: "0.75rem", wordBreak: "break-all" }}>
                      {selected.event.id}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={closeDialog}
                style={{ fontSize: "0.85rem", padding: "0.4rem 1.1rem" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Pop-up Modal */}
      {dateRangeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="date-range-dialog-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12, 42, 82, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDateRangeModal();
          }}
        >
          <div
            className="table-card"
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "1.5rem",
              borderRadius: "10px",
              boxShadow: "0 20px 40px -10px rgba(12, 42, 82, 0.25), 0 1px 3px rgba(0, 0, 0, 0.08)",
              background: "var(--bg-surface)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IconCalendar style={{ width: 18, height: 18, color: "var(--color-navy-brand)" }} />
                <h3
                  id="date-range-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "var(--color-navy-brand)",
                  }}
                >
                  Select Date Range
                </h3>
              </div>
              <button
                type="button"
                className="audit-dialog-close"
                onClick={closeDateRangeModal}
                aria-label="Close date range dialog"
              >
                ✕
              </button>
            </div>

            {/* Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label
                  htmlFor="audit-filter-start-date"
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Start Date (From)
                </label>
                <input
                  id="audit-filter-start-date"
                  type="date"
                  className="toolbar-date-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={pendingStartDate}
                  max={pendingEndDate || undefined}
                  onChange={(e) => setPendingStartDate(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="audit-filter-end-date"
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "0.35rem",
                  }}
                >
                  End Date (To)
                </label>
                <input
                  id="audit-filter-end-date"
                  type="date"
                  className="toolbar-date-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  value={pendingEndDate}
                  min={pendingStartDate || undefined}
                  onChange={(e) => setPendingEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {pendingStartDate || pendingEndDate || appliedStartDate || appliedEndDate ? (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: "0.82rem", padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}
                  onClick={clearDateRange}
                >
                  Clear Range
                </button>
              ) : (
                <div />
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                  onClick={closeDateRangeModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: "0.85rem", padding: "0.4rem 1.1rem" }}
                  onClick={applyDateRange}
                  disabled={!pendingStartDate && !pendingEndDate}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
