"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SignOutButton } from "../projects/sign-out";
import {
  IconBuilding,
  IconClipboard,
  IconVideo,
  IconShieldCheck,
  IconAlertTriangle,
  IconBarChart,
  IconTrendingUp,
  IconLock,
  IconBell,
  IconSettings,
  IconMenu,
  IconUser,
  type IconProps,
} from "./icons";

export interface NavHeaderProps {
  userEmail: string;
  permissionsCount: number;
  permissions?: string[];
  unreadNotificationsCount?: number;
  activeSection:
    | "projects"
    | "inspections"
    | "control-room"
    | "attendance"
    | "notifications"
    | "complaints"
    | "reports"
    | "audit"
    | "admin"
    | "account"
    | "corrective-actions"
    | "analytics";
}

interface NavItem {
  href: string;
  label: string;
  section: NavHeaderProps["activeSection"];
  icon: React.ComponentType<IconProps>;
}

const NAV_PERMISSIONS: Partial<Record<NavHeaderProps["activeSection"], string[]>> = {
  projects: ["project:read"],
  inspections: ["inspection:read"],
  "control-room": ["cctv:read", "ai:anomaly:read"],
  attendance: ["attendance:monitor:read"],
  "corrective-actions": ["corrective_action:read"],
  complaints: ["complaint:read"],
  reports: ["report:read"],
  analytics: ["report:read", "project:read"],
  audit: ["audit:read"],
  notifications: ["notification:read"],
  admin: ["user:manage", "role:manage"],
};

const NAV_ITEMS: NavItem[] = [
  { href: "/projects", label: "Projects", section: "projects", icon: IconBuilding },
  { href: "/inspections", label: "Inspections", section: "inspections", icon: IconClipboard },
  { href: "/control-room", label: "Control Room", section: "control-room", icon: IconVideo },
  { href: "/attendance", label: "Attendance", section: "attendance", icon: IconUser },
  { href: "/corrective-actions", label: "Corrective Actions", section: "corrective-actions", icon: IconShieldCheck },
  { href: "/complaints", label: "Complaints", section: "complaints", icon: IconAlertTriangle },
  { href: "/reports", label: "Reports", section: "reports", icon: IconBarChart },
  { href: "/analytics", label: "Analytics", section: "analytics", icon: IconTrendingUp },
  { href: "/audit", label: "Audit Log", section: "audit", icon: IconLock },
  { href: "/notifications", label: "Notifications", section: "notifications", icon: IconBell },
  { href: "/admin", label: "Admin", section: "admin", icon: IconSettings },
];

const SECTION_LABELS: Record<NavHeaderProps["activeSection"], string> = {
  projects: "Projects",
  inspections: "Inspections",
  "control-room": "Control Room",
  attendance: "Attendance",
  "corrective-actions": "Corrective Actions",
  complaints: "Complaints",
  reports: "Reports",
  analytics: "Authority Analytics & SLA Oversight",
  audit: "Audit Log",
  notifications: "Notifications",
  admin: "Admin",
  account: "Account Profile",
};

export function NavHeader({
  userEmail,
  permissionsCount: _permissionsCount,
  permissions,
  unreadNotificationsCount,
  activeSection,
}: NavHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unreadNotificationsCount ?? 0);

  useEffect(() => {
    if (unreadNotificationsCount !== undefined) {
      setUnreadCount(unreadNotificationsCount);
    }
  }, [unreadNotificationsCount]);

  useEffect(() => {
    const canReadNotifications =
      !permissions ||
      permissions.length === 0 ||
      permissions.includes("*") ||
      permissions.includes("notification:read");

    if (!canReadNotifications) return;

    let isMounted = true;
    fetch("/api/notifications?pageSize=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data.unread === "number") {
          setUnreadCount(data.unread);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [permissions, activeSection]);

  const visibleNavItems = React.useMemo(() => {
    if (!permissions || permissions.length === 0 || permissions.includes("*")) {
      return NAV_ITEMS;
    }
    return NAV_ITEMS.filter((item) => {
      const required = NAV_PERMISSIONS[item.section];
      if (!required || required.length === 0) return true;
      return required.some((req) => permissions.includes(req));
    });
  }, [permissions]);

  useEffect(() => {
    const stored = localStorage.getItem("netram_sidebar_collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
      document.body.classList.add("sidebar-collapsed");
    }
    document.body.classList.add("has-portal-sidebar");

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("has-portal-sidebar");
      document.body.classList.remove("sidebar-collapsed");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("netram_sidebar_collapsed", String(next));
        if (next) {
          document.body.classList.add("sidebar-collapsed");
        } else {
          document.body.classList.remove("sidebar-collapsed");
        }
        return next;
      });
    }
  }

  const activeLabel = SECTION_LABELS[activeSection] ?? "Overview";

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* TOP HEADER BAR */}
      <header className="portal-topbar" role="banner">
        <div className="topbar-content">
          <div className="topbar-left">
            {/* Single Unified Collapse/Menu Toggle Button */}
            <button
              type="button"
              className="topbar-toggle-btn"
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand sidepanel (Ctrl+B)" : "Collapse sidepanel (Ctrl+B)"}
              aria-label={isCollapsed ? "Expand sidepanel" : "Collapse sidepanel"}
              aria-expanded={!isCollapsed}
            >
              <IconMenu style={{ width: 17, height: 17 }} />
            </button>

            {/* Portal Identity & Active Page */}
            <div className="topbar-brand-group">
              <span className="topbar-brand-badge">DoSJE</span>
              <span className="topbar-brand-title">NETRAM</span>
              <span className="topbar-brand-divider" aria-hidden="true">/</span>
              <h1 className="topbar-page-title">{activeLabel}</h1>
            </div>
          </div>

          <div className="topbar-right">
            {/* Notifications Icon Button with Unread Badge */}
            <Link
              href="/notifications"
              className={`topbar-account-btn ${activeSection === "notifications" ? "active" : ""}`}
              title={unreadCount > 0 ? `${unreadCount} Unread Notifications` : "Notifications"}
              aria-label="Notifications"
              style={{ position: "relative" }}
            >
              <IconBell style={{ width: 16, height: 16 }} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    borderRadius: "9999px",
                    minWidth: "15px",
                    height: "15px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    padding: "0 3px",
                    boxShadow: "0 0 0 2px var(--color-surface, #ffffff)",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Account Profile / Management Icon Button */}
            <Link
              href="/account"
              className={`topbar-account-btn ${activeSection === "account" ? "active" : ""}`}
              title={userEmail ? `Account Settings (${userEmail})` : "Account Settings"}
              aria-label="Account Settings"
            >
              <IconUser style={{ width: 16, height: 16 }} />
            </Link>

            {/* Sign Out Button */}
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* COLLAPSIBLE LEFT SIDEPANEL */}
      <aside
        className={`portal-sidepanel ${isCollapsed ? "collapsed" : ""} ${
          mobileOpen ? "mobile-open" : ""
        }`}
        aria-label="Side Navigation"
      >
        {/* Clean Sidepanel Navigation Links */}
        <nav className="sidepanel-nav">
          {visibleNavItems.map((item) => {
            const IconComp = item.icon;
            const isActive = activeSection === item.section;
            const isNotifications = item.section === "notifications";

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`sidepanel-link ${isActive ? "active" : ""}`}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="sidepanel-icon-wrap" style={{ position: "relative" }}>
                  <IconComp className="sidepanel-icon" />
                  {isNotifications && unreadCount > 0 && isCollapsed && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-2px",
                        right: "-2px",
                        background: "#dc2626",
                        color: "#ffffff",
                        fontSize: "0.55rem",
                        fontWeight: 700,
                        borderRadius: "9999px",
                        minWidth: "12px",
                        height: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: "0 2px",
                      }}
                    >
                      {unreadCount > 9 ? "!" : unreadCount}
                    </span>
                  )}
                </span>
                {!isCollapsed && (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, gap: "0.5rem" }}>
                    <span className="sidepanel-link-text">{item.label}</span>
                    {isNotifications && unreadCount > 0 && (
                      <span
                        className="badge badge-critical"
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 6px",
                          borderRadius: "9999px",
                        }}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}