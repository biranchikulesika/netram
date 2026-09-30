"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { Notification } from "@netram/types";
import { formatDateTime } from "../../../lib/presentation";
import {
  IconBell,
  IconCheck,
  IconClipboard,
  IconShieldCheck,
  IconAlertTriangle,
} from "../../components/icons";

interface NotificationsViewProps {
  initialNotifications: Notification[];
  initialTotal?: number;
  initialUnread?: number;
}

function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return formatDateTime(d);
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateTime(d);
  } catch {
    return "-";
  }
}

function getDeepLink(n: Notification): { href: string; label: string } | null {
  const type = n.type.toLowerCase();
  if (type.includes("inspection")) {
    return { href: "/dashboard/inspections", label: "View Inspection" };
  }
  if (type.includes("corrective_action") || type.includes("action") || type.includes("overdue")) {
    return { href: "/dashboard/corrective-actions", label: "View Corrective Actions" };
  }
  if (type.includes("anomaly") || type.includes("cctv") || type.includes("ai")) {
    return { href: "/dashboard/control-room", label: "View Control Room" };
  }
  if (type.includes("complaint")) {
    return { href: "/dashboard/complaints", label: "View Complaints" };
  }
  if (type.includes("project")) {
    return { href: "/dashboard/projects", label: "View Projects" };
  }
  if (type.includes("fund") || type.includes("expense")) {
    return { href: "/dashboard/funds", label: "View Funds" };
  }
  return null;
}

function getNotificationVisual(type: string): {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  bg: string;
  color: string;
} {
  const t = type.toLowerCase();
  if (t.includes("inspection")) {
    return {
      icon: IconClipboard,
      bg: "var(--tint-navy)",
      color: "#0c2a52",
    };
  }
  if (t.includes("corrective_action") || t.includes("overdue") || t.includes("action")) {
    return {
      icon: IconShieldCheck,
      bg: "var(--tint-red)",
      color: "#dc2626",
    };
  }
  if (t.includes("anomaly") || t.includes("ai") || t.includes("cctv")) {
    return {
      icon: IconAlertTriangle,
      bg: "var(--tint-orange)",
      color: "#dd501e",
    };
  }
  return {
    icon: IconBell,
    bg: "#edf0f5",
    color: "var(--text-muted)",
  };
}

export function NotificationsView({
  initialNotifications,
}: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "pending").length,
    [notifications],
  );

  async function handleMarkRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n)),
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("netram:notifications-read"));
    }
    setMarkingId(id);
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
      });
    } catch {
      // Revert if API fails
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "pending" } : n)),
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    const previous = [...notifications];
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("netram:notifications-read"));
    }
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setNotifications(previous);
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.25rem 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--color-navy-brand, #0c2a52)",
            }}
          >
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span
              style={{
                background: "var(--tint-navy)",
                color: "#0c2a52",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.15rem 0.55rem",
                borderRadius: "9999px",
              }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.825rem",
              padding: "0.35rem 0.65rem",
              color: "var(--color-accent-blue, #0c2a52)",
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Mark all notifications as read"
          >
            <IconCheck style={{ width: 14, height: 14 }} />
            <span>{isMarkingAll ? "Marking all…" : "Mark all as read"}</span>
          </button>
        )}
      </div>

      {/* Notifications Feed */}
      {notifications.length === 0 ? (
        <div
          className="table-card"
          style={{
            padding: "3.5rem 2rem",
            textAlign: "center",
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--bg-subtle, #edf0f5)",
              color: "var(--text-muted, var(--text-subtle))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            <IconBell style={{ width: 22, height: 22 }} />
          </div>
          <h3
            style={{
              margin: "0 0 0.35rem 0",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--color-navy-brand, #0c2a52)",
            }}
          >
            All caught up
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            You have no notifications right now.
          </p>
        </div>
      ) : (
        <div
          className="table-card"
          style={{
            padding: 0,
            overflow: "hidden",
            borderRadius: "10px",
            border: "1px solid var(--color-border-subtle, var(--color-border-subtle))",
          }}
        >
          {notifications.map((n, idx) => {
            const isUnread = n.status === "pending";
            const visual = getNotificationVisual(n.type);
            const VisualIcon = visual.icon;
            const link = getDeepLink(n);

            return (
              <div
                key={n.id}
                className="notification-item"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.9rem",
                  padding: "1rem 1.25rem",
                  background: isUnread ? "rgba(12, 42, 82, 0.03)" : "var(--bg-surface)",
                  borderBottom:
                    idx < notifications.length - 1
                      ? "1px solid var(--color-border-subtle, #edf0f5)"
                      : "none",
                }}
              >
                {/* Unread Indicator Dot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: isUnread ? "#0c2a52" : "transparent",
                    marginTop: "0.55rem",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />

                {/* Visual Icon Badge */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: visual.bg,
                    color: visual.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <VisualIcon style={{ width: 18, height: 18 }} />
                </div>

                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "0.5rem",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "0.925rem",
                        fontWeight: isUnread ? 700 : 600,
                        color: isUnread
                          ? "var(--color-navy-brand, #0c2a52)"
                          : "var(--text-primary, #002449)",
                        lineHeight: 1.4,
                      }}
                    >
                      {n.title}
                    </h3>
                    <span
                      className="muted"
                      style={{
                        fontSize: "0.78rem",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      title={formatDateTime(n.createdAt)}
                      suppressHydrationWarning
                    >
                      {mounted ? formatRelativeTime(n.createdAt) : formatDateTime(n.createdAt)}
                    </span>
                  </div>

                  {n.body && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        lineHeight: 1.5,
                        color: "var(--text-secondary, var(--text-muted))",
                      }}
                    >
                      {n.body}
                    </p>
                  )}

                  {link && (
                    <div style={{ marginTop: "0.35rem" }}>
                      <Link
                        href={link.href}
                        onClick={() => {
                          if (isUnread) handleMarkRead(n.id);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "var(--color-accent-blue, #0c2a52)",
                          textDecoration: "none",
                        }}
                      >
                        <span>{link.label}</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Mark Read Action */}
                {isUnread && (
                  <button
                    type="button"
                    className="btn-ghost notification-item-read-btn"
                    onClick={() => handleMarkRead(n.id)}
                    disabled={markingId === n.id}
                    title="Mark as read"
                    aria-label="Mark as read"
                    style={{
                      padding: "0.35rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                      flexShrink: 0,
                      marginLeft: "0.25rem",
                      color: "var(--text-muted, var(--text-subtle))",
                    }}
                  >
                    <IconCheck style={{ width: 16, height: 16 }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
