"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ActionInboxItem } from "@netram/types";
import type { InboxAction } from "./action-inbox-card";

export interface DecisionConfirmModalProps {
  item: ActionInboxItem | null;
  action: InboxAction | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** The word the user must type per decision, keyed by CTA kind. */
function confirmWordFor(action: InboxAction): string {
  return action.kind === "approve" ? "VERIFY" : "REJECT";
}

/**
 * Type-to-confirm guard for inbox decisions. Verifying or rejecting from a
 * card is a one-click operation otherwise; an irreversible administrative
 * action deserves a deliberate second step (AGENTS.md §73 command-safety
 * spirit applied to the UI surface).
 */
export function DecisionConfirmModal({
  item,
  action,
  busy,
  error,
  onConfirm,
  onClose,
}: DecisionConfirmModalProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirmWord = action ? confirmWordFor(action) : "";
  const isReject = action?.kind === "reject";
  const canSubmit = !!action && typed.trim().toUpperCase() === confirmWord && !busy;

  // Fresh modal state per open, and autofocus for keyboard-first confirmation.
  useEffect(() => {
    if (item && action) {
      setTyped("");
      inputRef.current?.focus();
    }
  }, [item, action]);

  if (!item || !action) return null;

  const accent = isReject ? "#dc2626" : "#16a34a";

  return (
    <div
      className="lightbox-backdrop"
      style={{ zIndex: 200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          borderTop: `3px solid ${accent}`,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "0.9rem" }}>
          <h3
            id="decision-confirm-title"
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--color-navy-brand)",
            }}
          >
            {isReject ? "Reject" : "Verify"} — confirm this decision
          </h3>
          <p className="muted" style={{ fontSize: "0.8rem", margin: "0.3rem 0 0 0" }}>
            {item.title}
            {item.project.name ? ` · ${item.project.name}` : ""}
            {item.project.code ? ` (${item.project.code})` : ""}
          </p>
        </div>

        {/* Explanation of what the decision does */}
        <div
          style={{
            background: isReject ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${isReject ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: 6,
            padding: "0.6rem 0.8rem",
            marginBottom: "0.9rem",
            fontSize: "0.8rem",
            lineHeight: 1.45,
            color: isReject ? "#991b1b" : "#166534",
          }}
        >
          {isReject ? (
            <>
              Rejecting sends this item back for correction (registration returns to Draft;
              the expense/ATR goes back to the organisation to resubmit). Nothing is deleted —
              the decision is audit-logged against your account.
            </>
          ) : (
            <>
              This records your approval as an authority decision. It advances the workflow
              (registration becomes Approved; the expense/ATR is accepted) and is audit-logged
              against your account.
            </>
          )}
        </div>

        {/* Typed confirmation */}
        <label
          htmlFor="decision-confirm-input"
          style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}
        >
          Type{" "}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              background: "#f1f5f9",
              padding: "0.1rem 0.4rem",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            {confirmWord}
          </span>{" "}
          to confirm
        </label>
        <input
          id="decision-confirm-input"
          ref={inputRef}
          type="text"
          value={typed}
          disabled={busy}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) onConfirm();
            if (e.key === "Escape" && !busy) onClose();
          }}
          placeholder={confirmWord}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "var(--font-mono)",
            fontSize: "0.9rem",
            padding: "0.55rem 0.7rem",
            border: `1px solid ${typed.trim().toUpperCase() === confirmWord ? accent : "var(--color-border-strong)"}`,
            borderRadius: 6,
            marginBottom: "0.9rem",
          }}
        />

        {error && (
          <div
            role="alert"
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              padding: "0.55rem 0.75rem",
              marginBottom: "0.9rem",
              color: "#991b1b",
              fontSize: "0.8rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={isReject ? { background: "#dc2626", borderColor: "#dc2626" } : undefined}
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {busy ? "Recording…" : isReject ? "Reject decision" : "Record approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
