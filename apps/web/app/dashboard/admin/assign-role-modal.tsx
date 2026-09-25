"use client";

import React, { useState, useEffect } from "react";
import type {
  AssignmentScope,
  JurisdictionView,
  RoleAssignmentView,
  RoleView,
  UserAdminView,
} from "@netram/types";
import { formatRoleTitle } from "../../../lib/presentation";

export interface AssignRoleModalProps {
  user: UserAdminView | null;
  roles: RoleView[];
  jurisdictions: JurisdictionView[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignment: RoleAssignmentView, targetUserId: string) => void;
}

export function AssignRoleModal({
  user,
  roles = [],
  jurisdictions = [],
  isOpen,
  onClose,
  onSuccess,
}: AssignRoleModalProps) {
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>(
    roles[0]?.code || "authority_officer",
  );
  const [scope, setScope] = useState<AssignmentScope>("jurisdiction");
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState<string>(
    jurisdictions[0]?.id || "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (roles.length > 0 && !roles.some((r) => r.code === selectedRoleCode)) {
        const firstRole = roles[0];
        if (firstRole?.code) setSelectedRoleCode(firstRole.code);
      }
      if (jurisdictions.length > 0 && !jurisdictions.some((j) => j.id === selectedJurisdictionId)) {
        const firstJurisdiction = jurisdictions[0];
        if (firstJurisdiction?.id) setSelectedJurisdictionId(firstJurisdiction.id);
      }
    }
  }, [isOpen, user, roles, jurisdictions, selectedRoleCode, selectedJurisdictionId]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoleCode) {
      setError("Please select a role to assign.");
      return;
    }

    if (scope === "jurisdiction" && !selectedJurisdictionId) {
      setError("A target jurisdiction is mandatory for jurisdiction-scoped roles.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/role-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleCode: selectedRoleCode,
          scope,
          jurisdictionId: scope === "jurisdiction" ? selectedJurisdictionId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message || `Failed to assign role (HTTP status ${res.status})`,
        );
      }

      const created = (await res.json()) as RoleAssignmentView;
      onSuccess(created, user.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="lightbox-backdrop"
      style={{ zIndex: 100 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-assign-role-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "440px",
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          borderRadius: "10px",
          padding: "1.25rem",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
            paddingBottom: "0.85rem",
            marginBottom: "1.2rem",
          }}
        >
          <div>
            <h3
              id="modal-assign-role-title"
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Assign Role
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {user.displayName ? `${user.displayName} • ${user.email}` : user.email}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.35rem",
              color: "var(--text-muted, #64748b)",
              cursor: "pointer",
              padding: "0.2rem 0.4rem",
              lineHeight: 1,
              borderRadius: "4px",
            }}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              padding: "0.6rem 0.85rem",
              marginBottom: "1rem",
              color: "#991b1b",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Selection */}
          <div style={{ marginBottom: "1.15rem" }}>
            <label
              htmlFor="assign-role-select"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-navy-brand, #0f2d59)",
                marginBottom: "0.4rem",
              }}
            >
              Role
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="assign-role-select"
                value={selectedRoleCode}
                onChange={(e) => setSelectedRoleCode(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 2.25rem 0.6rem 0.85rem",
                  borderRadius: "7px",
                  border: "1px solid var(--color-border-subtle, #cbd5e1)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-primary, #0f172a)",
                  background: "var(--bg-surface, #ffffff)",
                  boxSizing: "border-box",
                  appearance: "none",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {formatRoleTitle(r.code, r.name)}
                  </option>
                ))}
              </select>
              <div
                style={{
                  position: "absolute",
                  right: "0.85rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--text-muted, #64748b)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Scope Selection (Segmented Control) */}
          <div style={{ marginBottom: "1.15rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-navy-brand, #0f2d59)",
                marginBottom: "0.4rem",
              }}
            >
              Scope
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "var(--bg-subtle, #f1f5f9)",
                padding: "0.25rem",
                borderRadius: "8px",
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                gap: "0.25rem",
              }}
            >
              <button
                type="button"
                onClick={() => setScope("jurisdiction")}
                style={{
                  padding: "0.45rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background: scope === "jurisdiction" ? "#ffffff" : "transparent",
                  color:
                    scope === "jurisdiction"
                      ? "var(--color-navy-brand, #0f2d59)"
                      : "var(--text-secondary, #64748b)",
                  boxShadow: scope === "jurisdiction" ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                Jurisdiction
              </button>
              <button
                type="button"
                onClick={() => setScope("national")}
                style={{
                  padding: "0.45rem 0.75rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  background: scope === "national" ? "#ffffff" : "transparent",
                  color:
                    scope === "national"
                      ? "var(--color-navy-brand, #0f2d59)"
                      : "var(--text-secondary, #64748b)",
                  boxShadow: scope === "national" ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                National
              </button>
            </div>
          </div>

          {/* Target Jurisdiction Picker (if scope === jurisdiction) */}
          {scope === "jurisdiction" && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="assign-jurisdiction-select"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--color-navy-brand, #0f2d59)",
                  marginBottom: "0.4rem",
                }}
              >
                Jurisdiction
              </label>
              <div style={{ position: "relative" }}>
                <select
                  id="assign-jurisdiction-select"
                  value={selectedJurisdictionId}
                  onChange={(e) => setSelectedJurisdictionId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 2.25rem 0.6rem 0.85rem",
                    borderRadius: "7px",
                    border: "1px solid var(--color-border-subtle, #cbd5e1)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-primary, #0f172a)",
                    background: "var(--bg-surface, #ffffff)",
                    boxSizing: "border-box",
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {jurisdictions.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} ({j.code})
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: "absolute",
                    right: "0.85rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "var(--text-muted, #64748b)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.6rem",
              borderTop: "1px solid var(--color-border-subtle, #e2e8f0)",
              paddingTop: "0.85rem",
              marginTop: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
              style={{
                padding: "0.45rem 1rem",
                fontSize: "0.82rem",
                borderRadius: "6px",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                padding: "0.45rem 1.25rem",
                fontSize: "0.82rem",
                borderRadius: "6px",
                background: "var(--color-navy-brand, #0f2d59)",
                borderColor: "var(--color-navy-brand, #0f2d59)",
              }}
            >
              {isSubmitting ? "Assigning..." : "Assign Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
