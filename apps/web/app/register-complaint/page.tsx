"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Complaint } from "@netram/types";

interface FacilityRef {
  id: string;
  code: string;
  name: string;
}

function assertAllowedAttachment(file: File): string | null {
  const allowed = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  if (!allowed.has(file.type)) {
    return `'${file.name}' is not supported. Only photos, videos, PDFs and office documents can be attached.`;
  }
  if (file.size > 100 * 1024 * 1024) {
    return `'${file.name}' exceeds the 100 MB size limit.`;
  }
  return null;
}

const MAX_ATTACHMENTS = 5;

function RegisterComplaintContent() {
  const [facilities, setFacilities] = useState<FacilityRef[]>([]);
  const [facilitiesError, setFacilitiesError] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [complainantName, setComplainantName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Complaint | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/projects/registry");
        if (!res.ok) throw new Error("registry unavailable");
        const data = (await res.json()) as FacilityRef[];
        setFacilities(data);
        if (data.length > 0) setProjectId(data[0]!.id);
      } catch {
        setFacilitiesError(true);
      }
    })();
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const picked = Array.from(files).filter((file) => {
      const problem = assertAllowedAttachment(file);
      if (problem) {
        setError(problem);
        return false;
      }
      return true;
    });
    if (picked.length > 0) {
      setAttachments((prev) =>
        [...prev, ...picked].slice(0, MAX_ATTACHMENTS),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("projectId", projectId);
    form.append("description", description);
    form.append("complainantName", complainantName.trim());
    form.append("contactInfo", contactInfo.trim());
    for (const file of attachments) form.append("files", file, file.name);

    try {
      const res = await fetch("/api/complaints/register", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Grievance filing service unavailable (status ${res.status}).`);
      }

      setResult((await res.json()) as Complaint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to file grievance");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!result?.trackingCode) return;
    void navigator.clipboard.writeText(result.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: "780px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* Top Brand Banner */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--color-navy-brand, #1e3a8a)" }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--color-navy-brand, #1e3a8a)" }}>
            GOVERNMENT OF INDIA · DoSJE
          </span>
        </div>
        <h1 style={{ margin: "0.25rem 0", fontSize: "1.85rem", fontWeight: 800, color: "var(--color-navy-brand, #1e3a8a)" }}>
          Netram Citizen Grievance Portal
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted, #64748b)" }}>
          File a public grievance regarding a monitored facility for statutory review and redressal (§35)
        </p>
      </div>

      {/* Registration Form */}
      <div className="table-card" style={{ padding: "1.75rem", marginBottom: "2rem", borderRadius: "10px" }}>
        {facilitiesError ? (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "1.1rem 1.25rem", color: "#991b1b", fontSize: "0.9rem", textAlign: "center" }}>
            Unable to load the facility registry. Please retry shortly or contact the district authority.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Monitored Facility *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                disabled={facilities.length === 0}
                style={{
                  width: "100%",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "6px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.95rem",
                  color: "#0f172a",
                  background: "#ffffff",
                }}
              >
                <option value="" disabled>
                  {facilities.length === 0 ? "Loading facilities…" : "Select a monitored facility"}
                </option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Grievance Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                maxLength={8000}
                rows={5}
                placeholder="Describe the concern observed at the facility (minimum 10 characters)."
                style={{
                  width: "100%",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "6px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "0.95rem",
                  color: "#0f172a",
                  background: "#ffffff",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Your Name <span style={{ fontWeight: 500, textTransform: "none", fontSize: "0.72rem", color: "#94a3b8" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={complainantName}
                  onChange={(e) => setComplainantName(e.target.value)}
                  maxLength={200}
                  placeholder="For acknowledgment"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "6px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.95rem",
                    color: "#0f172a",
                    background: "#ffffff",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Contact <span style={{ fontWeight: 500, textTransform: "none", fontSize: "0.72rem", color: "#94a3b8" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  maxLength={300}
                  placeholder="Phone or email"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "6px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.95rem",
                    color: "#0f172a",
                    background: "#ffffff",
                  }}
                />
              </div>
            </div>

            {/* Supporting Attachments */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Supporting Evidence <span style={{ fontWeight: 500, textTransform: "none", fontSize: "0.72rem", color: "#94a3b8" }}>(optional)</span>
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.txt,.doc,.docx,.xls,.xlsx"
                onChange={(e) => handleFiles(e.target.files)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.9rem",
                  borderRadius: "6px",
                  border: "1.5px dashed #cbd5e1",
                  fontSize: "0.9rem",
                  color: "#0f172a",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              />
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.3rem" }}>
                Photos, videos, PDFs and office documents (up to {MAX_ATTACHMENTS} files, max 100&nbsp;MB each).
              </div>
              {attachments.length > 0 && (
                <ul style={{ margin: "0.6rem 0 0", padding: 0, listStyle: "none", display: "grid", gap: "0.35rem" }}>
                  {attachments.map((f, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        padding: "0.4rem 0.55rem",
                        fontSize: "0.8rem",
                        color: "#0f172a",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {f.name}
                      </span>
                      <span className="muted" style={{ fontSize: "0.7rem", flexShrink: 0 }}>
                        {(f.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          fontWeight: 600,
                          flexShrink: 0,
                          padding: "0.1rem 0.3rem",
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "1.1rem 1.25rem", color: "#991b1b", fontSize: "0.9rem", textAlign: "center" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                padding: "0.85rem 1.75rem",
                fontSize: "0.95rem",
                background: "var(--color-navy-brand, #1e3a8a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? "Filing Grievance…" : "Submit Grievance"}
            </button>

            <div style={{ fontSize: "0.76rem", color: "var(--text-muted, #64748b)", lineHeight: 1.5 }}>
              🔐 Your identity and contact coordinates are confidential (§39). A unique tracking code will be
              issued on submission for statutory status verification.
            </div>
          </form>
        )}
      </div>

      {/* Success Receipt */}
      {result && (
        <div
          className="table-card"
          style={{
            padding: "2rem",
            marginBottom: "2rem",
            borderRadius: "12px",
            border: "1px solid var(--color-border-strong, #cbd5e1)",
            borderLeft: "6px solid #15803d",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#15803d", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Grievance Filed Successfully
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "1rem", fontWeight: 800, color: "var(--color-navy-brand, #1e3a8a)", background: "#f1f5f9", padding: "0.3rem 0.65rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  {result.trackingCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "0.25rem 0.5rem", fontSize: "0.75rem", cursor: "pointer", color: copied ? "#166534" : "#475569", fontWeight: 600 }}
                >
                  {copied ? "✓ Copied" : "Copy Code"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.5rem 0.9rem", fontSize: "0.8rem", fontWeight: 700, color: "#15803d" }}>
              ✓ Registered in Public Ledger
            </div>
          </div>

          <p style={{ margin: "0 0 1.25rem", fontSize: "0.92rem", lineHeight: 1.55, color: "#0f172a" }}>
            Your grievance regarding <strong>{result.projectName}</strong> ({result.projectCode}) has been logged
            for district authority examination. Retention of this tracking code is required to verify statutory
            status updates.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              href={`/track-complaint?code=${encodeURIComponent(result.trackingCode)}`}
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", padding: "0.7rem 1.25rem", fontSize: "0.88rem", fontWeight: 600, background: "var(--color-navy-brand, #1e3a8a)", color: "#ffffff", borderRadius: "6px", textDecoration: "none" }}
            >
              Track Grievance Status &rarr;
            </Link>
          </div>

          <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5 }}>
            🛡️ <strong>Citizen Privacy Safeguard (§39):</strong> Complainant identity and contact coordinates are
            confidential and omitted from all public verification views.
          </div>
        </div>
      )}

      {/* Cross Links */}
      <div style={{ textAlign: "center", marginTop: "2.5rem", display: "flex", justifyContent: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <Link href="/track-complaint" style={{ color: "var(--color-navy-brand, #1e3a8a)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
          Track Existing Grievance
        </Link>
        <Link href="/login" style={{ color: "var(--color-navy-brand, #1e3a8a)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
          Staff & Authorized Officer Portal Login &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function RegisterComplaintPage() {
  return (
    <main>
      <RegisterComplaintContent />
    </main>
  );
}