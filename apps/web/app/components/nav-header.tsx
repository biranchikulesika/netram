"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SignOutButton } from "../dashboard/projects/sign-out";
import {
  IconBuilding,
  IconClipboard,
  IconVideo,
  IconShieldCheck,
  IconAlertTriangle,
  IconLock,
  IconBell,
  IconSettings,
  IconMenu,
  IconUser,
  IconIndianRupee,
  IconLayoutDashboard,
  IconFileText,
  IconChevronLeft,
  IconChevronRight,
  type IconProps,
} from "./icons";

export interface NavHeaderProps {
  userEmail: string;
  permissionsCount: number;
  permissions?: string[];
  unreadNotificationsCount?: number;
  activeSection:
    | "dashboard"
    | "projects"
    | "registry"
    | "inspections"
    | "control-room"
    | "attendance"
    | "funds"
    | "notifications"
    | "complaints"
    | "audit"
    | "admin"
    | "account"
    | "corrective-actions";
}

interface NavItem {
  href: string;
  label: string;
  section: NavHeaderProps["activeSection"];
  icon: React.ComponentType<IconProps>;
}

interface NavGroup {
  id: string;
  title?: string;
  items: NavItem[];
}

const NAV_PERMISSIONS: Partial<Record<NavHeaderProps["activeSection"], string[]>> = {
  projects: ["project:read"],
  registry: [
    "project:create",
    "organisation:create",
    "programme:create",
    "inspector:register",
    "official:register",
  ],
  inspections: ["inspection:read"],
  "control-room": ["cctv:read", "ai:anomaly:read"],
  attendance: ["attendance:monitor:read"],
  funds: ["fund:read", "expense:read"],
  "corrective-actions": ["corrective_action:read"],
  complaints: ["complaint:read"],
  audit: ["audit:read"],
  notifications: ["notification:read"],
  admin: ["user:manage", "role:manage"],
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    items: [
      { href: "/dashboard", label: "Dashboard", section: "dashboard", icon: IconLayoutDashboard },
    ],
  },
  {
    id: "operations",
    title: "Field Operations",
    items: [
      { href: "/dashboard/projects", label: "Projects", section: "projects", icon: IconBuilding },
      { href: "/dashboard/inspections", label: "Inspections", section: "inspections", icon: IconClipboard },
      { href: "/dashboard/corrective-actions", label: "Corrective Actions", section: "corrective-actions", icon: IconShieldCheck },
      { href: "/dashboard/complaints", label: "Complaints", section: "complaints", icon: IconAlertTriangle },
    ],
  },
  {
    id: "monitoring",
    title: "Monitoring",
    items: [
      { href: "/dashboard/control-room", label: "Control Room", section: "control-room", icon: IconVideo },
      { href: "/dashboard/attendance", label: "Attendance", section: "attendance", icon: IconUser },
      { href: "/dashboard/funds", label: "Funds & Expenses", section: "funds", icon: IconIndianRupee },
    ],
  },
  {
    id: "governance",
    title: "Administration",
    items: [
      { href: "/dashboard/registry", label: "Registrations", section: "registry", icon: IconFileText },
      { href: "/dashboard/audit", label: "Audit Log", section: "audit", icon: IconLock },
      { href: "/dashboard/admin", label: "Admin", section: "admin", icon: IconSettings },
      { href: "/dashboard/notifications", label: "Notifications", section: "notifications", icon: IconBell },
    ],
  },
];

const SECTION_LABELS: Record<NavHeaderProps["activeSection"], string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  registry: "Registrations",
  inspections: "Inspections",
  funds: "Funds & Expenses",
  "control-room": "Control Room",
  attendance: "Attendance",
  "corrective-actions": "Corrective Actions",
  complaints: "Complaints",
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
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unreadNotificationsCount ?? 0);
  const isExpanded = isPinned || isHovered;

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

    function handleNotificationsRead() {
      fetch("/api/notifications?pageSize=1")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data && typeof data.unread === "number") {
            setUnreadCount(data.unread);
          }
        })
        .catch(() => {});
    }

    window.addEventListener("netram:notifications-read", handleNotificationsRead);

    return () => {
      isMounted = false;
      window.removeEventListener("netram:notifications-read", handleNotificationsRead);
    };
  }, [permissions, activeSection]);

  const visibleNavGroups = React.useMemo(() => {
    const hasAll = !permissions || permissions.length === 0 || permissions.includes("*");
    return NAV_GROUPS.map((group) => {
      const items = group.items.filter((item) => {
        if (hasAll) return true;
        if (item.section === "dashboard") return true;
        const required = NAV_PERMISSIONS[item.section];
        if (!required || required.length === 0) return true;
        return required.some((req) => permissions.includes(req));
      });
      return { ...group, items };
    }).filter((group) => group.items.length > 0);
  }, [permissions]);

  useEffect(() => {
    const stored = localStorage.getItem("netram_sidebar_pinned");
    if (stored === "true") {
      setIsPinned(true);
      document.body.classList.add("sidebar-expanded");
    } else {
      setIsPinned(false);
      document.body.classList.remove("sidebar-expanded");
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
      document.body.classList.remove("sidebar-expanded");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setIsPinned((prev) => {
        const next = !prev;
        localStorage.setItem("netram_sidebar_pinned", String(next));
        if (next) {
          document.body.classList.add("sidebar-expanded");
        } else {
          document.body.classList.remove("sidebar-expanded");
        }
        return next;
      });
    }
  }

  function handleMouseEnter() {
    if (!isPinned) {
      setIsHovered(true);
    }
  }

  function handleMouseLeave() {
    if (!isPinned) {
      setIsHovered(false);
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
              title={isPinned ? "Collapse sidepanel (Ctrl+B)" : "Expand sidepanel (Ctrl+B)"}
              aria-label={isPinned ? "Collapse sidepanel" : "Expand sidepanel"}
              aria-expanded={isPinned}
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
              href="/dashboard/notifications"
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
              href="/dashboard/account"
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
        className={`portal-sidepanel ${isPinned ? "pinned" : "collapsed"} ${
          !isPinned && isHovered ? "hover-expanded" : ""
        } ${mobileOpen ? "mobile-open" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="Side Navigation"
      >
        {/* Grouped Sidepanel Navigation Links */}
        <nav className="sidepanel-nav">
          {visibleNavGroups.map((group) => (
            <div key={group.id} className="sidepanel-group">
              {group.title && isExpanded && (
                <div className="sidepanel-group-title">{group.title}</div>
              )}
              {group.items.map((item) => {
                const IconComp = item.icon;
                const isActive = activeSection === item.section;
                const isNotifications = item.section === "notifications";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setMobileOpen(false);
                      if (!isPinned) setIsHovered(false);
                    }}
                    className={`sidepanel-link ${isActive ? "active" : ""}`}
                    title={!isExpanded ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="sidepanel-icon-wrap" style={{ position: "relative" }}>
                      <IconComp className="sidepanel-icon" />
                      {isNotifications && unreadCount > 0 && !isExpanded && (
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
                    {isExpanded && (
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
            </div>
          ))}
        </nav>

        {/* Footer Pin / Collapse Toggle Action */}
        <div className="sidepanel-footer">
          <button
            type="button"
            className="sidepanel-toggle-footer-btn"
            onClick={toggleSidebar}
            title={isPinned ? "Collapse sidepanel (Ctrl+B)" : "Expand & pin sidepanel (Ctrl+B)"}
            aria-label={isPinned ? "Collapse sidepanel" : "Expand sidepanel"}
          >
            <span className="sidepanel-icon-wrap">
              {isPinned ? (
                <IconChevronLeft style={{ width: 16, height: 16 }} />
              ) : (
                <IconChevronRight style={{ width: 16, height: 16 }} />
              )}
            </span>
            {isExpanded && (
              <span className="sidepanel-link-text" style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                {isPinned ? "Collapse sidebar" : "Pin sidebar open"}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}