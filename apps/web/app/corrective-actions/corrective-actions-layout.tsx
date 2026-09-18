"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { CorrectiveAction, CorrectiveActionStatus } from "@netram/types";
import { CORRECTIVE_ACTION_TRANSITIONS } from "@netram/types";
import { formatDate } from "../../lib/presentation";
import { CorrectiveActionTransitionModal } from "./corrective-action-transition-modal";
import { CreateCorrectiveActionModal } from "./create-corrective-action-modal";

export interface CorrectiveActionsLayoutProps {
  initialActions: CorrectiveAction[];
  totalActions: number;
  canOrder: boolean;
  canTransition: boolean;
}

function getStatusBadge(status: CorrectiveActionStatus): {
  bg: string;
  color: string;
  label: string;
} {
  switch (status) {
    case "pending":
      return { bg: "#f1f5f9", color: "#475569", label: "PENDING" };
    case "submitted":
      return { bg: "#e0f2fe", color: "#0369a1", label: "SUBMITTED" };
    case "under_review":
      return { bg: "#fef3c7", color: "#b45309", label: "UNDER REVIEW" };
    case "accepted":
      return { bg: "#dcfce7", color: "#15803d", label: "ACCEPTED" };
    case "rejected":
      return { bg: "#fee2e2", color: "#b91c1c", label: "REJECTED" };
    case "overdue":
      return { bg: "#ffedd5", color: "#c2410c", label: "OVERDUE" };
    case "escalated":
      return { bg: "#f3e8ff", color: "#7e22ce", label: "ESCALATED" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: status };
  }
}

export function CorrectiveActionsLayout({
  initialActions,
  totalActions: _totalActions,
  canOrder,
  canTransition,
}: CorrectiveActionsLayoutProps) {
  const [actionsList, setActionsList] = useState<CorrectiveAction[]>(initialActions);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "IN_REVIEW" | "OVERDUE" | "ACCEPTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForTransition, setSelectedForTransition] = useState<CorrectiveAction | null>(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  // Metrics
  const metrics = useMemo(() => {
    const total = actionsList.length;
    const pending = actionsList.filter((a) => a.status === "pending" || a.status === "rejected").length;
    const inReview = actionsList.filter((a) => a.status === "submitted" || a.status === "under_review").length;
    const overdue = actionsList.filter((a) => a.status === "overdue" || a.status === "escalated").length;
    const accepted = actionsList.filter((a) => a.status === "accepted").length;
    return { total, pending, inReview, overdue, accepted };
  }, [actionsList]);

  // Filtered
  const filtered = useMemo(() => {
    return actionsList.filter((a) => {
      // Tab filter
      if (filter === "PENDING" && a.status !== "pending" && a.status !== "rejected") {
        return false;
      }
      if (filter === "IN_REVIEW" && a.status !== "submitted" && a.status !== "under_review") {
        return false;
      }
      if (filter === "OVERDUE" && a.status !== "overdue" && a.status !== "escalated") {
        return false;
      }
      if (filter === "ACCEPTED" && a.status !== "accepted") {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = a.id.toLowerCase().includes(q);
        const matchesFinding = a.findingId.toLowerCase().includes(q);
        const matchesInspection = a.inspectionId.toLowerCase().includes(q);
        const matchesStatus = a.status.toLowerCase().includes(q);
        return matchesId || matchesFinding || matchesInspection || matchesStatus;
      }

      return true;
    });
  }, [actionsList, filter, searchQuery]);

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
            Corrective Actions
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Formal remediation orders, statutory compliance tracking, and deficiency closure (§32)
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {canOrder && (
            <button
              type="button"
              onClick={() => setIsOrderOpen(true)}
              className="btn-primary"
              style={{
                fontSize: "0.82rem",
                padding: "0.45rem 1rem",
                background: "var(--color-navy-brand)",
              }}
            >
              + Order Corrective Action
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
        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #64748b" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>PENDING COMPLIANCE</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#334155", marginTop: "0.2rem" }}>
            {metrics.pending}
          </div>
        </div>

        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>IN REVIEW</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#b45309", marginTop: "0.2rem" }}>
            {metrics.inReview}
          </div>
        </div>

        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #ea580c" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>OVERDUE / ESCALATED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#c2410c", marginTop: "0.2rem" }}>
            {metrics.overdue}
          </div>
        </div>

        <div className="table-card" style={{ padding: "1rem", borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>ACCEPTED / CLOSED</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#15803d", marginTop: "0.2rem" }}>
            {metrics.accepted}
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
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
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
            className={`filter-tab-btn ${filter === "PENDING" ? "active" : ""}`}
            onClick={() => setFilter("PENDING")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "PENDING" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "PENDING" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Pending Compliance ({metrics.pending})
          </button>

          <button
            type="button"
            className={`filter-tab-btn ${filter === "IN_REVIEW" ? "active" : ""}`}
            onClick={() => setFilter("IN_REVIEW")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "IN_REVIEW" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "IN_REVIEW" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            In Review ({metrics.inReview})
          </button>

          <button
            type="button"
            className={`filter-tab-btn ${filter === "OVERDUE" ? "active" : ""}`}
            onClick={() => setFilter("OVERDUE")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "OVERDUE" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "OVERDUE" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Overdue / Escalated ({metrics.overdue})
          </button>

          <button
            type="button"
            className={`filter-tab-btn ${filter === "ACCEPTED" ? "active" : ""}`}
            onClick={() => setFilter("ACCEPTED")}
            style={{
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e1",
              background: filter === "ACCEPTED" ? "var(--color-navy-brand)" : "#ffffff",
              color: filter === "ACCEPTED" ? "#ffffff" : "#475569",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Accepted / Closed ({metrics.accepted})
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by action ID, finding ID, status..."
          style={{
            minWidth: "260px",
            padding: "0.4rem 0.7rem",
            borderRadius: "4px",
            border: "1px solid #cbd5e1",
            fontSize: "0.82rem",
          }}
        />
      </div>

      {/* Corrective Actions Table */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Action ID</th>
              <th>Finding Reference</th>
              <th>Status</th>
              <th>Statutory Deadline</th>
              <th>Created</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "2.5rem" }}>
                  No corrective actions found matching the selected filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((ca) => {
                const statusMeta = getStatusBadge(ca.status);
                const allowable = CORRECTIVE_ACTION_TRANSITIONS[ca.status] ?? [];
                const canAct = canTransition && allowable.length > 0;

                const isOverdue =
                  ca.deadline &&
                  ca.status !== "accepted" &&
                  new Date(ca.deadline) < new Date();

                return (
                  <tr key={ca.id}>
                    <td>
                      <Link
                        href={`/corrective-actions/${ca.id}`}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          color: "var(--color-navy-brand)",
                          textDecoration: "none",
                        }}
                      >
                        {ca.id.slice(0, 10)}...
                      </Link>
                    </td>

                    <td>
                      <div>
                        <Link
                          href={`/inspections/${ca.inspectionId}`}
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: "inherit",
                            textDecoration: "none",
                          }}
                        >
                          Deficiency #{ca.findingId.slice(0, 8)}
                        </Link>
                        <div className="muted" style={{ fontSize: "0.72rem" }}>
                          Inspection: {ca.inspectionId.slice(0, 8)}...
                        </div>
                      </div>
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
                      {ca.deadline ? (
                        <span style={{ color: isOverdue ? "#dc2626" : "inherit", fontWeight: isOverdue ? 700 : 400 }}>
                          {formatDate(ca.deadline)}
                          {isOverdue && " (Overdue)"}
                        </span>
                      ) : (
                        "No deadline set"
                      )}
                    </td>

                    <td className="muted" style={{ fontSize: "0.8rem" }}>
                      {formatDate(ca.createdAt)}
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
                            onClick={() => setSelectedForTransition(ca)}
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
                            Transition
                          </button>
                        )}
                        <Link
                          href={`/corrective-actions/${ca.id}`}
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
      <CorrectiveActionTransitionModal
        correctiveAction={selectedForTransition}
        isOpen={!!selectedForTransition}
        onClose={() => setSelectedForTransition(null)}
        onSuccess={(updated) => {
          setActionsList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }}
      />

      <CreateCorrectiveActionModal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        onSuccess={(created) => {
          setActionsList((prev) => [created, ...prev]);
        }}
      />
    </div>
  );
}
