"use client";

import React, { useState, useMemo } from "react";
import type { UserAdminView, RoleView } from "@netram/types";
import {
  IconShieldCheck,
  IconSearch,
  IconCheck,
} from "../components/icons";

export interface AdminViewProps {
  users: UserAdminView[];
  totalUsers: number;
  roles: RoleView[];
  currentEmail: string;
  hasUserManage: boolean;
  hasRoleManage: boolean;
}

export function AdminView({
  users = [],
  totalUsers: _totalUsers = 0,
  roles = [],
  currentEmail: _currentEmail,
  hasUserManage: _hasUserManage,
  hasRoleManage: _hasRoleManage,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [expandedRoleCode, setExpandedRoleCode] = useState<string | null>(null);

  // Safe data arrays
  const safeUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);
  const safeRoles = useMemo(() => (Array.isArray(roles) ? roles : []), [roles]);

  // Metric calculations
  const activeCount = useMemo(
    () => safeUsers.filter((u) => u?.status === "active").length,
    [safeUsers],
  );

  const suspendedCount = useMemo(
    () => safeUsers.filter((u) => u?.status === "suspended").length,
    [safeUsers],
  );

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return safeUsers.filter((u) => {
      if (!u) return false;

      // Status Filter
      if (statusFilter !== "ALL" && u.status !== statusFilter) {
        return false;
      }

      // Role Filter
      if (roleFilter !== "ALL") {
        const hasMatchingRole =
          Array.isArray(u.assignments) &&
          u.assignments.some((a) => a?.roleCode === roleFilter);
        if (!hasMatchingRole) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
        const nameMatch = u.displayName ? u.displayName.toLowerCase().includes(q) : false;
        const roleMatch =
          Array.isArray(u.assignments) &&
          u.assignments.some((a) => a?.roleCode?.toLowerCase().includes(q));
        return emailMatch || nameMatch || roleMatch;
      }

      return true;
    });
  }, [safeUsers, statusFilter, roleFilter, searchQuery]);

  function formatDate(isoString: string | null | undefined): string {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  function getAvatarInitial(nameOrEmail: string | null | undefined): string {
    if (!nameOrEmail) return "U";
    return nameOrEmail.trim().charAt(0).toUpperCase();
  }

  return (
    <div>
      {/* Clean Compact Header */}
      <div className="section-title-row" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
            User Administration
          </h2>
          <p className="muted" style={{ marginTop: "0.15rem", fontSize: "0.82rem" }}>
            Manage operators, role assignments, and permissions
          </p>
        </div>
      </div>

      {/* Navigation Toolbar & Tabs */}
      <div className="registry-toolbar">
        <div className="search-filter-group">
          {/* Main Tab Toggle */}
          <div className="filter-tabs">
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <span>User Directory</span>
              <span className="filter-count-badge">{safeUsers.length}</span>
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === "roles" ? "active" : ""}`}
              onClick={() => setActiveTab("roles")}
            >
              <span>Roles &amp; Policies</span>
              <span className="filter-count-badge">{safeRoles.length}</span>
            </button>
          </div>

          {activeTab === "users" && (
            <>
              {/* Search Bar */}
              <div className="search-input-wrap">
                <IconSearch className="search-icon-svg" style={{ width: 15, height: 15 }} />
                <input
                  type="text"
                  placeholder="Search by email, name, or role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-with-icon"
                  aria-label="Filter users"
                />
              </div>

              {/* Status Filter */}
              <div className="filter-tabs">
                <button
                  type="button"
                  className={`filter-tab-btn ${statusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setStatusFilter("ALL")}
                >
                  All Status
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() => setStatusFilter("active")}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  className={`filter-tab-btn ${statusFilter === "suspended" ? "active" : ""}`}
                  onClick={() => setStatusFilter("suspended")}
                >
                  Suspended ({suspendedCount})
                </button>
              </div>

              {/* Role Dropdown Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.78rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-strong)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
                aria-label="Filter by role"
              >
                <option value="ALL">All Roles ({safeRoles.length})</option>
                {safeRoles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === "users" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: "220px" }}>Operator Identity</th>
                <th style={{ width: "130px" }}>Account Status</th>
                <th>Assigned Roles &amp; Jurisdiction Scopes</th>
                <th style={{ width: "130px" }}>Registered Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      {searchQuery || statusFilter !== "ALL" || roleFilter !== "ALL"
                        ? "No operators match the current filter criteria."
                        : "No users currently registered in the database."}
                    </div>
                    {(searchQuery || statusFilter !== "ALL" || roleFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("ALL");
                          setRoleFilter("ALL");
                        }}
                        className="btn-secondary"
                        style={{ marginTop: "0.75rem", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const initial = getAvatarInitial(u?.displayName || u?.email);
                  const isSuspended = u?.status === "suspended";
                  const assignments = Array.isArray(u?.assignments) ? u.assignments : [];

                  return (
                    <tr key={u.id}>
                      {/* Identity & Display Name */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "8px",
                              background: isSuspended ? "#fee2e2" : "#002449",
                              color: isSuspended ? "#dc2626" : "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}>
                              {u.email}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {u.displayName || "Official Account"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td>
                        {u.status === "active" ? (
                          <span
                            className="status status-active"
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#15803d",
                              }}
                            />
                            Active
                          </span>
                        ) : (
                          <span
                            className="status status-suspended"
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#dc2626",
                              }}
                            />
                            Suspended
                          </span>
                        )}
                      </td>

                      {/* Roles & Scopes */}
                      <td>
                        {assignments.length === 0 ? (
                          <span className="muted" style={{ fontStyle: "italic" }}>
                            No roles assigned
                          </span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {assignments.map((a) => (
                              <span
                                key={a.id}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                  background: "#f1f5f9",
                                  border: "1px solid #cbd5e1",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--color-navy-brand)",
                                  }}
                                >
                                  {a.roleCode}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.65rem",
                                    textTransform: "uppercase",
                                    padding: "0.05rem 0.25rem",
                                    borderRadius: "3px",
                                    background: a.scope === "national" ? "#dbeafe" : "#ffedd5",
                                    color: a.scope === "national" ? "#1e40af" : "#9a3412",
                                    fontWeight: 600,
                                  }}
                                >
                                  {a.scope}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Created Date */}
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="table-footer-info">
            <span>
              Showing {filteredUsers.length} of {safeUsers.length} registered operators
            </span>
            <span>Server Authoritative Access Control &bull; AGENTS.md §16</span>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & POLICIES */}
      {activeTab === "roles" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th style={{ width: "200px" }}>Role Code</th>
                <th style={{ minWidth: "220px" }}>Role Name &amp; Purpose</th>
                <th style={{ width: "160px" }}>Granted Permissions</th>
                <th style={{ width: "110px", textAlign: "right" }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {safeRoles.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      No roles configured in the system.
                    </div>
                  </td>
                </tr>
              ) : (
                safeRoles.map((r) => {
                  const permissions = Array.isArray(r.permissions) ? r.permissions : [];
                  const isExpanded = expandedRoleCode === r.code;

                  return (
                    <React.Fragment key={r.code}>
                      <tr>
                        {/* Role Code Badge */}
                        <td>
                          <span className="code-badge" style={{ fontWeight: 700 }}>
                            {r.code}
                          </span>
                        </td>

                        {/* Name */}
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}>
                            {r.name}
                          </div>
                          <div style={{ marginTop: "0.2rem" }}>
                            <span className="code-badge" style={{ fontSize: "0.72rem" }}>{r.code}</span>
                          </div>
                        </td>

                        {/* Permissions Count */}
                        <td>
                          <span
                            className="status status-assigned"
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                          >
                            <IconShieldCheck style={{ width: 13, height: 13 }} />
                            {permissions.length} Permissions
                          </span>
                        </td>

                        {/* Action: Toggle Permissions */}
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRoleCode(isExpanded ? null : r.code)
                            }
                            className="btn-secondary"
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.55rem",
                              border: "1px solid var(--color-border-strong)",
                            }}
                          >
                            {isExpanded ? "Hide Details" : "View Grants"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Permissions Drawer Row */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              background: "var(--bg-subtle)",
                              padding: "1rem 1.25rem",
                              borderBottom: "1px solid var(--color-border-subtle)",
                            }}
                          >
                            <div style={{ marginBottom: "0.5rem" }}>
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  fontFamily: "var(--font-mono)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.1em",
                                  color: "var(--color-accent-blue)",
                                }}
                              >
                                Granted Permissions for {r.name} ({permissions.length} total)
                              </span>
                            </div>

                            {permissions.length === 0 ? (
                              <p className="muted" style={{ fontStyle: "italic", margin: 0 }}>
                                No specific permissions currently assigned to this role.
                              </p>
                            ) : (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                                  gap: "0.4rem",
                                  marginTop: "0.4rem",
                                }}
                              >
                                {permissions.map((perm) => (
                                  <div
                                    key={perm}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.4rem",
                                      background: "var(--bg-surface)",
                                      border: "1px solid var(--color-border-subtle)",
                                      padding: "0.3rem 0.55rem",
                                      borderRadius: "4px",
                                      fontSize: "0.75rem",
                                      fontFamily: "var(--font-mono)",
                                      color: "var(--color-navy-data)",
                                    }}
                                  >
                                    <IconCheck
                                      style={{
                                        width: 12,
                                        height: 12,
                                        color: "var(--action-green)",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {perm}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="table-footer-info">
            <span>
              Configured roles &bull; {safeRoles.length} system definitions
            </span>
            <span>Role-Based Access Control Matrix</span>
          </div>
        </div>
      )}
    </div>
  );
}
