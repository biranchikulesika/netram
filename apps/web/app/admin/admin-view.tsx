"use client";

import React, { useState, useMemo } from "react";
import type {
  UserAdminView,
  RoleView,
  JurisdictionView,
  RoleAssignmentView,
} from "@netram/types";
import {
  IconShieldCheck,
  IconSearch,
  IconCheck,
  IconAlertTriangle,
} from "../components/icons";
import { AssignRoleModal } from "./assign-role-modal";

export interface AdminViewProps {
  users: UserAdminView[];
  totalUsers: number;
  roles: RoleView[];
  jurisdictions?: JurisdictionView[];
  currentEmail: string;
  hasUserManage: boolean;
  hasRoleManage: boolean;
}

export function AdminView({
  users = [],
  totalUsers: _totalUsers = 0,
  roles = [],
  jurisdictions = [],
  currentEmail,
  hasUserManage,
  hasRoleManage,
}: AdminViewProps) {
  const [userList, setUserList] = useState<UserAdminView[]>(users);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [expandedRoleCode, setExpandedRoleCode] = useState<string | null>(null);

  // Modal states
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserAdminView | null>(null);
  const [userToConfirmStatus, setUserToConfirmStatus] = useState<{
    user: UserAdminView;
    targetStatus: "active" | "suspended";
  } | null>(null);
  const [assignmentToRevoke, setAssignmentToRevoke] = useState<{
    assignmentId: string;
    roleCode: string;
    userEmail: string;
    userId: string;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // Safe data arrays
  const safeUsers = useMemo(() => (Array.isArray(userList) ? userList : []), [userList]);
  const safeRoles = useMemo(() => (Array.isArray(roles) ? roles : []), [roles]);
  const safeJurisdictions = useMemo(
    () => (Array.isArray(jurisdictions) ? jurisdictions : []),
    [jurisdictions],
  );

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

  // Action: Toggle Status
  const handleConfirmStatusChange = async () => {
    if (!userToConfirmStatus) return;
    const { user, targetStatus } = userToConfirmStatus;

    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message || `Failed to update status (status ${res.status})`,
        );
      }

      setUserList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: targetStatus } : u)),
      );

      setFeedback({
        type: "success",
        message: `User ${user.email} status changed to ${targetStatus.toUpperCase()} successfully.`,
      });
      setUserToConfirmStatus(null);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update user status",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Assign Role Callback
  const handleRoleAssigned = (newAssignment: RoleAssignmentView, targetUserId: string) => {
    setUserList((prev) =>
      prev.map((u) => {
        if (u.id !== targetUserId) return u;
        return {
          ...u,
          assignments: [...u.assignments, newAssignment],
        };
      }),
    );
    setFeedback({
      type: "success",
      message: `Role ${newAssignment.roleCode} (${newAssignment.scope}) assigned successfully.`,
    });
  };

  // Action: Revoke Role Assignment
  const handleConfirmRevokeAssignment = async () => {
    if (!assignmentToRevoke) return;
    const { assignmentId, roleCode, userEmail, userId } = assignmentToRevoke;

    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/role-assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message || `Failed to revoke role assignment (status ${res.status})`,
        );
      }

      setUserList((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          return {
            ...u,
            assignments: u.assignments.filter((a) => a.id !== assignmentId),
          };
        }),
      );

      setFeedback({
        type: "success",
        message: `Revoked role ${roleCode} from ${userEmail}.`,
      });
      setAssignmentToRevoke(null);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to revoke role assignment",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      {/* Global Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            fontSize: "0.82rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: feedback.type === "success" ? "#dcfce7" : "#fee2e2",
            border: `1px solid ${feedback.type === "success" ? "#86efac" : "#fca5a5"}`,
            color: feedback.type === "success" ? "#15803d" : "#991b1b",
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}
          >
            &times;
          </button>
        </div>
      )}

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
                <th style={{ width: "120px" }}>Account Status</th>
                <th>Assigned Roles &amp; Scopes</th>
                <th style={{ width: "120px" }}>Registered</th>
                <th style={{ width: "180px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "3rem 1rem" }}>
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
                  const isCurrentUser = u.email === currentEmail;

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
                              {isCurrentUser && (
                                <span
                                  style={{
                                    marginLeft: "0.4rem",
                                    fontSize: "0.68rem",
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: "3px",
                                    background: "#e0f2fe",
                                    color: "#0369a1",
                                    fontWeight: 700,
                                  }}
                                >
                                  YOU
                                </span>
                              )}
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
                            style={{ display: "inline-flex", alignItems: "center" }}
                          >
                            Active
                          </span>
                        ) : (
                          <span
                            className="status status-suspended"
                            style={{ display: "inline-flex", alignItems: "center" }}
                          >
                            Suspended
                          </span>
                        )}
                      </td>

                      {/* Roles & Scopes with Revocation Action */}
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

                                {hasRoleManage && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAssignmentToRevoke({
                                        assignmentId: a.id,
                                        roleCode: a.roleCode,
                                        userEmail: u.email,
                                        userId: u.id,
                                      })
                                    }
                                    title={`Revoke ${a.roleCode} assignment`}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#94a3b8",
                                      padding: "0 0.15rem",
                                      fontSize: "0.85rem",
                                      lineHeight: 1,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                                  >
                                    &times;
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Created Date */}
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Operational Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "0.4rem",
                            alignItems: "center",
                            justifyContent: "flex-end",
                          }}
                        >
                          {hasRoleManage && (
                            <button
                              type="button"
                              onClick={() => setSelectedUserForRole(u)}
                              className="btn-secondary"
                              style={{
                                padding: "0.25rem 0.55rem",
                                fontSize: "0.75rem",
                                background: "#f0fdf4",
                                borderColor: "#bbf7d0",
                                color: "#15803d",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              + Assign Role
                            </button>
                          )}

                          {hasUserManage && (
                            <button
                              type="button"
                              disabled={isCurrentUser}
                              onClick={() =>
                                setUserToConfirmStatus({
                                  user: u,
                                  targetStatus: isSuspended ? "active" : "suspended",
                                })
                              }
                              className="btn-secondary"
                              title={
                                isCurrentUser
                                  ? "Self-lockout guard: You cannot suspend your own administrative account"
                                  : undefined
                              }
                              style={{
                                padding: "0.25rem 0.55rem",
                                fontSize: "0.75rem",
                                background: isSuspended ? "#f0fdf4" : "#fef2f2",
                                borderColor: isSuspended ? "#86efac" : "#fca5a5",
                                color: isSuspended ? "#15803d" : "#dc2626",
                                fontWeight: 600,
                                cursor: isCurrentUser ? "not-allowed" : "pointer",
                                opacity: isCurrentUser ? 0.5 : 1,
                              }}
                            >
                              {isSuspended ? "Reactivate" : "Suspend"}
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

          <div className="table-footer-info">
            <span>
              Showing {filteredUsers.length} of {safeUsers.length} registered operators
            </span>
            <span>Server Authoritative Access Control &bull; AGENTS.md &sect;16, &sect;17</span>
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

      {/* MODAL 1: Assign Scoped Role Modal */}
      <AssignRoleModal
        user={selectedUserForRole}
        roles={safeRoles}
        jurisdictions={safeJurisdictions}
        isOpen={!!selectedUserForRole}
        onClose={() => setSelectedUserForRole(null)}
        onSuccess={handleRoleAssigned}
      />

      {/* MODAL 2: User Status Confirmation Dialog */}
      {userToConfirmStatus && (
        <div
          className="lightbox-backdrop"
          style={{ zIndex: 100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-status-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserToConfirmStatus(null);
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: userToConfirmStatus.targetStatus === "suspended" ? "#fee2e2" : "#dcfce7",
                color: userToConfirmStatus.targetStatus === "suspended" ? "#dc2626" : "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <IconAlertTriangle style={{ width: 22, height: 22 }} />
            </div>

            <h3
              id="confirm-status-title"
              style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy-brand)" }}
            >
              {userToConfirmStatus.targetStatus === "suspended"
                ? "Suspend Operator Account"
                : "Reactivate Operator Account"}
            </h3>

            <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem" }}>
              {userToConfirmStatus.targetStatus === "suspended"
                ? `Are you sure you want to suspend access for ${userToConfirmStatus.user.email}? This immediately revokes operational permissions and suspends active session capabilities under governance policy §16.`
                : `Are you sure you want to reactivate access for ${userToConfirmStatus.user.email}? This restores operational access under their assigned roles and jurisdictions.`}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "0.85rem",
              }}
            >
              <button
                type="button"
                onClick={() => setUserToConfirmStatus(null)}
                className="btn-secondary"
                disabled={actionLoading}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
                className="btn-primary"
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  background: userToConfirmStatus.targetStatus === "suspended" ? "#dc2626" : "#15803d",
                  borderColor: userToConfirmStatus.targetStatus === "suspended" ? "#dc2626" : "#15803d",
                }}
              >
                {actionLoading ? "Updating..." : `Confirm ${userToConfirmStatus.targetStatus === "suspended" ? "Suspension" : "Reactivation"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Revoke Role Assignment Dialog */}
      {assignmentToRevoke && (
        <div
          className="lightbox-backdrop"
          style={{ zIndex: 100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-revoke-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAssignmentToRevoke(null);
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h3
              id="confirm-revoke-title"
              style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: 700, color: "var(--color-navy-brand)" }}
            >
              Revoke Role Assignment
            </h3>

            <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem" }}>
              Are you sure you want to revoke the role <strong>{assignmentToRevoke.roleCode}</strong> from{" "}
              <strong>{assignmentToRevoke.userEmail}</strong>? This immediately removes all granted permissions under this role scope.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "0.85rem",
              }}
            >
              <button
                type="button"
                onClick={() => setAssignmentToRevoke(null)}
                className="btn-secondary"
                disabled={actionLoading}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevokeAssignment}
                disabled={actionLoading}
                className="btn-primary"
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  background: "#dc2626",
                  borderColor: "#dc2626",
                }}
              >
                {actionLoading ? "Revoking..." : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
