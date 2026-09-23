"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { AuthorityAnalyticsOverview } from "@netram/types";
import {
  IconTrendingUp,
  IconShieldCheck,
  IconAlertTriangle,
  IconClock,
  IconChevronRight,
} from "../../components/icons";

export interface AnalyticsViewProps {
  initialOverview: AuthorityAnalyticsOverview;
  selectedDistrictId?: string;
  userEmail: string;
}

export function AnalyticsView({
  initialOverview,
  selectedDistrictId = "",
  userEmail,
}: AnalyticsViewProps) {
  const [districtFilter, setDistrictFilter] = useState(selectedDistrictId);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<AuthorityAnalyticsOverview>(initialOverview);

  const handleFilterChange = async (newDistrictId: string) => {
    setDistrictFilter(newDistrictId);
    setLoading(true);
    try {
      const url = newDistrictId
        ? `/api/analytics?districtId=${encodeURIComponent(newDistrictId)}`
        : `/api/analytics`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as AuthorityAnalyticsOverview;
        setOverview(data);
      }
    } catch (err) {
      console.error("Failed to fetch scoped analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const { summary, slaComplianceByJurisdiction, deficiencyRecurrence, inspectionClosureVelocity } =
    overview;

  // SLA status color helper
  const getSlaBadge = (rate: number) => {
    if (rate >= 90) {
      return {
        label: "Optimal",
        bg: "#dcfce7",
        color: "#15803d",
        border: "#bbf7d0",
      };
    }
    if (rate >= 75) {
      return {
        label: "Attention Advised",
        bg: "#fef3c7",
        color: "#b45309",
        border: "#fde68a",
      };
    }
    return {
      label: "Critical Breach",
      bg: "#fee2e2",
      color: "#b91c1c",
      border: "#fecaca",
    };
  };

  const overallBadge = getSlaBadge(summary.overallSlaComplianceRate);

  return (
    <div className="analytics-view" style={{ maxWidth: "1280px", margin: "0 auto", padding: "1.5rem" }}>
      {/* Top Header & Jurisdiction Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--color-navy-brand, #1e293b)",
                background: "#f1f5f9",
                padding: "2px 8px",
                borderRadius: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <IconTrendingUp width={12} height={12} />
              Authority Oversight Suite
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              • Synced: {new Date(overview.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--color-navy-brand, #0f172a)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Statutory Analytics & SLA Intelligence
          </h1>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.9rem" }}>
            Jurisdiction compliance monitoring, deficiency recurrence analysis, and inspection closure velocity.
          </p>
        </div>

        {/* District Jurisdiction Scoper */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "#ffffff",
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <label
            htmlFor="jurisdiction-select"
            style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}
          >
            Jurisdiction:
          </label>
          <select
            id="jurisdiction-select"
            value={districtFilter}
            disabled={loading}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#1e293b",
              padding: "0.35rem 0.6rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Assigned Jurisdictions</option>
            {slaComplianceByJurisdiction.map((d) => (
              <option key={d.districtId} value={d.districtId}>
                {d.districtName} ({d.districtCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Primary KPI Executive Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {/* Card 1: SLA Compliance */}
        <div
          className="kpi-card"
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              SLA Compliance
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "12px",
                background: overallBadge.bg,
                color: overallBadge.color,
                border: `1px solid ${overallBadge.border}`,
              }}
            >
              {overallBadge.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
              {summary.overallSlaComplianceRate}%
            </span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>of statutory deadlines met</span>
          </div>
          {/* Progress bar */}
          <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden", marginBottom: "0.75rem" }}>
            <div
              style={{
                height: "100%",
                width: `${summary.overallSlaComplianceRate}%`,
                background: summary.overallSlaComplianceRate >= 90 ? "#16a34a" : summary.overallSlaComplianceRate >= 75 ? "#d97706" : "#dc2626",
                borderRadius: "3px",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
            <span>Total Orders: <strong>{summary.totalCorrectiveActions}</strong></span>
            <span>Overdue: <strong style={{ color: summary.overdueCorrectiveActions > 0 ? "#dc2626" : "inherit" }}>{summary.overdueCorrectiveActions}</strong></span>
            <span>Resolved: <strong style={{ color: "#16a34a" }}>{summary.resolvedCorrectiveActions}</strong></span>
          </div>
        </div>

        {/* Card 2: Closure Velocity */}
        <div
          className="kpi-card"
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Inspection Velocity
            </span>
            <IconClock width={16} height={16} style={{ color: "#3b82f6" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
              {summary.averageClosureDays}
            </span>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>days avg cycle</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 0.75rem 0" }}>
            Time from inspection initiation to final statutory dossier sealing.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
            <span>Total: <strong>{summary.totalInspections}</strong></span>
            <span>In-Field: <strong>{inspectionClosureVelocity.inProgressInspections}</strong></span>
            <span>Closed: <strong style={{ color: "#16a34a" }}>{summary.closedInspections}</strong></span>
          </div>
        </div>

        {/* Card 3: Deficiencies Identified */}
        <div
          className="kpi-card"
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Deficiencies Logged
            </span>
            <IconAlertTriangle width={16} height={16} style={{ color: "#eab308" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
              {summary.totalFindings}
            </span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>statutory deficiencies</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                background: summary.criticalFindingsCount > 0 ? "#fee2e2" : "#f1f5f9",
                color: summary.criticalFindingsCount > 0 ? "#b91c1c" : "#64748b",
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              {summary.criticalFindingsCount} Critical
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              in active monitoring
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
            <span>Facilities: <strong>{summary.totalProjects}</strong></span>
            <span>Active: <strong style={{ color: "#16a34a" }}>{summary.activeProjects}</strong></span>
          </div>
        </div>

        {/* Card 4: Citizen Grievance Redressal */}
        <div
          className="kpi-card"
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "1.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Citizen Grievances
            </span>
            <IconShieldCheck width={16} height={16} style={{ color: "#10b981" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
              {summary.complaintRedressalRate}%
            </span>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>resolved</span>
          </div>
          <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden", marginBottom: "0.75rem" }}>
            <div
              style={{
                height: "100%",
                width: `${summary.complaintRedressalRate}%`,
                background: "#10b981",
                borderRadius: "3px",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
            <span>Complaints: <strong>{summary.totalComplaints}</strong></span>
            <span>Redressed: <strong style={{ color: "#16a34a" }}>{summary.resolvedComplaints}</strong></span>
          </div>
        </div>
      </div>

      {/* Section 1: Jurisdiction-Level SLA Compliance Table */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          marginBottom: "2rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
              Jurisdiction SLA Compliance & Escalation Matrix
            </h2>
            <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Corrective action orders, statutory deadlines, and enforcement velocity by administrative district.
            </p>
          </div>
          <Link
            href="/dashboard/corrective-actions"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#2563eb",
              textDecoration: "none",
            }}
          >
            View Corrective Actions <IconChevronRight width={14} height={14} />
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>
                <th style={{ padding: "0.75rem 1.25rem" }}>Jurisdiction</th>
                <th style={{ padding: "0.75rem 1rem" }}>Code</th>
                <th style={{ padding: "0.75rem 1rem" }}>Total Orders</th>
                <th style={{ padding: "0.75rem 1rem" }}>Pending</th>
                <th style={{ padding: "0.75rem 1rem" }}>Submitted</th>
                <th style={{ padding: "0.75rem 1rem" }}>Overdue</th>
                <th style={{ padding: "0.75rem 1rem" }}>Resolved</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>SLA Compliance</th>
                <th style={{ padding: "0.75rem 1.25rem" }}>Statutory Status</th>
              </tr>
            </thead>
            <tbody>
              {slaComplianceByJurisdiction.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                    No corrective action orders recorded in this jurisdiction scope.
                  </td>
                </tr>
              ) : (
                slaComplianceByJurisdiction.map((d) => {
                  const badge = getSlaBadge(d.slaComplianceRate);
                  return (
                    <tr
                      key={d.districtId}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.75rem 1.25rem", fontWeight: 600, color: "#1e293b" }}>
                        {d.districtName}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#64748b", fontFamily: "monospace" }}>
                        {d.districtCode}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{d.totalActions}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#64748b" }}>{d.pendingActions}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#0284c7" }}>{d.submittedActions}</td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontWeight: d.overdueActions > 0 ? 700 : 400,
                          color: d.overdueActions > 0 ? "#dc2626" : "#64748b",
                        }}
                      >
                        {d.overdueActions}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#16a34a", fontWeight: 600 }}>
                        {d.acceptedActions}
                      </td>
                      <td style={{ padding: "0.75rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 700, minWidth: "40px" }}>{d.slaComplianceRate}%</span>
                          <div
                            style={{
                              flex: 1,
                              height: "6px",
                              background: "#e2e8f0",
                              borderRadius: "3px",
                              overflow: "hidden",
                              maxWidth: "80px",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${d.slaComplianceRate}%`,
                                background:
                                  d.slaComplianceRate >= 90
                                    ? "#16a34a"
                                    : d.slaComplianceRate >= 75
                                    ? "#d97706"
                                    : "#dc2626",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1.25rem" }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Deficiency Recurrence & Safety Root Causes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Left: Deficiency Recurrence Taxonomy */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            padding: "1.25rem",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: "#0f172a" }}>
              Deficiency Recurrence Taxonomy
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
              Systemic findings classified across safety, hygiene, structural, and staffing standards.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {deficiencyRecurrence.map((item) => (
              <div
                key={item.category}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>
                    {item.category}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: "#e2e8f0",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      color: "#334155",
                    }}
                  >
                    {item.totalOccurrences} cases
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                  {item.severityBreakdown.critical > 0 && (
                    <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                      {item.severityBreakdown.critical} Critical
                    </span>
                  )}
                  {item.severityBreakdown.high > 0 && (
                    <span style={{ background: "#ffedd5", color: "#c2410c", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                      {item.severityBreakdown.high} High
                    </span>
                  )}
                  {item.severityBreakdown.medium > 0 && (
                    <span style={{ background: "#fef9c3", color: "#854d0e", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                      {item.severityBreakdown.medium} Med
                    </span>
                  )}
                  {item.severityBreakdown.low > 0 && (
                    <span style={{ background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                      {item.severityBreakdown.low} Low
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", color: "#64748b" }}>
                    Open: <strong style={{ color: item.unresolvedCount > 0 ? "#dc2626" : "inherit" }}>{item.unresolvedCount}</strong> | Closed: <strong style={{ color: "#16a34a" }}>{item.resolvedCount}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Inspection Velocity Breakdown */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            padding: "1.25rem",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.25rem 0", color: "#0f172a" }}>
              Inspection Closure Velocity by Administrative Unit
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
              Cycle time (days) from assignment to formal statutory review and sealing.
            </p>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>District</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Conducted</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Closed</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Avg Closure Time</th>
              </tr>
            </thead>
            <tbody>
              {inspectionClosureVelocity.velocityByJurisdiction.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "1.5rem", textAlign: "center", color: "#94a3b8" }}>
                    No inspection activity recorded in this scope.
                  </td>
                </tr>
              ) : (
                inspectionClosureVelocity.velocityByJurisdiction.map((v) => (
                  <tr key={v.districtId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "#1e293b" }}>
                      {v.districtName}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{v.totalInspections}</td>
                    <td style={{ padding: "0.6rem 0.75rem", color: "#16a34a", fontWeight: 600 }}>
                      {v.closedInspections}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", fontWeight: 700, color: "#0f172a" }}>
                      {v.averageClosureDays > 0 ? `${v.averageClosureDays} days` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Quick statutory links */}
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Active Officer: <strong>{userEmail}</strong>
            </span>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Link
                href="/dashboard/reports"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
              >
                Inspection Dossiers →
              </Link>
              <Link
                href="/dashboard/audit"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
              >
                Statutory Audit Trail →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
