"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type {
  FundAllocation,
  Expense,
  InspectionFlag,
  Project,
} from "@netram/types";
import {
  IconX,
  IconSearch,
  IconPlus,
  IconTrendingUp,
  IconIndianRupee,
  IconChevronRight,
} from "../../components/icons";
import {
  EXPENSE_STATUS_FILTERS,
  StatusFilter,
  matchesStatusFilter,
} from "../../components/fund-status-filter";
import {
  AllocationDetailModal,
  ExpenseDetailModal,
  FlagActionModal,
  FlagDetailModal,
  ScheduleInspectionModal,
  expenseStatusMeta,
  formatCurrency,
  formatDate,
} from "../../components/funds-ui";

export interface ProjectOption {
  id: string;
  name: string;
  code: string;
  districtId: string | null;
  organisationId: string | null;
  status: Project["status"];
  approvedById: string | null;
  stateName: string;
  districtName: string;
  organisationName: string;
}

export function getWorkflowEstablishments(projects: ProjectOption[]): ProjectOption[] {
  const uniqueProjects = new Map<string, ProjectOption>();
  for (const project of projects) {
    if (
      project.status === "Active" &&
      project.approvedById !== null &&
      project.districtId !== null &&
      project.organisationId !== null
    ) {
      uniqueProjects.set(project.id, project);
    }
  }
  return [...uniqueProjects.values()].sort(
    (left, right) =>
      left.stateName.localeCompare(right.stateName) ||
      left.districtName.localeCompare(right.districtName) ||
      left.name.localeCompare(right.name),
  );
}

interface FundsDashboardClientProps {
  initialAllocations: FundAllocation[];
  initialExpenses: Expense[];
  initialFlags: InspectionFlag[];
  canViewRiskFlags: boolean;
  projects: ProjectOption[];
  permissions: string[];
}

function fyOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export function currentAndNextFiscalYears(now = new Date()): string[] {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [`${startYear}-${startYear + 1}`, `${startYear + 1}-${startYear + 2}`];
}

export function expenseAmountMatches(entered: string, expected: string): boolean {
  return entered.replace(/,/g, "").trim() === expected.replace(/,/g, "").trim();
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

const expenseTextareaStyle: React.CSSProperties = {
  ...expenseFieldStyle,
  minHeight: "7rem",
  resize: "vertical",
};

const expenseGroupStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.85rem",
};

function formatCompact(val: number): string {
  if (val >= 1e7) return "₹ " + (val / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
  if (val >= 1e5) return "₹ " + (val / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " L";
  if (val >= 1e3) return "₹ " + (val / 1e3).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " K";
  return "₹ " + val.toLocaleString("en-IN");
}

const PIE_PALETTE = ["#2563eb", "#f59e0b", "#059669", "#8b5cf6", "#dc2626", "#0ea5e9", "#ec4899", "#84cc16", "#f97316", "#64748b"];

function StatDonut({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No expenditure data available.</div>;
  }

  const size = 180;
  const r = 72;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Expenditure by category donut chart">
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = Math.max(frac * c - 2, 0);
          const offset = -acc * c;
          acc += frac;
          return (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={PIE_PALETTE[i % PIE_PALETTE.length]}
              strokeWidth={24}
              strokeDasharray={`${dash} ${c}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${d.label}: ${formatCurrency(d.value)} (${Math.round(frac * 100)}%)`}</title>
            </circle>
          );
        })}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--text-primary)">
          {formatCompact(total)}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text-muted)">
          TOTAL SPENT
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 180, flex: 1 }}>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_PALETTE[i % PIE_PALETTE.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
            <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatCompact(d.value)}</span>
            <span style={{ color: "var(--text-muted)", width: 38, textAlign: "right" }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatHBar({ data, forceColors }: { data: { label: string; value: number }[]; forceColors?: string[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.length === 0) {
    return <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No records available.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ width: 130, fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right" }} title={d.label}>
            {d.label}
          </span>
          <div style={{ flex: 1, height: 18, background: "rgba(148, 163, 184, 0.15)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max((d.value / max) * 100, 2)}%`,
                background: forceColors?.[i] ?? PIE_PALETTE[i % PIE_PALETTE.length],
                borderRadius: 4,
              }}
              title={`${d.label}: ${formatCurrency(d.value)}`}
            />
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)", width: 70, textAlign: "right" }}>{formatCompact(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-subtle)" }}>{title}</div>
      {children}
    </div>
  );
}

function StatKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
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
          flex: 1,
        }}
      >
      <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.1, color:"var(--text-primary)", whiteSpace: "nowrap" }}>{value}</div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          transform: "translateY(-50%)",
          width: 3,
          height: "2.1rem",
          borderRadius: 2,
          background: color,
        }}
      />
    </div>
  );
}

export function FundsDashboardClient({
  initialAllocations,
  initialExpenses,
  initialFlags,
  canViewRiskFlags,
  projects,
  permissions,
}: FundsDashboardClientProps) {
  const [allocations, setAllocations] = useState<FundAllocation[]>(initialAllocations);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [flags, setFlags] = useState<InspectionFlag[]>(initialFlags);
  const workflowEstablishments = useMemo(() => getWorkflowEstablishments(projects), [projects]);
  const establishmentGroups = useMemo(() => {
    const groups = new Map<
      string,
      { stateName: string; districtName: string; establishments: ProjectOption[] }
    >();
    for (const establishment of workflowEstablishments) {
      const key = `${establishment.stateName}\u0000${establishment.districtName}`;
      const group = groups.get(key) ?? {
        stateName: establishment.stateName,
        districtName: establishment.districtName,
        establishments: [],
      };
      group.establishments.push(establishment);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [workflowEstablishments]);

  const [view, setView] = useState<
    "allocations" | "expenses" | "stats" | "flags"
  >("allocations");
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Permissions
  const canAllocate = permissions.includes("fund:allocate") || permissions.includes("*");
  const canVerify = permissions.includes("expense:verify") || permissions.includes("*");
  const canInspect = permissions.includes("inspection:create") || permissions.includes("*");
  const canSubmitExpense = permissions.includes("expense:submit") || permissions.includes("*");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    EXPENSE_STATUS_FILTERS.filter((f) => f.value !== "ALL").map((f) => f.value),
  );
  const [fyFilter, setFyFilter] = useState<string>("");

  // Modals
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [submittingAllocation, setSubmittingAllocation] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [showExpenseConfirmation, setShowExpenseConfirmation] = useState(false);
  const [confirmationAmount, setConfirmationAmount] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [expenseDraftId, setExpenseDraftId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    projectId: workflowEstablishments[0]?.id ?? "",
    category: "Materials & Supplies",
    description: "",
    amount: "",
    vendorName: "",
    vendorGstin: "",
    invoiceNumber: "",
    invoiceDate: "",
    paymentMethod: "",
    paymentReference: "",
    transactionDate: new Date().toISOString().split("T")[0],
    allocationId: "",
  });
  const expenseAllocations = allocations.filter(
    (allocation) =>
      allocation.projectId === expenseForm.projectId && allocation.status !== "cancelled",
  );
  const selectedExpenseEstablishment = workflowEstablishments.find(
    (establishment) => establishment.id === expenseForm.projectId,
  );
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null); // expenseId
  const [rejectReason, setRejectReason] = useState("");
  const [showInspectModal, setShowInspectModal] = useState<InspectionFlag | null>(null);
  const [showFlagActionModal, setShowFlagActionModal] = useState<{
    flag: InspectionFlag;
    action: "review" | "resolve" | "dismiss";
  } | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [detail, setDetail] = useState<{ kind: "allocation" | "expense" | "flag"; id: string } | null>(null);

  // Forms
  const [allocationForm, setAllocationForm] = useState({
    projectId: projects[0]?.id ?? "",
    fiscalYear: currentAndNextFiscalYears()[0],
    allocatedAmount: "",
    scheme: "",
    description: "",
    notes: "",
  });

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectOption>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  // Per-fiscal-year stats for the stats panel. Lifecycle buckets are disjoint:
  // each expense contributes to exactly ONE bucket (pending / verified / rejected / voided).
  const statsByYear = useMemo(() => {
    const empty = () => ({ sanctioned: 0, pending: 0, verified: 0, rejected: 0, voided: 0 });
    const byYear = new Map<string, ReturnType<typeof empty>>();
    for (const a of allocations) {
      const fy = a.fiscalYear || "—";
      const rec = byYear.get(fy) ?? empty();
      rec.sanctioned += parseFloat(a.allocatedAmount) || 0;
      byYear.set(fy, rec);
    }
    for (const e of expenses) {
      const fy = fyOf(e.transactionDate) ?? "—";
      const rec = byYear.get(fy) ?? empty();
      const amount = parseFloat(e.amount) || 0;
      if (e.status === "verified") rec.verified += amount;
      else if (e.status === "rejected") rec.rejected += amount;
      else if (e.status === "voided") rec.voided += amount;
      else if (e.status === "submitted" || e.status === "under_review") rec.pending += amount;
      byYear.set(fy, rec);
    }
    return [...byYear.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fy, v]) => ({ fy, ...v }));
  }, [allocations, expenses]);

  const statsOverview = useMemo(() => {
    let sanctioned = 0;
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let voided = 0;
    for (const y of statsByYear) {
      sanctioned += y.sanctioned;
      pending += y.pending;
      verified += y.verified;
      rejected += y.rejected;
      voided += y.voided;
    }
    return { sanctioned, pending, verified, rejected, voided };
  }, [statsByYear]);

  // Expenditure grouped by category (pending + verified only — the real spend)
  const statsByCategory = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const e of expenses) {
      if (e.status === "rejected" || e.status === "voided" || e.status === "draft") continue;
      const cat = e.category || "Other";
      byCat.set(cat, (byCat.get(cat) ?? 0) + (parseFloat(e.amount) || 0));
    }
    return [...byCat.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Top projects by total spend (excludes rejected/voided)
  const statsByProject = useMemo(() => {
    const byProj = new Map<string, number>();
    for (const e of expenses) {
      if (e.status === "rejected" || e.status === "voided") continue;
      const name = projectMap.get(e.projectId)?.name ?? "Unknown Project";
      byProj.set(name, (byProj.get(name) ?? 0) + (parseFloat(e.amount) || 0));
    }
    return [...byProj.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [expenses, projectMap]);

  // Expense status breakdown
  const statsByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    const amounts = new Map<string, number>();
    for (const e of expenses) {
      counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
      amounts.set(e.status, (amounts.get(e.status) ?? 0) + (parseFloat(e.amount) || 0));
    }
    return expenseStatusMeta
      .map((s) => ({
        status: s.value,
        label: s.label,
        color: s.color,
        count: counts.get(s.value) ?? 0,
        amount: amounts.get(s.value) ?? 0,
      }))
      .filter((s) => s.count > 0);
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!matchesStatusFilter(e.status, selectedStatuses, EXPENSE_STATUS_FILTERS)) return false;
        if (fyFilter && fyOf(e.transactionDate) !== fyFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const p = projectMap.get(e.projectId);
          const matchProj = p?.name.toLowerCase().includes(q) || p?.code.toLowerCase().includes(q);
          const matchDesc = e.description.toLowerCase().includes(q);
          const matchVendor = e.vendorName.toLowerCase().includes(q);
          const matchInv = (e.invoiceNumber ?? "").toLowerCase().includes(q);
          if (!matchProj && !matchDesc && !matchVendor && !matchInv) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pending = (s: Expense["status"]) => (s === "submitted" || s === "under_review" ? 0 : 1);
        return pending(a.status) - pending(b.status);
      });
  }, [expenses, selectedStatuses, fyFilter, search, projectMap]);

  // Filtered allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (fyFilter && a.fiscalYear !== fyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const p = projectMap.get(a.projectId);
        const matchProj = p?.name.toLowerCase().includes(q) || p?.code.toLowerCase().includes(q);
        const matchDesc = (a.description ?? "").toLowerCase().includes(q);
        const matchScheme = (a.scheme ?? "").toLowerCase().includes(q);
        const matchNotes = (a.notes ?? "").toLowerCase().includes(q);
        if (!matchProj && !matchDesc && !matchScheme && !matchNotes) return false;
      }
      return true;
    });
  }, [allocations, search, projectMap, fyFilter]);

  // Filtered flags
  const filteredFlags = useMemo(() => {
    return flags.filter((f) => {
      if (fyFilter && fyOf(f.createdAt) !== fyFilter) return false;
      return true;
    });
  }, [flags, fyFilter]);

  const fyOptions = useMemo(() => {
    const present: number[] = [];
    const collect = (fy: string | null) => {
      if (fy) {
        const start = Number(fy.slice(0, 4));
        if (!present.includes(start)) present.push(start);
      }
    };
    for (const a of allocations) collect(a.fiscalYear);
    for (const e of expenses) collect(fyOf(e.transactionDate));
    for (const f of flags) collect(fyOf(f.createdAt));
    if (present.length === 0) return [];
    const currentYear = new Date().getFullYear();
    const start = Math.min(Math.min(...present), currentYear);
    const end = Math.min(Math.max(...present), currentYear);
    return Array.from({ length: end - start + 1 }, (_, i) => {
      const y = start + i;
      return `${y}-${y + 1}`;
    });
  }, [allocations, expenses, flags]);

  useEffect(() => {
    if (!fyOptions.includes(fyFilter)) {
      setFyFilter(fyOptions[fyOptions.length - 1] ?? "");
    }
  }, [fyOptions, fyFilter]);

  const detailAllocation =
    detail?.kind === "allocation" ? allocations.find((a) => a.id === detail.id) : undefined;
  const detailExpense = detail?.kind === "expense" ? expenses.find((e) => e.id === detail.id) : undefined;
  const detailExpenseProject = detailExpense ? projectMap.get(detailExpense.projectId) : undefined;
  const detailExpenseAllocation = detailExpense
    ? allocations.find((allocation) => allocation.id === detailExpense.allocationId)
    : undefined;
  const detailFlag = detail?.kind === "flag" ? flags.find((f) => f.id === detail.id) : undefined;

  // Handlers
  async function handleCreateAllocation(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAllocation(true);
    try {
      const res = await fetch("/api/v1/funds/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: allocationForm.projectId,
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
      const created = (await res.json()) as FundAllocation;
      setAllocations((prev) => [created, ...prev]);
      setShowAllocationModal(false);
      setAllocationForm((current) => ({
        ...current,
        fiscalYear: currentAndNextFiscalYears()[0],
        allocatedAmount: "",
        scheme: "",
        description: "",
        notes: "",
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSubmittingAllocation(false);
    }
  }

  function closeAllocationModal() {
    if (!submittingAllocation) setShowAllocationModal(false);
  }

  function openExpenseModal() {
    setExpenseDraftId(null);
    setShowExpenseModal(true);
  }

  function closeExpenseModal() {
    if (submittingExpense) return;
    if (
      expenseDraftId &&
      !window.confirm(
        "This expenditure is saved as a draft. Close it now? You can retry submission before closing.",
      )
    ) {
      return;
    }
    setExpenseDraftId(null);
    setShowExpenseModal(false);
  }

  function handleExpenseSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseDraftId && (!expenseForm.projectId || !expenseForm.description || !expenseForm.amount)) {
      return;
    }
    setConfirmationAmount("");
    setConfirmationError("");
    setShowExpenseConfirmation(true);
  }

  function closeExpenseConfirmation() {
    if (submittingExpense) return;
    setShowExpenseConfirmation(false);
    setConfirmationAmount("");
    setConfirmationError("");
  }

  async function submitExpense() {
    setSubmittingExpense(true);
    setConfirmationError("");
    let created: Expense | null = null;
    try {
      let submitted: Expense;
      if (expenseDraftId) {
        const res = await fetch(`/api/v1/funds/expenses/${expenseDraftId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to submit expense");
        }
        submitted = (await res.json()) as Expense;
      } else {
        const res = await fetch("/api/v1/funds/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: expenseForm.projectId,
            allocationId: expenseForm.allocationId || undefined,
            category: expenseForm.category,
            description: expenseForm.description,
            amount: expenseForm.amount,
            vendorName: expenseForm.vendorName || undefined,
            vendorGstin: expenseForm.vendorGstin || undefined,
            invoiceNumber: expenseForm.invoiceNumber || undefined,
            invoiceDate: expenseForm.invoiceDate
              ? new Date(`${expenseForm.invoiceDate}T00:00:00.000Z`).toISOString()
              : undefined,
            paymentMethod: expenseForm.paymentMethod || undefined,
            paymentReference: expenseForm.paymentReference || undefined,
            transactionDate: new Date(`${expenseForm.transactionDate}T00:00:00.000Z`).toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to create expense");
        }
        created = (await res.json()) as Expense;
        setExpenseDraftId(created.id);

        const submitRes = await fetch(`/api/v1/funds/expenses/${created.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!submitRes.ok) {
          const err = await submitRes.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to submit expense");
        }
        submitted = (await submitRes.json()) as Expense;
      }

      setExpenses((prev) => [submitted, ...prev.filter((expense) => expense.id !== submitted.id)]);
      setExpenseDraftId(null);
      setShowExpenseModal(false);
      setShowExpenseConfirmation(false);
      setConfirmationAmount("");
      setConfirmationError("");
      setExpenseForm({
        projectId: workflowEstablishments[0]?.id ?? "",
        category: "Materials & Supplies",
        description: "",
        amount: "",
        vendorName: "",
        vendorGstin: "",
        invoiceNumber: "",
        invoiceDate: "",
        paymentMethod: "",
        paymentReference: "",
        transactionDate: new Date().toISOString().split("T")[0],
        allocationId: "",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConfirmationError(
        created || expenseDraftId ? `${msg} The saved draft is ready to retry.` : msg,
      );
    } finally {
      setSubmittingExpense(false);
    }
  }

  async function handleExpenseConfirmation(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseAmountMatches(confirmationAmount, expenseForm.amount)) {
      setConfirmationError("Enter the expenditure amount exactly as shown above.");
      return;
    }
    await submitExpense();
  }

  async function handleVerifyExpense(id: string) {
    if (!confirm("Confirm verification of this expenditure against supporting documentation?")) return;
    try {
      const res = await fetch(`/api/v1/funds/expenses/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Verification failed");
      }
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleRejectExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!showRejectModal || !rejectReason.trim()) return;
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
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === showRejectModal ? updated : e)));
      setShowRejectModal(null);
      setRejectReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
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
      setShowInspectModal(null);
      // Update flag status locally
      setFlags((prev) =>
        prev.map((f) =>
          f.id === flagId
            ? { ...f, status: "inspection_in_progress", linkedInspectionId: data.inspection.id }
            : f,
        ),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleFlagAction(e: React.FormEvent) {
    e.preventDefault();
    if (!showFlagActionModal) return;
    const { flag, action } = showFlagActionModal;
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
      const updated = await res.json();
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
      setShowFlagActionModal(null);
      setFlagNote("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Toolbar: Search, Filters & Section Tabs */}
      <div className="registry-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by facility, scheme, description, or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter fund records"
              style={{ minWidth: "280px", maxWidth: "420px" }}
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Fund dashboard sections">
            <button
              type="button"
              role="tab"
              aria-selected={view === "allocations"}
              className={`filter-tab-btn ${view === "allocations" ? "active" : ""}`}
              onClick={() => setView("allocations")}
            >
              <span>Allocations</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={view === "expenses"}
              className={`filter-tab-btn ${view === "expenses" ? "active" : ""}`}
              onClick={() => setView("expenses")}
            >
              <span>Expenditures</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={view === "stats"}
              className={`filter-tab-btn ${view === "stats" ? "active" : ""}`}
              onClick={() => setView("stats")}
            >
              <span>Stats</span>
            </button>

            {canViewRiskFlags && (
              <button
                type="button"
                role="tab"
                aria-selected={view === "flags"}
                className={`filter-tab-btn ${view === "flags" ? "active" : ""}`}
                onClick={() => setView("flags")}
              >
                <span>Alerts</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
          {view === "expenses" && (
            <StatusFilter
              filters={EXPENSE_STATUS_FILTERS}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              title="Filter by status"
            />
          )}

          {canSubmitExpense && canAllocate ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowAddMenu((s) => !s)}
                className="btn"
                aria-haspopup="menu"
                aria-expanded={showAddMenu}
                title="Add expenditure or allocate fund"
                style={{
                  background: "#4338ca",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.5rem 0.9rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  borderRadius: "6px",
                  boxShadow: "0 2px 6px rgba(67, 56, 202, 0.35)",
                }}
              >
                <IconPlus width={15} height={15} />
                <span>New Entry</span>
                <IconChevronRight
                  width={12}
                  height={12}
                  style={{ transform: showAddMenu ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
                />
              </button>
              {showAddMenu && (
                <>
                  <div
                    onClick={() => setShowAddMenu(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  />
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 0.5rem)",
                      zIndex: 50,
                      minWidth: "260px",
                      background: "#ffffff",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "10px",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
                      padding: "0.4rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", padding: "0.4rem 0.6rem 0.2rem" }}>
                      Create Record
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="add-entry-option"
                      onClick={() => {
                        setShowAddMenu(false);
                        openExpenseModal();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.7rem",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: "8px",
                          background: "rgba(217, 119, 6, 0.14)",
                          color: "#b45309",
                          flexShrink: 0,
                        }}
                      >
                        <IconTrendingUp width={16} height={16} />
                      </span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span>Add Expenditure</span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--text-muted)" }}>
                          Record submitted/spent amount
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="add-entry-option"
                      onClick={() => {
                        setShowAddMenu(false);
                        setShowAllocationModal(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.7rem",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: "8px",
                          background: "rgba(67, 56, 202, 0.12)",
                          color: "#4338ca",
                          flexShrink: 0,
                        }}
                      >
                        <IconIndianRupee width={16} height={16} />
                      </span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span>Allocate Fund</span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--text-muted)" }}>
                          Sanction funds to a scheme
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {canSubmitExpense && (
                <button
                  type="button"
                  onClick={openExpenseModal}
                  className="btn"
                  style={{
                    background: "#d97706",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    borderRadius: "4px",
                  }}
                  title="Add Expenditure"
                >
                  <span>+ Add Expenditure</span>
                </button>
              )}

              {canAllocate && (
                <button
                  type="button"
                  onClick={() => setShowAllocationModal(true)}
                  className="btn"
                  style={{
                    background: "var(--color-navy-brand)",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    borderRadius: "4px",
                  }}
                  title="Allocate Fund"
                >
                  <span>+ Allocate Fund</span>
                </button>
              )}
            </>
          )}

          {fyOptions.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", whiteSpace: "nowrap" }}>
              <button
                type="button"
                style={fyArrowStyle}
                title="Previous fiscal year"
                aria-label="Previous fiscal year"
                disabled={!(fyOptions.indexOf(fyFilter) > 0)}
                onClick={() => setFyFilter(fyOptions[Math.max(fyOptions.indexOf(fyFilter) - 1, 0)]!)}
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
                            style={{ color: "#cbd5e1", fontSize: "0.85rem", fontWeight: 600, padding: "0 0.45rem" }}
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
                disabled={!(fyOptions.indexOf(fyFilter) < fyOptions.length - 1)}
                onClick={() => setFyFilter(fyOptions[Math.min(fyOptions.indexOf(fyFilter) + 1, fyOptions.length - 1)]!)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats content (shown in place of the tables) */}
      {view === "stats" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          {/* LEFT: 2x2 KPI grid | RIGHT: pie (category donut) */}
          <div style={{ display: "flex", gap: "1.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 340px", minWidth: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
                <StatKpi label="Total Sanctioned" value={formatCompact(statsOverview.sanctioned)} color="#2563eb" />
                <StatKpi label="Pending Verification" value={formatCompact(statsOverview.pending)} color="#f59e0b" />
                <StatKpi label="Verified" value={formatCompact(statsOverview.verified)} color="#059669" />
                <StatKpi label="Rejected" value={formatCompact(statsOverview.rejected)} color="#dc2626" />
              </div>
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 280 }}>
              <StatCard title="Expenditure by Category">
                <StatDonut data={statsByCategory} />
              </StatCard>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.75rem", marginTop: "1.5rem" }}>
            <StatCard title="Top Projects by Spend">
              <StatHBar data={statsByProject} />
            </StatCard>
            <StatCard title="Expenditure by Status">
              <StatHBar data={statsByStatus.map((s) => ({ label: s.label, value: s.amount }))} forceColors={statsByStatus.map((s) => s.color)} />
            </StatCard>
          </div>
        </div>
      )}

      {/* TAB 1: ALLOCATIONS & RELEASES */}
      {view === "allocations" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Facility / Project</th>
                <th>Scheme</th>
                <th>Description</th>
                <th>FY</th>
                <th style={{ textAlign: "right" }}>Sanctioned Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                    No fund allocations found matching filters.
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((a) => {
                  const p = projectMap.get(a.projectId);

                  return (
                    <tr
                      key={a.id}
                      onClick={() => setDetail({ kind: "allocation", id: a.id })}
                      title="View allocation details"
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <Link
                          href={`/projects/${a.projectId}/funds`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                        >
                          {p?.name ?? a.projectId.slice(0, 8)}
                        </Link>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                          {p?.code ?? "—"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--color-navy-dark)" }}>
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
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-navy-dark)" }}>
                        {formatCurrency(a.allocatedAmount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ALL EXPENDITURES */}
      {view === "expenses" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Facility / Project</th>
                <th>Description</th>
                <th>Vendor</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Expenditure Amount</th>
                <th style={{ textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
{filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                      No expenditures found matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                filteredExpenses.map((e) => {
                  const p = projectMap.get(e.projectId);
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setDetail({ kind: "expense", id: e.id })}
                      title="View expenditure details & actions"
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <Link
                          href={`/projects/${e.projectId}/funds`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                        >
                          {p?.name ?? e.projectId.slice(0, 8)}
                        </Link>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                          {p?.code ?? "—"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, maxWidth: "250px" }}>{e.description}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{e.vendorName}</div>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {formatDate(e.transactionDate)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-navy-dark)" }}>
                        {formatCurrency(e.amount)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              e.status === "verified"
                                ? "#16a34a"
                                : e.status === "rejected"
                                  ? "#dc2626"
                                  : "#d97706",
                          }}
                        >
                          {e.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: FINANCIAL ALERTS & ANOMALY REVIEW */}
      {canViewRiskFlags && view === "flags" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Severity</th>
                  <th>Reason</th>
                  <th>Flagged On</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlags.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                      No active financial alerts recorded.
                    </td>
                  </tr>
                ) : (
                  filteredFlags.map((f) => {
                    const p = projectMap.get(f.projectId);
                    return (
                      <tr
                        key={f.id}
                        onClick={() => setDetail({ kind: "flag", id: f.id })}
                        title="View alert details & actions"
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <Link
                            href={`/projects/${f.projectId}/funds`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                          >
                            {p?.name ?? f.projectId.slice(0, 8)}
                          </Link>
                        </td>
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
                            <div style={{ fontSize: "0.7rem", marginTop: "0.2rem", color: "#2563eb" }}>
                              <Link href={`/inspections/${f.linkedInspectionId}`} onClick={(e) => e.stopPropagation()}>
                                Inspection #{f.linkedInspectionId.slice(0, 8)}
                              </Link>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {formatDate(f.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ALLOCATION */}
      {showAllocationModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
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
              </div>
              <button
                type="button"
                onClick={closeAllocationModal}
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
              <section style={{ display: "flex", flexDirection: "column", gap: "0.9rem", padding: "1.25rem 0" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Allocation Target</h3>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Beneficiary Establishment *
                  </label>
                  <select
                    required
                    value={allocationForm.projectId}
                    onChange={(e) => setAllocationForm({ ...allocationForm, projectId: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)", background: "var(--bg-surface)" }}
                  >
                    {projects.length === 0 && <option value="">No establishments available</option>}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.code} — {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                      Fiscal Year *
                    </label>
                    <select
                      required
                      value={allocationForm.fiscalYear}
                      onChange={(e) => setAllocationForm({ ...allocationForm, fiscalYear: e.target.value })}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)", background: "var(--bg-surface)" }}
                    >
                      {currentAndNextFiscalYears().map((year, index) => (
                        <option key={year} value={year}>
                          {year} · {index === 0 ? "Current FY" : "Next FY"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                      Sanctioned Amount (₹) *
                    </label>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 5000000.00"
                      value={allocationForm.allocatedAmount}
                      onChange={(e) => setAllocationForm({ ...allocationForm, allocatedAmount: e.target.value })}
                      style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)" }}
                    />
                  </div>
                </div>
              </section>

              <section style={{ display: "flex", flexDirection: "column", gap: "0.9rem", padding: "1.25rem 0", borderTop: "1px solid var(--color-border-subtle)" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>Scheme Details</h3>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Scheme Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Enter the sanctioning scheme name"
                    value={allocationForm.scheme}
                    onChange={(e) => setAllocationForm({ ...allocationForm, scheme: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Description <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Purpose or scope of this allocation"
                    value={allocationForm.description}
                    onChange={(e) => setAllocationForm({ ...allocationForm, description: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Administrative Notes <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Internal notes for reviewers"
                    value={allocationForm.notes}
                    onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--color-border-strong)", font: "inherit", resize: "vertical" }}
                  />
                </div>
              </section>

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
                  onClick={closeAllocationModal}
                  disabled={submittingAllocation}
                  style={{ padding: "0.65rem 1rem", cursor: submittingAllocation ? "wait" : "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAllocation || projects.length === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    minWidth: "190px",
                    padding: "0.7rem 1.2rem",
                    borderRadius: "6px",
                    background: "linear-gradient(90deg, var(--color-navy-brand), var(--color-accent-blue))",
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

      {/* MODAL: REPORT EXPENDITURE (INSTITUTION / AGENCY) */}
      {showExpenseModal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-modal-title"
            className="card"
            style={{
              width: "min(1160px, calc(100vw - 2rem))",
              maxHeight: "calc(100vh - 2rem)",
              overflowY: "auto",
              padding: 0,
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                padding: "1.5rem 2rem 1.25rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2.25rem",
                    height: "2.25rem",
                    borderRadius: "10px",
                    background: "rgba(67, 56, 202, 0.1)",
                    color: "var(--color-navy-brand)",
                    flexShrink: 0,
                  }}
                >
                  <IconIndianRupee width={18} height={18} />
                </span>
                <h2 id="expense-modal-title" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 750 }}>
                  Add expenditure
                </h2>
              </div>
              <button
                type="button"
                onClick={closeExpenseModal}
                disabled={submittingExpense}
                aria-label="Close expenditure form"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2.25rem",
                  height: "2.25rem",
                  flexShrink: 0,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  borderRadius: "50%",
                  cursor: submittingExpense ? "wait" : "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <IconX width={19} height={19} />
              </button>
            </div>

            <form
              onSubmit={handleExpenseSubmitRequest}
              style={{ display: "flex", flexDirection: "column", padding: "0 2rem 1.5rem" }}
            >
              <fieldset
                disabled={expenseDraftId !== null}
                style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
              >
                <section style={expenseGroupStyle}>
                  {workflowEstablishments.length > 0 ? (
                    <>
                      <div
                        style={{
                          display: "grid",
                          width: "100%",
                          minWidth: 0,
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                          gap: "1rem",
                        }}
                      >
                        <select
                          required
                          aria-label="Beneficiary establishment"
                          value={expenseForm.projectId}
                          onChange={(e) =>
                            setExpenseForm({
                              ...expenseForm,
                              projectId: e.target.value,
                              allocationId: "",
                            })
                          }
                          style={expenseFieldStyle}
                        >
                          {establishmentGroups.map((group) => (
                            <optgroup
                              key={`${group.stateName}-${group.districtName}`}
                              label={`${group.stateName} / ${group.districtName}`}
                            >
                              {group.establishments.map((establishment) => (
                                <option key={establishment.id} value={establishment.id}>
                                  {establishment.organisationName} · {establishment.name} ({establishment.code})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <select
                          aria-label="Allocated funds"
                          value={expenseForm.allocationId}
                          onChange={(e) => setExpenseForm({ ...expenseForm, allocationId: e.target.value })}
                          style={expenseFieldStyle}
                        >
                          <option value="">Allocation (optional)</option>
                          {expenseAllocations.map((allocation) => (
                            <option key={allocation.id} value={allocation.id}>
                              {allocation.scheme || "Allocation"} · {formatCurrency(allocation.allocatedAmount)} ({allocation.fiscalYear})
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedExpenseEstablishment && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "0.35rem 1rem",
                            color: "var(--text-muted)",
                            fontSize: "0.8rem",
                          }}
                        >
                          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                            {selectedExpenseEstablishment.name}
                          </span>
                          <span>{selectedExpenseEstablishment.organisationName}</span>
                          <span>
                            {selectedExpenseEstablishment.stateName} / {selectedExpenseEstablishment.districtName}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div role="status" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      No approved establishments available.
                    </div>
                  )}
                </section>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
                    gap: "1.25rem",
                    alignItems: "start",
                  }}
                >
                  <section style={expenseGroupStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          width: "0.2rem",
                          height: "1rem",
                          borderRadius: "999px",
                          background: "var(--color-navy-brand)",
                        }}
                      />
                      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 750 }}>Spend</h3>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        width: "100%",
                        minWidth: 0,
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                        gap: "0.8rem",
                      }}
                    >
                      <div style={{ position: "relative", minWidth: 0 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            left: "0.8rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-muted)",
                            fontWeight: 700,
                            pointerEvents: "none",
                          }}
                        >
                          ₹
                        </span>
                        <input
                          required
                          type="text"
                          inputMode="decimal"
                          aria-label="Expenditure amount"
                          placeholder="Amount *"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          style={{ ...expenseFieldStyle, padding: "0.7rem 0.8rem 0.7rem 2rem" }}
                        />
                      </div>
                      <select
                        aria-label="Expenditure category"
                        value={expenseForm.category}
                        onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                        style={expenseFieldStyle}
                      >
                        <option value="Civil Works & Renovation">Civil Works & Renovation</option>
                        <option value="Materials & Supplies">Materials & Supplies</option>
                        <option value="Equipment & Technology">Equipment & Technology</option>
                        <option value="Personnel & Honorarium">Personnel & Honorarium</option>
                        <option value="Administrative & Overhead">Administrative & Overhead</option>
                        <option value="Nutrition & Catering">Nutrition & Catering</option>
                        <option value="Transport & Logistics">Transport & Logistics</option>
                        <option value="Other">Other Operational</option>
                      </select>
                      <input
                        required
                        type="date"
                        aria-label="Expenditure date"
                        value={expenseForm.transactionDate}
                        onChange={(e) => setExpenseForm({ ...expenseForm, transactionDate: e.target.value })}
                        style={expenseFieldStyle}
                      />
                    </div>
                    <textarea
                      required
                      rows={3}
                      aria-label="Purpose of expenditure"
                      placeholder="Purpose *"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      style={expenseTextareaStyle}
                    />
                  </section>

                  <section style={expenseGroupStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          width: "0.2rem",
                          height: "1rem",
                          borderRadius: "999px",
                          background: "#d97706",
                        }}
                      />
                      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 750 }}>Payee</h3>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        width: "100%",
                        minWidth: 0,
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
                        gap: "0.8rem",
                      }}
                    >
                      <input
                        required
                        type="text"
                        aria-label="Vendor / payee"
                        placeholder="Vendor / payee *"
                        value={expenseForm.vendorName}
                        onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                        style={expenseFieldStyle}
                      />
                      <input
                        type="text"
                        aria-label="GSTIN"
                        placeholder="GSTIN"
                        value={expenseForm.vendorGstin}
                        onChange={(e) => setExpenseForm({ ...expenseForm, vendorGstin: e.target.value })}
                        style={expenseFieldStyle}
                      />
                      <input
                        type="text"
                        aria-label="Invoice / voucher number"
                        placeholder="Invoice / voucher"
                        value={expenseForm.invoiceNumber}
                        onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                        style={expenseFieldStyle}
                      />
                      <input
                        type="date"
                        aria-label="Invoice date"
                        value={expenseForm.invoiceDate}
                        onChange={(e) => setExpenseForm({ ...expenseForm, invoiceDate: e.target.value })}
                        style={expenseFieldStyle}
                      />
                      <select
                        aria-label="Payment mode"
                        value={expenseForm.paymentMethod}
                        onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                        style={expenseFieldStyle}
                      >
                        <option value="">Payment mode</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="PFMS_TRANSFER">PFMS transfer</option>
                        <option value="RTGS">RTGS</option>
                        <option value="DIRECT_CREDIT">Direct credit</option>
                      </select>
                      <input
                        type="text"
                        aria-label="Payment reference"
                        placeholder="Payment reference"
                        value={expenseForm.paymentReference}
                        onChange={(e) => setExpenseForm({ ...expenseForm, paymentReference: e.target.value })}
                        style={expenseFieldStyle}
                      />
                    </div>
                  </section>
                </div>
              </fieldset>

              {expenseDraftId && (
                <div
                  role="alert"
                  style={{
                    marginTop: "1rem",
                    padding: "0.7rem 0.8rem",
                    borderRadius: "7px",
                    background: "#fff7ed",
                    color: "#9a3412",
                    fontSize: "0.8rem",
                  }}
                >
                  Draft saved. Retry submission when ready.
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  marginTop: "1.25rem",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeExpenseModal}
                  disabled={submittingExpense}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.4rem",
                    minWidth: "104px",
                    minHeight: "2.75rem",
                    padding: "0.7rem 1rem",
                    borderRadius: "8px",
                    fontWeight: 600,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    cursor: submittingExpense ? "wait" : "pointer",
                    opacity: submittingExpense ? 0.65 : 1,
                  }}
                >
                  <IconX width={15} height={15} />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense || workflowEstablishments.length === 0}
                  aria-busy={submittingExpense}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    minWidth: "190px",
                    minHeight: "2.75rem",
                    padding: "0.7rem 1.25rem",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                    background: "var(--action-green)",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    boxShadow: "0 4px 12px rgba(14, 122, 52, 0.2)",
                    cursor:
                      submittingExpense || workflowEstablishments.length === 0
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      submittingExpense || workflowEstablishments.length === 0 ? 0.6 : 1,
                  }}
                >
                  <span>
                    {submittingExpense
                      ? expenseDraftId
                        ? "Retrying..."
                        : "Submitting..."
                      : expenseDraftId
                        ? "Retry review"
                        : "Review"}
                  </span>
                  {!submittingExpense && <IconChevronRight width={15} height={15} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExpenseConfirmation && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1100,
          }}
        >
          <div
            className="card"
            style={{
              width: "min(440px, calc(100vw - 2rem))",
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
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 750 }}>
                  Confirm expenditure
                </h3>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Enter the amount exactly as shown to confirm this expenditure.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExpenseConfirmation}
                disabled={submittingExpense}
                aria-label="Close expenditure confirmation"
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.5rem 1rem",
                margin: "1.25rem 0",
                padding: "0.85rem",
                borderRadius: "6px",
                background: "var(--bg-subtle)",
                fontSize: "0.82rem",
              }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Expenditure amount</span>
              <strong style={{ textAlign: "right" }}>{expenseForm.amount}</strong>
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Establishment</span>
              <span style={{ textAlign: "right" }}>{selectedExpenseEstablishment?.name ?? "—"}</span>
            </div>

            <form onSubmit={handleExpenseConfirmation} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <label htmlFor="expense-confirmation-amount" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Enter amount to confirm *
              </label>
              <input
                id="expense-confirmation-amount"
                required
                autoFocus
                type="text"
                inputMode="decimal"
                placeholder={expenseForm.amount}
                value={confirmationAmount}
                onChange={(e) => {
                  setConfirmationAmount(e.target.value);
                  if (confirmationError) setConfirmationError("");
                }}
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  borderRadius: "6px",
                  border: confirmationError ? "1px solid #dc2626" : "1px solid var(--color-border-strong)",
                  font: "inherit",
                }}
              />
              {confirmationError && (
                <div role="alert" style={{ color: "#991b1b", fontSize: "0.78rem" }}>
                  {confirmationError}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.45rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeExpenseConfirmation}
                  disabled={submittingExpense}
                  style={{ padding: "0.65rem 0.9rem", cursor: submittingExpense ? "wait" : "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.4rem",
                    padding: "0.65rem 1rem",
                    borderRadius: "6px",
                    background: "linear-gradient(90deg, var(--action-green), var(--action-green-dark))",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    cursor: submittingExpense ? "wait" : "pointer",
                  }}
                >
                  {submittingExpense ? "Submitting..." : expenseDraftId ? "Confirm retry" : "Confirm expenditure"}
                  {!submittingExpense && <IconChevronRight width={15} height={15} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "450px",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <h3 style={{ margin: "0 0 0.75rem 0", color: "#991b1b" }}>Reject Expenditure</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
              Provide the specific non-compliance, documentary omission, or discrepancy rationale. This note will be recorded in the official audit register.
            </p>
            <form onSubmit={handleRejectExpense}>
              <textarea
                required
                rows={3}
                placeholder="State rejection justification..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
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
                  onClick={() => setShowRejectModal(null)}
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
                  type="submit"
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.4rem 1rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
)}

      {/* MODAL: TRIGGER FIELD INSPECTION */}
      {showInspectModal && (
        <ScheduleInspectionModal
          flag={showInspectModal}
          projectName={projectMap.get(showInspectModal.projectId)?.name ?? showInspectModal.projectId.slice(0, 8)}
          onConfirm={() => handleTriggerInspection(showInspectModal.id)}
          onClose={() => setShowInspectModal(null)}
        />
      )}

      {/* MODAL: FLAG ACTIONS (REVIEW / RESOLVE / DISMISS) */}
      {showFlagActionModal && (
        <FlagActionModal
          action={showFlagActionModal.action}
          note={flagNote}
          onNoteChange={setFlagNote}
          onSubmit={handleFlagAction}
          onClose={() => setShowFlagActionModal(null)}
        />
      )}

      {/* MODAL: ROW DETAIL (ALLOCATION / EXPENSE / FLAG) */}
      {detailAllocation && (
        <AllocationDetailModal
          allocation={detailAllocation}
          projectName={projectMap.get(detailAllocation.projectId)?.name ?? detailAllocation.projectId.slice(0, 8)}
          onClose={() => setDetail(null)}
        />
      )}

      {detail && detailFlag && (
        <FlagDetailModal
          flag={detailFlag}
          projectName={projectMap.get(detailFlag.projectId)?.name ?? detailFlag.projectId.slice(0, 8)}
          projectCode={projectMap.get(detailFlag.projectId)?.code ?? detailFlag.projectId.slice(0, 8)}
          canInspect={canInspect}
          onClose={() => setDetail(null)}
          onReview={() => {
            setDetail(null);
            setShowFlagActionModal({ flag: detailFlag, action: "review" });
          }}
          onInspect={() => {
            setDetail(null);
            setShowInspectModal(detailFlag);
          }}
          onDismiss={() => {
            setDetail(null);
            setShowFlagActionModal({ flag: detailFlag, action: "dismiss" });
          }}
          onResolve={() => {
            setDetail(null);
            setShowFlagActionModal({ flag: detailFlag, action: "resolve" });
          }}
        />
      )}
      {detailExpense && (
        <ExpenseDetailModal
          expense={detailExpense}
          allocation={detailExpenseAllocation}
          project={detailExpenseProject}
          canVerify={canVerify}
          onClose={() => setDetail(null)}
          onReject={(id) => {
            setDetail(null);
            setShowRejectModal(id);
          }}
          onVerify={(id) => {
            setDetail(null);
            handleVerifyExpense(id);
          }}
        />
      )}
    </div>
  );
}
