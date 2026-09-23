"use client";

import React, { useState } from "react";
import type {
  AssignmentScope,
  JurisdictionView,
  RoleAssignmentView,
  RoleView,
  UserAdminView,
} from "@netram/types";

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

  if (!isOpen || !user) return null;

  const selectedRole = roles.find((r) => r.code === selectedRoleCode);

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
          maxWidth: "540px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                background: "#f1f5f9",
                padding: "0.15rem 0.4rem",
                borderRadius: "4px",
                color: "#475569",
                fontWeight: 600,
              }}
            >
              OPERATOR IDENTITY
            </span>
            <h3
              id="modal-assign-role-title"
              style={{
                margin: "0.4rem 0 0",
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Assign Scoped Role
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {user.displayName || "Operator"} &bull; {user.email}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              color: "#64748b",
              cursor: "pointer",
              padding: "0.2rem 0.5rem",
              lineHeight: 1,
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
              padding: "0.65rem 0.85rem",
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
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="assign-role-select"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              Select Authoritative Role:
            </label>
            <select
              id="assign-role-select"
              value={selectedRoleCode}
              onChange={(e) => setSelectedRoleCode(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>

            {selectedRole && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.78rem",
                  color: "#475569",
                }}
              >
                Grants <strong>{selectedRole.permissions.length}</strong> permissions under policy:{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-navy-brand)" }}>
                  {selectedRole.code}
                </span>
              </div>
            )}
          </div>

          {/* Scope Selection */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.5rem",
              }}
            >
              Jurisdiction Authorization Boundary (&sect;16, &sect;17):
            </label>
            <div style={{ display: "flex", gap: "1rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#1e293b",
                }}
              >
                <input
                  type="radio"
                  name="assignScope"
                  checked={scope === "jurisdiction"}
                  onChange={() => setScope("jurisdiction")}
                  style={{ accentColor: "var(--color-navy-brand)" }}
                />
                <span>Jurisdiction-Scoped (District / State)</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#1e293b",
                }}
              >
                <input
                  type="radio"
                  name="assignScope"
                  checked={scope === "national"}
                  onChange={() => setScope("national")}
                  style={{ accentColor: "var(--color-navy-brand)" }}
                />
                <span>National (Unrestricted)</span>
              </label>
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
                  color: "#334155",
                  marginBottom: "0.35rem",
                }}
              >
                Target Jurisdiction: <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                id="assign-jurisdiction-select"
                value={selectedJurisdictionId}
                onChange={(e) => setSelectedJurisdictionId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  background: "#ffffff",
                  boxSizing: "border-box",
                }}
              >
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.code}) &mdash; {j.scopeLevel}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.74rem" }}>
                Under &sect;17, this operator will only possess authoritative powers for resources situated inside this specific boundary.
              </p>
            </div>
          )}

          {/* Action Footer */}
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
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                background: "var(--color-navy-brand)",
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
