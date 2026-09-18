"use client";

import React, { useState, useMemo } from "react";
import type { AuditEvent } from "@netram/types";
import { formatDateTime, getUserDisplayName } from "../../lib/presentation";
import {
  IconLock,
  IconSearch,
  IconShieldCheck,
} from "../components/icons";

interface AuditExplorerViewProps {
  initialEvents: AuditEvent[];
  initialTotal: number;
}

type ActionCategory =
  | "all"
  | "inspections"
  | "remediations"
  | "reports"
  | "grievances"
  | "facilities"
  | "security"
  | "surveillance"
  | "attendance";

const CATEGORIES: Array<{ id: ActionCategory; label: string }> = [
  { id: "all", label: "All Events" },
  { id: "inspections", label: "Inspections" },
  { id: "remediations", label: "Remediations" },
  { id: "reports", label: "Reports" },
  { id: "grievances", label: "Grievances" },
  { id: "facilities", label: "Facilities" },
  { id: "security", label: "Security & Access" },
  { id: "surveillance", label: "Surveillance & AI" },
  { id: "attendance", label: "Attendance" },
];

function getActionBadgeClass(action: string): string {
  if (
    action.includes("failed") ||
    action.includes("rejected") ||
    action.includes("overdue") ||
    action.includes("authorization_failed")
  ) {
    return "badge-critical";
  }
  if (
    action.includes("anomaly") ||
    action.includes("escalated") ||
    action.includes("conflict") ||
    action.includes("under_review")
  ) {
    return "badge-warning";
  }
  return "badge-routine";
}

function matchesCategory(action: string, category: ActionCategory): boolean {
  if (category === "all") return true;
  if (category === "inspections") {
    return (
      action.startsWith("inspection.") ||
      action.startsWith("finding.") ||
      action.startsWith("observation.") ||
      action.startsWith("evidence.")
    );
  }
  if (category === "remediations") {
    return action.startsWith("corrective_action.");
  }
  if (category === "reports") {
    return action.startsWith("report.");
  }
  if (category === "grievances") {
    return action.startsWith("complaint.");
  }
  if (category === "facilities") {
    return action.startsWith("project.");
  }
  if (category === "security") {
    return (
      action.startsWith("auth.") ||
      action.startsWith("user.") ||
      action.startsWith("role.") ||
      action.startsWith("admin.")
    );
  }
  if (category === "surveillance") {
    return action.startsWith("cctv.") || action.startsWith("ai.") || action.startsWith("vc.");
  }
  if (category === "attendance") {
    return action.startsWith("attendance.") || action.startsWith("scheduled_job.");
  }
  return false;
}

export function AuditExplorerView({ initialEvents, initialTotal }: AuditExplorerViewProps) {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents);
  const [totalCount, setTotalCount] = useState<number>(initialTotal);
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Available resource types in current dataset
  const availableResourceTypes = useMemo(() => {
    const types = new Set<string>();
    for (const e of events) {
      if (e.resourceType) types.add(e.resourceType);
    }
    return Array.from(types).sort();
  }, [events]);

  // Filtered audit events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (!matchesCategory(e.action, categoryFilter)) return false;
      if (resourceFilter !== "all" && e.resourceType !== resourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAction = e.action.toLowerCase().includes(q);
        const matchesActor = e.actorUserId ? e.actorUserId.toLowerCase().includes(q) : false;
        const matchesResource = e.resourceId ? e.resourceId.toLowerCase().includes(q) : false;
        const matchesReq = e.requestId ? e.requestId.toLowerCase().includes(q) : false;
        const matchesIp = e.ipAddress ? e.ipAddress.toLowerCase().includes(q) : false;
        if (!matchesAction && !matchesActor && !matchesResource && !matchesReq && !matchesIp) {
          return false;
        }
      }
      return true;
    });
  }, [events, categoryFilter, resourceFilter, searchQuery]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/audit?pageSize=100");
      if (res.ok) {
        const data = (await res.json()) as { items: AuditEvent[]; total: number };
        if (Array.isArray(data.items)) {
          setEvents(data.items);
          setTotalCount(data.total ?? data.items.length);
        }
      }
    } catch {
      // Keep existing data on network failure
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header & Assurance Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ margin: 0 }}>Statutory Audit Ledger Explorer</h2>
            <span
              className="badge badge-routine"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.8rem",
                padding: "0.2rem 0.6rem",
              }}
            >
              <IconShieldCheck style={{ width: 13, height: 13 }} />
              <span>Immutable Ledger (§37)</span>
            </span>
          </div>
          <p className="muted" style={{ margin: "0.35rem 0 0 0" }}>
            Append-only, tamper-evident chronological ledger of all administrative actions and state mutations
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Total Records: <strong>{totalCount}</strong>
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{ fontSize: "0.85rem", padding: "0.35rem 0.8rem" }}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Ledger"}
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          flexWrap: "wrap",
          paddingBottom: "0.25rem",
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={isActive ? "btn-primary" : "btn-secondary"}
              style={{
                padding: "0.3rem 0.75rem",
                fontSize: "0.825rem",
                borderRadius: "9999px",
              }}
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div
        className="table-card"
        style={{
          padding: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 280px" }}>
          <IconSearch style={{ width: 16, height: 16, color: "var(--color-muted, #9ca3af)" }} />
          <input
            type="text"
            placeholder="Search action, actor ID, resource ID, request ID, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.85rem",
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-text, #111827)",
            }}
            aria-label="Search audit events"
          />
        </div>

        {/* Resource Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label htmlFor="resource-filter" className="muted" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            Resource Type:
          </label>
          <select
            id="resource-filter"
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.85rem",
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-text, #111827)",
            }}
          >
            <option value="all">All Resources ({events.length})</option>
            {availableResourceTypes.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="table-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: "1.25rem" }}>Action</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Traceability (Request / IP)</th>
              <th>Occurred At</th>
              <th style={{ textAlign: "right", paddingRight: "1.25rem" }}>Dossier</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                  <IconLock style={{ width: 32, height: 32, margin: "0 auto 0.75rem auto", opacity: 0.35 }} />
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No matching audit records found</div>
                  <div style={{ fontSize: "0.825rem", marginTop: "0.25rem" }}>
                    {searchQuery || categoryFilter !== "all" || resourceFilter !== "all"
                      ? "Try adjusting your search query, category, or resource filter."
                      : "No statutory audit events recorded in this environment yet."}
                  </div>
                </td>
              </tr>
            ) : (
              filteredEvents.map((e) => {
                const badgeClass = getActionBadgeClass(e.action);

                return (
                  <tr key={e.id}>
                    {/* Action */}
                    <td style={{ paddingLeft: "1.25rem" }}>
                      <span
                        className={`badge ${badgeClass}`}
                        style={{
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                        }}
                      >
                        {e.action}
                      </span>
                    </td>

                    {/* Actor */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                          {getUserDisplayName(e.actorUserId, "Automated System")}
                        </span>
                        {e.actorUserId && (
                          <span
                            className="muted"
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.72rem",
                              letterSpacing: "-0.3px",
                            }}
                            title={e.actorUserId}
                          >
                            {e.actorUserId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Resource */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>
                          {e.resourceType ? e.resourceType.toUpperCase() : "—"}
                        </span>
                        {e.resourceId && (
                          <span
                            className="muted"
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.72rem",
                              letterSpacing: "-0.3px",
                            }}
                            title={e.resourceId}
                          >
                            {e.resourceId.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Request / IP */}
                    <td className="muted" style={{ fontSize: "0.78rem", fontFamily: "monospace" }}>
                      <div>{e.requestId ? `#${e.requestId.slice(0, 8)}` : "—"}</div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.85 }}>{e.ipAddress ?? "—"}</div>
                    </td>

                    {/* Occurred At */}
                    <td className="muted" style={{ fontSize: "0.825rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(e.occurredAt)}
                    </td>

                    {/* Dossier action */}
                    <td style={{ textAlign: "right", paddingRight: "1.25rem", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => setSelectedEvent(e)}
                      >
                        Inspect Dossier
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Tamper-Evident Dossier Inspection Modal */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-dossier-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEvent(null);
          }}
        >
          <div
            className="table-card"
            style={{
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              borderRadius: "10px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span className={`badge ${getActionBadgeClass(selectedEvent.action)}`} style={{ fontSize: "0.75rem" }}>
                    {selectedEvent.action}
                  </span>
                  <span
                    className="badge badge-routine"
                    style={{ fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    <IconShieldCheck style={{ width: 11, height: 11 }} />
                    <span>Tamper-Evident Dossier</span>
                  </span>
                </div>
                <h3
                  id="audit-dossier-title"
                  style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy-brand)" }}
                >
                  Audit Record: {selectedEvent.action}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.4rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--color-muted, #6b7280)",
                }}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            {/* Traceability Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
                background: "var(--color-surface-subtle, #f8fafc)",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #e2e8f0)",
                fontSize: "0.825rem",
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Event Identifier
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all" }}>
                  {selectedEvent.id}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Timestamp (UTC)
                </div>
                <div style={{ fontWeight: 500 }}>{formatDateTime(selectedEvent.occurredAt)}</div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Actor User
                </div>
                <div style={{ fontWeight: 500 }}>{selectedEvent.actorUserId ?? "System Automated"}</div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Resource Target
                </div>
                <div style={{ fontWeight: 500 }}>
                  {selectedEvent.resourceType ? `${selectedEvent.resourceType.toUpperCase()}` : "—"}
                  {selectedEvent.resourceId ? ` (${selectedEvent.resourceId.slice(0, 8)})` : ""}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Trace Request ID
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                  {selectedEvent.requestId ?? "—"}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Origin Client IP
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                  {selectedEvent.ipAddress ?? "—"}
                </div>
              </div>
            </div>

            {/* Mutation Metadata Payload Viewer */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-navy-brand)" }}>
                  Mutation Metadata & Audit State Payload
                </span>
                {selectedEvent.metadata && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.72rem" }}
                    onClick={() => handleCopy(JSON.stringify(selectedEvent.metadata, null, 2), "payload")}
                  >
                    {copiedKey === "payload" ? "Copied!" : "Copy JSON"}
                  </button>
                )}
              </div>

              <div
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: "1rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  lineHeight: 1.5,
                  overflowX: "auto",
                  maxHeight: "260px",
                }}
              >
                {selectedEvent.metadata ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                ) : (
                  <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                    No state mutation payload captured for this audit event.
                  </span>
                )}
              </div>
            </div>

            {/* Statutory Compliance Note */}
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                padding: "0.75rem 1rem",
                background: "#f0fdf4",
                borderRadius: "6px",
                border: "1px solid #bbf7d0",
                fontSize: "0.8rem",
                lineHeight: 1.5,
                color: "#166534",
              }}
            >
              <IconShieldCheck style={{ width: 16, height: 16, flexShrink: 0, marginTop: "2px" }} />
              <span>
                <strong>Statutory Integrity Guarantee:</strong> In accordance with DoSJE operating standards (§37, §38),
                all audit entries are immutable, cryptographically verifiable, and permanently retained in PostgreSQL.
              </span>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.25rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleCopy(selectedEvent.id, "id")}
                style={{ fontSize: "0.85rem" }}
              >
                {copiedKey === "id" ? "Copied ID!" : "Copy Event ID"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedEvent(null)}
                style={{ fontSize: "0.85rem" }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
