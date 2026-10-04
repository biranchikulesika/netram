"use client";

import React, { useState, useMemo } from "react";
import type { UserAdminView, RoleView, JurisdictionView, RoleAssignmentView } from "@netram/types";
import { formatDate, formatRoleTitle } from "../../../lib/presentation";
import { IconSearch, IconRotateCcw, IconMapPin } from "../../components/icons";
import { AssignRoleModal } from "./assign-role-modal";
import { PaginationBar, useClientPagination } from "../../components/pagination-bar";

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0];
    const second = parts[1];
    if (first && second && first[0] && second[0]) {
      return (first[0] + second[0]).toUpperCase();
    }
    if (first) {
      return first.slice(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "OP";
}

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
  hasUserManage: _hasUserManage,
  hasRoleManage,
}: AdminViewProps) {
  const [userList, setUserList] = useState<UserAdminView[]>(users);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<UserAdminView | null>(null);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserAdminView | null>(null);
  const [assignmentToRevoke, setAssignmentToRevoke] = useState<{
    assignmentId: string;
    roleCode: string;
    roleTitle?: string;
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

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return safeUsers.filter((u) => {
      if (!u) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
        const nameMatch = u.displayName ? u.displayName.toLowerCase().includes(q) : false;
        const roleMatch =
          Array.isArray(u.assignments) &&
          u.assignments.some((a) => {
            const roleMeta = safeRoles.find((r) => r.code === a.roleCode);
            const title = formatRoleTitle(a.roleCode, roleMeta?.name).toLowerCase();
            return a?.roleCode?.toLowerCase().includes(q) || title.includes(q);
          });
        return emailMatch || nameMatch || roleMatch;
      }

      return true;
    });
  }, [safeUsers, searchQuery, safeRoles]);

  const pagination = useClientPagination(filteredUsers, 20, [searchQuery]);

  // Derived effective permissions for selected user in detail view
  const effectivePermissions = useMemo(() => {
    if (!selectedUserForDetails) return [];
    const userRoleCodes = (selectedUserForDetails.assignments || []).map((a) => a.roleCode);
    const perms = safeRoles
      .filter((r) => userRoleCodes.includes(r.code))
      .flatMap((r) => (Array.isArray(r.permissions) ? r.permissions : []));
    return Array.from(new Set(perms)).sort();
  }, [selectedUserForDetails, safeRoles]);

  // Group and deduplicate roles and assignments for selected user
  const groupedRoles = useMemo(() => {
    if (!selectedUserForDetails?.assignments) return [];

    const seen = new Set<string>();
    const uniqueAssignments: RoleAssignmentView[] = [];
    for (const a of selectedUserForDetails.assignments) {
      const key = `${a.roleCode}:${a.scope}:${a.jurisdictionId || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueAssignments.push(a);
      }
    }

    const map = new Map<
      string,
      {
        roleCode: string;
        title: string;
        assignments: {
          id: string;
          scope: string;
          jurisdictionName?: string;
          jurisdictionCode?: string;
        }[];
      }
    >();

    for (const a of uniqueAssignments) {
      const roleMeta = safeRoles.find((r) => r.code === a.roleCode);
      const title = formatRoleTitle(a.roleCode, roleMeta?.name);
      const jurisdictionMeta = a.jurisdictionId
        ? safeJurisdictions.find((j) => j.id === a.jurisdictionId)
        : null;

      if (!map.has(a.roleCode)) {
        map.set(a.roleCode, {
          roleCode: a.roleCode,
          title,
          assignments: [],
        });
      }

      map.get(a.roleCode)!.assignments.push({
        id: a.id,
        scope: a.scope,
        jurisdictionName: jurisdictionMeta?.name,
        jurisdictionCode: jurisdictionMeta?.code,
      });
    }

    return Array.from(map.values());
  }, [selectedUserForDetails, safeRoles, safeJurisdictions]);

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
    setSelectedUserForDetails((prev) => {
      if (!prev || prev.id !== targetUserId) return prev;
      return {
        ...prev,
        assignments: [...prev.assignments, newAssignment],
      };
    });
    const roleMeta = safeRoles.find((r) => r.code === newAssignment.roleCode);
    const title = formatRoleTitle(newAssignment.roleCode, roleMeta?.name);
    setFeedback({
      type: "success",
      message: `${title} (${newAssignment.scope}) assigned successfully.`,
    });
  };

  // Action: Revoke Role Assignment
  const handleConfirmRevokeAssignment = async () => {
    if (!assignmentToRevoke) return;
    const { assignmentId, roleCode, roleTitle, userEmail, userId } = assignmentToRevoke;
    const displayRoleTitle = roleTitle || formatRoleTitle(roleCode);

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
      setSelectedUserForDetails((prev) => {
        if (!prev || prev.id !== userId) return prev;
        return {
          ...prev,
          assignments: prev.assignments.filter((a) => a.id !== assignmentId),
        };
      });

      setFeedback({
        type: "success",
        message: `Revoked ${displayRoleTitle} from ${userEmail}.`,
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
            background: feedback.type === "success" ? "var(--tint-green)" : "var(--tint-red)",
            border: `1px solid ${feedback.type === "success" ? "var(--tint-green)" : "var(--tint-red)"}`,
            color: feedback.type === "success" ? "#137e3a" : "#dc2626",
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.1rem",
              color: "inherit",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Navigation Toolbar */}
      <div
        className="registry-toolbar"
        style={{ marginBottom: "1.25rem", justifyContent: "space-between" }}
      >
        <div className="search-filter-group">
          {/* Search Bar on the Left */}
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by name, email, or role…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter operators"
            />
          </div>

          {/* Reset Search button */}
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="btn-ghost"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.78rem",
                padding: "0.35rem 0.5rem",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
              title="Reset search"
              aria-label="Reset search"
            >
              <IconRotateCcw style={{ width: 13, height: 13 }} />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {filteredUsers.length} {filteredUsers.length === 1 ? "operator" : "operators"}
        </div>
      </div>

      {/* OPERATORS TABLE */}
      <div className="table-card">
        <table style={{ width: "100%", whiteSpace: "nowrap" }}>
          <thead>
            <tr>
              <th style={{ minWidth: "180px" }}>Name</th>
              <th style={{ minWidth: "220px" }}>Email</th>
              <th style={{ minWidth: "160px" }}>Role</th>
              <th style={{ minWidth: "140px" }}>Scope</th>
              <th style={{ minWidth: "130px" }}>Registered</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
                  <div className="table-empty-state">
                    <div className="table-empty-title">
                      {searchQuery.trim()
                        ? "No operators match the search criteria."
                        : "No operators recorded."}
                    </div>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="btn-secondary"
                        style={{
                          marginTop: "0.75rem",
                          fontSize: "0.78rem",
                          padding: "0.35rem 0.75rem",
                        }}
                      >
                        Reset Search
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pagination.paginatedItems.map((u) => {
                const assignments = Array.isArray(u?.assignments) ? u.assignments : [];
                const isCurrentUser = u.email === currentEmail;

                return (
                  <tr
                    key={u.id}
                    tabIndex={0}
                    role="button"
                    className="table-row"
                    onClick={() => setSelectedUserForDetails(u)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedUserForDetails(u);
                      }
                    }}
                    title={`Click to view details for ${u.displayName || u.email}`}
                  >
                    {/* Name */}
                    <td>
                      <span className="table-name-link" style={{ cursor: "pointer" }}>
                        {u.displayName || "Official Account"}
                        {isCurrentUser && (
                          <span
                            style={{
                              marginLeft: "0.4rem",
                              fontSize: "0.72rem",
                              color: "var(--color-accent-blue)",
                              fontWeight: 500,
                            }}
                          >
                            (You)
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Email */}
                    <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>

                    {/* Role (clean text, deduplicated abstracted title, no wrap) */}
                    <td>
                      {(() => {
                        const dedupedTitles = Array.from(
                          new Set(
                            assignments.map((a) => {
                              const meta = safeRoles.find((r) => r.code === a.roleCode);
                              return formatRoleTitle(a.roleCode, meta?.name);
                            }),
                          ),
                        );

                        if (dedupedTitles.length === 0) {
                          return (
                            <span
                              className="muted"
                              style={{ fontStyle: "italic", fontSize: "0.8rem" }}
                            >
                              No role
                            </span>
                          );
                        }

                        return (
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--color-navy-brand)",
                            }}
                          >
                            {dedupedTitles.join(", ")}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Scope (clean text, deduplicated, no wrap) */}
                    <td>
                      {(() => {
                        const dedupedScopes = Array.from(
                          new Set(
                            assignments.map((a) => {
                              if (a.scope === "national") {
                                return "National";
                              }
                              if (a.jurisdictionId) {
                                const j = safeJurisdictions.find(
                                  (item) => item.id === a.jurisdictionId,
                                );
                                if (j) return j.name;
                              }
                              return a.scope
                                ? a.scope.charAt(0).toUpperCase() + a.scope.slice(1)
                                : "-";
                            }),
                          ),
                        );

                        if (dedupedScopes.length === 0) {
                          return <span className="muted">-</span>;
                        }

                        return (
                          <span style={{ color: "var(--text-secondary)" }}>
                            {dedupedScopes.join(", ")}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Created Date */}
                    <td className="table-date">{formatDate(u.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <PaginationBar
          from={pagination.from}
          to={pagination.to}
          total={pagination.total}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          itemName="registered operators"
          onPageClick={pagination.onPageClick}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      </div>

      {/* MODAL: Operator Details & Permission Management */}
      {selectedUserForDetails && (
        <div
          className="lightbox-backdrop"
          style={{ zIndex: 100 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="operator-details-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUserForDetails(null);
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: "640px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,36,73, 0.25)",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              padding: "1.5rem",
              borderRadius: "10px",
              background: "var(--bg-surface)",
            }}
          >
            {/* Header: Operator Identity */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingBottom: "1.1rem",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                {/* Avatar Icon */}
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "var(--color-navy-subtle, var(--tint-navy))",
                    color: "var(--color-navy-brand, #0c2a52)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1rem",
                    border: "1px solid var(--tint-navy)",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  {getInitials(selectedUserForDetails.displayName, selectedUserForDetails.email)}
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <h3
                      id="operator-details-title"
                      style={{
                        margin: 0,
                        fontSize: "1.2rem",
                        fontWeight: 700,
                        color: "var(--color-navy-brand)",
                      }}
                    >
                      {selectedUserForDetails.displayName || "Operator Account"}
                    </h3>
                    {selectedUserForDetails.email === currentEmail && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          background: "var(--tint-navy)",
                          color: "#0c2a52",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                      >
                        CURRENT USER
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.84rem",
                      color: "var(--text-secondary)",
                      marginTop: "0.15rem",
                    }}
                  >
                    {selectedUserForDetails.email}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserForDetails(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  lineHeight: 1,
                  padding: "0.35rem 0.5rem",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close operator details"
              >
                &times;
              </button>
            </div>

            {/* Structured Operator Identity / Metadata Bar */}
            <div
              style={{
                marginTop: "1rem",
                padding: "0.65rem 1rem",
                background: "var(--bg-subtle, #edf0f5)",
                borderRadius: "8px",
                border: "1px solid var(--color-border-subtle, var(--color-border-subtle))",
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Status
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--action-green, #137e3a)",
                    marginTop: "0.15rem",
                  }}
                >
                  Active
                </span>
              </div>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Registered
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    color: "var(--text-primary)",
                    fontWeight: 500,
                    marginTop: "0.15rem",
                  }}
                >
                  {formatDate(selectedUserForDetails.createdAt)}
                </span>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div
              style={{
                overflowY: "auto",
                paddingTop: "1.2rem",
                paddingBottom: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.4rem",
              }}
            >
              {/* PRIMARY SECTION: Role Assignments & Scopes */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      color: "var(--color-navy-brand)",
                    }}
                  >
                    Roles
                  </h4>

                  {hasRoleManage && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserForRole(selectedUserForDetails)}
                      className="btn-secondary"
                      style={{
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.78rem",
                        background: "var(--tint-green)",
                        borderColor: "var(--tint-green)",
                        color: "#137e3a",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        flexShrink: 0,
                      }}
                    >
                      + Assign Role
                    </button>
                  )}
                </div>

                {/* Role Assignment Cards */}
                {groupedRoles.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed var(--color-border-subtle, var(--color-border-strong))",
                      borderRadius: "8px",
                      padding: "1rem",
                      textAlign: "center",
                      background: "var(--bg-subtle, #edf0f5)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      No roles assigned
                    </p>
                    {hasRoleManage && (
                      <button
                        type="button"
                        onClick={() => setSelectedUserForRole(selectedUserForDetails)}
                        className="btn-secondary"
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.3rem 0.7rem",
                          fontSize: "0.78rem",
                          color: "#137e3a",
                          borderColor: "var(--tint-green)",
                          background: "#ffffff",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        + Assign Role
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {groupedRoles.map((roleGroup) => (
                      <div
                        key={roleGroup.roleCode}
                        style={{
                          background: "var(--bg-surface)",
                          border:
                            "1px solid var(--color-border-subtle, var(--color-border-subtle))",
                          borderRadius: "8px",
                          padding: "0.75rem 0.9rem",
                          boxShadow: "0 1px 2px rgba(0,36,73, 0.03)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "0.92rem",
                              color: "var(--color-navy-brand)",
                            }}
                          >
                            {roleGroup.title}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {roleGroup.assignments.map((assignment) => {
                            const isNational = assignment.scope === "national";
                            return (
                              <div
                                key={assignment.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  background: "var(--bg-subtle, #edf0f5)",
                                  padding: "0.4rem 0.65rem",
                                  borderRadius: "6px",
                                  border: "1px solid var(--color-border-subtle, #edf0f5)",
                                }}
                              >
                                <div
                                  style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
                                >
                                  {isNational ? (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        fontSize: "0.76rem",
                                        fontWeight: 600,
                                        color: "#0c2a52",
                                      }}
                                    >
                                      National Scope
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.3rem",
                                        fontSize: "0.76rem",
                                        fontWeight: 600,
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      <IconMapPin
                                        style={{
                                          width: 12,
                                          height: 12,
                                          color: "var(--text-subtle)",
                                        }}
                                      />
                                      {assignment.jurisdictionName
                                        ? `${assignment.jurisdictionName}${assignment.jurisdictionCode ? ` (${assignment.jurisdictionCode})` : ""}`
                                        : "Jurisdiction"}
                                    </span>
                                  )}
                                </div>

                                {hasRoleManage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAssignmentToRevoke({
                                        assignmentId: assignment.id,
                                        roleCode: roleGroup.roleCode,
                                        roleTitle: roleGroup.title,
                                        userEmail: selectedUserForDetails.email,
                                        userId: selectedUserForDetails.id,
                                      });
                                    }}
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      padding: "0.2rem 0.5rem",
                                      color: "#dc2626",
                                      background: "transparent",
                                      border: "none",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "var(--tint-red)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "transparent";
                                    }}
                                    title={`Revoke ${roleGroup.title}`}
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECONDARY SECTION: Permissions */}
              <div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      color: "var(--color-navy-brand)",
                    }}
                  >
                    Permissions
                  </h4>
                </div>

                {effectivePermissions.length === 0 ? (
                  <p
                    className="muted"
                    style={{ fontStyle: "italic", fontSize: "0.82rem", margin: "0.25rem 0" }}
                  >
                    No permissions active.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      maxHeight: "260px",
                      overflowY: "auto",
                      paddingRight: "0.25rem",
                    }}
                  >
                    {effectivePermissions.map((perm) => (
                      <div
                        key={perm}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: "var(--bg-subtle, #edf0f5)",
                          border:
                            "1px solid var(--color-border-subtle, var(--color-border-subtle))",
                          borderRadius: "5px",
                          padding: "0.3rem 0.6rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "var(--color-navy-data, #002449)",
                          boxShadow: "0 1px 2px rgba(0,36,73, 0.02)",
                          whiteSpace: "nowrap",
                        }}
                        title={perm}
                      >
                        {perm}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,36,73, 0.25)",
            }}
          >
            <h3
              id="confirm-revoke-title"
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Revoke Role
            </h3>

            <p
              style={{
                fontSize: "0.85rem",
                lineHeight: 1.5,
                margin: "0 0 1.25rem",
                color: "var(--text-secondary)",
              }}
            >
              Revoke{" "}
              <strong>
                {assignmentToRevoke.roleTitle || formatRoleTitle(assignmentToRevoke.roleCode)}
              </strong>{" "}
              from <strong>{assignmentToRevoke.userEmail}</strong>?
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                borderTop: "1px solid var(--color-border-subtle)",
                paddingTop: "0.85rem",
              }}
            >
              <button
                type="button"
                onClick={() => setAssignmentToRevoke(null)}
                className="btn-secondary"
                disabled={actionLoading}
                style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevokeAssignment}
                disabled={actionLoading}
                className="btn-primary"
                style={{
                  padding: "0.45rem 1.25rem",
                  fontSize: "0.82rem",
                  background: "#dc2626",
                  borderColor: "#dc2626",
                }}
              >
                {actionLoading ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
