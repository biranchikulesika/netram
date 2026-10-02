"use client";

import { useEffect } from "react";
import { IconAlertTriangle } from "./components/icons";
import { ErrorActions } from "./components/error-actions";

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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "var(--bg-canvas, #edf0f5)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: isForbidden ? "var(--tint-red)" : "var(--tint-orange)",
            color: isForbidden ? "#dc2626" : "#dd501e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem auto",
          }}
        >
          <IconAlertTriangle style={{ width: 24, height: 24 }} />
        </div>

        <h2
          style={{
            margin: "0 0 0.35rem 0",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--color-navy-brand)",
          }}
        >
          {isForbidden ? "Access Restricted" : "Temporary Operational Notice"}
        </h2>

        <p
          className="muted"
          style={{
            fontSize: "0.85rem",
            lineHeight: 1.55,
            margin: "0 0 1.1rem 0",
            maxWidth: "40ch",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {isForbidden
            ? "Your official account does not have authorization to view this resource. Please contact your administrative supervisor if this requires elevated access."
            : "An unexpected operational exception occurred while retrieving this record."}
        </p>

        <ErrorActions onRetry={reset} fallbackHref="/dashboard" />
      </div>
    </div>
  );
}
