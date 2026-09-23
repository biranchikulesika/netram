"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { AttendanceAnomaly, AttendanceCalculation, AttendanceReviewAction } from "@netram/types";
import { getProjectName, getProjectCode } from "../../lib/presentation";
import { AnomalyReviewPanel } from "./anomaly-review";
import { IconSearch, IconAlertTriangle, IconBarChart } from "../components/icons";

interface AttendanceOverviewProps {
  calculations: AttendanceCalculation[];
  anomalies: AttendanceAnomaly[];
  selectedDate: string;
  initialSearch?: string;
}

function severityColor(severity: string): string {
  return {
    LOW: "#22c55e",
    MEDIUM: "#eab308",
    HIGH: "#f97316",
    CRITICAL: "#ef4444",
  }[severity] ?? "#6b7280";
}

/** Status pill colors per attendance anomaly state (control-room parity). */
function stateStyle(state: string): { bg: string; color: string } {
  switch (state) {
    case "NEW":
      return { bg: "#fee2e2", color: "#b91c1c" };
    case "REVIEWED":
      return { bg: "#ede9fe", color: "#6d28d9" };
    case "INVESTIGATING":
      return { bg: "#ffedd5", color: "#c2410c" };
    case "ACTIONED":
      return { bg: "#dcfce7", color: "#15803d" };
    case "FALSE_POSITIVE":
      return { bg: "#e0f2fe", color: "#0369a1" };
    case "DISMISSED":
      return { bg: "#f1f5f9", color: "#64748b" };
    default:
      return { bg: "#f1f5f9", color: "#334155" };
  }
}

export function AttendanceOverviewSection({
  calculations,
  anomalies,
  selectedDate,
  initialSearch = "",
}: AttendanceOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [view, setView] = useState<"stats" | "alerts">("stats");
  const [alertView, setAlertView] = useState<"active" | "resolved">("active");
  const [selectedAnomaly, setSelectedAnomaly] = useState<AttendanceAnomaly | null>(null);

  const ACTIVE_STATES = ["NEW", "REVIEWED", "INVESTIGATING"];
  const RESOLVED_STATES = ["DISMISSED", "FALSE_POSITIVE", "ACTIONED"];
  const activeAnomalyCount = anomalies.filter((a) => ACTIVE_STATES.includes(a.state)).length;
  const resolvedAnomalyCount = anomalies.filter((a) => RESOLVED_STATES.includes(a.state)).length;

  /** Server round-trip: the selected date drives from/to on every attendance fetch. */
  const handleDateChange = (value: string) => {
    if (!value || value === selectedDate) return;
    const params = new URLSearchParams(window.location.search);
    params.set("date", value);
    router.push(`${pathname}?${params.toString()}`);
  };

  /** Client-only: search filters the loaded rows without a server round-trip. */
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const filteredCalculations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return calculations;
    return calculations.filter((calc) => {
      return (
        getProjectName(calc.projectId).toLowerCase().includes(q) ||
        getProjectCode(calc.projectId).toLowerCase().includes(q) ||
        calc.operationalDate.includes(q)
      );
    });
  }, [calculations, searchQuery]);

  /** Review an anomaly via the server-side API route, then resync. */
  const handleReview = async (id: string, action: AttendanceReviewAction) => {
    try {
      await fetch(`/api/attendance/anomalies/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
      setSelectedAnomaly(null);
    } catch {
      // Keep the panel open so the failed review stays visible.
    }
  };

  /** Anomalies narrowed to the active/resolved view, plus the toolbar search. */
  const filteredAnomalies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return anomalies.filter((a) => {
      const inView =
        alertView === "active"
          ? ACTIVE_STATES.includes(a.state)
          : RESOLVED_STATES.includes(a.state);
      if (!inView) return false;
      if (!q) return true;
      return (
        (a.projectName?.toLowerCase().includes(q) ?? false) ||
        (a.projectCode?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [anomalies, alertView, searchQuery]);

  return (
    <section>
      {/* Toolbar: search + Stats/Alerts switch on the left; the right corner
          shows the date (Stats) or the Active/Resolved filter (Alerts),
          mirroring the control-room header design. */}
      <div className="control-room-header">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search attendance..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter attendance by project name, code or date"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Attendance view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "stats"}
              onClick={() => setView("stats")}
              className={`filter-tab-btn ${view === "stats" ? "active" : ""}`}
            >
              <IconBarChart style={{ width: 13, height: 13 }} />
              <span>Stats</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={view === "alerts"}
              onClick={() => setView("alerts")}
              className={`filter-tab-btn ${view === "alerts" ? "active" : ""}`}
            >
              <IconAlertTriangle style={{ width: 13, height: 13 }} />
              <span>Alerts</span>
              <span
                className={`filter-count-badge ${activeAnomalyCount > 0 ? "danger" : ""}`}
              >
                {anomalies.length}
              </span>
            </button>
          </div>
        </div>

        {view === "stats" ? (
          <input
            type="date"
            className="toolbar-date-input"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            aria-label="Attendance date"
            title="Attendance date"
          />
        ) : (
          <div className="filter-tabs" role="tablist" aria-label="Anomaly status filter">
            <button
              type="button"
              role="tab"
              aria-selected={alertView === "active"}
              onClick={() => setAlertView("active")}
              className={`filter-tab-btn ${alertView === "active" ? "active" : ""}`}
            >
              <span>Active</span>
              <span className="filter-count-badge">{activeAnomalyCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={alertView === "resolved"}
              onClick={() => setAlertView("resolved")}
              className={`filter-tab-btn ${alertView === "resolved" ? "active" : ""}`}
            >
              <span>Resolved</span>
              <span className="filter-count-badge">{resolvedAnomalyCount}</span>
            </button>
          </div>
        )}
      </div>

      {/* Anomaly alerts (Alerts view) — control-room row design */}
      {view === "alerts" && (
        <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.6rem" }}>
          {filteredAnomalies.length === 0 ? (
            <div
              className="empty-state"
              style={{
                padding: "2.5rem",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <IconAlertTriangle
                style={{ width: 30, height: 30, color: "var(--text-subtle)", margin: "0 auto 0.75rem auto", display: "block" }}
              />
              <h3>
                {searchQuery
                  ? "No matching anomalies"
                  : `No ${alertView} attendance anomalies`}
              </h3>
              <p className="muted">
                {searchQuery
                  ? `No ${alertView} attendance anomalies match "${searchQuery}".`
                  : alertView === "active"
                    ? "No open anomaly signals detected in your jurisdiction."
                    : "Anomalies dismissed or acted upon will appear here."}
              </p>
            </div>
          ) : (
            filteredAnomalies.map((anomaly) => {
              const sevColor = severityColor(anomaly.severity);
              const status = stateStyle(anomaly.state);
              return (
                <button
                  key={anomaly.id}
                  type="button"
                  onClick={() => setSelectedAnomaly(anomaly)}
                  className="anomaly-alert-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    width: "100%",
                    textAlign: "left",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "0.7rem 0.85rem",
                    cursor: "pointer",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      borderRadius: "6px",
                      background: sevColor,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconAlertTriangle style={{ width: 17, height: 17 }} />
                  </span>

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 600,
                        fontSize: "0.84rem",
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {anomaly.supportingSignals?.note != null
                        ? (anomaly.supportingSignals.note as React.ReactNode)
                        : `${anomaly.anomalyType.replace(/_/g, " ")} - review recommended`}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.72rem",
                        color: "#64748b",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <strong style={{ color: sevColor }}>{anomaly.severity}</strong>
                      {anomaly.projectName && <>{` · ${anomaly.projectName}`}</>}
                      {anomaly.projectCode && <>{` (${anomaly.projectCode})`}</>}
                      {anomaly.operationalDate && <>{` · Op day ${anomaly.operationalDate}`}</>}
                      {anomaly.anomalyType === "PERSISTENT_LOW_ATTENDANCE"
                        && typeof anomaly.supportingSignals?.streakDays === "number"
                        && (<> · Below expected for {anomaly.supportingSignals.streakDays} consecutive days</>)}
                    </span>
                  </span>

                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "999px",
                      background: status.bg,
                      color: status.color,
                      textTransform: "uppercase",
                    }}
                  >
                    {anomaly.state}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Anomaly review popup */}
      {selectedAnomaly && (
        <div
          className="lightbox-backdrop"
          style={{ zIndex: 100 }}
          role="dialog"
          aria-modal="true"
          aria-label="Anomaly review"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAnomaly(null);
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "transparent",
              padding: 0,
              maxWidth: "620px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <AnomalyReviewPanel
              anomaly={selectedAnomaly}
              onReview={(action) => handleReview(selectedAnomaly.id, action)}
              onClose={() => setSelectedAnomaly(null)}
            />
          </div>
        </div>
      )}

      {/* Project attendance table (Stats view) */}
      {view === "stats" &&
        (calculations.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3>No Attendance Data</h3>
          <p className="muted">
            No attendance calculations available for your authorized jurisdiction.
          </p>
        </div>
      ) : (
        <div className="table-card attendance-table-card" style={{ marginTop: "1.5rem" }}>
          <table className="attendance-table">
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <th style={thStyle}>Project</th>
                <th style={thStyle}>Op Day</th>
                <th style={thStyle}>Expected</th>
                <th style={thStyle}>Present</th>
                <th style={thStyle}>Absent</th>
                <th style={thStyle}>Unknown</th>
                <th style={thStyle}>Data Quality</th>
                <th style={thStyle}>Track Record</th>
              </tr>
            </thead>
            <tbody>
              {filteredCalculations.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      padding: "3rem 1rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <IconSearch
                      width={22}
                      height={22}
                      style={{ opacity: 0.5, margin: "0 auto 0.5rem", display: "block" }}
                    />
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      No attendance rows found
                    </div>
                    <div style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                      Adjust the search query or pick another date to see more.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCalculations.map((calc) => {
                  return (
                    <tr
                      key={`${calc.projectId}:${calc.operationalDate}`}
                      className="table-row"
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={tdStyle}>
                        <Link
                          href={`/projects/${calc.projectId}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                          title={`Open project details for ${getProjectName(calc.projectId)}`}
                        >
                          <strong
                            style={{
                              color: "#1d4ed8",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                            }}
                          >
                            {getProjectName(calc.projectId)}
                          </strong>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "#64748b",
                              marginTop: "2px",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {getProjectCode(calc.projectId)}
                          </div>
                        </Link>
                      </td>
                      <td style={tdStyle}>{calc.operationalDate}</td>
                      <td style={tdStyle}>
                        {calc.expected !== null ? calc.expected : "—"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 600,
                          color:
                            calc.coverage === "COMPLETE"
                              ? "#16a34a"
                              : calc.coverage === "PARTIAL"
                              ? "#d97706"
                              : "#6b7280",
                        }}
                      >
                        {calc.present}
                      </td>
                      <td style={tdStyle}>
                        {calc.absent !== null ? calc.absent : "—"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color:
                            calc.unknown > 0 ? "#dc2626" : "#94a3b8",
                        }}
                      >
                        {calc.unknown}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {calc.dataQuality}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontSize: "0.75rem",
                          color: "#64748b",
                        }}
                      >
                        <Link
                          href={`/attendance/records/${calc.projectId}?year=${calc.operationalDate.slice(0, 4)}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "#2563eb",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                          title={`View yearly attendance record for ${getProjectName(calc.projectId)}`}
                        >
                          View Record
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  fontWeight: 600,
  color: "#475569",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  verticalAlign: "middle",
};
