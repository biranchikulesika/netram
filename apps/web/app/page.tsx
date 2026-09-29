import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "../lib/api";
import { redirect } from "next/navigation";
import TypingHeadline from "./TypingHeadline";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Netram Monitoring Platform",
  description:
    "Official portal of the Department of Social Justice & Empowerment (DoSJE) monitoring system.",
};

export default async function HomePage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        width: "100%",
        background: "#f6f8fc",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        :root {
          --navy: #0c2a52;
          --saffron: #dd501e;
          --green: #137e3a;
          --green-hover: #137e3a;
          --muted: var(--text-subtle);
          --line: var(--color-border-subtle);
          /* type scale — one size per level, no ad-hoc values */
          --fs-display: 5.5rem;
          --fs-tagline: 2rem;
          --fs-body: 1.0625rem;
          --fs-cta: 0.9375rem;
          --fs-btn: 0.875rem;
          --fs-meta: 0.75rem;
          /* spacing rhythm */
          --sp-1: 0.5rem;
          --sp-2: 1rem;
          --sp-3: 1.75rem;
          --sp-4: 2.75rem;
        }
        .nav-btn {
          display: inline-flex;
          align-items: center;
          box-sizing: border-box;
          font-weight: 600;
          font-size: var(--fs-btn);
          line-height: 1.2;
          padding: 0.7rem 1.25rem;
          min-height: 2.5rem;
          border-radius: 8px;
          text-decoration: none;
          transition: background .12s ease, color .12s ease, border-color .12s ease;
        }
        .nav-btn:hover { text-decoration: none; }
        .nav-btn:focus-visible {
          outline: 2px solid var(--navy);
          outline-offset: 2px;
        }
        .nav-btn-primary {
          background: var(--green);
          color: #fff;
          font-size: var(--fs-cta);
          font-weight: 700;
          padding: 0.7rem 1.6rem;
          box-shadow: 0 1px 2px rgba(19,126,58, .25), 0 6px 16px -6px rgba(19,126,58, .45);
        }
        .nav-btn-primary:hover { background: var(--green-hover); color: #fff; }
        .nav-btn-quiet {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--color-border-strong);
        }
        .nav-btn-quiet:hover {
          background: #fff;
          color: var(--navy);
          border-color: var(--navy);
        }
        .hero-heading {
          font-size: var(--fs-display);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
        }
        /* Tagline sits a clear step below the display line.
           No letter-spacing: it breaks Devanagari conjuncts apart. */
        .hero-tagline {
          margin-top: var(--sp-2);
          font-size: var(--fs-tagline);
          font-weight: 600;
          line-height: 1.6;
          letter-spacing: normal;
          word-spacing: 0.3em;
          color: var(--navy);
          font-family:
            "Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", Mangal,
            var(--font-sans);
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
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        @media (max-width: 720px) {
          .hero-heading { font-size: 3rem; }
          .hero-tagline { font-size: 1.25rem; word-spacing: 0.2em; }
          .masthead-sih { width: 120px; height: auto; }
        }
      `}</style>

      {/* Masthead, top-left */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1.5rem 2rem 0",
        }}
      >
        <a
          href="https://socialjustice.gov.in"
          target="_blank"
          rel="noreferrer noopener"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            minWidth: 0,
            textDecoration: "none",
          }}
        >
          <Image
            src="/National-Emblem-1.svg"
            alt="Department of Social Justice & Empowerment logo"
            width={72}
            height={72}
            style={{ borderRadius: "8px", flexShrink: 0, objectFit: "contain" }}
          />
          <div style={{ maxWidth: "17rem", minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "1.0625rem",
                color: "var(--navy)",
                lineHeight: 1.3,
                textWrap: "balance",
              }}
            >
              Department of Social Justice and Empowerment
            </div>
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--muted)",
                lineHeight: 1.3,
                marginTop: "0.2rem",
              }}
            >
              Government of India
            </div>
          </div>
        </a>

        <a
          href="https://sih.gov.in"
          target="_blank"
          rel="noreferrer noopener"
          style={{ marginLeft: "auto", flexShrink: 0, lineHeight: 0 }}
        >
          <Image
            className="masthead-sih"
            src="/sih-logo.png"
            alt="Smart India Hackathon"
            width={208}
            height={96}
            style={{ objectFit: "contain" }}
          />
        </a>
      </div>

      {/* Hero */}
      <section
        className="hero-grid"
        style={{
          padding: "var(--sp-4) 1.5rem var(--sp-3)",
          textAlign: "center",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <h1 className="hero-heading" style={{ margin: 0 }}>
          <TypingHeadline />
          <div className="hero-tagline">सत्य · दृष्टि · दायित्व</div>
        </h1>

        <p
          style={{
            maxWidth: "34rem",
            margin: "var(--sp-3) auto 0",
            color: "var(--muted)",
            fontSize: "var(--fs-body)",
            lineHeight: 1.6,
          }}
        >
          Smart Monitoring and Inspection Platform
        </p>

        <div className="action-row" style={{ marginTop: "var(--sp-4)" }}>
          <Link href="/login" className="nav-btn nav-btn-primary">
            Authority Login
          </Link>
          <Link href="/register-complaint" className="nav-btn nav-btn-quiet">
            Register a Complaint
          </Link>
        </div>
      </section>

      <footer
        style={{
          padding: "1.25rem 2rem",
          color: "var(--muted)",
          fontSize: "var(--fs-meta)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.4rem",
          borderTop: "1px solid var(--line)",
        }}
      >
        <span>© 2026 Team Netram</span>
        <a
          href="https://github.com/biranchikulesika/netram"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Team Netram on GitHub"
          style={{ display: "inline-flex", color: "var(--navy)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
      </footer>
    </main>
  );
}