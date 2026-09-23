"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconAlertTriangle, IconBuilding } from "./components/icons";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception for internal diagnostics
    console.error("Platform application error caught by boundary:", error);
  }, [error]);

  const isForbidden =
    error.message?.includes("Missing permission") ||
    error.message?.includes("FORBIDDEN") ||
    error.message?.includes("403");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "var(--bg-canvas, #f8fafc)",
      }}
    >
      <div
        className="table-card"
        style={{
          padding: "2.5rem 2rem",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: isForbidden ? "#fee2e2" : "#fef3c7",
            color: isForbidden ? "#dc2626" : "#d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem auto",
          }}
        >
          <IconAlertTriangle style={{ width: 24, height: 24 }} />
        </div>

        <h2
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--color-navy-brand)",
          }}
        >
          {isForbidden ? "Access Restricted" : "Temporary Operational Notice"}
        </h2>

        <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.5rem 0" }}>
          {isForbidden
            ? "Your official account does not have authorization to view this resource. Please contact your administrative supervisor if this requires elevated access."
            : "An unexpected operational exception occurred while retrieving this record. Please retry the operation or return to the registry."}
        </p>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => reset()}
            className="btn-secondary"
            style={{ fontSize: "0.82rem", padding: "0.5rem 1rem" }}
          >
            Retry Action
          </button>
          <Link
            href="/dashboard/projects"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "var(--color-navy-brand)",
              color: "#ffffff",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <IconBuilding style={{ width: 14, height: 14 }} />
            <span>Return to Projects</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
