import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: "var(--bg-canvas, #f8fafc)" }}>
      <div
        className="table-card"
        style={{ padding: "3rem 2.5rem", maxWidth: "520px", width: "100%", textAlign: "center", borderRadius: "12px", border: "1px solid var(--color-border-strong, #cbd5e1)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)" }}
      >
        <div style={{ fontSize: "3rem", fontWeight: 800, color: "var(--color-navy-brand, #1e3a8a)", lineHeight: 1 }}>
          404
        </div>
        <h1 style={{ margin: "0.75rem 0 0.5rem", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-navy-brand, #1e3a8a)" }}>
          Page Not Found
        </h1>
        <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-muted, #64748b)", margin: "0 0 1.75rem" }}>
          The requested page does not exist or has been moved. Please verify the address or return to the portal home.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "var(--color-navy-brand, #1e3a8a)", color: "#ffffff", padding: "0.55rem 1.1rem", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}
          >
            Return to Home
          </Link>
          <Link
            href="/login"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "#ffffff", color: "var(--color-navy-brand, #1e3a8a)", border: "1px solid #cbd5e1", padding: "0.55rem 1.1rem", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}
          >
            Staff Portal Login
          </Link>
        </div>
      </div>
    </main>
  );
}