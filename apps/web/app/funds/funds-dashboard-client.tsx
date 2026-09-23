"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type {
  FundAllocation,
  Expense,
  InspectionFlag,
  FinancialRiskRule,
} from "@netram/types";
import {
  IconShieldCheck,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconSearch,
} from "../components/icons";

interface ProjectOption {
  id: string;
  name: string;
  code: string;
  districtId: string | null;
}

interface FundsDashboardClientProps {
  initialAllocations: FundAllocation[];
  initialExpenses: Expense[];
  initialFlags: InspectionFlag[];
  initialRules: FinancialRiskRule[];
  projects: ProjectOption[];
  permissions: string[];
}

function formatCurrency(val: string | number | null | undefined): string {
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

function formatDate(iso: string | null | undefined): string {
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

export function FundsDashboardClient({
  initialAllocations,
  initialExpenses,
  initialFlags,
  initialRules,
  projects,
  permissions,
}: FundsDashboardClientProps) {
  const [allocations, setAllocations] = useState<FundAllocation[]>(initialAllocations);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [flags, setFlags] = useState<InspectionFlag[]>(initialFlags);
  const [rules] = useState<FinancialRiskRule[]>(initialRules);

  const [activeTab, setActiveTab] = useState<
    "allocations" | "expenses" | "queue" | "flags" | "rules"
  >("allocations");

  // Permissions
  const canAllocate = permissions.includes("fund:allocate") || permissions.includes("*");
  const canRelease = permissions.includes("fund:release") || permissions.includes("*");
  const canVerify = permissions.includes("expense:verify") || permissions.includes("*");
  const canVoid = permissions.includes("expense:void") || permissions.includes("*");
  const canInspect = permissions.includes("inspection:create") || permissions.includes("*");
  const canConfigure = permissions.includes("financial_risk:configure") || permissions.includes("*");
  const canSubmitExpense = permissions.includes("expense:submit") || permissions.includes("*");

  // Filters
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Modals
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState<string | null>(null); // allocationId
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    projectId: projects[0]?.id ?? "",
    category: "Materials & Supplies",
    description: "",
    amount: "",
    vendorName: "",
    vendorGstin: "",
    invoiceNumber: "",
    transactionDate: new Date().toISOString().split("T")[0],
    allocationId: "",
  });
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null); // expenseId
  const [rejectReason, setRejectReason] = useState("");
  const [showVoidModal, setShowVoidModal] = useState<string | null>(null); // expenseId
  const [voidReason, setVoidReason] = useState("");
  const [showInspectModal, setShowInspectModal] = useState<InspectionFlag | null>(null);
  const [showFlagActionModal, setShowFlagActionModal] = useState<{
    flag: InspectionFlag;
    action: "review" | "resolve" | "dismiss";
  } | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [evaluatingProjectId, setEvaluatingProjectId] = useState<string>(projects[0]?.id ?? "");
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<string | null>(null);

  // Forms
  const [allocationForm, setAllocationForm] = useState({
    projectId: projects[0]?.id ?? "",
    fiscalYear: "2024-2025",
    description: "National Infrastructure Grant - Phase 1",
    allocatedAmount: "",
    notes: "",
  });

  const [releaseForm, setReleaseForm] = useState({
    releasedAmount: "",
    referenceNumber: "",
    releaseDate: new Date().toISOString().split("T")[0],
    remarks: "PFMS Central Treasury Disbursal",
  });

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectOption>();
    for (const p of projects) {
      map.set(p.id, p);
    }
    return map;
  }, [projects]);

  // Totals calculations
  const totals = useMemo(() => {
    let allocated = 0;
    let expended = 0;
    let verified = 0;

    for (const a of allocations) {
      allocated += parseFloat(a.allocatedAmount) || 0;
    }

    for (const e of expenses) {
      if (e.status !== "voided" && e.status !== "rejected") {
        expended += parseFloat(e.amount) || 0;
      }
      if (e.status === "verified") {
        expended += parseFloat(e.amount) || 0;
        verified += parseFloat(e.amount) || 0;
      }
    }

    const openFlags = flags.filter((f) => f.status === "open" || f.status === "under_review");
    const highRiskFlags = openFlags.filter((f) => f.riskLevel === "high" || f.riskLevel === "critical").length;
    const medRiskFlags = openFlags.filter((f) => f.riskLevel === "medium").length;
    const lowRiskFlags = openFlags.filter((f) => f.riskLevel === "low").length;

    const utilizationRate = allocated > 0 ? ((expended / allocated) * 100).toFixed(1) : "0.0";

    return {
      allocated,
      expended,
      verified,
      openFlagsCount: openFlags.length,
      highRiskFlags,
      medRiskFlags,
      lowRiskFlags,
      utilizationRate,
    };
  }, [allocations, expenses, flags]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (projectFilter !== "ALL" && e.projectId !== projectFilter) return false;
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
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
    });
  }, [expenses, projectFilter, statusFilter, categoryFilter, search, projectMap]);

  // Verification queue
  const verificationQueue = useMemo(() => {
    return expenses.filter((e) => e.status === "submitted" || e.status === "under_review");
  }, [expenses]);

  // Filtered allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (projectFilter !== "ALL" && a.projectId !== projectFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const p = projectMap.get(a.projectId);
        const matchProj = p?.name.toLowerCase().includes(q) || p?.code.toLowerCase().includes(q);
        const matchDesc = (a.description ?? "").toLowerCase().includes(q);
        const matchNotes = (a.notes ?? "").toLowerCase().includes(q);
        if (!matchProj && !matchDesc && !matchNotes) return false;
      }
      return true;
    });
  }, [allocations, projectFilter, search, projectMap]);

  // Handlers
  async function handleCreateAllocation(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/funds/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: allocationForm.projectId,
          fiscalYear: allocationForm.fiscalYear,
          allocatedAmount: allocationForm.allocatedAmount,
          description: allocationForm.description,
          notes: allocationForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to create allocation");
      }
      const created = await res.json();
      setAllocations((prev) => [created, ...prev]);
      setShowAllocationModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleCreateRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!showReleaseModal) return;
    try {
      const res = await fetch("/api/v1/funds/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocationId: showReleaseModal,
          releasedAmount: releaseForm.releasedAmount,
          releaseDate: new Date(releaseForm.releaseDate || Date.now()).toISOString(),
          referenceNumber: releaseForm.referenceNumber,
          remarks: releaseForm.remarks || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to disburse funds");
      }
      alert("Fund installment successfully disbursed!");
      setShowReleaseModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseForm.projectId || !expenseForm.description || !expenseForm.amount) return;
    setSubmittingExpense(true);
    try {
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
          transactionDate: expenseForm.transactionDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to submit expense");
      }
      const created = await res.json();
      setExpenses((prev) => [created, ...prev]);
      setShowExpenseModal(false);
      setExpenseForm({
        projectId: projects[0]?.id ?? "",
        category: "Materials & Supplies",
        description: "",
        amount: "",
        vendorName: "",
        vendorGstin: "",
        invoiceNumber: "",
        transactionDate: new Date().toISOString().split("T")[0],
        allocationId: "",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSubmittingExpense(false);
    }
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

  async function handleVoidExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!showVoidModal || !voidReason.trim()) return;
    try {
      const res = await fetch(`/api/v1/funds/expenses/${showVoidModal}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voidReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Voiding failed");
      }
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === showVoidModal ? updated : e)));
      setShowVoidModal(null);
      setVoidReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleEvaluateRisk() {
    if (!evaluatingProjectId) return;
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await fetch(`/api/v1/financial-risk/evaluate/${evaluatingProjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Evaluation failed");
      }
      const data = await res.json();
      setEvalResult(
        data.flag
          ? `Advisory Flag Generated: Composite Score ${data.scoreOutput?.totalScore}/100 (${data.scoreOutput?.riskLevel?.toUpperCase()}) with ${data.scoreOutput?.triggeredRules?.length} discrepancy indicators.`
          : `Evaluation Complete: Score ${data.scoreOutput?.totalScore}/100 (${data.scoreOutput?.riskLevel}). No critical discrepancy threshold breached.`,
      );
      // Refresh flags
      const flagsRes = await fetch("/api/v1/inspection-flags");
      if (flagsRes.ok) {
        const updatedFlags = await flagsRes.json();
        setFlags(updatedFlags.items ?? updatedFlags);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEvalResult(`Error: ${msg}`);
    } finally {
      setEvaluating(false);
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
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "var(--color-navy-dark)" }}>
            Fund Utilization & Transparency
          </h1>
          <p className="muted" style={{ margin: "0.25rem 0 0 0", fontSize: "0.9rem" }}>
            Public finance tracking, expenditure verification, and AI-assisted risk discrepancy engine.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowEvaluateModal(true)}
            className="btn"
            style={{
              background: "var(--bg-surface)",
              color: "var(--color-navy-brand)",
              border: "1px solid var(--color-border-strong)",
              padding: "0.5rem 0.85rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              borderRadius: "4px",
            }}
          >
            <IconAlertTriangle width={15} height={15} style={{ color: "#d97706" }} />
            <span>Run Risk Engine</span>
          </button>

          {canSubmitExpense && (
            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
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
              title="Report Actual Expenditure (Implementing Institution / Agency)"
            >
              <span>+ Report Expenditure</span>
              <span style={{ fontSize: "0.7rem", opacity: 0.85, background: "rgba(0,0,0,0.2)", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>
                Agency
              </span>
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
              title="Sanction / Approve Fund (Competent Department / Authority)"
            >
              <span>+ Sanction Allocation</span>
              <span style={{ fontSize: "0.7rem", opacity: 0.85, background: "rgba(255,255,255,0.2)", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>
                Authority
              </span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-subtle)" }}>
            Total Sanctioned
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.25rem", color: "var(--color-navy-dark)" }}>
            {formatCurrency(totals.allocated)}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {allocations.length} total scheme allocations
          </div>
        </div>

        <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-subtle)" }}>
            Expenditure Submitted
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.25rem", color: "var(--color-navy-dark)" }}>
            {formatCurrency(totals.expended)}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Overall Utilization: <strong>{totals.utilizationRate}%</strong> of sanctioned
          </div>
        </div>

        <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #059669" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-subtle)" }}>
            Expenditure Verified
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.25rem", color: "#059669" }}>
            {formatCurrency(totals.verified)}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Official documentary sign-off
          </div>
        </div>

        <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #ef4444" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-subtle)" }}>
            Advisory Risk Flags
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, marginTop: "0.25rem", color: totals.highRiskFlags > 0 ? "#b91c1c" : "var(--color-navy-dark)" }}>
            {totals.openFlagsCount}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            <span style={{ color: "#dc2626", fontWeight: 600 }}>{totals.highRiskFlags} High</span> •{" "}
            <span style={{ color: "#d97706", fontWeight: 600 }}>{totals.medRiskFlags} Med</span> •{" "}
            <span style={{ color: "#2563eb" }}>{totals.lowRiskFlags} Low</span>
          </div>
        </div>
      </div>

      {/* GOVERNANCE & STATUTORY ROLES MATRIX (GFR COMPLIANT) */}
      <div
        className="card"
        style={{
          padding: "1.25rem 1.5rem",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "8px",
          marginTop: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--color-navy-dark)" }}>
              Fund Utilization Governance & Separation of Duties Matrix
            </h3>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Statutory oversight mapping adhering to General Financial Rules (GFR) and anti-conflict maker-checker protocols.
            </p>
          </div>
          <span className="badge badge-routine" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
            GFR Compliant • Anti-Conflict Maker-Checker Enforced
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Tile 1: Sanction/Approve Fund */}
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#ffffff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              borderTop: "3px solid #2563eb",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#2563eb" }}>
                Activity 1
              </span>
              <span className="badge" style={{ fontSize: "0.68rem", background: "#dbeafe", color: "#1e40af" }}>
                fund:allocate
              </span>
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--color-navy-dark)" }}>
              Sanction / Approve Fund
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", marginTop: "0.35rem" }}>
              Competent Department / Authority
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Issues Administrative Approval & Financial Sanction Orders; sets statutory project ceilings.
            </div>
          </div>

          {/* Tile 2: Allocate/Release Fund */}
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#ffffff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              borderTop: "3px solid #0891b2",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#0891b2" }}>
                Activity 2
              </span>
              <span className="badge" style={{ fontSize: "0.68rem", background: "#cffafe", color: "#155e75" }}>
                fund:release
              </span>
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--color-navy-dark)" }}>
              Allocate / Release Fund
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", marginTop: "0.35rem" }}>
              Authorized Programme / Dept Officer
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Releases tranches via PFMS / Treasury against milestones; releases cannot exceed sanction.
            </div>
          </div>

          {/* Tile 3: Report Actual Expenditure */}
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#ffffff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              borderTop: "3px solid #d97706",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#d97706" }}>
                Activity 3
              </span>
              <span className="badge" style={{ fontSize: "0.68rem", background: "#fef3c7", color: "#92400e" }}>
                expense:submit
              </span>
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--color-navy-dark)" }}>
              Report Actual Expenditure
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", marginTop: "0.35rem" }}>
              Institution / Implementing Agency
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Uploads GST invoices, vouchers, payment UTRs, and evidence; cannot approve or verify own claims.
            </div>
          </div>

          {/* Tile 4: Verify Expenditure */}
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#ffffff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              borderTop: "3px solid #059669",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#059669" }}>
                Activity 4
              </span>
              <span className="badge" style={{ fontSize: "0.68rem", background: "#dcfce7", color: "#166534" }}>
                expense:verify
              </span>
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--color-navy-dark)" }}>
              Verify Expenditure
            </div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b", marginTop: "0.35rem" }}>
              Authorized Officer / Auditor
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Reviews documentary & physical audit evidence. Verified records are immutable. No self-verification.
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border-subtle)",
          gap: "0.5rem",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          className={`filter-tab-btn ${activeTab === "allocations" ? "active" : ""}`}
          onClick={() => setActiveTab("allocations")}
          style={{ padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer", background: "none" }}
        >
          <span>Allocations & Releases</span>
          <span className="filter-count-badge" style={{ marginLeft: "0.4rem" }}>{allocations.length}</span>
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeTab === "expenses" ? "active" : ""}`}
          onClick={() => setActiveTab("expenses")}
          style={{ padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer", background: "none" }}
        >
          <span>All Expenditures</span>
          <span className="filter-count-badge" style={{ marginLeft: "0.4rem" }}>{expenses.length}</span>
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
          style={{ padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer", background: "none" }}
        >
          <span>Verification Queue</span>
          {verificationQueue.length > 0 && (
            <span className="stat-chip warn" style={{ marginLeft: "0.4rem", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}>
              {verificationQueue.length} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeTab === "flags" ? "active" : ""}`}
          onClick={() => setActiveTab("flags")}
          style={{ padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer", background: "none" }}
        >
          <span>Financial Risk Flags</span>
          {totals.openFlagsCount > 0 && (
            <span className="stat-chip warn" style={{ marginLeft: "0.4rem", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}>
              {totals.openFlagsCount} Active
            </span>
          )}
        </button>

        <button
          type="button"
          className={`filter-tab-btn ${activeTab === "rules" ? "active" : ""}`}
          onClick={() => setActiveTab("rules")}
          style={{ padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer", background: "none" }}
        >
          <span>Risk Engine Rules</span>
          <span className="filter-count-badge" style={{ marginLeft: "0.4rem" }}>{rules.length}</span>
        </button>
      </div>

      {/* Global Filter Bar for Lists */}
      {activeTab !== "rules" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            padding: "0.75rem 1rem",
            background: "var(--bg-surface)",
            borderRadius: "6px",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: "200px" }}>
            <IconSearch width={16} height={16} style={{ color: "var(--text-subtle)" }} />
            <input
              type="text"
              placeholder="Search by facility, scheme, description, or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "0.85rem",
                background: "transparent",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Facility:</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{
                padding: "0.35rem 0.6rem",
                fontSize: "0.8rem",
                borderRadius: "4px",
                border: "1px solid var(--color-border-strong)",
              }}
            >
              <option value="ALL">All Facilities ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {activeTab === "expenses" && (
            <>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "0.35rem 0.6rem",
                    fontSize: "0.8rem",
                    borderRadius: "4px",
                    border: "1px solid var(--color-border-strong)",
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="voided">Voided</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Category:</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    padding: "0.35rem 0.6rem",
                    fontSize: "0.8rem",
                    borderRadius: "4px",
                    border: "1px solid var(--color-border-strong)",
                  }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="Materials & Supplies">Materials & Supplies</option>
                  <option value="Labor & Personnel">Labor & Personnel</option>
                  <option value="Equipment & Rental">Equipment & Rental</option>
                  <option value="Utilities & Operational">Utilities & Operational</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 1: ALLOCATIONS & RELEASES */}
      {activeTab === "allocations" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Facility / Project</th>
                <th>Description</th>
                <th>FY</th>
                <th style={{ textAlign: "right" }}>Sanctioned Amount</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th>Created</th>
                <th style={{ textAlign: "right", width: "130px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                    No fund allocations found matching filters.
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((a) => {
                  const p = projectMap.get(a.projectId);

                  return (
                    <tr key={a.id}>
                      <td>
                        <Link
                          href={`/projects/${a.projectId}/funds`}
                          style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                        >
                          {p?.name ?? a.projectId.slice(0, 8)}
                        </Link>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                          {p?.code ?? "—"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.description ?? "Government Scheme Allocation"}</div>
                        {a.notes && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{a.notes}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: "0.75rem" }}>
                          {a.fiscalYear}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-navy-dark)" }}>
                        {formatCurrency(a.allocatedAmount)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${
                            a.status === "active" ? "badge-routine" : "badge-surprise"
                          }`}
                        >
                          {a.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {formatDate(a.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {canRelease && a.status === "active" && (
                          <button
                            type="button"
                            onClick={() => setShowReleaseModal(a.id)}
                            style={{
                              background: "var(--bg-subtle)",
                              border: "1px solid var(--color-border-strong)",
                              borderRadius: "4px",
                              padding: "0.3rem 0.55rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              color: "var(--color-navy-brand)",
                            }}
                          >
                            + Disburse
                          </button>
                        )}
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
      {activeTab === "expenses" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor / GSTIN</th>
                <th>Invoice & Date</th>
                <th style={{ textAlign: "right" }}>Claimed Amount</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "right", width: "160px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                    No expenditures found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => {
                  const p = projectMap.get(e.projectId);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link
                          href={`/projects/${e.projectId}/funds`}
                          style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                        >
                          {p?.name ?? e.projectId.slice(0, 8)}
                        </Link>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                          {p?.code ?? "—"}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: "0.75rem" }}>
                          {e.category}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, maxWidth: "250px" }}>{e.description}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{e.vendorName}</div>
                        {e.vendorGstin && (
                          <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            GST: {e.vendorGstin}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                          Inv: {e.invoiceNumber ?? "—"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {formatDate(e.transactionDate)}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-navy-dark)" }}>
                        {formatCurrency(e.amount)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`badge ${
                            e.status === "verified"
                              ? "badge-routine"
                              : e.status === "rejected" || e.status === "voided"
                                ? "badge-surprise"
                                : "warn"
                          }`}
                          style={{
                            background:
                              e.status === "verified"
                                ? "#dcfce7"
                                : e.status === "rejected"
                                  ? "#fee2e2"
                                  : e.status === "voided"
                                    ? "#f1f5f9"
                                    : "#fef3c7",
                            color:
                              e.status === "verified"
                                ? "#166534"
                                : e.status === "rejected"
                                  ? "#991b1b"
                                  : e.status === "voided"
                                    ? "#475569"
                                    : "#92400e",
                          }}
                        >
                          {e.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                          {canVerify && (e.status === "submitted" || e.status === "under_review") && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleVerifyExpense(e.id)}
                                title="Verify Expenditure"
                                style={{
                                  background: "#dcfce7",
                                  border: "1px solid #86efac",
                                  color: "#166534",
                                  borderRadius: "4px",
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectModal(e.id)}
                                title="Reject Expenditure"
                                style={{
                                  background: "#fee2e2",
                                  border: "1px solid #fca5a5",
                                  color: "#991b1b",
                                  borderRadius: "4px",
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canVoid && (e.status === "verified" || e.status === "submitted") && (
                            <button
                              type="button"
                              onClick={() => setShowVoidModal(e.id)}
                              title="Void Record (Audit Traceable)"
                              style={{
                                background: "var(--bg-subtle)",
                                border: "1px solid var(--color-border-strong)",
                                color: "var(--text-muted)",
                                borderRadius: "4px",
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Void
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
        </div>
      )}

      {/* TAB 3: VERIFICATION QUEUE */}
      {activeTab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <IconShieldCheck width={20} height={20} style={{ color: "#2563eb" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e40af" }}>
                Documentary Verification Workstation
              </div>
              <div style={{ fontSize: "0.8rem", color: "#1e3a8a" }}>
                Expenditures require cross-referencing against submitted invoices, geo-tagged delivery receipts, and vendor GSTIN registration before final public account credit.
              </div>
            </div>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor & GSTIN</th>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right", width: "160px" }}>Verification Action</th>
                </tr>
              </thead>
              <tbody>
                {verificationQueue.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                      <IconCheck width={32} height={32} style={{ color: "#10b981", margin: "0 auto 0.5rem" }} />
                      <div>All submitted claims are verified. No pending items in queue.</div>
                    </td>
                  </tr>
                ) : (
                  verificationQueue.map((e) => {
                    const p = projectMap.get(e.projectId);
                    return (
                      <tr key={e.id}>
                        <td>
                          <Link
                            href={`/projects/${e.projectId}/funds`}
                            style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                          >
                            {p?.name ?? e.projectId.slice(0, 8)}
                          </Link>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                            {p?.code ?? "—"}
                          </div>
                        </td>
                        <td>
                          <span className="badge">{e.category}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{e.description}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{e.vendorName}</div>
                          <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                            {e.vendorGstin ? `GST: ${e.vendorGstin}` : "No GST registered"}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                            {e.invoiceNumber ?? "—"}
                          </div>
                        </td>
                        <td style={{ fontSize: "0.8rem" }}>{formatDate(e.transactionDate)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-navy-dark)" }}>
                          {formatCurrency(e.amount)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {canVerify ? (
                            <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => handleVerifyExpense(e.id)}
                                style={{
                                  background: "#dcfce7",
                                  border: "1px solid #86efac",
                                  color: "#166534",
                                  borderRadius: "4px",
                                  padding: "0.3rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Accept & Verify
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectModal(e.id)}
                                style={{
                                  background: "#fee2e2",
                                  border: "1px solid #fca5a5",
                                  color: "#991b1b",
                                  borderRadius: "4px",
                                  padding: "0.3rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Read only</span>
                          )}
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

      {/* TAB 4: FINANCIAL RISK FLAGS & ANOMALY REVIEW */}
      {activeTab === "flags" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Advisory Notice */}
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <IconAlertTriangle width={20} height={20} style={{ color: "#d97706" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#92400e" }}>
                Advisory Discrepancy Board (Non-Punitive Technical Oversight)
              </div>
              <div style={{ fontSize: "0.8rem", color: "#b45309" }}>
                Flags are generated by statistical rules (e.g. Benford's law, velocity spikes, round numbers, duplicate submissions) to direct administrative and field inspection attention. They do not constitute formal accusations of fraud.
              </div>
            </div>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Risk Level</th>
                  <th style={{ textAlign: "center" }}>Score</th>
                  <th>Summary / Trigger Signals</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right", width: "220px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                      No active financial risk flags recorded.
                    </td>
                  </tr>
                ) : (
                  flags.map((f) => {
                    const p = projectMap.get(f.projectId);
                    const indicatorsCount = Array.isArray(f.evidenceRefs) ? f.evidenceRefs.length : 0;
                    return (
                      <tr key={f.id}>
                        <td>
                          <Link
                            href={`/projects/${f.projectId}/funds`}
                            style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}
                          >
                            {p?.name ?? f.projectId.slice(0, 8)}
                          </Link>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                            {p?.code ?? "—"}
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
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
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                            {f.riskScore}/100
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{f.explanation}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                            {indicatorsCount} supporting evidence references
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge" style={{ fontSize: "0.75rem" }}>
                            {f.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                          {f.linkedInspectionId && (
                            <div style={{ fontSize: "0.7rem", marginTop: "0.2rem", color: "#2563eb" }}>
                              <Link href={`/inspections/${f.linkedInspectionId}`}>
                                Inspection #{f.linkedInspectionId.slice(0, 8)}
                              </Link>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {formatDate(f.createdAt)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {canInspect &&
                              !f.linkedInspectionId &&
                              f.status !== "resolved" &&
                              f.status !== "dismissed" && (
                                <button
                                  type="button"
                                  onClick={() => setShowInspectModal(f)}
                                  style={{
                                    background: "var(--color-navy-brand)",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Trigger Inspection
                                </button>
                              )}

                            {f.status === "open" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowFlagActionModal({ flag: f, action: "review" })
                                }
                                style={{
                                  background: "var(--bg-subtle)",
                                  border: "1px solid var(--color-border-strong)",
                                  borderRadius: "4px",
                                  padding: "0.25rem 0.5rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Review
                              </button>
                            )}

                            {f.status !== "resolved" && f.status !== "dismissed" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowFlagActionModal({ flag: f, action: "resolve" })
                                  }
                                  style={{
                                    background: "#dcfce7",
                                    border: "1px solid #86efac",
                                    color: "#166534",
                                    borderRadius: "4px",
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Resolve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowFlagActionModal({ flag: f, action: "dismiss" })
                                  }
                                  style={{
                                    background: "#fee2e2",
                                    border: "1px solid #fca5a5",
                                    color: "#991b1b",
                                    borderRadius: "4px",
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Dismiss
                                </button>
                              </>
                            )}
                          </div>
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

      {/* TAB 5: RISK RULES CONFIGURATOR */}
      {activeTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "var(--bg-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--color-navy-dark)" }}>
                Financial Discrepancy Detection Engine Rules (13 Rule Pipeline)
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Rules evaluate expenditure history, invoice metadata, supporting documents, and vendor profiles.
              </div>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{rules.filter((r) => r.enabled).length} / {rules.length} Rules Active</span>
              {canConfigure && (
                <span className="badge" style={{ background: "#dbeafe", color: "#1e40af", fontSize: "0.7rem" }}>
                  Configurable
                </span>
              )}
            </div>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Code</th>
                  <th>Rule Name</th>
                  <th>Description</th>
                  <th style={{ width: "100px", textAlign: "center" }}>Severity</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Weight</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          background: "var(--bg-subtle)",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "3px",
                        }}
                      >
                        {r.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.name}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.description}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="badge"
                        style={{
                          background:
                            r.severity === "critical" || r.severity === "high"
                              ? "#fee2e2"
                              : r.severity === "medium"
                                ? "#fef3c7"
                                : "#e0f2fe",
                          color:
                            r.severity === "critical" || r.severity === "high"
                              ? "#991b1b"
                              : r.severity === "medium"
                                ? "#92400e"
                                : "#0369a1",
                          fontSize: "0.7rem",
                        }}
                      >
                        {r.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                      {r.weight}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`badge ${r.enabled ? "badge-routine" : ""}`}
                        style={{ fontSize: "0.7rem" }}
                      >
                        {r.enabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </td>
                  </tr>
                ))}
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
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "550px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                Sanction New Scheme Allocation
              </h2>
              <button
                type="button"
                onClick={() => setShowAllocationModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <IconX width={20} height={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAllocation} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Beneficiary Facility / Project *
                </label>
                <select
                  required
                  value={allocationForm.projectId}
                  onChange={(e) => setAllocationForm({ ...allocationForm, projectId: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Fiscal Year *
                  </label>
                  <input
                    required
                    type="text"
                    value={allocationForm.fiscalYear}
                    onChange={(e) => setAllocationForm({ ...allocationForm, fiscalYear: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Sanctioned Amount (₹) *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 5000000.00"
                    value={allocationForm.allocatedAmount}
                    onChange={(e) => setAllocationForm({ ...allocationForm, allocatedAmount: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Scheme Description / Sanction Details *
                </label>
                <input
                  required
                  type="text"
                  value={allocationForm.description}
                  onChange={(e) => setAllocationForm({ ...allocationForm, description: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Administrative Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={allocationForm.notes}
                  onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAllocationModal(false)}
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
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
                    padding: "0.5rem 1.25rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISBURSE / RELEASE FUNDS */}
      {showReleaseModal && (
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
              width: "480px",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                Disburse Fund Installment
              </h2>
              <button
                type="button"
                onClick={() => setShowReleaseModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <IconX width={20} height={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRelease} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Disbursement Amount (₹) *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 1500000.00"
                  value={releaseForm.releasedAmount}
                  onChange={(e) => setReleaseForm({ ...releaseForm, releasedAmount: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Treasury / PFMS Reference Number *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. REL-TR-2024-001"
                  value={releaseForm.referenceNumber}
                  onChange={(e) => setReleaseForm({ ...releaseForm, referenceNumber: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Release Date *
                </label>
                <input
                  required
                  type="date"
                  value={releaseForm.releaseDate}
                  onChange={(e) => setReleaseForm({ ...releaseForm, releaseDate: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={releaseForm.remarks}
                  onChange={(e) => setReleaseForm({ ...releaseForm, remarks: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowReleaseModal(null)}
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Authorize Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPORT EXPENDITURE (INSTITUTION / AGENCY) */}
      {showExpenseModal && (
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
              width: "550px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Report Actual Expenditure
                </h2>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Action restricted to Implementing Institution / Agency (`expense:submit`)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <IconX width={20} height={20} />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Beneficiary Project / Facility *
                </label>
                <select
                  required
                  value={expenseForm.projectId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Expenditure Category *
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
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
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Claimed Amount (₹) *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 75000.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Description / Purpose of Expenditure *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Purchase of 50 student study desks and benches"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Vendor / Payee Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. SteelCraft Furnishings Ltd"
                    value={expenseForm.vendorName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Vendor GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 21AAAAA0000A1Z5"
                    value={expenseForm.vendorGstin}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorGstin: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Invoice / Voucher Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2024-883"
                    value={expenseForm.invoiceNumber}
                    onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                    Transaction Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={expenseForm.transactionDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, transactionDate: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--color-border-strong)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 1rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  style={{
                    background: "#d97706",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {submittingExpense ? "Submitting..." : "Submit Expenditure Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT EXPENSE */}
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
            <h3 style={{ margin: "0 0 0.75rem 0", color: "#991b1b" }}>Reject Expenditure Claim</h3>
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

      {/* MODAL: VOID EXPENSE */}
      {showVoidModal && (
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
            <h3 style={{ margin: "0 0 0.75rem 0", color: "#475569" }}>Void Expenditure Record</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
              Voiding deactivates this transaction while preserving full audit traceability. Enter reason for cancellation:
            </p>
            <form onSubmit={handleVoidExpense}>
              <textarea
                required
                rows={3}
                placeholder="Reason for voiding..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
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
                  onClick={() => setShowVoidModal(null)}
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
                    background: "#475569",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.4rem 1rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Void Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRIGGER SPECIAL INSPECTION FROM FLAG */}
      {showInspectModal && (
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
              width: "480px",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--color-navy-dark)" }}>
              Escalate to Special Field Inspection
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
              This will create a new special field inspection with trigger{" "}
              <strong>risk_engine</strong>, linked to Flag #{showInspectModal.id.slice(0, 8)}.
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
                <strong>Facility:</strong> {projectMap.get(showInspectModal.projectId)?.name}
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                <strong>Risk Level:</strong> {showInspectModal.riskLevel.toUpperCase()} (Score:{" "}
                {showInspectModal.riskScore}/100)
              </div>
              <div style={{ marginTop: "0.25rem", color: "var(--text-muted)" }}>
                {showInspectModal.explanation}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowInspectModal(null)}
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
                onClick={() => handleTriggerInspection(showInspectModal.id)}
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
      )}

      {/* MODAL: FLAG ACTIONS (REVIEW / RESOLVE / DISMISS) */}
      {showFlagActionModal && (
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
              width: "480px",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--color-navy-dark)" }}>
              {showFlagActionModal.action === "review"
                ? "Record Review Notes"
                : showFlagActionModal.action === "resolve"
                  ? "Resolve Financial Discrepancy Flag"
                  : "Dismiss Risk Flag"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
              {showFlagActionModal.action === "dismiss"
                ? "Mandatory audit justification required explaining why this statistical or documentary flag was cleared."
                : "Enter review assessment or resolution rationale for official audit records."}
            </p>
            <form onSubmit={handleFlagAction}>
              <textarea
                required
                rows={3}
                placeholder="Enter justification notes..."
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
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
                  onClick={() => setShowFlagActionModal(null)}
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
                    background:
                      showFlagActionModal.action === "dismiss"
                        ? "#dc2626"
                        : showFlagActionModal.action === "resolve"
                          ? "#10b981"
                          : "var(--color-navy-brand)",
                    color: "#ffffff",
                    border: "none",
                    padding: "0.4rem 1.1rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Confirm Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RUN RISK ENGINE ON DEMAND */}
      {showEvaluateModal && (
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
              width: "480px",
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                Execute Financial Risk Engine
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowEvaluateModal(false);
                  setEvalResult(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <IconX width={20} height={20} />
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
              Runs all 13 statistical discrepancy rules (Benford's law, budget overrun, velocity surges, weekend clustering, duplicate claims, vendor concentration) on the facility.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Select Facility:
              </label>
              <select
                value={evaluatingProjectId}
                onChange={(e) => setEvaluatingProjectId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--color-border-strong)",
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            {evalResult && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  background: evalResult.startsWith("Advisory") ? "#fffbeb" : "#f0fdf4",
                  border: evalResult.startsWith("Advisory") ? "1px solid #fef3c7" : "1px solid #bbf7d0",
                  color: evalResult.startsWith("Advisory") ? "#92400e" : "#166534",
                  marginBottom: "1rem",
                }}
              >
                {evalResult}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  setShowEvaluateModal(false);
                  setEvalResult(null);
                }}
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--color-border-strong)",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={evaluating}
                onClick={handleEvaluateRisk}
                style={{
                  background: "var(--color-navy-brand)",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.4rem 1.1rem",
                  borderRadius: "4px",
                  fontWeight: 600,
                  cursor: evaluating ? "not-allowed" : "pointer",
                }}
              >
                {evaluating ? "Evaluating Rules..." : "Execute Analysis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
