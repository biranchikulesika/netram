"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PublicComplaintTracking } from "@netram/types";
import { formatDate, formatDateTime } from "../../lib/presentation";

function getStatusBadge(status: string): { bg: string; color: string; label: string } {
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
      return { bg: "#f1f5f9", color: "#334155", label: status.toUpperCase() };
  }
}

function TrackComplaintContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [result, setResult] = useState<PublicComplaintTracking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error(`No grievance record found with tracking code "${cleanCode}".`);
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

  return (
    <div style={{ maxWidth: "720px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* Top Brand Banner */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "var(--color-navy-brand)",
            }}
          />
          <span style={{ fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-navy-brand)" }}>
            NETRAM CITIZEN OVERSIGHT
          </span>
        </div>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.8rem", fontWeight: 800, color: "var(--color-navy-brand)" }}>
          Track Grievance Status
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Public accountability ledger for citizen inquiries and project monitoring (§35)
        </p>
      </div>

      {/* Lookup Form */}
      <div className="table-card" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            type="text"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
            placeholder="Enter Tracking Code (e.g. CMP-2026-A1B2)"
            required
            style={{
              flex: "1 1 280px",
              padding: "0.7rem 0.85rem",
              borderRadius: "6px",
              border: "1.5px solid #cbd5e1",
              fontSize: "0.95rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{
              padding: "0.7rem 1.5rem",
              fontSize: "0.95rem",
              background: "var(--color-navy-brand)",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Searching..." : "Track Status"}
          </button>
        </form>
      </div>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "6px",
            padding: "1rem",
            marginBottom: "2rem",
            color: "#991b1b",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div
          className="table-card"
          style={{
            padding: "2rem",
            marginBottom: "2rem",
            borderLeft: `5px solid ${getStatusBadge(result.status).color}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#475569",
                  background: "#f1f5f9",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                }}
              >
                {result.trackingCode}
              </span>
              <h2 style={{ margin: "0.6rem 0 0.2rem", fontSize: "1.3rem", color: "var(--color-navy-brand)" }}>
                {result.projectName}
              </h2>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                Facility Code: <strong>{result.projectCode}</strong>
              </div>
            </div>

            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "0.25rem 0.65rem",
                borderRadius: "4px",
                background: getStatusBadge(result.status).bg,
                color: getStatusBadge(result.status).color,
              }}
            >
              {getStatusBadge(result.status).label}
            </span>
          </div>

          {/* Timeline Milestones */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "1rem",
              marginTop: "1.5rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>RECEIVED AT</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b", marginTop: "0.2rem" }}>
                {formatDate(result.receivedAt)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>CURRENT STATE</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: getStatusBadge(result.status).color, marginTop: "0.2rem" }}>
                {result.status.replace("_", " ").toUpperCase()}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>CONCLUSION DATE</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b", marginTop: "0.2rem" }}>
                {result.resolvedAt ? formatDate(result.resolvedAt) : "In Progress"}
              </div>
            </div>
          </div>

          {/* Resolution Card if present */}
          {result.resolutionText && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1.25rem",
                borderRadius: "6px",
                background: result.status === "resolved" ? "#f0fdf4" : "#f8fafc",
                border: `1px solid ${result.status === "resolved" ? "#bbf7d0" : "#e2e8f0"}`,
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: result.status === "resolved" ? "#15803d" : "#475569" }}>
                OFFICIAL REDRESSAL RESOLUTION
              </div>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.88rem", lineHeight: 1.5, color: "#1e293b" }}>
                {result.resolutionText}
              </p>
              {result.resolvedAt && (
                <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.4rem" }}>
                  Certified on {formatDateTime(result.resolvedAt)}
                </div>
              )}
            </div>
          )}

          {/* Privacy footer */}
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e2e8f0",
              fontSize: "0.75rem",
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            🛡️ <strong>Citizen Privacy Safeguard (§39):</strong> Individual complainant identity and
            contact numbers are strictly confidential and redacted from this public portal.
          </div>
        </div>
      )}

      {/* Back to Home / Login */}
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link
          href="/login"
          style={{
            color: "var(--color-navy-brand)",
            fontSize: "0.85rem",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Staff & Officer Portal Login &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function TrackComplaintPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ textAlign: "center", padding: "3rem" }}>Loading portal...</div>}>
        <TrackComplaintContent />
      </Suspense>
    </main>
  );
}
