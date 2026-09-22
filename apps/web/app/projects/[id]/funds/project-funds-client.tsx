"use client";

import React, { useState } from "react";
import type { ProjectFundOverview } from "@netram/types";
import { IconShieldCheck } from "../../../components/icons";

interface ProjectFundsClientProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  initialOverview: ProjectFundOverview;
  canSubmitExpense: boolean;
  canVerifyExpense: boolean;
  canEvaluateRisk: boolean;
}

export function ProjectFundsClient({
  projectId,
  projectCode: _projectCode,
  projectName: _projectName,
  initialOverview,
  canSubmitExpense,
  canVerifyExpense,
  canEvaluateRisk,
}: ProjectFundsClientProps) {
  const [overview, setOverview] = useState<ProjectFundOverview>(initialOverview);
  const [evaluating, setEvaluating] = useState(false);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"expenses" | "flags" | "allocations">("expenses");

  // New Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
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

  // Void modal state
  const [voidingExpenseId, setVoidingExpenseId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // Trigger evaluation
  async function handleEvaluateRisk() {
    setEvaluating(true);
    setEvalMessage(null);
    try {
      const res = await fetch(`/api/v1/financial-risk/evaluate/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Evaluation failed");
      }
      const data = await res.json();
      setEvalMessage(
        data.flag
          ? `Review flag updated: Score ${data.scoreOutput?.totalScore} (${data.scoreOutput?.riskLevel?.toUpperCase()})`
          : "Evaluation complete: No risk discrepancies detected.",
      );
      // Refresh overview
      const refreshRes = await fetch(`/api/v1/funds/projects/${projectId}/overview`);
      if (refreshRes.ok) {
        const updated = await refreshRes.json();
        setOverview(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEvalMessage(`Error: ${msg}`);
    } finally {
      setEvaluating(false);
    }
  }

  // Submit new expense
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingExpense(true);
    try {
      const res = await fetch("/api/v1/funds/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
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
      // Refresh overview
      const refreshRes = await fetch(`/api/v1/funds/projects/${projectId}/overview`);
      if (refreshRes.ok) {
        const updated = await refreshRes.json();
        setOverview(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Verify expense
  async function handleVerifyExpense(id: string) {
    if (!confirm("Are you sure you want to verify this expense claim? Verified records become immutable.")) return;
    try {
      const res = await fetch(`/api/v1/funds/expenses/${id}/verify`, { method: "POST" });
      if (!res.ok) throw new Error("Verification failed");
      const refreshRes = await fetch(`/api/v1/funds/projects/${projectId}/overview`);
      if (refreshRes.ok) setOverview(await refreshRes.json());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  // Void expense
  async function handleVoidExpense() {
    if (!voidingExpenseId || !voidReason.trim()) return;
    setVoiding(true);
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
      const refreshRes = await fetch(`/api/v1/funds/projects/${projectId}/overview`);
      if (refreshRes.ok) setOverview(await refreshRes.json());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setVoiding(false);
    }
  }

  const { summary, allocations, releases, recentExpenses, activeFlags } = overview;
  const numAlloc = parseFloat(summary.totalAllocated || "0");
  const numRel = parseFloat(summary.totalReleased || "0");
  const numExp = parseFloat(summary.totalExpenditure || "0");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Metric Cards Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #2563eb" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
            Sanctioned Allocation
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
            ₹{numAlloc.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
            {allocations.length} active allocation{allocations.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #059669" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
            Disbursed / Released
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
            ₹{numRel.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
            {releases.length} disbursal installment{releases.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #d97706" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
            Total Expenditure
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
            ₹{numExp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
            {recentExpenses.length} expense record{recentExpenses.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderLeft: "4px solid #7c3aed" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
            Fund Utilization
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>
            {summary.utilizationRate}%
          </div>
          <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", marginTop: "0.5rem", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, summary.utilizationRate)}%`,
                height: "100%",
                backgroundColor: summary.utilizationRate > 90 ? "#dc2626" : summary.utilizationRate > 70 ? "#d97706" : "#059669",
              }}
            />
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", borderLeft: `4px solid ${activeFlags.length > 0 ? "#dc2626" : "#059669"}` }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", fontWeight: 500 }}>
            Active Review Flags
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: activeFlags.length > 0 ? "#dc2626" : "inherit" }}>
            {activeFlags.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
            {activeFlags.length > 0 ? "Requires inspection follow-up" : "Clean profile"}
          </div>
        </div>
      </div>

      {/* Action Header & Notice */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className={`btn ${activeTab === "expenses" ? "primary" : "outline"}`}
            onClick={() => setActiveTab("expenses")}
          >
            Expenses ({recentExpenses.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "flags" ? "primary" : "outline"}`}
            onClick={() => setActiveTab("flags")}
          >
            Inspection Review Flags ({activeFlags.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === "allocations" ? "primary" : "outline"}`}
            onClick={() => setActiveTab("allocations")}
          >
            Sanction Orders & Disbursals ({allocations.length})
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          {canSubmitExpense && (
            <button
              type="button"
              className="btn primary"
              onClick={() => setShowExpenseModal(true)}
            >
              + Record Expense
            </button>
          )}
          {canEvaluateRisk && (
            <button
              type="button"
              className="btn outline"
              onClick={handleEvaluateRisk}
              disabled={evaluating}
            >
              {evaluating ? "Evaluating..." : "Run Risk Engine"}
            </button>
          )}
        </div>
      </div>

      {evalMessage && (
        <div
          className="card"
          style={{
            padding: "0.875rem 1.25rem",
            backgroundColor: evalMessage.includes("Error") ? "#fef2f2" : "#f0fdf4",
            borderColor: evalMessage.includes("Error") ? "#f87171" : "#86efac",
            fontSize: "0.875rem",
          }}
        >
          {evalMessage}
        </div>
      )}

      {/* Tab: Active Inspection Flags */}
      {activeTab === "flags" && (
        <div className="table-card">
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Active Financial Risk Review Flags</h3>
            <p className="muted" style={{ margin: "0.25rem 0 0 0", fontSize: "0.8125rem" }}>
              Explainable anomalies identified by the 13-rule risk engine for verification and oversight.
            </p>
          </div>
          {activeFlags.length === 0 ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--muted-foreground)" }}>
              <IconShieldCheck width={36} height={36} style={{ color: "#059669", marginBottom: "0.5rem" }} />
              <div>No active inspection review flags for this project.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activeFlags.map((flag) => (
                <div key={flag.id} style={{ padding: "1.25rem", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          className={`badge ${
                            flag.riskLevel === "critical"
                              ? "danger"
                              : flag.riskLevel === "high"
                              ? "danger"
                              : flag.riskLevel === "medium"
                              ? "warn"
                              : "neutral"
                          }`}
                          style={{ textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 700 }}
                        >
                          {flag.riskLevel} (Score {flag.riskScore})
                        </span>
                        <span style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                          Status: <strong>{flag.status.replace(/_/g, " ")}</strong>
                        </span>
                      </div>
                      <pre
                        style={{
                          marginTop: "0.75rem",
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                          fontSize: "0.875rem",
                          lineHeight: 1.5,
                          backgroundColor: "#f8fafc",
                          padding: "0.75rem",
                          borderRadius: "4px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {flag.explanation}
                      </pre>
                      {flag.evidenceRefs.length > 0 && (
                        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {flag.evidenceRefs.map((ref, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 8px",
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                                borderRadius: "4px",
                              }}
                            >
                              {ref.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "160px" }}>
                      <a
                        href={`/funds#flag-${flag.id}`}
                        className="btn outline"
                        style={{ fontSize: "0.8125rem", textAlign: "center" }}
                      >
                        Open Flag Details
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Expenses */}
      {activeTab === "expenses" && (
        <div className="table-card">
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Submitted Expenditure Claims</h3>
              <p className="muted" style={{ margin: "0.25rem 0 0 0", fontSize: "0.8125rem" }}>
                All procurement, works, and operational expenses recorded for this facility.
              </p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor / GSTIN</th>
                <th>Invoice #</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted-foreground)" }}>
                    No expenses submitted yet for this project.
                  </td>
                </tr>
              ) : (
                recentExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.transactionDate).toLocaleDateString("en-IN")}</td>
                    <td>{exp.category}</td>
                    <td>
                      <div>{exp.description}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{exp.vendorName}</div>
                      {exp.vendorGstin && <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{exp.vendorGstin}</div>}
                    </td>
                    <td>{exp.invoiceNumber || "—"}</td>
                    <td style={{ fontWeight: 600 }}>
                      ₹{parseFloat(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          exp.status === "verified"
                            ? "success"
                            : exp.status === "submitted"
                            ? "neutral"
                            : exp.status === "rejected" || exp.status === "voided"
                            ? "danger"
                            : "neutral"
                        }`}
                      >
                        {exp.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {canVerifyExpense && exp.status === "submitted" && (
                          <button
                            type="button"
                            className="btn outline"
                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            onClick={() => handleVerifyExpense(exp.id)}
                          >
                            Verify
                          </button>
                        )}
                        {exp.status !== "voided" && (
                          <button
                            type="button"
                            className="btn outline"
                            style={{ fontSize: "0.75rem", padding: "2px 8px", color: "#dc2626" }}
                            onClick={() => setVoidingExpenseId(exp.id)}
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Allocations & Releases */}
      {activeTab === "allocations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="table-card">
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Sanctioned Budget Allocations</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Fiscal Year</th>
                  <th>Sanctioned Amount (₹)</th>
                  <th>Status</th>
                  <th>Sanction Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>No allocations found.</td>
                  </tr>
                ) : (
                  allocations.map((a) => (
                    <tr key={a.id}>
                      <td>{a.fiscalYear}</td>
                      <td style={{ fontWeight: 600 }}>₹{parseFloat(a.allocatedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`badge ${a.status === "active" ? "success" : "danger"}`}>
                          {a.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{a.sanctionedAt ? new Date(a.sanctionedAt).toLocaleDateString("en-IN") : "—"}</td>
                      <td>{a.description || a.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-card">
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Fund Releases (Disbursals)</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Release Date</th>
                  <th>Reference #</th>
                  <th>Disbursed Amount (₹)</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {releases.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>No fund releases found.</td>
                  </tr>
                ) : (
                  releases.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.releaseDate).toLocaleDateString("en-IN")}</td>
                      <td style={{ fontWeight: 500 }}>{r.referenceNumber}</td>
                      <td style={{ fontWeight: 600 }}>₹{parseFloat(r.releasedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`badge ${r.status === "released" ? "success" : "danger"}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{r.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: "500px", maxWidth: "90%", padding: "1.5rem", backgroundColor: "var(--background)" }}>
            <h3 style={{ marginTop: 0 }}>Record Expenditure Claim</h3>
            <form onSubmit={handleCreateExpense} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Category *</label>
                <select
                  className="input"
                  style={{ width: "100%", marginTop: "0.25rem" }}
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  required
                >
                  <option value="Materials & Supplies">Materials & Supplies</option>
                  <option value="Works & Construction">Works & Construction</option>
                  <option value="Consultancy & Services">Consultancy & Services</option>
                  <option value="Equipment & Machinery">Equipment & Machinery</option>
                  <option value="Staff & Honorarium">Staff & Honorarium</option>
                  <option value="Operational Overheads">Operational Overheads</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Description *</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%", marginTop: "0.25rem" }}
                  placeholder="e.g. Supply of cement bags batch 4"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Amount (₹) *</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: "100%", marginTop: "0.25rem" }}
                    placeholder="25000.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Transaction Date *</label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: "100%", marginTop: "0.25rem" }}
                    value={expenseForm.transactionDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, transactionDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Vendor Name *</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: "100%", marginTop: "0.25rem" }}
                    placeholder="ABC Suppliers Ltd"
                    value={expenseForm.vendorName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Vendor GSTIN</label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: "100%", marginTop: "0.25rem" }}
                    placeholder="22AAAAA0000A1Z5"
                    value={expenseForm.vendorGstin}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vendorGstin: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Invoice Number</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: "100%", marginTop: "0.25rem" }}
                  placeholder="INV-2025-001"
                  value={expenseForm.invoiceNumber}
                  onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setShowExpenseModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={submittingExpense}
                >
                  {submittingExpense ? "Saving..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Reason Modal */}
      {voidingExpenseId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: "450px", maxWidth: "90%", padding: "1.5rem", backgroundColor: "var(--background)" }}>
            <h3 style={{ marginTop: 0, color: "#dc2626" }}>Void Expense Record</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
              Financial records cannot be deleted. Voiding will permanently deactivate this claim while retaining an immutable audit trail.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 500 }}>Justification / Reason *</label>
              <textarea
                className="input"
                style={{ width: "100%", height: "80px", marginTop: "0.25rem" }}
                placeholder="Reason for voiding (required by audit policy)..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                className="btn outline"
                onClick={() => setVoidingExpenseId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={!voidReason.trim() || voiding}
                onClick={handleVoidExpense}
              >
                {voiding ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
