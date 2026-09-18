"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Complaint } from "@netram/types";
import { formatDate } from "../../lib/presentation";
import { ComplaintTransitionModal } from "./complaint-transition-modal";
import { CreateComplaintModal } from "./create-complaint-modal";

export interface ComplaintsLayoutProps {
  initialComplaints: Complaint[];
  totalComplaints: number;
  projects: Array<{ id: string; code: string; name: string }>;
  canCreate: boolean;
  canResolve: boolean;
}

function getComplaintStatusBadge(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "received":
      return { bg: "#e0f2fe", color: "#0369a1", label: "RECEIVED" };
    case "under_review":
      return { bg: "#fef3c7", color: "#b45309", label: "UNDER REVIEW" };
    case "escalated":
      return { bg: "#fee2e2", color: "#dc2626", label: "ESCALATED" };
    case "resolved":
      return { bg: "#dcfce7", color: "#15803d", label: "RESOLVED" };
    case "closed":
      return { bg: "#f1f5f9", color: "#475569", label: "CLOSED" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: status.toUpperCase() };
  }
}

export function ComplaintsLayout({
  initialComplaints,
  totalComplaints: _totalComplaints,
  projects,
  canCreate,
  canResolve,
}: ComplaintsLayoutProps) {
  const [complaintList, setComplaintList] = useState<Complaint[]>(initialComplaints);
  const [filter, setFilter] = useState<"ALL" | "ACTION_REQUIRED" | "ESCALATED" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForTransition, setSelectedForTransition] = useState<Complaint | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Metrics
  const metrics = useMemo(() => {
    const total = complaintList.length;
    const received = complaintList.filter((c) => c.status === "received").length;
    const underReview = complaintList.filter((c) => c.status === "under_review").length;
    const escalated = complaintList.filter((c) => c.status === "escalated").length;
    const resolved = complaintList.filter((c) => c.status === "resolved" || c.status === "closed").length;
    return { total, received, underReview, escalated, resolved };
  }, [complaintList]);

  // Filtered complaints
  const filtered = useMemo(() => {
    return complaintList.filter((c) => {
      // Tab filter
      if (filter === "ACTION_REQUIRED" && c.status !== "received" && c.status !== "under_review") {
        return false;
      }
      if (filter === "ESCALATED" && c.status !== "escalated") {
        return false;
      }
      if (filter === "RESOLVED" && c.status !== "resolved" && c.status !== "closed") {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = c.trackingCode.toLowerCase().includes(q);
        const matchesProject =
          c.projectCode.toLowerCase().includes(q) || c.projectName.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesComplainant = c.complainantName?.toLowerCase().includes(q);
        return matchesCode || matchesProject || matchesDesc || matchesComplainant;
      }

      return true;
    });
  }, [complaintList, filter, searchQuery]);

  return (
    <div>
      {/* Top Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.25rem 0", color: "var(--color-navy-brand)" }}>
            Complaints & Grievances
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Public oversight inputs and facility grievances under governance lifecycle §35
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link
            href="/track-complaint"
            className="btn-secondary"
            style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
          >
            Citizen Tracking Portal →
          </Link>
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="btn-primary"
              style={{
                fontSize: "0.82rem",
                padding: "0.45rem 1rem",
                background: "var(--color-navy-brand)",
              }}
            >
              + Register Grievance
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #0284c7" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>RECEIVED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0369a1", marginTop: "0.2rem" }}>
            {metrics.received}
          </div>
        </div>

        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>UNDER REVIEW</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#b45309", marginTop: "0.2rem" }}>
            {metrics.underReview}
          </div>
        </div>

        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>ESCALATED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#dc2626", marginTop: "0.2rem" }}>
            {metrics.escalated}
          </div>
        </div>

        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>RESOLVED / CLOSED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#15803d", marginTop: "0.2rem" }}>
            {metrics.resolved}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            className={`filter-tab-btn ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "ALL" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "ALL" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            All ({metrics.total})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${filter === "ACTION_REQUIRED" ? "active" : ""}`}
            onClick={() => setFilter("ACTION_REQUIRED")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "ACTION_REQUIRED" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "ACTION_REQUIRED" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Pending Action ({metrics.received + metrics.underReview})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${filter === "ESCALATED" ? "active" : ""}`}
            onClick={() => setFilter("ESCALATED")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "ESCALATED" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "ESCALATED" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Escalated ({metrics.escalated})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${filter === "RESOLVED" ? "active" : ""}`}
            onClick={() => setFilter("RESOLVED")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "RESOLVED" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "RESOLVED" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Resolved / Closed ({metrics.resolved})
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by tracking code, project, keyword..."
          style={{
            minWidth: "260px",
            padding: "0.4rem 0.7rem",
            borderRadius: "4px",
            border: "1px solid #cbd5e1",
            fontSize: "0.82rem",
          }}
        />
      </div>

      {/* Complaints Table */}
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
                  No grievances found matching the selected filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const statusMeta = getComplaintStatusBadge(c.status);
                const canAct = canResolve && c.status !== "resolved" && c.status !== "closed";

                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/complaints/${c.id}`}
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
                        href={`/projects/${c.projectId}`}
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
                          padding: "0.2rem 0.45rem",
                          borderRadius: "4px",
                          background: statusMeta.bg,
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
                        {canAct && (
                          <button
                            type="button"
                            onClick={() => setSelectedForTransition(c)}
                            className="btn-secondary"
                            style={{
                              padding: "0.25rem 0.55rem",
                              fontSize: "0.75rem",
                              background: "#f0f9ff",
                              borderColor: "#bae6fd",
                              color: "#0369a1",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Update Status
                          </button>
                        )}
                        <Link
                          href={`/complaints/${c.id}`}
                          className="btn-secondary"
                          style={{
                            padding: "0.25rem 0.55rem",
                            fontSize: "0.75rem",
                            textDecoration: "none",
                          }}
                        >
                          Dossier →
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

      {/* Modals */}
      <ComplaintTransitionModal
        complaint={selectedForTransition}
        isOpen={!!selectedForTransition}
        onClose={() => setSelectedForTransition(null)}
        onSuccess={(updated) => {
          setComplaintList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }}
      />

      <CreateComplaintModal
        isOpen={isCreateOpen}
        projects={projects}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(created) => {
          setComplaintList((prev) => [created, ...prev]);
        }}
      />
    </div>
  );
}
