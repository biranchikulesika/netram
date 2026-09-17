"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Notification } from "@netram/types";
import { formatDate } from "../../lib/presentation";
import {
  IconBell,
  IconCheck,
  IconClipboard,
  IconShieldCheck,
  IconAlertTriangle,
} from "../components/icons";

interface NotificationsViewProps {
  initialNotifications: Notification[];
  initialTotal?: number;
  initialUnread?: number;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }
> = {
  "inspection.assigned": {
    label: "Inspection Assigned",
    badgeClass: "badge-routine",
    icon: IconClipboard,
  },
  "corrective_action.overdue": {
    label: "Action Overdue",
    badgeClass: "badge-critical",
    icon: IconShieldCheck,
  },
  "ai.anomaly_detected": {
    label: "AI Anomaly Detected",
    badgeClass: "badge-warning",
    icon: IconAlertTriangle,
  },
};

export function NotificationsView({
  initialNotifications,
}: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Compute live unread count based on current state
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => n.status === "pending").length;
  }, [notifications]);

  const readCount = useMemo(() => {
    return notifications.filter((n) => n.status === "read").length;
  }, [notifications]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesBody = item.body?.toLowerCase().includes(query) ?? false;
        const matchesType = item.type.toLowerCase().includes(query);
        if (!matchesTitle && !matchesBody && !matchesType) return false;
      }
      return true;
    });
  }, [notifications, statusFilter, typeFilter, searchQuery]);

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Failed to mark notification as read (HTTP ${res.status})`);
      }
      await res.json();
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)),
      );
      if (selectedNotification?.id === id) {
        setSelectedNotification((prev) => (prev ? { ...prev, status: "read" } : null));
      }
      setFeedback({ message: "Notification marked as read.", type: "success" });
    } catch (err: unknown) {
      setFeedback({
        message: err instanceof Error ? err.message : "Failed to update notification.",
        type: "error",
      });
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setIsMarkingAll(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Failed to mark all as read (HTTP ${res.status})`);
      }
      const data = await res.json();
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
      if (selectedNotification) {
        setSelectedNotification((prev) => (prev ? { ...prev, status: "read" } : null));
      }
      setFeedback({
        message: `Successfully marked ${data.updated ?? unreadCount} notification(s) as read.`,
        type: "success",
      });
    } catch (err: unknown) {
      setFeedback({
        message: err instanceof Error ? err.message : "Failed to mark all as read.",
        type: "error",
      });
    } finally {
      setIsMarkingAll(false);
    }
  }

  function getDeepLink(n: Notification): { href: string; label: string } | null {
    if (n.type === "inspection.assigned") {
      return { href: "/inspections", label: "View Inspections" };
    }
    if (n.type === "corrective_action.overdue") {
      return { href: "/corrective-actions", label: "View Corrective Actions" };
    }
    if (n.type === "ai.anomaly_detected") {
      return { href: "/control-room", label: "View Control Room AI" };
    }
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header & Mark All as Read */}
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
            <h2 style={{ margin: 0 }}>Notifications Center</h2>
            {unreadCount > 0 ? (
              <span className="badge badge-critical" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }}>
                {unreadCount} Unread
              </span>
            ) : (
              <span className="badge badge-routine" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }}>
                All Caught Up
              </span>
            )}
          </div>
          <p className="muted" style={{ margin: "0.35rem 0 0 0" }}>
            Real-time administrative alerts, statutory inspection assignments, and system compliance notices
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || isMarkingAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              opacity: unreadCount === 0 ? 0.6 : 1,
              cursor: unreadCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            <IconCheck style={{ width: 15, height: 15 }} />
            <span>{isMarkingAll ? "Marking all..." : "Mark All as Read"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            fontSize: "0.875rem",
            background: feedback.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: feedback.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${feedback.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 700,
            }}
            aria-label="Dismiss message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
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
        {/* Status Filter Tabs */}
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            className={statusFilter === "all" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem" }}
            onClick={() => setStatusFilter("all")}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={statusFilter === "pending" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem" }}
            onClick={() => setStatusFilter("pending")}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            className={statusFilter === "read" ? "btn-primary" : "btn-secondary"}
            style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem" }}
            onClick={() => setStatusFilter("read")}
          >
            Read ({readCount})
          </button>
        </div>

        {/* Search and Type Dropdown */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.85rem",
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-text, #111827)",
            }}
            aria-label="Filter by notification type"
          >
            <option value="all">All Types</option>
            <option value="inspection.assigned">Inspection Assigned</option>
            <option value="corrective_action.overdue">Corrective Action Overdue</option>
            <option value="ai.anomaly_detected">AI Anomaly Detected</option>
          </select>

          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.85rem",
              minWidth: "220px",
              background: "var(--color-surface, #ffffff)",
              color: "var(--color-text, #111827)",
            }}
            aria-label="Search notifications"
          />
        </div>
      </div>

      {/* Notifications Table */}
      <div className="table-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ width: "28px", paddingLeft: "1.25rem" }}></th>
              <th>Category</th>
              <th>Notification</th>
              <th>Status</th>
              <th>Date</th>
              <th style={{ textAlign: "right", paddingRight: "1.25rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                  <IconBell style={{ width: 32, height: 32, margin: "0 auto 0.75rem auto", opacity: 0.35 }} />
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No notifications found</div>
                  <div style={{ fontSize: "0.825rem", marginTop: "0.25rem" }}>
                    {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                      ? "Try changing your active search query or status filter."
                      : "You currently have no notifications in your inbox."}
                  </div>
                </td>
              </tr>
            ) : (
              filteredNotifications.map((n) => {
                const isUnread = n.status === "pending";
                const typeInfo = TYPE_CONFIG[n.type] ?? {
                  label: n.type,
                  badgeClass: "badge-routine",
                  icon: IconBell,
                };
                const Icon = typeInfo.icon;
                const isBeingMarked = markingId === n.id;

                return (
                  <tr
                    key={n.id}
                    style={{
                      background: isUnread ? "rgba(59, 130, 246, 0.04)" : undefined,
                      fontWeight: isUnread ? 500 : 400,
                    }}
                  >
                    {/* Unread indicator dot */}
                    <td style={{ paddingLeft: "1.25rem", textAlign: "center" }}>
                      {isUnread ? (
                        <span
                          title="Unread"
                          style={{
                            display: "inline-block",
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            background: "#2563eb",
                            boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.25)",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "var(--color-border, #cbd5e1)",
                          }}
                        />
                      )}
                    </td>

                    {/* Type badge */}
                    <td>
                      <span
                        className={`badge ${typeInfo.badgeClass}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <Icon style={{ width: 12, height: 12 }} />
                        <span>{typeInfo.label}</span>
                      </span>
                    </td>

                    {/* Title and summary */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <span
                          style={{
                            fontWeight: isUnread ? 700 : 600,
                            color: isUnread ? "var(--color-navy-brand, #1e3a8a)" : "var(--color-text, #111827)",
                          }}
                        >
                          {n.title}
                        </span>
                        {n.body && (
                          <span
                            className="muted"
                            style={{
                              fontSize: "0.825rem",
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "500px",
                            }}
                          >
                            {n.body}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status badge */}
                    <td>
                      <span
                        className={`status status-${n.status}`}
                        style={{ textTransform: "capitalize", fontSize: "0.75rem" }}
                      >
                        {isUnread ? "Unread" : "Read"}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="muted" style={{ fontSize: "0.825rem", whiteSpace: "nowrap" }}>
                      {formatDate(n.createdAt)}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right", paddingRight: "1.25rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                          onClick={() => setSelectedNotification(n)}
                        >
                          View Details
                        </button>

                        {isUnread && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              padding: "0.25rem 0.6rem",
                              fontSize: "0.78rem",
                              color: "#2563eb",
                              borderColor: "#93c5fd",
                            }}
                            onClick={() => handleMarkRead(n.id)}
                            disabled={isBeingMarked}
                          >
                            {isBeingMarked ? "..." : "Mark Read"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal / Drawer */}
      {selectedNotification && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-detail-title"
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
            if (e.target === e.currentTarget) setSelectedNotification(null);
          }}
        >
          <div
            className="table-card"
            style={{
              maxWidth: "560px",
              width: "100%",
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
                <span
                  className={`badge ${TYPE_CONFIG[selectedNotification.type]?.badgeClass ?? "badge-routine"}`}
                  style={{ fontSize: "0.75rem", marginBottom: "0.5rem" }}
                >
                  {TYPE_CONFIG[selectedNotification.type]?.label ?? selectedNotification.type}
                </span>
                <h3
                  id="notification-detail-title"
                  style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy-brand)" }}
                >
                  {selectedNotification.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
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

            {/* Metadata Badges */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.825rem" }}>
              <span className={`status status-${selectedNotification.status}`}>
                {selectedNotification.status === "pending" ? "Unread" : "Read"}
              </span>
              <span className="muted">Received: {formatDate(selectedNotification.createdAt)}</span>
              <span className="muted" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                ID: {selectedNotification.id}
              </span>
            </div>

            {/* Body Content */}
            <div
              style={{
                background: "var(--color-surface-subtle, #f8fafc)",
                padding: "1rem",
                borderRadius: "6px",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                color: "var(--color-text, #1e293b)",
                whiteSpace: "pre-wrap",
                border: "1px solid var(--color-border, #e2e8f0)",
              }}
            >
              {selectedNotification.body ?? "No additional text content provided in this alert."}
            </div>

            {/* Deep Link Action */}
            {(() => {
              const link = getDeepLink(selectedNotification);
              if (!link) return null;
              return (
                <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                  <span style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 500 }}>
                    Related Official Workspace:{" "}
                  </span>
                  <Link
                    href={link.href}
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#15803d",
                      textDecoration: "underline",
                      marginLeft: "0.25rem",
                    }}
                  >
                    {link.label} &rarr;
                  </Link>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              {selectedNotification.status === "pending" && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleMarkRead(selectedNotification.id)}
                  disabled={markingId === selectedNotification.id}
                  style={{ color: "#2563eb", borderColor: "#93c5fd" }}
                >
                  {markingId === selectedNotification.id ? "Marking read..." : "Mark as Read"}
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedNotification(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
