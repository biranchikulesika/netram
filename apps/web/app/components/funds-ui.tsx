"use client";

import React from "react";
import Link from "next/link";
import type { Expense, FundAllocation, InspectionFlag } from "@netram/types";
import { IconChevronRight, IconX } from "./icons";

/** Only what the beneficiary card shows — satisfied by both `Project` and the
 *  dashboard's narrower `ProjectOption`, so neither caller needs casting. */
export interface ExpenseDetailProject {
  name: string;
  code: string;
  organisationName?: string | null;
  districtName?: string | null;
  stateName?: string | null;
}

/**
 * Funds presentation shared by the funds dashboard and the facility funds tab,
 * so both render the same screens. Kept here rather than in either client: the
 * two files previously carried their own copies of these helpers and drifted
 * (one title-cased expense statuses crudely, the other used real labels).
 */

export function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "₹ 0.00";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return "₹ 0.00";
  return (
    "₹ " +
    num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** One current lifecycle state per expense; buckets below are disjoint. */
export const expenseStatusMeta = [
  { value: "submitted", label: "Pending Verification", color: "#dd501e" },
  { value: "under_review", label: "Under Review", color: "#0c2a52" },
  { value: "verified", label: "Verified", color: "#137e3a" },
  { value: "rejected", label: "Rejected", color: "#dc2626" },
  { value: "voided", label: "Voided", color: "var(--text-subtle)" },
  { value: "draft", label: "Draft", color: "#0c2a52" },
];

export function expenseStatusLabel(status: Expense["status"]): string {
  return expenseStatusMeta.find((item) => item.value === status)?.label ?? status;
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: "0.75rem",
        fontSize: "0.85rem",
        padding: "0.5rem 0",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
}

/**
 * The vendor / payment field set, shared by the funds screens and the action
 * inbox's verify-payment pop-up. Both previously spelled out these same six
 * fields and their absence wording separately, then drifted ("Not recorded" vs
 * "Not provided"). Takes plain values, not an `Expense`, so callers with
 * different data contracts can still render one screen.
 */
export function VendorPaymentInfo({
  vendorName,
  vendorGstin,
  invoiceNumber,
  invoiceDate,
  paymentMethod,
  paymentReference,
}: {
  vendorName?: string | null;
  vendorGstin?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
}) {
  const dataTextStyle = { fontSize: "0.85rem", fontWeight: 600 } as const;
  return (
    <section>
      <h3 style={{ margin: "0 0 0.55rem", fontSize: "0.85rem", fontWeight: 700 }}>
        Vendor and payment information
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "1rem" }}>
        <DetailRow label="Vendor / payee">{vendorName ?? "Not provided"}</DetailRow>
        <DetailRow label="GSTIN">
          {vendorGstin ? <span style={dataTextStyle}>{vendorGstin}</span> : "Not provided"}
        </DetailRow>
        <DetailRow label="Invoice / voucher number">
          {invoiceNumber ? <span style={dataTextStyle}>{invoiceNumber}</span> : "Not provided"}
        </DetailRow>
        <DetailRow label="Invoice Date">{formatDate(invoiceDate)}</DetailRow>
        <DetailRow label="Payment mode">{paymentMethod ?? "Not recorded"}</DetailRow>
        <DetailRow label="Payment reference">
          {paymentReference ? <span style={dataTextStyle}>{paymentReference}</span> : "Not recorded"}
        </DetailRow>
      </div>
    </section>
  );
}

/**
 * The funds overlay + card + title/close header that every funds detail
 * pop-up uses. Three modals share one shell so their chrome cannot drift.
 */
export function FundsModal({
  title,
  badge,
  onClose,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,36,73, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(760px, calc(100vw - 2rem))",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.5rem",
          background: "#ffffff",
          borderRadius: "12px",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 750 }}>{title}</h2>
            {badge}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.35rem",
              background: "var(--bg-subtle)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "6px",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <IconX width={20} height={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * Allocation detail pop-up — one screen, used by the funds dashboard and the
 * facility funds tab.
 */
export function AllocationDetailModal({
  allocation,
  projectName,
  onClose,
}: {
  allocation: FundAllocation;
  projectName: string;
  onClose: () => void;
}) {
  return (
    <FundsModal title="Fund Allocation Details" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <DetailRow label="Facility / Project">
          <Link
            href={`/projects/${allocation.projectId}/funds`}
            style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
          >
            {projectName}
          </Link>
        </DetailRow>
        <DetailRow label="Allocation ID">
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{allocation.id}</span>
        </DetailRow>
        <DetailRow label="Financial Year">
          <span className="badge">{allocation.fiscalYear}</span>
        </DetailRow>
        <DetailRow label="Status">
          <span className="badge">{allocation.status.toUpperCase()}</span>
        </DetailRow>
        <DetailRow label="Sanctioned Amount">
          <span style={{ fontWeight: 700 }}>{formatCurrency(allocation.allocatedAmount)}</span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}> {allocation.currency}</span>
        </DetailRow>
        <DetailRow label="Scheme">
          <span style={{ fontWeight: 700 }}>{allocation.scheme ?? "Government Scheme Allocation"}</span>
        </DetailRow>
        {allocation.description && <DetailRow label="Description">{allocation.description}</DetailRow>}
        <DetailRow label="Sanctioned At">
          {allocation.sanctionedAt ? formatDate(allocation.sanctionedAt) : "—"}
        </DetailRow>
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <Link
            href={`/projects/${allocation.projectId}/funds`}
            style={{
              background: "var(--color-navy-brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              padding: "0.4rem 1.1rem",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.85rem",
            }}
          >
            Open Facility Fund Record
          </Link>
        </div>
      </div>
    </FundsModal>
  );
}

/**
 * Expenditure detail pop-up — one screen, used by the funds dashboard and the
 * facility funds tab. The status pill and the whole body live here so the two
 * pages cannot drift apart again.
 */
export function ExpenseDetailModal({
  expense,
  allocation,
  project,
  canVerify,
  onClose,
  onReject,
  onVerify,
}: {
  expense: Expense;
  allocation: FundAllocation | undefined;
  project: ExpenseDetailProject | undefined;
  canVerify: boolean;
  onClose: () => void;
  onReject: (expenseId: string) => void;
  onVerify: (expenseId: string) => void;
}) {
  const pending = expense.status === "submitted" || expense.status === "under_review";
  return (
    <FundsModal
      title="Expenditure Details"
      onClose={onClose}
      badge={
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.4rem 0.65rem",
            borderRadius: "999px",
            fontSize: "0.72rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
            color:
              expense.status === "verified"
                ? "#137e3a"
                : expense.status === "rejected" || expense.status === "voided"
                  ? "#dc2626"
                  : expense.status === "draft"
                    ? "#0c2a52"
                    : "#dd501e",
            background:
              expense.status === "verified"
                ? "var(--tint-green)"
                : expense.status === "rejected" || expense.status === "voided"
                  ? "var(--tint-red)"
                  : expense.status === "draft"
                    ? "var(--tint-navy)"
                    : "var(--tint-orange)",
          }}
        >
          {expenseStatusLabel(expense.status)}
        </span>
      }
    >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: "1rem",
              padding: "1.1rem",
              borderRadius: "8px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <div style={{ flex: "1 1 180px" }}>
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
                  fontSize: "1.8rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                {formatCurrency(expense.amount)}
              </div>
            </div>
            <div
              style={{
                flex: "2 1 320px",
                paddingLeft: "1rem",
                borderLeft: "1px solid var(--color-border-subtle)",
              }}
            >
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
                {expense.description || "—"}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                  gap: "0.75rem",
                  marginTop: "0.8rem",
                  paddingTop: "0.7rem",
                  borderTop: "1px solid var(--color-border-subtle)",
                  textAlign: "left",
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
                    {expense.category}
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
                    {formatDate(expense.transactionDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                padding: "0.8rem",
                borderRadius: "7px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Beneficiary establishment
              </div>
              <Link
                href={`/projects/${expense.projectId}/funds`}
                style={{ display: "block", marginTop: "0.3rem", fontWeight: 700, color: "var(--color-navy-brand)" }}
              >
                {project?.name ?? `Project ${expense.projectId.slice(0, 8)}`}
              </Link>
              <div style={{ marginTop: "0.2rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {project?.code ?? "Code unavailable"}
                {project?.organisationName ? ` · ${project.organisationName}` : ""}
              </div>
              {project && (
                <div style={{ marginTop: "0.2rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {project.stateName} / {project.districtName}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "0.8rem",
                borderRadius: "7px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Allocated funds
              </div>
              <div style={{ marginTop: "0.3rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {allocation?.scheme ??
                  (expense.allocationId ? "Allocation unavailable" : "Unlinked expenditure")}
              </div>
              <div style={{ marginTop: "0.2rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {allocation
                  ? `${allocation.fiscalYear} · ${formatCurrency(allocation.allocatedAmount)}`
                  : "No fund allocation selected"}
              </div>
            </div>
          </div>

          <VendorPaymentInfo
              vendorName={expense.vendorName}
              vendorGstin={expense.vendorGstin}
              invoiceNumber={expense.invoiceNumber}
              invoiceDate={expense.invoiceDate}
              paymentMethod={expense.paymentMethod}
              paymentReference={expense.paymentReference}
            />

          {expense.voidReason && (
            <div
              role="note"
              style={{
                padding: "0.8rem",
                borderRadius: "7px",
                background: "var(--tint-red)",
                border: "1px solid var(--tint-red)",
                color: "#dc2626",
                fontSize: "0.8rem",
              }}
            >
              <strong>Reason for voiding:</strong> {expense.voidReason}
            </div>
          )}

          <div
            style={{
              display: canVerify && pending ? "flex" : "none",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "1rem",
              paddingTop: "0.85rem",
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "0.55rem",
                flexWrap: "wrap",
              }}
            >
              {canVerify && pending && (
                <>
                  <button
                    type="button"
                    onClick={() => onReject(expense.id)}
                    style={{
                      padding: "0.5rem 0.9rem",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid var(--tint-red)",
                      color: "#dc2626",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => onVerify(expense.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.5rem 0.9rem",
                      borderRadius: "6px",
                      background: "var(--action-green)",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Verify expenditure
                    <IconChevronRight width={13} height={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
    </FundsModal>
  );
}

/* ---------------------------------------------------------------- alerts -- */

const alertButton = {
  background: "#ffffff",
  color: "var(--text-primary)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "6px",
  padding: "0.45rem 1.1rem",
  fontSize: "0.85rem",
  fontWeight: 500,
  cursor: "pointer",
} as const;

/**
 * Financial alert pop-up — one screen, used by the funds dashboard and the
 * facility funds tab. `projectName` / `projectCode` are resolved by the caller
 * so both screens fall back to the id the same way.
 */
export function FlagDetailModal({
  flag,
  projectName,
  projectCode,
  canInspect,
  onClose,
  onReview,
  onInspect,
  onDismiss,
  onResolve,
}: {
  flag: InspectionFlag;
  projectName: string;
  projectCode: string;
  canInspect: boolean;
  onClose: () => void;
  onReview: () => void;
  onInspect: () => void;
  onDismiss: () => void;
  onResolve: () => void;
}) {
  const settled = flag.status === "resolved" || flag.status === "dismissed";
  return (
    <FundsModal title="Financial Alert" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <DetailRow label="Facility / Project">
          <Link
            href={`/dashboard/projects/${flag.projectId}`}
            className="table-name-link"
            title={`Open facility record for ${projectName}`}
          >
            {projectName}
          </Link>
        </DetailRow>
        <DetailRow label="Project Code">
          <Link
            href={`/dashboard/projects/${flag.projectId}`}
            className="table-code-link"
            title={`Project identifier: ${projectCode}`}
          >
            {projectCode}
          </Link>
        </DetailRow>
        <DetailRow label="Severity">
          <span className="badge badge-surprise">
            {flag.riskLevel.toUpperCase()} · {flag.riskScore}
          </span>
        </DetailRow>
        <DetailRow label="Trigger Source">{flag.triggerSource.replace(/_/g, " ")}</DetailRow>
        <DetailRow label="Current State">
          <span className="badge">{flag.status.replace(/_/g, " ").toUpperCase()}</span>
        </DetailRow>
        <DetailRow label="Reason">{flag.explanation}</DetailRow>
        {flag.evidenceRefs.length > 0 && (
          <DetailRow label="Evidence Refs">
            {flag.evidenceRefs.map((r) => (
              <div key={r.id} style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                {r.label}
              </div>
            ))}
          </DetailRow>
        )}
        {flag.linkedInspectionId && (
          <DetailRow label="Linked Inspection">
            <Link
              href={`/dashboard/inspections/${flag.linkedInspectionId}`}
              className="table-code-link"
              title={`Linked inspection ${flag.linkedInspectionId}`}
            >
              Inspection #{flag.linkedInspectionId.slice(0, 8)}
            </Link>
          </DetailRow>
        )}
        {flag.reviewNotes && <DetailRow label="Review Notes">{flag.reviewNotes}</DetailRow>}
        {flag.resolution && <DetailRow label="Resolution">{flag.resolution}</DetailRow>}
        {flag.dismissedReason && (
          <DetailRow label="Dismissal Reason">
            <span style={{ color: "#dc2626" }}>{flag.dismissedReason}</span>
          </DetailRow>
        )}
        <DetailRow label="Raised On">{formatDate(flag.createdAt)}</DetailRow>

        {(canInspect || flag.status === "open" || !settled) && (
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            {flag.status === "open" && (
              <button type="button" onClick={onReview} style={alertButton}>
                Add Notes
              </button>
            )}
            {canInspect && !flag.linkedInspectionId && !settled && (
              <button type="button" onClick={onInspect} style={alertButton}>
                Schedule Inspection
              </button>
            )}
            {!settled && (
              <>
                <button
                  type="button"
                  onClick={onDismiss}
                  style={{
                    ...alertButton,
                    color: "#dc2626",
                    border: "1px solid var(--tint-red)",
                    marginLeft: "auto",
                  }}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={onResolve}
                  style={{
                    background: "var(--color-navy-brand)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.45rem 1.1rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Mark Resolved
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </FundsModal>
  );
}

export type FlagAction = "review" | "resolve" | "dismiss";

const flagActionCopy: Record<FlagAction, { title: string; blurb: string; placeholder: string; cta: string }> = {
  review: {
    title: "Add Review Notes",
    blurb: "Record what you checked and what you concluded. These notes are saved to the audit trail.",
    placeholder: "What did you review, and what did you find?",
    cta: "Save Notes",
  },
  resolve: {
    title: "Resolve This Alert",
    blurb: "Explain how the discrepancy was settled. This becomes part of the permanent audit record.",
    placeholder: "How was the discrepancy resolved?",
    cta: "Mark Resolved",
  },
  dismiss: {
    title: "Dismiss This Alert",
    blurb: "Dismissal removes this alert from the active list. A written reason is required and permanently audited.",
    placeholder: "Why is this alert not valid?",
    cta: "Dismiss Alert",
  },
};

/** Review / resolve / dismiss form for a financial alert — the audited write. */
export function FlagActionModal({
  action,
  note,
  onNoteChange,
  onSubmit,
  onClose,
}: {
  action: FlagAction;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const copy = flagActionCopy[action];
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,36,73, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="card"
        style={{ width: "480px", padding: "1.5rem", background: "#ffffff", borderRadius: "8px" }}
      >
        <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--color-navy-dark)" }}>{copy.title}</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
          {copy.blurb}
        </p>
        <form onSubmit={onSubmit}>
          <textarea
            required
            rows={3}
            placeholder={copy.placeholder}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--color-border-strong)",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#ffffff",
                color: "var(--text-primary)",
                border: "1px solid var(--color-border-strong)",
                padding: "0.45rem 0.95rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                background: "var(--color-navy-brand)",
                color: "#ffffff",
                border: "none",
                padding: "0.45rem 1.1rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copy.cta}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Escalates a financial alert into a special field inspection. */
export function ScheduleInspectionModal({
  flag,
  projectName,
  onConfirm,
  onClose,
}: {
  flag: InspectionFlag;
  projectName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,36,73, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="card"
        style={{ width: "480px", padding: "1.5rem", background: "#ffffff", borderRadius: "8px" }}
      >
        <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--color-navy-dark)" }}>
          Escalate to Special Field Inspection
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
          This will create a new special field inspection with trigger <strong>risk_engine</strong>,
          linked to Flag #{flag.id.slice(0, 8)}.
        </p>
        <div
          style={{
            background: "var(--bg-subtle)",
            padding: "0.75rem",
            borderRadius: "4px",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <strong>Facility:</strong> {projectName}
          </div>
          <div style={{ marginTop: "0.25rem" }}>
            <strong>Risk Level:</strong> {flag.riskLevel.toUpperCase()} (Score: {flag.riskScore}/100)
          </div>
          <div style={{ marginTop: "0.25rem", color: "var(--text-muted)" }}>{flag.explanation}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--color-border-strong)",
              padding: "0.4rem 0.8rem",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "var(--color-navy-brand)",
              color: "#ffffff",
              border: "none",
              padding: "0.4rem 1.1rem",
              borderRadius: "4px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create Field Inspection
          </button>
        </div>
      </div>
    </div>
  );
}
