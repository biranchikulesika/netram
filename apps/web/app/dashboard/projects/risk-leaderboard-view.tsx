"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { ProjectRankEntry, CompositeRiskLevel } from "@netram/types";
import { IconSearch } from "../components/icons";

interface RiskLeaderboardViewProps {
  initialRankings: ProjectRankEntry[];
  canEvaluate: boolean;
  onRefresh?: () => void;
}

const LEVEL_STYLES: Record<CompositeRiskLevel, { text: string; bg: string; border: string; label: string }> = {
  critical: { text: "#dc2626", bg: "#fef2f2", border: "#f87171", label: "Critical" },
  high: { text: "#ea580c", bg: "#fff7ed", border: "#fdba74", label: "High" },
  medium: { text: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Medium" },
  low: { text: "#059669", bg: "#f0fdf4", border: "#86efac", label: "Low" },
};

export function RiskLeaderboardView({
  initialRankings,
  canEvaluate,
}: RiskLeaderboardViewProps) {
  const [rankings, setRankings] = useState<ProjectRankEntry[]>(initialRankings);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [sweeping, setSweeping] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Summary counts
  const summary = useMemo(() => {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const r of rankings) {
      if (r.riskLevel === "critical") critical++;
      else if (r.riskLevel === "high") high++;
      else if (r.riskLevel === "medium") medium++;
      else low++;
    }
    return { total: rankings.length, critical, high, medium, low };
  }, [rankings]);

  // Filtered entries
  const filtered = useMemo(() => {
    return rankings.filter((r) => {
      if (levelFilter !== "ALL" && r.riskLevel.toUpperCase() !== levelFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const nameMatch = r.projectName.toLowerCase().includes(q);
        const codeMatch = r.projectCode.toLowerCase().includes(q);
        const districtMatch = r.districtName?.toLowerCase().includes(q) ?? false;
        const orgMatch = r.organisationName?.toLowerCase().includes(q) ?? false;
        return nameMatch || codeMatch || districtMatch || orgMatch;
      }
      return true;
    });
  }, [rankings, search, levelFilter]);

  async function fetchRankings() {
    try {
      const res = await fetch("/api/v1/project-risk/rankings?pageSize=100");
      if (res.ok) {
        const data = await res.json();
        setRankings(data.items || []);
      }
    } catch {
      // silent fallback
    }
  }

  async function handleSweep() {
    setSweeping(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/project-risk/sweep", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to trigger sweep");
      }
      const data = await res.json();
      setMessage({
        type: "success",
        text: `Sweep completed: Re-scored ${data.evaluatedCount} facilities (${data.scheduledCount} inspections scheduled).`,
      });
      await fetchRankings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: msg });
    } finally {
      setSweeping(false);
    }
  }

  async function handleEvaluateSingle(projectId: string) {
    setEvaluatingId(projectId);
    try {
      const res = await fetch(`/api/v1/project-risk/evaluate/${projectId}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Evaluation failed");
      }
      await fetchRankings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: msg });
    } finally {
      setEvaluatingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Metric Cards Banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            borderLeft: "4px solid #64748b",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
            Total Facilities Ranked
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>
            {summary.total}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Priority sorted by Composite Score
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            borderLeft: "4px solid #dc2626",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 600, textTransform: "uppercase" }}>
            Critical Risk (≥ 75)
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#dc2626", marginTop: "0.25rem" }}>
            {summary.critical}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Urgent oversight required
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #fed7aa",
            borderLeft: "4px solid #ea580c",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#ea580c", fontWeight: 600, textTransform: "uppercase" }}>
            High Risk (50–74)
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#ea580c", marginTop: "0.25rem" }}>
            {summary.high}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Eligible for auto-scheduling
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #fef08a",
            borderLeft: "4px solid #d97706",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600, textTransform: "uppercase" }}>
            Medium Risk (25–49)
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#d97706", marginTop: "0.25rem" }}>
            {summary.medium}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Elevated monitoring
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #bbf7d0",
            borderLeft: "4px solid #059669",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600, textTransform: "uppercase" }}>
            Low Risk (&lt; 25)
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#059669", marginTop: "0.25rem" }}>
            {summary.low}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
            Routine inspection cycle
          </div>
        </div>
      </div>

      {/* Notice / Feedback Banner */}
      {message && (
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: "8px",
            fontSize: "0.875rem",
            backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: message.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: "1 1 300px" }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              flex: 1,
              maxWidth: 380,
            }}
          >
            <IconSearch
              style={{
                position: "absolute",
                left: 12,
                width: 16,
                height: 16,
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="search"
              placeholder="Search ranked facilities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                fontSize: "0.875rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                outline: "none",
              }}
            />
          </div>

          {/* Level Filter Tabs */}
          <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "#f1f5f9", padding: 3, borderRadius: 8 }}>
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                style={{
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: levelFilter === lvl ? 600 : 500,
                  color: levelFilter === lvl ? "#0f172a" : "#64748b",
                  backgroundColor: levelFilter === lvl ? "#ffffff" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  boxShadow: levelFilter === lvl ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {canEvaluate && (
          <button
            type="button"
            onClick={handleSweep}
            disabled={sweeping}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: sweeping ? "#94a3b8" : "#0f766e",
              border: "none",
              borderRadius: "8px",
              cursor: sweeping ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            {sweeping ? "Sweeping Active Facilities..." : "🔄 Sweep & Re-Score Active Facilities"}
          </button>
        )}
      </div>

      {/* Leaderboard Table Card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "0.75rem 1rem", width: 60, fontWeight: 600 }}>Rank</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Facility / Institute</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>District</th>
                <th style={{ padding: "0.75rem 1rem", width: 150, fontWeight: 600 }}>Composite Score</th>
                <th style={{ padding: "0.75rem 1rem", minWidth: 220, fontWeight: 600 }}>Primary Risk Drivers</th>
                <th style={{ padding: "0.75rem 1rem", width: 160, fontWeight: 600 }}>Field State</th>
                <th style={{ padding: "0.75rem 1rem", width: 100, textAlign: "right", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
                    No ranked facilities match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((entry, idx) => {
                  const style = LEVEL_STYLES[entry.riskLevel];
                  const rank = idx + 1;
                  const isEvaluating = evaluatingId === entry.projectId;

                  return (
                    <tr
                      key={entry.projectId}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfdfe",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: style.text,
                            backgroundColor: style.bg,
                            border: `1px solid ${style.border}`,
                          }}
                        >
                          #{rank}
                        </span>
                      </td>

                      {/* Facility */}
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <Link
                          href={`/projects/${entry.projectId}`}
                          style={{
                            fontWeight: 600,
                            color: "#0f172a",
                            textDecoration: "none",
                            display: "block",
                          }}
                        >
                          {entry.projectName}
                        </Link>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                          {entry.projectCode} · {entry.organisationName || "Direct Sanction"}
                        </div>
                      </td>

                      {/* District */}
                      <td style={{ padding: "0.875rem 1rem", color: "#475569" }}>
                        {entry.districtName || "State / Central"}
                      </td>

                      {/* Composite Score Badge */}
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "1.125rem",
                              fontWeight: 800,
                              color: style.text,
                              lineHeight: 1,
                            }}
                          >
                            {Math.round(entry.totalScore)}
                          </span>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              color: style.text,
                              backgroundColor: style.bg,
                              border: `1px solid ${style.border}`,
                            }}
                          >
                            {style.label}
                          </span>
                        </div>
                      </td>

                      {/* Primary Risk Drivers */}
                      <td style={{ padding: "0.875rem 1rem" }}>
                        {entry.topContributors && entry.topContributors.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {entry.topContributors.slice(0, 2).map((c, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#334155",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                }}
                              >
                                <span
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    backgroundColor: "#fee2e2",
                                    color: "#dc2626",
                                    fontSize: "0.625rem",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  {i + 1}
                                </span>
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 240,
                                  }}
                                  title={c.explanation}
                                >
                                  {c.explanation}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            No elevated risk factors
                          </span>
                        )}
                      </td>

                      {/* Field / Dispatch State */}
                      <td style={{ padding: "0.875rem 1rem", fontSize: "0.75rem" }}>
                        {entry.openInspectionCount > 0 ? (
                          <span style={{ color: "#2563eb", fontWeight: 600 }}>
                            🔍 {entry.openInspectionCount} active inspection{entry.openInspectionCount === 1 ? "" : "s"}
                          </span>
                        ) : entry.totalScore >= 50 ? (
                          <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                            ⚡ Auto-schedule eligible
                          </span>
                        ) : (
                          <span style={{ color: "#059669" }}>
                            Normal oversight
                          </span>
                        )}
                        {entry.hasOpenFlag && (
                          <div style={{ color: "#ea580c", marginTop: 2, fontWeight: 500 }}>
                            ⚠️ Flag pending review
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.375rem" }}>
                          {canEvaluate && (
                            <button
                              type="button"
                              onClick={() => handleEvaluateSingle(entry.projectId)}
                              disabled={isEvaluating}
                              title="Re-evaluate Composite Risk"
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                                backgroundColor: isEvaluating ? "#f1f5f9" : "#ffffff",
                                color: isEvaluating ? "#94a3b8" : "#334155",
                                cursor: isEvaluating ? "not-allowed" : "pointer",
                              }}
                            >
                              {isEvaluating ? "..." : "⚡"}
                            </button>
                          )}
                          <Link
                            href={`/projects/${entry.projectId}`}
                            style={{
                              padding: "0.25rem 0.625rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              borderRadius: 4,
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#ffffff",
                              color: "#2563eb",
                              textDecoration: "none",
                            }}
                          >
                            View →
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
      </div>
    </div>
  );
}
