"use client";

import React from "react";
import { ErrorActions } from "./components/error-actions";

export default function NotFound() {
  return (
    <main
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
          maxWidth: "520px",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: "3.25rem",
            fontWeight: 800,
            color: "var(--color-navy-brand, #002449)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
            paddingLeft: "0.03em",
          }}
        >
          404
        </div>
        <h1
          style={{
            margin: "0.7rem 0 0.35rem",
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "var(--color-navy-brand, #002449)",
          }}
        >
          Page Not Found
        </h1>
        <p
          className="muted"
          style={{
            fontSize: "0.88rem",
            lineHeight: 1.55,
            color: "var(--text-muted, var(--text-subtle))",
            margin: "0 0 1.1rem",
            maxWidth: "40ch",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          The requested page does not exist or has been relocated.
        </p>

        <ErrorActions fallbackHref="/dashboard" />
      </div>
    </main>
  );
}
