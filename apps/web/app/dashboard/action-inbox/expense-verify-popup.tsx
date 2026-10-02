"use client";

import React, { useEffect, useState } from "react";
import type { ActionInboxItem } from "@netram/types";
import { formatDate } from "../../../lib/presentation";
import { VendorPaymentInfo } from "../../components/funds-ui";

/**
 * Context fields the server discloses for expense_verification items (see
 * ActionInboxService.fetchExpenses). Omitted fields stay absent - never
 * rendered as blank placeholders (§34).
 */
interface ExpensePopupContext {
  status?: string;
  category?: string;
  description?: string;
  vendorName?: string;
  vendorGstin?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  transactionDate?: string;
}

function readContext(context: Record<string, unknown>): ExpensePopupContext {
  return context as ExpensePopupContext;
}

export interface ExpenseVerifyPopupProps {
  item: ActionInboxItem | null;
  busy: boolean;
  error: string | null;
  /** Stages the verify decision in the type-to-confirm modal. */
  onVerify: (item: ActionInboxItem) => void;
  /** Executes the rejection immediately with the stated reason. */
  onReject: (item: ActionInboxItem, reason: string) => void;
  onClose: () => void;
}

/**
 * Verify-payment popup for expenditure items (mirrors the funds workspace's
 * expense detail modal). Everything the authority needs for this decision -
 * amount, purpose, vendor/payment detail - is carried by the item itself, so
 * the decision completes on the inbox page without opening the record.
 */
export function ExpenseVerifyPopup({
  item,
  busy,
  error,
  onVerify,
  onReject,
  onClose,
}: ExpenseVerifyPopupProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (item) {
      setReason("");
    }
  }, [item]);

  if (!item) return null;

  const ctx = readContext(item.context);
  const canReject = reason.trim().length > 0 && !busy;

  return (
    <div
      className="lightbox-backdrop"
      style={{ zIndex: 200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-verify-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 560,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0,36,73, 0.25)",
          borderTop: "3px solid #137e3a",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "0.9rem" }}>
          <h3
            id="expense-verify-title"
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--color-navy-brand)",
            }}
          >
            Verify payment - expenditure
          </h3>
          <p className="muted" style={{ fontSize: "0.8rem", margin: "0.3rem 0 0 0" }}>
            {item.project.name
              ? `${item.project.name}${item.project.code ? ` (${item.project.code})` : ""}`
              : item.project.code || "No facility linked"}
          </p>
        </div>

        {/* Amount / purpose hero (funds-workspace idiom) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "1rem",
            borderRadius: 8,
            background: "var(--bg-subtle)",
            border: "1px solid var(--color-border-subtle)",
            marginBottom: "0.9rem",
          }}
        >
          <div style={{ flex: "1 1 160px" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Expenditure amount
            </div>
            <div
              style={{
                marginTop: "0.2rem",
                fontSize: "1.7rem",
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              ₹{" "}
              {item.amountInr?.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) ?? "0.00"}
            </div>
          </div>
          <div style={{ flex: "2 1 300px" }}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Purpose of expenditure
            </div>
            <div
              style={{
                marginTop: "0.25rem",
                fontSize: "0.85rem",
                lineHeight: 1.5,
                color: "var(--text-primary)",
              }}
            >
              {ctx.description ?? item.summary}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: "0.75rem",
                marginTop: "0.8rem",
                paddingTop: "0.7rem",
                borderTop: "1px solid var(--color-border-subtle)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Expenditure type
                </div>
                <div
                  style={{
                    marginTop: "0.2rem",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {ctx.category ?? "-"}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Expenditure date
                </div>
                <div
                  style={{
                    marginTop: "0.2rem",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {ctx.transactionDate ? formatDate(ctx.transactionDate) : "-"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor / payment field set comes from the funds screens, so the two
            cannot drift apart on labels or absence wording again. */}
        <div style={{ marginBottom: "0.9rem" }}>
          <VendorPaymentInfo
            vendorName={ctx.vendorName}
            vendorGstin={ctx.vendorGstin}
            invoiceNumber={ctx.invoiceNumber}
            invoiceDate={ctx.invoiceDate}
            paymentMethod={ctx.paymentMethod}
            paymentReference={ctx.paymentReference}
          />
        </div>

        {/* Rejection reason (server requires min 1 char) */}
        <div style={{ marginBottom: "0.9rem" }}>
          <label
            htmlFor="expense-reject-reason"
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "block",
              marginBottom: "0.35rem",
            }}
          >
            Rejection reason{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              (required to reject)
            </span>
          </label>
          <textarea
            id="expense-reject-reason"
            rows={2}
            value={reason}
            disabled={busy}
            placeholder="State the non-compliance, documentary omission, or discrepancy…"
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "0.5rem 0.7rem",
              border: "1px solid var(--color-border-strong)",
              borderRadius: 6,
              fontSize: "0.85rem",
              resize: "vertical",
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: "var(--tint-red)",
              border: "1px solid var(--tint-red)",
              borderRadius: 6,
              padding: "0.55rem 0.75rem",
              marginBottom: "0.9rem",
              color: "#dc2626",
              fontSize: "0.8rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.5rem",
            paddingTop: "0.85rem",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: "var(--tint-red)", color: "#dc2626" }}
            disabled={!canReject}
            onClick={() => onReject(item, reason.trim())}
          >
            Reject payment
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => onVerify(item)}
          >
            {busy ? "Recording…" : "Verify payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
