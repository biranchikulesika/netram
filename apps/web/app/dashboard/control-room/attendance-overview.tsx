"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type {
  AttendanceAnomaly,
  AttendanceCalculation,
  AttendanceReviewAction,
} from "@netram/types";
import { AnomalyReviewPanel } from "./anomaly-review";
import { IconSearch, IconAlertTriangle, IconBarChart } from "../../components/icons";
import { PaginationBar, useClientPagination } from "../../components/pagination-bar";

interface AttendanceOverviewProps {
  calculations: AttendanceCalculation[];
  anomalies: AttendanceAnomaly[];
  selectedDate: string;
  initialSearch?: string;
}

function severityColor(severity: string): string {
  return (
    {
      LOW: "#137e3a",
      MEDIUM: "#dd501e",
      HIGH: "#dd501e",
      CRITICAL: "#dc2626",
    }[severity] ?? "var(--text-muted)"
  );
}

/** Status pill colors per attendance anomaly state (control-room parity). */
function stateStyle(state: string): { bg: string; color: string } {
  switch (state) {
    case "NEW":
      return { bg: "var(--tint-red)", color: "#dc2626" };
    case "REVIEWED":
      return { bg: "var(--tint-navy)", color: "#0c2a52" };
    case "INVESTIGATING":
      return { bg: "var(--tint-orange)", color: "#dd501e" };
    case "ACTIONED":
      return { bg: "var(--tint-green)", color: "#137e3a" };
    case "FALSE_POSITIVE":
      return { bg: "var(--tint-navy)", color: "#0c2a52" };
    case "DISMISSED":
      return { bg: "#edf0f5", color: "var(--text-subtle)" };
    default:
      return { bg: "#edf0f5", color: "var(--text-muted)" };
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
        (calc.projectName ?? "").toLowerCase().includes(q) ||
        (calc.projectCode ?? "").toLowerCase().includes(q) ||
        calc.operationalDate.includes(q)
      );
    });
  }, [calculations, searchQuery]);

  const pagination = useClientPagination(filteredCalculations, 20, [selectedDate, searchQuery]);

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
              {view === "alerts" && (
                <span className={`filter-count-badge ${activeAnomalyCount > 0 ? "danger" : ""}`}>
                  {anomalies.length}
                </span>
              )}
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
              {alertView === "active" && (
                <span className="filter-count-badge">{activeAnomalyCount}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={alertView === "resolved"}
              onClick={() => setAlertView("resolved")}
              className={`filter-tab-btn ${alertView === "resolved" ? "active" : ""}`}
            >
              <span>Resolved</span>
              {alertView === "resolved" && (
                <span className="filter-count-badge">{resolvedAnomalyCount}</span>
              )}
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
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <IconAlertTriangle
                style={{
                  width: 30,
                  height: 30,
                  color: "var(--text-subtle)",
                  margin: "0 auto 0.75rem auto",
                  display: "block",
                }}
              />
              <h3>
                {searchQuery ? "No matching anomalies" : `No ${alertView} attendance anomalies`}
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
                    border: "1px solid var(--color-border-subtle)",
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
                        color: "#002449",
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
                        color: "var(--text-subtle)",
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
                      {anomaly.anomalyType === "PERSISTENT_LOW_ATTENDANCE" &&
                        typeof anomaly.supportingSignals?.streakDays === "number" && (
                          <>
                            {" "}
                            · Below expected for {anomaly.supportingSignals.streakDays} consecutive
                            days
                          </>
                        )}
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
              boxShadow: "0 25px 50px -12px rgba(0,36,73, 0.25)",
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
              border: "1px solid var(--color-border-subtle)",
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
                <tr>
                  <th>Project</th>
                  <th>Op Day</th>
                  <th className="table-align-right">Expected</th>
                  <th className="table-align-right">Present</th>
                  <th className="table-align-right">Absent</th>
                  <th className="table-align-right">Unknown</th>
                  <th>Data Quality</th>
                  <th>Track Record</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalculations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty-state">
                      <IconSearch width={22} height={22} className="table-empty-icon" />
                      <div className="table-empty-title">
                        No attendance records found
                      </div>
                      <div className="table-empty-desc">
                        Adjust the search query or pick another date to see more.
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagination.paginatedItems.map((calc) => {
                    return (
                      <tr
                        key={`${calc.projectId}:${calc.operationalDate}`}
                        className="table-row"
                        onClick={() => router.push(`/dashboard/projects/${calc.projectId}`)}
                        title={`Open project details for ${calc.projectName ?? calc.projectCode ?? "facility"}`}
                      >
                        <td>
                          <Link
                            href={`/dashboard/projects/${calc.projectId}`}
                            className="table-name-link"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open project details for ${calc.projectName ?? calc.projectCode ?? "facility"}`}
                          >
                            {calc.projectName ?? "Sanctioned facility"}
                          </Link>
                          {calc.projectCode && (
                            <div className="table-subtext">
                              <Link
                                href={`/dashboard/projects/${calc.projectId}`}
                                className="table-code-link"
                                onClick={(e) => e.stopPropagation()}
                                title={`Project code: ${calc.projectCode}`}
                              >
                                {calc.projectCode}
                              </Link>
                            </div>
                          )}
                        </td>
                        <td className="table-date">{calc.operationalDate}</td>
                        <td className="table-align-right">{calc.expected !== null ? calc.expected : "—"}</td>
                        <td
                          className="table-align-right"
                          style={{
                            fontWeight: 600,
                            color:
                              calc.coverage === "COMPLETE"
                                ? "#137e3a"
                                : calc.coverage === "PARTIAL"
                                  ? "#dd501e"
                                  : "var(--text-muted)",
                          }}
                        >
                          {calc.present}
                        </td>
                        <td className="table-align-right">{calc.absent !== null ? calc.absent : "—"}</td>
                        <td
                          className="table-align-right"
                          style={{
                            color: calc.unknown > 0 ? "#dc2626" : "var(--text-subtle)",
                          }}
                        >
                          {calc.unknown}
                        </td>
                        <td>
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
                        <td style={{ textAlign: "right" }}>
                          <Link
                            href={`/dashboard/attendance/records/${calc.projectId}?year=${calc.operationalDate.slice(0, 4)}`}
                            className="btn-secondary"
                            style={{ fontSize: "0.74rem", padding: "0.22rem 0.55rem", whiteSpace: "nowrap" }}
                            onClick={(e) => e.stopPropagation()}
                            title={`View yearly attendance record for ${calc.projectName ?? "Sanctioned facility"}`}
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

            <PaginationBar
              from={pagination.from}
              to={pagination.to}
              total={pagination.total}
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              itemName="attendance records"
              onPageClick={pagination.onPageClick}
              onPageSizeChange={pagination.onPageSizeChange}
            />
          </div>
        ))}
    </section>
  );
}
