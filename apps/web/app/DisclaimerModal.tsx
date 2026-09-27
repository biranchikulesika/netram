"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Authority workspaces are behind authentication; the public demonstration
    // disclosure belongs to the public-facing pages only.
    if (pathname?.startsWith("/dashboard")) return;
    if (!sessionStorage.getItem("netram-disclaimer-seen")) {
      setVisible(true);
    }
  }, [pathname]);

  const dismiss = () => {
    sessionStorage.setItem("netram-disclaimer-seen", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          maxWidth: "340px",
          width: "100%",
          padding: "1.75rem",
          border: "1px solid #cbd5e1",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
        }}
      >
        <h2
          id="disclaimer-title"
          style={{ margin: "0 0 0.6rem", fontSize: "1.15rem", fontWeight: 700, color: "#1e3a8a" }}
        >
          This is a project demonstration
        </h2>

        <p style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", lineHeight: 1.6, color: "#475569" }}>
          Netram is a Smart India Hackathon (SIH26095) project and is not an official Government of India or DoSJE platform.
        </p>

        <button
          type="button"
          onClick={dismiss}
          style={{
            width: "100%",
            padding: "0.7rem 1.25rem",
            fontSize: "0.9rem",
            fontWeight: 700,
            background: "linear-gradient(to right, #157a3d, #0f5f2f)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
