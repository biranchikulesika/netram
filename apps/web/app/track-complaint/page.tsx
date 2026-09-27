"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { PublicComplaintTracking, ComplaintStatus } from "@netram/types";
import { formatDate, formatDateTime } from "../../lib/presentation";

// ADDED: shared color tokens matching the rest of the site
const NAVY = "#1e3a8a";
const SAFFRON = "#e8590c";
const GREEN = "#157a3d";
const GREEN_DARK = "#0f5f2f";

function getStatusBadge(status: ComplaintStatus): { bg: string; color: string; label: string } {
  switch (status) {
    case "received":
      return { bg: "#e0f2fe", color: "#0369a1", label: "RECEIVED" };
    case "under_review":
      return { bg: "#fef3c7", color: "#b45309", label: "UNDER REVIEW" };
    case "escalated":
      return { bg: "#fee2e2", color: "#dc2626", label: "ESCALATED TO STATE" };
    case "resolved":
      return { bg: "#dcfce7", color: "#15803d", label: "RESOLVED" };
    case "closed":
      return { bg: "#f1f5f9", color: "#475569", label: "CLOSED WITHOUT ACTION" };
    default:
      return { bg: "#f1f5f9", color: "#334155", label: String(status).toUpperCase() };
  }
}

const LIFECYCLE_STEPS = [
  { id: 0, title: "1. Registered", desc: "Grievance logged in public ledger" },
  { id: 1, title: "2. Jurisdiction Review", desc: "District authority examination" },
  { id: 2, title: "3. Field Inquiry", desc: "Inspection or state escalation" },
  { id: 3, title: "4. Redressal & Closure", desc: "Official statutory determination" },
];

function getStepRank(status: ComplaintStatus): number {
  switch (status) {
    case "received":
      return 0;
    case "under_review":
      return 1;
    case "escalated":
      return 2;
    case "resolved":
    case "closed":
      return 3;
    default:
      return 0;
  }
}

function TrackComplaintContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [result, setResult] = useState<PublicComplaintTracking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async (codeToSearch: string) => {
    const cleanCode = codeToSearch.trim();
    if (!cleanCode) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/complaints/track/${encodeURIComponent(cleanCode)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`No grievance record found with tracking code "${cleanCode}". Please verify the code.`);
        }
        throw new Error(`Tracking lookup service unavailable (status ${res.status}).`);
      }

      const data = (await res.json()) as PublicComplaintTracking;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retrieve status");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      void fetchStatus(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchStatus(trackingCode);
  };

  const handleCopyCode = () => {
    if (!result?.trackingCode) return;
    void navigator.clipboard.writeText(result.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentRank = result ? getStepRank(result.status) : -1;

  return (
    <div style={{ maxWidth: "780px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* ADDED: global box-sizing fix so inputs don't overflow their container */}
      <style>{`
        input, select, textarea {
          box-sizing: border-box;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-receipt-card {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            padding: 2rem !important;
          }
        }
      `}</style>

      {/* ADDED: institutional tricolor strip — no-print so it never shows on the printed receipt */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "4px",
          background:
            "linear-gradient(to right, #ff9933 0%, #ff9933 33.33%, #ffffff 33.33%, #ffffff 66.66%, #138808 66.66%, #138808 100%)",
          zIndex: 50,
        }}
      />

      {/* Top Brand Banner — CHANGED: logo replaces written affiliation text */}
      <div className="no-print" style={{ textAlign: "center", marginBottom: "2rem", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
          <Image
            src="/National-Emblem-1.svg"
            alt="Department of Social Justice & Empowerment, Government of India"
            width={90}
            height={90}
            style={{ objectFit: "contain" }}
          />
          <Image
            src="/netram2.png"
            alt="Netram"
            width={90}
            height={90}
            style={{ objectFit: "contain" }}
          />
        </div>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.85rem", fontWeight: 800 }}>
          <span style={{ color: SAFFRON }}>Netram</span>{" "}
          <span style={{ color: NAVY }}>Citizen Grievance Portal</span>
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted, #64748b)" }}>
          Public accountability ledger for citizen inquiries, project monitoring, and statutory redressal (§35)
        </p>
      </div>

      {/* Lookup Form */}
      <div className="table-card no-print" style={{ padding: "1.75rem", marginBottom: "2rem", borderRadius: "12px", background: "#fff", border: "1px solid #e2e8f0" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="text"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
            placeholder="Enter Tracking Code (e.g. CMP-2026-A1B2)"
            required
            style={{
              flex: "1 1 300px",
              padding: "0.75rem 0.9rem",
              borderRadius: "8px",
              border: "1.5px solid #cbd5e1",
              fontSize: "0.95rem",
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: "#0f172a",
              background: "#ffffff",
            }}
          />
          {/* CHANGED: navy -> institutional green, matching the primary action color used site-wide */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "0.75rem 1.75rem",
              fontSize: "0.95rem",
              background: `linear-gradient(to right, ${GREEN}, ${GREEN_DARK})`,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Searching…" : "Track Status"}
          </button>
        </form>
        <div style={{ fontSize: "0.76rem", color: "var(--text-muted, #64748b)", marginTop: "0.75rem" }}>
          💡 <strong>Tip:</strong> Enter the unique alphanumeric code provided on your registration SMS or filing acknowledgment.
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div
          className="no-print"
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "1.1rem 1.25rem",
            marginBottom: "2rem",
            color: "#991b1b",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {/* Result Card / Dossier Receipt */}
      {result && (
        <div
          className="table-card print-receipt-card"
          style={{
            padding: "2rem",
            marginBottom: "2rem",
            borderRadius: "12px",
            border: "1px solid var(--color-border-strong, #cbd5e1)",
            borderLeft: `6px solid ${getStatusBadge(result.status).color}`,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "1rem",
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: NAVY,
                    background: "#f1f5f9",
                    padding: "0.3rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  {result.trackingCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="no-print"
                  style={{
                    background: "none",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    color: copied ? "#166534" : "#475569",
                    fontWeight: 600,
                  }}
                >
                  {copied ? "✓ Copied" : "Copy Code"}
                </button>
              </div>

              <h2 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1.35rem", fontWeight: 700, color: NAVY }}>
                {result.projectName}
              </h2>
              <div className="muted" style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Monitored Facility Code: <strong>{result.projectCode}</strong>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  padding: "0.35rem 0.75rem",
                  borderRadius: "6px",
                  background: getStatusBadge(result.status).bg,
                  color: getStatusBadge(result.status).color,
                  letterSpacing: "0.05em",
                }}
              >
                {getStatusBadge(result.status).label}
              </span>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.35rem" }}>
                Certified Statutory Status
              </div>
            </div>
          </div>

          {/* Visual Progress Stepper (§35) */}
          <div className="no-print" style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#475569", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "1rem" }}>
              Statutory Redressal Progression
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
              {LIFECYCLE_STEPS.map((step) => {
                const isDone = currentRank > step.id;
                const isCurrent = currentRank === step.id;

                const cardBg = isDone ? "#f0fdf4" : isCurrent ? "#eff6ff" : "#f8fafc";
                const borderCol = isDone ? "#86efac" : isCurrent ? "#93c5fd" : "#e2e8f0";
                const textCol = isDone ? "#166534" : isCurrent ? "#1e40af" : "#64748b";

                return (
                  <div
                    key={step.id}
                    style={{
                      padding: "0.75rem 0.85rem",
                      borderRadius: "8px",
                      background: cardBg,
                      border: `1.5px solid ${borderCol}`,
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          background: isDone ? "#16a34a" : isCurrent ? "#2563eb" : "#cbd5e1",
                          color: "#ffffff",
                        }}
                      >
                        {isDone ? "✓" : step.id + 1}
                      </span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: textCol }}>
                        {step.title}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", lineHeight: 1.3 }}>
                      {step.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Facts & Milestones Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1.25rem",
              background: "#f8fafc",
              padding: "1.25rem",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Filing Date</div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
                {formatDate(result.receivedAt)}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                {formatDate(result.receivedAt) === "—"
                  ? ""
                  : `Recorded ${formatDateTime(result.receivedAt)}`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Authority State</div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: getStatusBadge(result.status).color, marginTop: "0.25rem" }}>
                {result.status.replace(/_/g, " ").toUpperCase()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                {result.status === "resolved" ? "Redressal Concluded" : result.status === "closed" ? "Closed without action" : "Active District Oversight"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Conclusion Date</div>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
                {result.resolvedAt ? formatDate(result.resolvedAt) : "In Progress"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                {result.resolvedAt ? formatDateTime(result.resolvedAt) : "Awaiting closure"}
              </div>
            </div>
          </div>

          {/* Official Resolution Card if present */}
          {result.resolutionText && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "1.25rem 1.5rem",
                borderRadius: "8px",
                background: result.status === "resolved" ? "#f0fdf4" : "#f8fafc",
                border: `1.5px solid ${result.status === "resolved" ? "#bbf7d0" : "#cbd5e1"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: result.status === "resolved" ? "#15803d" : "#334155", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Official Statutory Determination
                </span>
                {result.status === "resolved" && (
                  <span style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem", borderRadius: "4px", background: "#bbf7d0", color: "#166534", fontWeight: 700 }}>
                    CERTIFIED
                  </span>
                )}
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem", lineHeight: 1.55, color: "#0f172a" }}>
                {result.resolutionText}
              </p>
              {result.resolvedAt && (
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.6rem" }}>
                  Certified and sealed on {formatDateTime(result.resolvedAt)} by competent authority.
                </div>
              )}
            </div>
          )}

          {/* Receipt Actions Bar (Print / PDF) */}
          <div
            className="no-print"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e2e8f0",
              marginTop: "1.5rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Statutory Receipt: <strong>{result.trackingCode}</strong>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.82rem",
                  padding: "0.45rem 0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: "8px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#0f172a",
                }}
              >
                <span>🖨️ Print Statutory Receipt</span>
              </button>
            </div>
          </div>

          {/* Privacy & Statutory Protection Safeguard */}
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e2e8f0",
              fontSize: "0.75rem",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            🛡️ <strong>Citizen Privacy Safeguard (§39):</strong> In compliance with the statutory Data Minimization
            Mandate, the complainant identity, contact coordinates, and phone numbers are confidential and
            strictly omitted from this public verification view.
          </div>
        </div>
      )}

      {/* Back to Home / Login */}
      <div className="no-print" style={{ textAlign: "center", marginTop: "2.5rem" }}>
        <Link
          href="/login"
          style={{
            color: NAVY,
            fontSize: "0.85rem",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Staff & Authorized Officer Portal Login &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function TrackComplaintPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ textAlign: "center", padding: "3rem" }}>Loading portal…</div>}>
        <TrackComplaintContent />
      </Suspense>
    </main>
  );
}