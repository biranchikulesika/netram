"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { ProjectRiskSnapshot, CompositeRiskLevel } from "@netram/types";

interface CompositeRiskCardProps {
  projectId: string;
  projectCode: string;
  initialSnapshot: ProjectRiskSnapshot | null;
  canEvaluate: boolean;
}

const LEVEL_COLORS: Record<CompositeRiskLevel, { text: string; bg: string; border: string; label: string }> = {
  critical: { text: "#dc2626", bg: "#fef2f2", border: "#f87171", label: "Critical Risk" },
  high: { text: "#ea580c", bg: "#fff7ed", border: "#fdba74", label: "High Risk" },
  medium: { text: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Medium Risk" },
  low: { text: "#059669", bg: "#f0fdf4", border: "#86efac", label: "Low Risk" },
};

export function CompositeRiskCard({
  projectId,
  initialSnapshot,
  canEvaluate,
}: CompositeRiskCardProps) {
  const [snapshot, setSnapshot] = useState<ProjectRiskSnapshot | null>(initialSnapshot);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const levelInfo = snapshot
    ? LEVEL_COLORS[snapshot.riskLevel]
    : { text: "#64748b", bg: "#f8fafc", border: "#cbd5e1", label: "Not Evaluated" };

  async function handleEvaluate() {
    setEvaluating(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/project-risk/evaluate/${projectId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || "Failed to evaluate composite risk");
      }
      const updatedSnapshot: ProjectRiskSnapshot = await res.json();
      setSnapshot(updatedSnapshot);
      setFeedback({
        type: "success",
        message: `Evaluation completed: Score ${Math.round(updatedSnapshot.totalScore)}/100 (${updatedSnapshot.riskLevel.toUpperCase()})`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", message: msg });
    } finally {
      setEvaluating(false);
    }
  }

  const score = snapshot ? Math.round(snapshot.totalScore) : 0;

  const dimensions = [
    { name: "Financial Risk", weight: 40, score: snapshot?.financialScore ?? 0, color: "#2563eb" },
    { name: "Inspection Quality", weight: 25, score: snapshot?.inspectionQualityScore ?? 0, color: "#7c3aed" },
    { name: "Attendance Anomaly", weight: 20, score: snapshot?.attendanceAnomalyScore ?? 0, color: "#0891b2" },
    { name: "Complaint Density", weight: 10, score: snapshot?.complaintDensityScore ?? 0, color: "#d97706" },
    { name: "AI Anomaly Signals", weight: 5, score: snapshot?.aiAnomalyScore ?? 0, color: "#ec4899" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        marginBottom: "1.5rem",
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#fafbfc",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: levelInfo.text,
              boxShadow: `0 0 0 3px ${levelInfo.border}`,
            }}
          />
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
              Composite Risk Score (CRS)
            </h3>
            <p style={{ margin: "0.125rem 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>
              Advisory inspection prioritization engine across 5 operational dimensions
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {snapshot && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.25rem 0.625rem",
                borderRadius: "9999px",
                color: levelInfo.text,
                backgroundColor: levelInfo.bg,
                border: `1px solid ${levelInfo.border}`,
                textTransform: "uppercase",
                letterSpacing: "0.025em",
              }}
            >
              {levelInfo.label}
            </span>
          )}

          {canEvaluate && (
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={evaluating}
              style={{
                padding: "0.375rem 0.875rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: evaluating ? "#94a3b8" : "#ffffff",
                backgroundColor: evaluating ? "#cbd5e1" : "#0f766e",
                border: "none",
                borderRadius: "6px",
                cursor: evaluating ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                transition: "background-color 0.15s ease",
              }}
            >
              {evaluating ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid #ffffff",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Evaluating...
                </>
              ) : (
                "⚡ Evaluate Risk Now"
              )}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "0.8125rem",
            backgroundColor: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: feedback.type === "success" ? "#166534" : "#991b1b",
            borderBottom: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Main Grid: Gauge + 5 Dimensions Breakdown */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          padding: "1.5rem",
        }}
      >
        {/* Left: Score Gauge / Metric Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            backgroundColor: "#f8fafc",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 120,
              height: 120,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `conic-gradient(${levelInfo.text} ${score * 3.6}deg, #e2e8f0 ${score * 3.6}deg)`,
              boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "2rem", fontWeight: 800, color: levelInfo.text, lineHeight: 1 }}>
                {score}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 500, marginTop: 2 }}>
                / 100 CRS
              </span>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>
              {snapshot ? levelInfo.label : "Pending First Evaluation"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              {snapshot
                ? `Calculated on ${new Date(snapshot.calculatedAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Click Evaluate Risk Now to score this facility"}
            </div>
          </div>

          {/* Auto-schedule status notification */}
          <div
            style={{
              marginTop: "1rem",
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.75rem",
              backgroundColor: snapshot?.scheduledInspectionId ? "#eff6ff" : "#f1f5f9",
              border: `1px solid ${snapshot?.scheduledInspectionId ? "#bfdbfe" : "#e2e8f0"}`,
              color: snapshot?.scheduledInspectionId ? "#1e40af" : "#475569",
            }}
          >
            {snapshot?.scheduledInspectionId ? (
              <span style={{ fontWeight: 600 }}>
                🚨 Special inspection auto-scheduled
                <Link
                  href={`/inspections/${snapshot.scheduledInspectionId}`}
                  style={{ marginLeft: 6, color: "#2563eb", textDecoration: "underline" }}
                >
                  View dispatch
                </Link>
              </span>
            ) : score >= 50 ? (
              <span>⚠️ High risk threshold met (Open inspection underway or cooldown active)</span>
            ) : (
              <span>✅ Within normal parameters (Scheduling threshold: 50)</span>
            )}
          </div>
        </div>

        {/* Right: 5 Dimensions Horizontal Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>
            Dimension Breakdown (Weighted 0–100 Scale)
          </div>

          {dimensions.map((dim) => {
            const weightedScore = (dim.score * (dim.weight / 100)).toFixed(1);
            return (
              <div key={dim.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span style={{ fontWeight: 500, color: "#334155" }}>
                    {dim.name} <span style={{ color: "#94a3b8" }}>({dim.weight}%)</span>
                  </span>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                    {Math.round(dim.score)} / 100{" "}
                    <span style={{ color: "#64748b", fontWeight: 400 }}>
                      (+{weightedScore} pts)
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    backgroundColor: "#f1f5f9",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, dim.score))}%`,
                      height: "100%",
                      backgroundColor: dim.color,
                      borderRadius: 4,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom: Top Risk Contributors */}
      {snapshot && snapshot.topContributors && snapshot.topContributors.length > 0 && (
        <div
          style={{
            padding: "1rem 1.5rem",
            backgroundColor: "#fcfdfe",
            borderTop: "1px solid #f1f5f9",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.5rem",
            }}
          >
            Key Risk Drivers
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {snapshot.topContributors.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  color: "#334155",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span>{c.explanation}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.6875rem",
                    color: "#64748b",
                    backgroundColor: "#f1f5f9",
                    padding: "0.125rem 0.375rem",
                    borderRadius: 4,
                  }}
                >
                  {c.dimension}
                </span>
              </div>
            ))}
          </div>

          {/* Narrative Summary / Synergies */}
          {snapshot.explanation && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.625rem 0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                color: "#475569",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ color: "#1e293b" }}>Diagnostic Summary: </strong>
              {snapshot.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
