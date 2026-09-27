import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "../lib/api";
import { redirect } from "next/navigation";
import TypingHeadline from "./TypingHeadline";
import Image from "next/image";
import DisclaimerModal from "./DisclaimerModal";

export const metadata: Metadata = {
  title: "Netram Monitoring Platform",
  description:
    "Official portal of the Department of Social Justice & Empowerment (DoSJE) monitoring system.",
};

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");

  return (
    <main style={{ minHeight: "100vh", width: "100%", background: "#f6f8fc" }}>
      <style>{`
        :root {
          --navy: #1e3a8a;
          --saffron: #e8590c;
          --green: #157a3d;
          --green-hover: #0f5f2f;
          --muted: #64748b;
        }
        .nav-btn {
          background: var(--green);
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          text-decoration: none;
          transition: background .12s ease;
        }
        .nav-btn:hover { background: var(--green-hover); color: #fff; }
        .plain-link {
          color: var(--navy);
          font-weight: 700;
          font-size: 0.95rem;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          border: 1.5px solid var(--navy);
          text-decoration: none;
        }
        .hero-grid {
          background-image:
            linear-gradient(rgba(30, 58, 138, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30, 58, 138, 0.06) 1px, transparent 1px);
          background-size: 64px 64px;
          -webkit-mask-image: radial-gradient(ellipse 90% 85% at 50% 35%, #000 65%, transparent 100%);
          mask-image: radial-gradient(ellipse 90% 85% at 50% 35%, #000 65%, transparent 100%);
        }
        .action-row {
          display: flex;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        @media (max-width: 720px) {
          .hero-heading { font-size: 2.6rem !important; }
        }
      `}</style>
      <DisclaimerModal />

      {/* Logo, top-left */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          padding: "1.5rem 2rem 0",
        }}
      >
        <Image
          src="/National-Emblem-1.svg"
          alt="Department of Social Justice & Empowerment logo"
          width={80}
          height={80}
          style={{ borderRadius: "8px", flexShrink: 0, objectFit: "contain" }}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--navy)", lineHeight: 1.1 }}>
            Department of Social Justice and Empowerment
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", lineHeight: 1.1 }}>
            Govt. of India
          </div>
        </div>
      </div>

      {/* Hero */}
      <section
        className="hero-grid"
        style={{
          width: "100%",
          padding: "4rem 1.5rem 6rem",
          textAlign: "center",
        }}
      >
        <div
          className="hero-heading"
          style={{
            fontSize: "4.5rem",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          <TypingHeadline /> <span style={{ color: "var(--navy)" }}>: सत्य · दृष्टि · दायित्व</span>
        </div>

        <p
          style={{
            maxWidth: "560px",
            margin: "1.25rem auto 0",
            color: "var(--muted)",
            fontSize: "1.05rem",
            lineHeight: 1.6,
          }}
        >
          Real-time monitoring and inspection for institutions under the
          Department of Social Justice &amp; Empowerment.
        </p>

        <div className="action-row" style={{ marginTop: "2.5rem" }}>
          <Link href="/login" className="nav-btn">
            Staff Login
          </Link>
          <Link href="/register-complaint" className="nav-btn">
            File a Complaint
          </Link>
          <Link href="/track-complaint" className="nav-btn">
            Track a Complaint
          </Link>
        </div>
      </section>

      <footer style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: "0.82rem" }}>
        © 2026 Netram · Department of Social Justice &amp; Empowerment
      </footer>
    </main>
  );
}