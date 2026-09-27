"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { InspectionFlag, Project, ProjectFundOverview } from "@netram/types";
import {
  IconSearch,
  IconX,
  IconPlus,
  IconChevronRight,
} from "../../../../components/icons";
import {
  ALLOCATION_STATUS_FILTERS,
  EXPENSE_STATUS_FILTERS,
  StatusFilter,
  matchesStatusFilter,
} from "../../../../components/fund-status-filter";
import {
  AllocationDetailModal,
  ExpenseDetailModal,
  FlagActionModal,
  FlagDetailModal,
  ScheduleInspectionModal,
  formatCurrency,
  formatDate,
  type FlagAction,
} from "../../../../components/funds-ui";
import { PaginationBar, useClientPagination } from "../../../../components/pagination-bar";

interface ProjectFundsClientProps {
  project: Project;
  initialOverview: ProjectFundOverview;
  canSubmitExpense: boolean;
  canVerifyExpense: boolean;
  canAllocate: boolean;
  /** Risk/flag visibility (financial_risk:read | project_risk:read | *) — the
   *  API omits flags for callers without it, so the tab mirrors the disclosure. */
  canViewFlags: boolean;
  /** Escalating an alert into a field inspection needs inspection:create. */
  canInspect: boolean;
}

/**
 * Shared design language with the global Funds & Expenses dashboard
 * (apps/web/app/dashboard/funds/funds-dashboard-client.tsx): StatKpi strip,
 * registry-toolbar section tabs, table-card tables and dashboard badge/status
 * treatment. Kept local because the dashboard's helpers are not exported.
 */
/** Dashboard-style label for an expense lifecycle status. */
function formatCompact(val: number): string {
  if (val >= 1e7)
    return "₹ " + (val / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
  if (val >= 1e5)
    return "₹ " + (val / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " L";
  if (val >= 1e3)
    return "₹ " + (val / 1e3).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " K";
  return "₹ " + val.toLocaleString("en-IN");
}

/**
 * Fiscal-year helper and FY strip styles, matching the funds dashboard idiom
 * (Indian FY starting April, indigo active pill, ‹ › year arrows).
 */
function fyOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

/** Current Indian fiscal year (April start) — mirrors the dashboard helper. */
function currentFy(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function nextFy(): string {
  const start = Number(currentFy().slice(0, 4)) + 1;
  return `${start}-${start + 1}`;
}

const fyArrowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  fontSize: "1rem",
  fontWeight: 700,
  lineHeight: 1,
  color: "#334155",
  cursor: "pointer",
  padding: "0.1rem 0.2rem",
};

const fyStripStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#64748b",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: "0.15rem 0.55rem",
};

const fyStripActiveStyle: React.CSSProperties = {
  color: "#ffffff",
  background: "#4338ca",
  borderRadius: "999px",
  fontWeight: 700,
};

/** StatKpi idiom from the funds dashboard: label, value, coloured rail. */
function StatKpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "0.1rem",
        padding: "0 1.35rem",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.55rem",
          fontWeight: 800,
          lineHeight: 1.15,
          color: "var(--text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{sub}</div>}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          transform: "translateY(-50%)",
          width: 3,
          height: "2.4rem",
          borderRadius: 2,
          background: color,
        }}
      />
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  "Materials & Supplies",
  "Works & Construction",
  "Consultancy & Services",
  "Equipment & Machinery",
  "Staff & Honorarium",
  "Operational Overheads",
] as const;

const expenseFieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "2.75rem",
  padding: "0.7rem 0.8rem",
  borderRadius: "8px",
  border: "1px solid var(--color-border-strong)",
  background: "#ffffff",
  color: "var(--text-primary)",
  font: "inherit",
};

export function ProjectFundsClient({
  project,
  initialOverview,
  canSubmitExpense,
  canVerifyExpense,
  canAllocate,
  canViewFlags,
  canInspect,
}: ProjectFundsClientProps) {
  const [overview, setOverview] = useState<ProjectFundOverview>(initialOverview);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"expenses" | "flags" | "allocations">("expenses");
  const [fyFilter, setFyFilter] = useState<string>("");
  // Status filters — same pop-up screen as the funds dashboard, one selection
  // per list so switching tabs keeps each list's own filter.
  const [expenseStatuses, setExpenseStatuses] = useState<string[]>(
    EXPENSE_STATUS_FILTERS.filter((f) => f.value !== "ALL").map((f) => f.value),
  );
  const [allocationStatuses, setAllocationStatuses] = useState<string[]>(
    ALLOCATION_STATUS_FILTERS.filter((f) => f.value !== "ALL").map((f) => f.value),
  );

  // New Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: "Materials & Supplies",
    description: "",
    amount: "",
    vendorName: "",
    vendorGstin: "",
    invoiceNumber: "",
    transactionDate: new Date().toISOString().split("T")[0],
    allocationId: overview.allocations[0]?.id ?? "",
  });

  // Row detail modal (dashboard idiom: click a row → full record details + actions)
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [allocationDetailId, setAllocationDetailId] = useState<string | null>(null);
  const [flagDetailId, setFlagDetailId] = useState<string | null>(null);
  const [flagAction, setFlagAction] = useState<{ flag: InspectionFlag; action: FlagAction } | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [inspectFlag, setInspectFlag] = useState<InspectionFlag | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // New Allocation (sanction) modal state
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [submittingAllocation, setSubmittingAllocation] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationForm, setAllocationForm] = useState({
    fiscalYear: currentFy(),
    allocatedAmount: "",
    scheme: "",
    description: "",
    notes: "",
  });

  // Void modal state
  const [voidingExpenseId, setVoidingExpenseId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  async function refreshOverview() {
    const res = await fetch(`/api/v1/funds/projects/${project.id}/overview`);
    if (res.ok) setOverview(await res.json());
  }

  // Submit new expense
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingExpense(true);
    setExpenseError(null);
    try {
      const res = await fetch("/api/v1/funds/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          allocationId: expenseForm.allocationId || undefined,
          category: expenseForm.category,
          description: expenseForm.description,
          amount: expenseForm.amount,
          transactionDate: new Date(expenseForm.transactionDate!).toISOString(),
          vendorName: expenseForm.vendorName,
          vendorGstin: expenseForm.vendorGstin || undefined,
          invoiceNumber: expenseForm.invoiceNumber || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to create expense claim");
      }
      setShowExpenseModal(false);
      setExpenseForm({
        category: "Materials & Supplies",
        description: "",
        amount: "",
        vendorName: "",
        vendorGstin: "",
        invoiceNumber: "",
        transactionDate: new Date().toISOString().split("T")[0],
        allocationId: overview.allocations[0]?.id ?? "",
      });
      await refreshOverview();
    } catch (err: unknown) {
      setExpenseError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Verify expense (used from the row-detail modal, as on the dashboard)
  async function handleFlagAction(e: React.FormEvent) {
    e.preventDefault();
    if (!flagAction) return;
    const { flag, action } = flagAction;
    try {
      let endpoint = `/api/v1/inspection-flags/${flag.id}/review`;
      let body: Record<string, unknown> = { reviewNotes: flagNote, status: "under_review" };
      if (action === "resolve") {
        endpoint = `/api/v1/inspection-flags/${flag.id}/resolve`;
        body = { resolution: flagNote };
      } else if (action === "dismiss") {
        endpoint = `/api/v1/inspection-flags/${flag.id}/dismiss`;
        body = { dismissedReason: flagNote };
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Action failed");
      }
      setFlagAction(null);
      setFlagNote("");
      await refreshOverview();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleTriggerInspection(flagId: string) {
    try {
      const res = await fetch(`/api/v1/inspection-flags/${flagId}/create-inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to trigger inspection");
      }
      const data = await res.json();
      alert(`Special Field Inspection #${data.inspection?.id?.slice(0, 8)} successfully scheduled!`);
      setInspectFlag(null);
      await refreshOverview();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleVerifyExpense(id: string) {
    if (
      !confirm(
        "Confirm verification of this expenditure against supporting documentation? Verified records become immutable.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/v1/funds/expenses/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Verification failed");
      await refreshOverview();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  // Reject expense (same endpoint + flow as the dashboard row-detail actions)
  async function handleRejectExpense() {
    if (!showRejectModal || !rejectReason.trim()) return;
    setRejecting(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/v1/funds/expenses/${showRejectModal}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Rejection failed");
      }
      setShowRejectModal(null);
      setRejectReason("");
      await refreshOverview();
    } catch (err: unknown) {
      setRejectError(err instanceof Error ? err.message : String(err));
    } finally {
      setRejecting(false);
    }
  }

  // Sanction a new fund allocation (same endpoint + flow as the funds dashboard)
  async function handleCreateAllocation(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAllocation(true);
    setAllocationError(null);
    try {
      const res = await fetch("/api/v1/funds/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          fiscalYear: allocationForm.fiscalYear,
          allocatedAmount: allocationForm.allocatedAmount,
          scheme: allocationForm.scheme || undefined,
          description: allocationForm.description || undefined,
          notes: allocationForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to create allocation");
      }
      setShowAllocationModal(false);
      setAllocationForm({
        fiscalYear: currentFy(),
        allocatedAmount: "",
        scheme: "",
        description: "",
        notes: "",
      });
      await refreshOverview();
    } catch (err: unknown) {
      setAllocationError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingAllocation(false);
    }
  }

  // Void expense
  async function handleVoidExpense() {
    if (!voidingExpenseId || !voidReason.trim()) return;
    setVoiding(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/v1/funds/expenses/${voidingExpenseId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voidReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Void failed");
      }
      setVoidingExpenseId(null);
      setVoidReason("");
      await refreshOverview();
    } catch (err: unknown) {
      setVoidError(err instanceof Error ? err.message : String(err));
    } finally {
      setVoiding(false);
    }
  }

  const { summary, allocations, recentExpenses, activeFlags } = overview;
  const numAlloc = parseFloat(summary.totalAllocated || "0");

  // Expenditure lifecycle buckets (dashboard stats idiom): disjoint amounts per
  // status so each record contributes to exactly one KPI. Draft/voided are
  // excluded from pending/verified/rejected, matching the dashboard.
  const statsOverview = useMemo(() => {
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    for (const e of recentExpenses) {
      const amount = parseFloat(e.amount) || 0;
      if (e.status === "verified") verified += amount;
      else if (e.status === "rejected") rejected += amount;
      else if (e.status === "submitted" || e.status === "under_review") pending += amount;
    }
    return { pending, verified, rejected };
  }, [recentExpenses]);

  const q = search.trim().toLowerCase();
  const matches = (text: string | null | undefined) => !q || (text ?? "").toLowerCase().includes(q);
  const filteredExpenses = recentExpenses.filter(
    (e) =>
      (!fyFilter || fyOf(e.transactionDate) === fyFilter) &&
      matchesStatusFilter(e.status, expenseStatuses, EXPENSE_STATUS_FILTERS) &&
      (matches(e.description) ||
        matches(e.vendorName) ||
        matches(e.invoiceNumber) ||
        matches(e.category)),
  );
  const filteredFlags = activeFlags.filter((f) => !fyFilter || fyOf(f.createdAt) === fyFilter);
  const filteredAllocations = allocations.filter(
    (a) =>
      (!fyFilter || a.fiscalYear === fyFilter) &&
      matchesStatusFilter(a.status, allocationStatuses, ALLOCATION_STATUS_FILTERS) &&
      (matches(a.scheme) || matches(a.description) || matches(a.notes) || matches(a.fiscalYear)),
  );

  const expensesPagination = useClientPagination(filteredExpenses, 20, [
    fyFilter,
    expenseStatuses,
    search,
  ]);
  const flagsPagination = useClientPagination(filteredFlags, 20, [fyFilter]);
  const allocationsPagination = useClientPagination(filteredAllocations, 20, [
    fyFilter,
    allocationStatuses,
    search,
  ]);
  // FY strip options — same derivation as the funds dashboard (current-year capped).
  const fyOptions = useMemo(() => {
    const present: number[] = [];
    const collect = (fy: string | null) => {
      if (fy) {
        const start = Number(fy.slice(0, 4));
        if (!present.includes(start)) present.push(start);
      }
    };
    for (const a of allocations) collect(a.fiscalYear);
    for (const e of recentExpenses) collect(fyOf(e.transactionDate));
    if (present.length === 0) return [];
    const currentYear = new Date().getFullYear();
    const start = Math.min(Math.min(...present), currentYear);
    const end = Math.min(Math.max(...present), currentYear);
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const y = start + i;
      return `${y}-${y + 1}`;
    });
  }, [allocations, recentExpenses]);

  // Default the strip to the most recent fiscal year, as the dashboard does.
  useEffect(() => {
    if (fyOptions.length > 0 && !fyOptions.includes(fyFilter)) {
      setFyFilter(fyOptions[fyOptions.length - 1] ?? "");
    }
  }, [fyOptions, fyFilter]);

  const fyIdx = fyOptions.indexOf(fyFilter);

  const detailFlag = useMemo(
    () => (flagDetailId ? activeFlags.find((f) => f.id === flagDetailId) : undefined),
    [flagDetailId, activeFlags],
  );
  const detailAllocation = useMemo(
    () => (allocationDetailId ? allocations.find((a) => a.id === allocationDetailId) : undefined),
    [allocationDetailId, allocations],
  );
  const detailExpense =
    detailExpenseId != null ? recentExpenses.find((e) => e.id === detailExpenseId) : undefined;
  const detailExpenseAllocation = detailExpense?.allocationId
    ? allocations.find((a) => a.id === detailExpense.allocationId)
    : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* KPI strip — dashboard stats idiom: Sanctioned / Pending / Verified / Rejected */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "0.9rem",
          padding: "1.1rem 0.5rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "10px",
          boxShadow: "0 1px 3px rgba(12, 42, 82, 0.03)",
        }}
      >
        <StatKpi label="Total Sanctioned" value={formatCompact(numAlloc)} color="#2563eb" />
        <StatKpi
          label="Pending Verification"
          value={formatCompact(statsOverview.pending)}
          color="#f59e0b"
        />
        <StatKpi label="Verified" value={formatCompact(statsOverview.verified)} color="#059669" />
        <StatKpi label="Rejected" value={formatCompact(statsOverview.rejected)} color="#dc2626" />
      </div>

      {/* Toolbar — registry-toolbar + filter-tabs idiom from the dashboard */}
      <div className="registry-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search expenditures, vendors, invoices, schemes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter fund records"
              style={{ minWidth: "240px", maxWidth: "380px" }}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Facility fund sections">
            {(
              [
                { key: "allocations" as const, label: "Allocations", count: filteredAllocations.length },
                { key: "expenses" as const, label: "Expenditures", count: filteredExpenses.length },
                ...(canViewFlags
                  ? [{ key: "flags" as const, label: "Alerts", count: filteredFlags.length }]
                  : []),
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                className={`filter-tab-btn ${activeTab === key ? "active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                <span>{label}</span>
                {activeTab === key && <span className="filter-count-badge">{count}</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginLeft: "auto" }}>
          {/* Status filter pop-up — the funds section's screen, applied to the
              expenditure and allocations lists. Flags carry their own
              lifecycle, so no status filter there. */}
          {activeTab === "expenses" && (
            <StatusFilter
              filters={EXPENSE_STATUS_FILTERS}
              selected={expenseStatuses}
              onChange={setExpenseStatuses}
              title="Filter expenditures by status"
            />
          )}
          {activeTab === "allocations" && (
            <StatusFilter
              filters={ALLOCATION_STATUS_FILTERS}
              selected={allocationStatuses}
              onChange={setAllocationStatuses}
              title="Filter allocations by status"
            />
          )}
          {canAllocate && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setAllocationError(null);
                setShowAllocationModal(true);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <IconPlus width={15} height={15} />
              <span>Allocate Fund</span>
            </button>
          )}
          {canSubmitExpense && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setExpenseError(null);
                setShowExpenseModal(true);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <IconPlus width={15} height={15} />
              <span>Record Expense</span>
            </button>
          )}

          {/* FY selector — dashboard toolbar idiom, applies to every section */}
          {fyOptions.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.2rem",
                whiteSpace: "nowrap",
              }}
            >
              <button
                type="button"
                style={fyArrowStyle}
                title="Previous fiscal year"
                aria-label="Previous fiscal year"
                disabled={fyIdx <= 0}
                onClick={() => setFyFilter(fyOptions[Math.max(fyIdx - 1, 0)] ?? fyFilter)}
              >
                ‹
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  whiteSpace: "nowrap",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--text-subtle)",
                }}
              >
                {fyOptions
                  .map((fy) => (
                    <button
                      key={fy}
                      type="button"
                      style={{ ...fyStripStyle, ...(fy === fyFilter ? fyStripActiveStyle : {}) }}
                      aria-pressed={fy === fyFilter}
                      aria-label={`Filter fiscal year ${fy}`}
                      onClick={() => setFyFilter(fy)}
                    >
                      {fy}
                    </button>
                  ))
                  .flatMap((el, i) =>
                    i === 0
                      ? [el]
                      : [
                          <span
                            key={`sep-${i}`}
                            style={{
                              color: "#cbd5e1",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              padding: "0 0.45rem",
                            }}
                          >
                            |
                          </span>,
                          el,
                        ],
                  )}
              </div>
              <button
                type="button"
                style={fyArrowStyle}
                title="Next fiscal year"
                aria-label="Next fiscal year"
                disabled={fyIdx < 0 || fyIdx >= fyOptions.length - 1}
                onClick={() =>
                  setFyFilter(fyOptions[Math.min(fyIdx + 1, fyOptions.length - 1)] ?? fyFilter)
                }
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab: Expenditures — dashboard columns + click-for-details rows */}
      {activeTab === "expenses" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Vendor</th>
                <th>Date</th>
                <th className="table-align-right">Expenditure Amount</th>
                <th className="table-align-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty-state">
                    <IconSearch width={22} height={22} className="table-empty-icon" />
                    <div className="table-empty-title">No expenditures found</div>
                    <div className="table-empty-desc">
                      {recentExpenses.length === 0
                        ? "No expenditures submitted yet for this facility."
                        : "No expenditures match the current search."}
                    </div>
                  </td>
                </tr>
              ) : (
                expensesPagination.paginatedItems.map((exp) => (
                  <tr
                    key={exp.id}
                    className="table-row"
                    onClick={() => setDetailExpenseId(exp.id)}
                    title="View expenditure details & actions"
                  >
                    <td>
                      <div style={{ fontWeight: 500, maxWidth: "250px" }}>{exp.description}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{exp.vendorName}</div>
                    </td>
                    <td className="table-date">
                      {formatDate(exp.transactionDate)}
                    </td>
                    <td
                      className="table-align-right"
                      style={{
                        fontWeight: 700,
                        color: "var(--color-navy-dark)",
                      }}
                    >
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="table-align-center">
                      <span className={`status status-${exp.status}`}>
                        {exp.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <PaginationBar
            from={expensesPagination.from}
            to={expensesPagination.to}
            total={expensesPagination.total}
            currentPage={expensesPagination.currentPage}
            totalPages={expensesPagination.totalPages}
            pageSize={expensesPagination.pageSize}
            itemName="expenditures"
            onPageClick={expensesPagination.onPageClick}
            onPageSizeChange={expensesPagination.onPageSizeChange}
          />
        </div>
      )}

      {/* Tab: Alerts (inspection review flags) — oversight-only disclosure */}
      {canViewFlags && activeTab === "flags" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Reason</th>
                <th>Flagged On</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan={3} className="table-empty-state">
                    <IconSearch width={22} height={22} className="table-empty-icon" />
                    <div className="table-empty-title">No financial alerts found</div>
                    <div className="table-empty-desc">No active financial alerts recorded for this facility.</div>
                  </td>
                </tr>
              ) : (
                flagsPagination.paginatedItems.map((f) => (
                  <tr
                    key={f.id}
                    className="table-row"
                    onClick={() => setFlagDetailId(f.id)}
                    title="View alert details & actions"
                  >
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        className="badge"
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          background:
                            f.riskLevel === "critical" || f.riskLevel === "high"
                              ? "#fee2e2"
                              : f.riskLevel === "medium"
                                ? "#fef3c7"
                                : "#e0f2fe",
                          color:
                            f.riskLevel === "critical" || f.riskLevel === "high"
                              ? "#991b1b"
                              : f.riskLevel === "medium"
                                ? "#92400e"
                                : "#0369a1",
                          fontWeight: 700,
                        }}
                      >
                        {f.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{f.explanation}</div>
                      {f.linkedInspectionId && (
                        <div className="table-subtext">
                          <Link
                            href={`/dashboard/inspections/${f.linkedInspectionId}`}
                            className="table-code-link"
                            onClick={(e) => e.stopPropagation()}
                            title={`Linked inspection ${f.linkedInspectionId}`}
                          >
                            Inspection #{f.linkedInspectionId.slice(0, 8)}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="table-date">
                      {formatDate(f.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <PaginationBar
            from={flagsPagination.from}
            to={flagsPagination.to}
            total={flagsPagination.total}
            currentPage={flagsPagination.currentPage}
            totalPages={flagsPagination.totalPages}
            pageSize={flagsPagination.pageSize}
            itemName="financial alerts"
            onPageClick={flagsPagination.onPageClick}
            onPageSizeChange={flagsPagination.onPageSizeChange}
          />
        </div>
      )}

      {/* Tab: Allocations */}
      {activeTab === "allocations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Scheme</th>
                  <th>Description</th>
                  <th>FY</th>
                  <th className="table-align-right">Sanctioned Amount</th>
                  <th>Actioned On</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty-state">
                      <IconSearch width={22} height={22} className="table-empty-icon" />
                      <div className="table-empty-title">No fund allocations found</div>
                      <div className="table-empty-desc">No allocations match current filter criteria.</div>
                    </td>
                  </tr>
                ) : (
                  allocationsPagination.paginatedItems.map((a) => (
                    <tr
                      key={a.id}
                      className="table-row"
                      onClick={() => setAllocationDetailId(a.id)}
                      title="View allocation details"
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--color-navy-dark)" }}>
                          {a.scheme ?? "Government Scheme Allocation"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.description ?? "—"}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: "0.75rem" }}>
                          {a.fiscalYear}
                        </span>
                      </td>
                      <td
                        className="table-align-right"
                        style={{
                          fontWeight: 700,
                          color: "var(--color-navy-dark)",
                        }}
                      >
                        {formatCurrency(a.allocatedAmount)}
                      </td>
                      <td className="table-date">
                        {formatDate(a.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <PaginationBar
              from={allocationsPagination.from}
              to={allocationsPagination.to}
              total={allocationsPagination.total}
              currentPage={allocationsPagination.currentPage}
              totalPages={allocationsPagination.totalPages}
              pageSize={allocationsPagination.pageSize}
              itemName="allocations"
              onPageClick={allocationsPagination.onPageClick}
              onPageSizeChange={allocationsPagination.onPageSizeChange}
            />
          </div>
        </div>
      )}

      {/* Record Expense Modal — dashboard modal idiom: overlay + card + X close */}
      {showExpenseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Record expenditure claim"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 26, 56, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(560px, calc(100vw - 2rem))",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "10px",
              boxSizing: "border-box",
              maxHeight: "calc(100vh - 4rem)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 750 }}>
                  Record expenditure
                </h3>
                <p
                  style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}
                >
                  {project.name} · {project.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                disabled={submittingExpense}
                aria-label="Close expenditure form"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.35rem",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "6px",
                  cursor: submittingExpense ? "wait" : "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <form
              onSubmit={handleCreateExpense}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
                marginTop: "1.1rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="pf-category" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    Category *
                  </label>
                  <select
                    id="pf-category"
                    className="input"
                    style={expenseFieldStyle}
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    required
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="pf-amount" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    Amount (₹) *
                  </label>
                  <input
                    id="pf-amount"
                    type="text"
                    inputMode="decimal"
                    className="input"
                    style={expenseFieldStyle}
                    placeholder="25000.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label htmlFor="pf-description" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  Description *
                </label>
                <input
                  id="pf-description"
                  type="text"
                  className="input"
                  style={expenseFieldStyle}
                  placeholder="e.g. Supply of cement bags batch 4"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="pf-vendor" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    Vendor / payee *
                  </label>
                  <input
                    id="pf-vendor"
                    type="text"
                    className="input"
                    style={expenseFieldStyle}
                    placeholder="ABC Suppliers Ltd"
                    value={expenseForm.vendorName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="pf-gstin" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    GSTIN
                  </label>
                  <input
                    id="pf-gstin"
                    type="text"
                    className="input"
                    style={expenseFieldStyle}
                    placeholder="22AAAAA0000A1Z5"
                    value={expenseForm.vendorGstin}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, vendorGstin: e.target.value })
                    }
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="pf-invoice" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    Invoice / voucher
                  </label>
                  <input
                    id="pf-invoice"
                    type="text"
                    className="input"
                    style={expenseFieldStyle}
                    placeholder="INV-2025-001"
                    value={expenseForm.invoiceNumber}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })
                    }
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label htmlFor="pf-date" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                    Transaction date *
                  </label>
                  <input
                    id="pf-date"
                    type="date"
                    className="input"
                    style={expenseFieldStyle}
                    value={expenseForm.transactionDate}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, transactionDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {expenseError && (
                <div role="alert" className="error-banner">
                  {expenseError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowExpenseModal(false)}
                  disabled={submittingExpense}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <IconX width={15} height={15} />
                  <span>Cancel</span>
                </button>
                <button type="submit" className="btn-primary" disabled={submittingExpense}>
                  {submittingExpense ? "Submitting…" : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXPENSE ROW DETAIL — dashboard idiom (overlay + card + actions) */}
      {detailFlag && (
        <FlagDetailModal
          flag={detailFlag}
          projectName={project.name}
          projectCode={project.code}
          canInspect={canInspect}
          onClose={() => setFlagDetailId(null)}
          onReview={() => {
            setFlagDetailId(null);
            setFlagAction({ flag: detailFlag, action: "review" });
          }}
          onInspect={() => {
            setFlagDetailId(null);
            setInspectFlag(detailFlag);
          }}
          onDismiss={() => {
            setFlagDetailId(null);
            setFlagAction({ flag: detailFlag, action: "dismiss" });
          }}
          onResolve={() => {
            setFlagDetailId(null);
            setFlagAction({ flag: detailFlag, action: "resolve" });
          }}
        />
      )}

      {flagAction && (
        <FlagActionModal
          action={flagAction.action}
          note={flagNote}
          onNoteChange={setFlagNote}
          onSubmit={handleFlagAction}
          onClose={() => setFlagAction(null)}
        />
      )}

      {inspectFlag && (
        <ScheduleInspectionModal
          flag={inspectFlag}
          projectName={project.name}
          onConfirm={() => handleTriggerInspection(inspectFlag.id)}
          onClose={() => setInspectFlag(null)}
        />
      )}

      {detailAllocation && (
        <AllocationDetailModal
          allocation={detailAllocation}
          projectName={project.name}
          onClose={() => setAllocationDetailId(null)}
        />
      )}

      {detailExpense && (
        <ExpenseDetailModal
          expense={detailExpense}
          allocation={detailExpenseAllocation}
          project={project}
          canVerify={canVerifyExpense}
          onClose={() => setDetailExpenseId(null)}
          onReject={(id) => {
            setDetailExpenseId(null);
            setRejectError(null);
            setRejectReason("");
            setShowRejectModal(id);
          }}
          onVerify={(id) => {
            setDetailExpenseId(null);
            void handleVerifyExpense(id);
          }}
        />
      )}

      {/* MODAL: REJECT EXPENSE (reason required, as on the dashboard) */}
      {showRejectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reject expenditure record"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 26, 56, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(460px, calc(100vw - 2rem))",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "10px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <h3 style={{ margin: 0, color: "#b91c1c", fontSize: "1.1rem", fontWeight: 750 }}>
                Reject expenditure record
              </h3>
              <button
                type="button"
                onClick={() => setShowRejectModal(null)}
                disabled={rejecting}
                aria-label="Close rejection form"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.35rem",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "6px",
                  cursor: rejecting ? "wait" : "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.5rem 0 0" }}>
              The submitting organisation will be able to amend and resubmit this claim. The
              rejection reason is recorded in the audit trail.
            </p>
            <div
              style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}
            >
              <label htmlFor="pf-reject-reason" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Rejection reason *
              </label>
              <textarea
                id="pf-reject-reason"
                style={{ ...expenseFieldStyle, minHeight: "5.5rem", resize: "vertical" }}
                placeholder="Reason for rejecting this claim (required by audit policy)…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>

            {rejectError && (
              <div role="alert" className="error-banner" style={{ marginTop: "0.75rem" }}>
                {rejectError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "1.1rem",
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRejectModal(null)}
                disabled={rejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!rejectReason.trim() || rejecting}
                onClick={() => void handleRejectExpense()}
                style={{ background: "#b91c1c", borderColor: "#b91c1c" }}
              >
                {rejecting ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidingExpenseId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Void expense record"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 26, 56, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(460px, calc(100vw - 2rem))",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "10px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
              }}
            >
              <h3 style={{ margin: 0, color: "#b91c1c", fontSize: "1.1rem", fontWeight: 750 }}>
                Void expenditure record
              </h3>
              <button
                type="button"
                onClick={() => setVoidingExpenseId(null)}
                disabled={voiding}
                aria-label="Close void confirmation"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.35rem",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "6px",
                  cursor: voiding ? "wait" : "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.5rem 0 0" }}>
              Financial records cannot be deleted. Voiding permanently deactivates this claim while
              retaining an immutable audit trail.
            </p>
            <div
              style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}
            >
              <label htmlFor="pf-void-reason" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Justification / reason *
              </label>
              <textarea
                id="pf-void-reason"
                className="input"
                style={{ ...expenseFieldStyle, minHeight: "5.5rem", resize: "vertical" }}
                placeholder="Reason for voiding (required by audit policy)…"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                required
              />
            </div>

            {voidError && (
              <div role="alert" className="error-banner" style={{ marginTop: "0.75rem" }}>
                {voidError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "1.1rem",
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setVoidingExpenseId(null)}
                disabled={voiding}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!voidReason.trim() || voiding}
                onClick={handleVoidExpense}
                style={{ background: "#b91c1c", borderColor: "#b91c1c" }}
              >
                {voiding ? "Voiding…" : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sanction Allocation modal — dashboard idiom (overlay + card + sections) */}
      {showAllocationModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sanction scheme allocation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 26, 56, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(720px, calc(100vw - 2rem))",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 0,
              background: "#ffffff",
              borderRadius: "12px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "1rem",
                padding: "1.25rem 1.5rem 1rem",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 750 }}>
                  Sanction Scheme Allocation
                </h2>
                <p
                  style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}
                >
                  {project.name} · {project.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllocationModal(false)}
                disabled={submittingAllocation}
                aria-label="Close allocation form"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.35rem",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "6px",
                  cursor: submittingAllocation ? "wait" : "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <form
              onSubmit={handleCreateAllocation}
              style={{ display: "flex", flexDirection: "column", padding: "0 1.5rem" }}
            >
              <section
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.9rem",
                  padding: "1.25rem 0",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>
                    Allocation Target
                  </h3>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.85rem",
                  }}
                >
                  <div>
                    <label
                      htmlFor="pf-allocation-fy"
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        marginBottom: "0.3rem",
                      }}
                    >
                      Fiscal Year *
                    </label>
                    <select
                      id="pf-allocation-fy"
                      required
                      value={allocationForm.fiscalYear}
                      onChange={(e) =>
                        setAllocationForm({ ...allocationForm, fiscalYear: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "0.6rem",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border-strong)",
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value={currentFy()}>{currentFy()} · Current FY</option>
                      <option value={nextFy()}>{nextFy()} · Next FY</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="pf-allocation-amount"
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        marginBottom: "0.3rem",
                      }}
                    >
                      Sanctioned Amount (₹) *
                    </label>
                    <input
                      id="pf-allocation-amount"
                      required
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 5000000.00"
                      value={allocationForm.allocatedAmount}
                      onChange={(e) =>
                        setAllocationForm({ ...allocationForm, allocatedAmount: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "0.6rem",
                        borderRadius: "6px",
                        border: "1px solid var(--color-border-strong)",
                      }}
                    />
                  </div>
                </div>
              </section>

              <section
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.9rem",
                  padding: "1.25rem 0",
                  borderTop: "1px solid var(--color-border-subtle)",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Scheme Details</h3>
                </div>
                <div>
                  <label
                    htmlFor="pf-allocation-scheme"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      marginBottom: "0.3rem",
                    }}
                  >
                    Scheme Name *
                  </label>
                  <input
                    id="pf-allocation-scheme"
                    required
                    type="text"
                    placeholder="Enter the sanctioning scheme name"
                    value={allocationForm.scheme}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, scheme: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border-strong)",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="pf-allocation-description"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      marginBottom: "0.3rem",
                    }}
                  >
                    Description{" "}
                    <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional)</span>
                  </label>
                  <input
                    id="pf-allocation-description"
                    type="text"
                    placeholder="Purpose or scope of this allocation"
                    value={allocationForm.description}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, description: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border-strong)",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="pf-allocation-notes"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      marginBottom: "0.3rem",
                    }}
                  >
                    Administrative Notes{" "}
                    <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional)</span>
                  </label>
                  <textarea
                    id="pf-allocation-notes"
                    rows={3}
                    placeholder="Internal notes for reviewers"
                    value={allocationForm.notes}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, notes: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border-strong)",
                      font: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>
              </section>

              {allocationError && (
                <div role="alert" className="error-banner" style={{ marginBottom: "0.9rem" }}>
                  {allocationError}
                </div>
              )}

              <div
                style={{
                  position: "sticky",
                  bottom: 0,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  margin: "0 -1.5rem",
                  padding: "1rem 1.5rem",
                  background: "rgba(255, 255, 255, 0.97)",
                  borderTop: "1px solid var(--color-border-subtle)",
                  boxShadow: "0 -8px 20px rgba(15, 23, 42, 0.06)",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAllocationModal(false)}
                  disabled={submittingAllocation}
                  style={{
                    padding: "0.65rem 1rem",
                    cursor: submittingAllocation ? "wait" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAllocation}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    minWidth: "190px",
                    padding: "0.7rem 1.2rem",
                    borderRadius: "6px",
                    background:
                      "linear-gradient(90deg, var(--color-navy-brand), var(--color-accent-blue))",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {submittingAllocation ? "Sanctioning allocation..." : "Sanction allocation"}
                  {!submittingAllocation && <IconChevronRight width={15} height={15} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
