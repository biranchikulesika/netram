import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "../lib/api";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Netram Monitoring Platform",
  description:
    "Official portal of the Department of Social Justice & Empowerment (DoSJE) monitoring system.",
};

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard/projects");

  return (
    <main style={{ minHeight: "100vh", padding: "3rem 1rem" }}>
      <style>{`
        .launcher-card {
          transition: transform .12s ease, box-shadow .12s ease;
        }
        .launcher-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(30, 58, 138, .12);
        }
      `}</style>

      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--color-navy-brand, #1e3a8a)" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-navy-brand, #1e3a8a)" }}>
              GOVERNMENT OF INDIA · DoSJE
            </span>
          </div>
          <h1 style={{ margin: "0.25rem 0", fontSize: "2.25rem", fontWeight: 800, color: "var(--color-navy-brand, #1e3a8a)" }}>
            Netram Monitoring Platform
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted, #64748b)" }}>
            Social justice programme oversight, grievance redressal, and public accountability ledger
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
          <Link
            href="/login"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="launcher-card table-card"
              style={{ padding: "2rem", borderRadius: "12px", border: "1px solid var(--color-border-strong, #cbd5e1)", height: "100%" }}
            >
              <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569", marginBottom: "0.6rem" }}>
                Authorized Portal
              </div>
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
                Staff &amp; Officer Login
              </h2>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#64748b" }}>
                Authority workspaces, control room, inspections, projects, and corrective actions.
              </p>
              <div style={{ marginTop: "1.25rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
                Sign in &rarr;
              </div>
            </div>
          </Link>

          <Link
            href="/register-complaint"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="launcher-card table-card"
              style={{ padding: "2rem", borderRadius: "12px", border: "1px solid var(--color-border-strong, #cbd5e1)", height: "100%" }}
            >
              <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569", marginBottom: "0.6rem" }}>
                Citizen Grievance
              </div>
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
                Register a Complaint
              </h2>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#64748b" }}>
                File a public grievance against a monitored social justice facility or programme.
              </p>
              <div style={{ marginTop: "1.25rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
                File grievance &rarr;
              </div>
            </div>
          </Link>

          <Link
            href="/track-complaint"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="launcher-card table-card"
              style={{ padding: "2rem", borderRadius: "12px", border: "1px solid var(--color-border-strong, #cbd5e1)", height: "100%" }}
            >
              <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569", marginBottom: "0.6rem" }}>
                Public Ledger
              </div>
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
                Track a Grievance
              </h2>
              <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: "#64748b" }}>
                Check the official dispute status using the tracking code from your filing acknowledgment.
              </p>
              <div style={{ marginTop: "1.25rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
                Track status &rarr;
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}