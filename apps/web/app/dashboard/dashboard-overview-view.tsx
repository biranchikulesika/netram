"use client";

import React from "react";
import Link from "next/link";
import type {
  Project,
  Inspection,
  PublicCctvCamera,
  Complaint,
  CorrectiveAction,
  AIAnomaly,
  AuditEvent,
  FundSummary,
} from "@netram/types";
import { formatRoleTitle, formatDate } from "../../lib/presentation";
import {
  IconBuilding,
  IconClipboard,
  IconVideo,
  IconShieldCheck,
  IconAlertTriangle,
  IconLock,
  IconIndianRupee,
  IconSettings,
  IconFileText,
  IconUser,
} from "../components/icons";

export interface DashboardOverviewViewProps {
  userEmail: string;
  userDisplayName?: string | null;
  userRole?: string | null;
  permissions: string[];
  stats: {
    projectsCount: number;
    inspectionsCount: number;
    camerasCount: number;
    complaintsCount: number;
    correctiveActionsCount: number;
    anomaliesCount: number;
  };
  recentProjects: Project[];
  recentInspections: Inspection[];
  recentCameras: PublicCctvCamera[];
  recentComplaints: Complaint[];
  recentCorrectiveActions: CorrectiveAction[];
  recentAnomalies: AIAnomaly[];
  recentAuditEvents: AuditEvent[];
  fundSummary?: FundSummary | null;
}

export function DashboardOverviewView({
  userEmail,
  userDisplayName,
  userRole,
  permissions: _permissions,
  stats,
  recentProjects: _recentProjects,
  recentInspections,
  recentCameras: _recentCameras,
  recentComplaints: _recentComplaints,
  recentCorrectiveActions: _recentCorrectiveActions,
  recentAnomalies,
  recentAuditEvents,
  fundSummary: _fundSummary,
}: DashboardOverviewViewProps) {
  const roleTitle = formatRoleTitle(userRole);

  const kpis = [
    {
      title: "Projects & Facilities",
      count: stats.projectsCount,
      label: "Registered facilities",
      href: "/dashboard/projects",
      icon: IconBuilding,
      color: "#0f2d59",
      bg: "#edf2fa",
    },
    {
      title: "Field Inspections",
      count: stats.inspectionsCount,
      label: "Audits on record",
      href: "/dashboard/inspections",
      icon: IconClipboard,
      color: "#1d4ed8",
      bg: "#eff6ff",
    },
    {
      title: "Surveillance Cameras",
      count: stats.camerasCount,
      label: `${stats.anomaliesCount} anomaly ${stats.anomaliesCount === 1 ? "alert" : "alerts"}`,
      href: "/dashboard/control-room",
      icon: IconVideo,
      color: "#0891b2",
      bg: "#ecfeff",
    },
    {
      title: "Corrective Actions",
      count: stats.correctiveActionsCount,
      label: "Compliance notices",
      href: "/dashboard/corrective-actions",
      icon: IconShieldCheck,
      color: "#b45309",
      bg: "#fffbeb",
    },
    {
      title: "Complaints",
      count: stats.complaintsCount,
      label: "Grievances logged",
      href: "/dashboard/complaints",
      icon: IconAlertTriangle,
      color: "#c2410c",
      bg: "#fff7ed",
    },
  ];

  const operationalModules = [
    {
      domain: "Field Operations",
      items: [
        {
          title: "Projects & Infrastructure",
          description: "Facility dossiers, GIS locations, and verification status",
          href: "/dashboard/projects",
          icon: IconBuilding,
          badge: `${stats.projectsCount} total`,
        },
        {
          title: "Field Inspections",
          description: "On-site audits, scheduled assignments, and observation evidence",
          href: "/dashboard/inspections",
          icon: IconClipboard,
          badge: `${stats.inspectionsCount} audits`,
        },
        {
          title: "Corrective Actions",
          description: "Formal notices, remedial deadlines, and compliance resolution",
          href: "/dashboard/corrective-actions",
          icon: IconShieldCheck,
          badge: `${stats.correctiveActionsCount} active`,
        },
        {
          title: "Grievances & Complaints",
          description: "Citizen and whistleblower submissions under institutional review",
          href: "/dashboard/complaints",
          icon: IconAlertTriangle,
          badge: `${stats.complaintsCount} logged`,
        },
      ],
    },
    {
      domain: "Monitoring & Finance",
      items: [
        {
          title: "CCTV Control Room",
          description: "Authorized real-time streams and AI anomaly detections",
          href: "/dashboard/control-room",
          icon: IconVideo,
          badge: `${stats.camerasCount} feeds`,
        },
        {
          title: "Automated Attendance",
          description: "Daily muster roll verification and biometric attendance logs",
          href: "/dashboard/attendance",
          icon: IconUser,
          badge: "Telemetry",
        },
        {
          title: "Funds & Expenditure",
          description: "Central scheme allocations, treasury releases, and expense records",
          href: "/dashboard/funds",
          icon: IconIndianRupee,
          badge: "Financials",
        },
      ],
    },
    {
      domain: "Governance & Administration",
      items: [
        {
          title: "Entity Registrations",
          description: "Onboard new agencies, schemes, inspectors, and departmental officials",
          href: "/dashboard/registry",
          icon: IconFileText,
          badge: "Onboarding",
        },
        {
          title: "Immutable Audit Log",
          description: "Tamper-evident operational event stream and identity tracking",
          href: "/dashboard/audit",
          icon: IconLock,
          badge: "Security",
        },
        {
          title: "Role & Access Control",
          description: "Server-authoritative role assignments and jurisdiction boundaries",
          href: "/dashboard/admin",
          icon: IconSettings,
          badge: "RBAC",
        },
      ],
    },
  ];

  return (
    <div>
      {/* Executive Welcome Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0a1f3d 0%, #0f2d59 100%)",
          color: "#ffffff",
          borderRadius: "10px",
          padding: "1.5rem 1.75rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          boxShadow: "0 4px 12px rgba(15, 45, 89, 0.12)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: "rgba(255, 255, 255, 0.12)",
                padding: "0.15rem 0.5rem",
                borderRadius: "4px",
                color: "#93c5fd",
              }}
            >
              DoSJE Monitoring System
            </span>
            <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>&bull; Netram Platform</span>
          </div>

          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
            Overview Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "#e2e8f0" }}>
            Welcome back, <strong>{userDisplayName || userEmail}</strong> &bull; Assigned as{" "}
            <span style={{ color: "#93c5fd", fontWeight: 600 }}>{roleTitle}</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link
            href="/dashboard/projects"
            className="btn-secondary"
            style={{
              padding: "0.45rem 0.9rem",
              fontSize: "0.82rem",
              background: "rgba(255, 255, 255, 0.1)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              textDecoration: "none",
            }}
          >
            Facilities
          </Link>
          <Link
            href="/dashboard/control-room"
            className="btn-secondary"
            style={{
              padding: "0.45rem 0.9rem",
              fontSize: "0.82rem",
              background: "#1d4ed8",
              borderColor: "#1d4ed8",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Live Streams
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        {kpis.map((kpi) => {
          const IconComponent = kpi.icon;
          return (
            <Link
              key={kpi.title}
              href={kpi.href}
              style={{
                textDecoration: "none",
                display: "block",
                background: "var(--bg-surface)",
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                borderRadius: "8px",
                padding: "1rem 1.15rem",
                boxShadow: "0 1px 3px rgba(12, 42, 82, 0.04)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 45, 89, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(12, 42, 82, 0.04)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary, #64748b)" }}>
                  {kpi.title}
                </span>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    background: kpi.bg,
                    color: kpi.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconComponent style={{ width: 16, height: 16 }} />
                </div>
              </div>

              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-navy-brand, #0f2d59)", lineHeight: 1.1 }}>
                {kpi.count}
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.3rem" }}>
                {kpi.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Grid: Operational Modules & Activity Stream */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column: Grouped Operational Modules */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {operationalModules.map((section) => (
            <div
              key={section.domain}
              className="table-card"
              style={{
                padding: "1.25rem 1.4rem",
                margin: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
                  paddingBottom: "0.65rem",
                  marginBottom: "0.85rem",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "var(--color-navy-brand, #0f2d59)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {section.domain}
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        padding: "0.75rem 0.85rem",
                        borderRadius: "7px",
                        border: "1px solid var(--color-border-subtle, #f1f5f9)",
                        background: "var(--bg-subtle, #f8fafc)",
                        textDecoration: "none",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#ffffff";
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--bg-subtle, #f8fafc)";
                        e.currentTarget.style.borderColor = "var(--color-border-subtle, #f1f5f9)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "6px",
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          color: "var(--color-navy-brand, #0f2d59)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        <ItemIcon style={{ width: 15, height: 15 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--color-navy-brand, #0f2d59)" }}>
                            {item.title}
                          </span>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              background: "#e2e8f0",
                              color: "#475569",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.76rem", color: "var(--text-secondary, #64748b)", lineHeight: 1.35 }}>
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Live Audit Activity & Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Active AI / Anomaly Alerts */}
          {recentAnomalies.length > 0 && (
            <div
              className="table-card"
              style={{
                padding: "1rem 1.15rem",
                margin: 0,
                borderLeft: "4px solid #f59e0b",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem" }}>
                <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
                  Surveillance Alerts
                </span>
                <Link
                  href="/dashboard/control-room"
                  style={{ fontSize: "0.75rem", color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}
                >
                  View All &rarr;
                </Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {recentAnomalies.slice(0, 3).map((anomaly) => (
                  <div
                    key={anomaly.id}
                    style={{
                      padding: "0.5rem 0.65rem",
                      borderRadius: "6px",
                      background: "#fffbeb",
                      border: "1px solid #fef3c7",
                      fontSize: "0.76rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "#92400e", textTransform: "capitalize" }}>
                        {anomaly.type.replace(/_/g, " ")}
                      </strong>
                      <span style={{ color: "#b45309", fontSize: "0.7rem", textTransform: "capitalize" }}>
                        {anomaly.status}
                      </span>
                    </div>
                    <div style={{ color: "#78350f", marginTop: "0.15rem", fontSize: "0.74rem" }}>
                      Severity: {anomaly.severity} &bull; Confidence: {(anomaly.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Field Inspections */}
          <div
            className="table-card"
            style={{
              padding: "1rem 1.15rem",
              margin: 0,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem" }}>
              <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
                Recent Audits
              </span>
              <Link
                href="/dashboard/inspections"
                style={{ fontSize: "0.75rem", color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}
              >
                All Audits &rarr;
              </Link>
            </div>

            {recentInspections.length === 0 ? (
              <p className="muted" style={{ fontStyle: "italic", fontSize: "0.78rem", margin: 0 }}>
                No recent inspections recorded.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {recentInspections.slice(0, 4).map((i) => (
                  <Link
                    key={i.id}
                    href={`/dashboard/inspections/${i.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.45rem 0.65rem",
                      borderRadius: "6px",
                      background: "var(--bg-subtle, #f8fafc)",
                      border: "1px solid var(--color-border-subtle, #e2e8f0)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-navy-brand)", textTransform: "capitalize" }}>
                        {i.type ? i.type.replace(/_/g, " ") : "Inspection"}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {formatDate(i.scheduledStart || i.createdAt)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        background: "#e2e8f0",
                        color: "#334155",
                        textTransform: "capitalize",
                      }}
                    >
                      {i.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Audit Log Stream */}
          <div
            className="table-card"
            style={{
              padding: "1rem 1.15rem",
              margin: 0,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem" }}>
              <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
                Live Audit Activity
              </span>
              <Link
                href="/dashboard/audit"
                style={{ fontSize: "0.75rem", color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}
              >
                Explorer &rarr;
              </Link>
            </div>

            {recentAuditEvents.length === 0 ? (
              <p className="muted" style={{ fontStyle: "italic", fontSize: "0.78rem", margin: 0 }}>
                No audit events available.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {recentAuditEvents.slice(0, 5).map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: "0.45rem 0.6rem",
                      borderRadius: "6px",
                      background: "var(--bg-subtle, #f8fafc)",
                      border: "1px solid var(--color-border-subtle, #e2e8f0)",
                      fontSize: "0.74rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--color-navy-brand)",
                          fontFamily: "var(--font-mono)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {evt.action}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", flexShrink: 0 }}>
                        {formatDate(evt.occurredAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                      {evt.actorUserId ? `Actor: ${evt.actorUserId.slice(0, 8)}…` : (evt.resourceType ? `Target: ${evt.resourceType}` : "System Service")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
