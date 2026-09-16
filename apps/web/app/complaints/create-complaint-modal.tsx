"use client";

import React, { useState } from "react";
import type { Complaint } from "@netram/types";

export interface CreateComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (complaint: Complaint) => void;
  projects: Array<{ id: string; code: string; name: string }>;
}

export function CreateComplaintModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
}: CreateComplaintModalProps) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [complainantName, setComplainantName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError("Please select a facility project.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError("Description must be at least 10 characters long.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          description: description.trim(),
          complainantName: complainantName.trim() || undefined,
          contactInfo: contactInfo.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message || `Failed to file grievance (status ${res.status})`,
        );
      }

      const created = (await res.json()) as Complaint;
      onSuccess(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="lightbox-backdrop"
      style={{ zIndex: 100 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-create-complaint-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "580px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "0.85rem",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h3
              id="modal-create-complaint-title"
              style={{
                margin: 0,
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              Register Public Grievance
            </h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              Intake official citizen complaint or inspection oversight finding (§35)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              color: "#64748b",
              cursor: "pointer",
              padding: "0.2rem 0.5rem",
              lineHeight: 1,
            }}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              padding: "0.65rem 0.85rem",
              marginBottom: "1rem",
              color: "#991b1b",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Facility / Project */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="complaint-project-select"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              Facility / Project <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              id="complaint-project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Grievance Narrative */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="complaint-description"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              Grievance Description <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              id="complaint-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              placeholder="Describe the non-compliance, irregularity, deficiency, or observation..."
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Complainant Name & Contact Info */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <label
                htmlFor="complaint-name"
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.35rem",
                }}
              >
                Complainant Name (Optional)
              </label>
              <input
                id="complaint-name"
                type="text"
                value={complainantName}
                onChange={(e) => setComplainantName(e.target.value)}
                placeholder="Anonymous / Citizen Name"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="complaint-contact"
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "0.35rem",
                }}
              >
                Contact Information (Optional)
              </label>
              <input
                id="complaint-contact"
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Phone or email for updates"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: "6px",
              padding: "0.6rem 0.8rem",
              marginBottom: "1.25rem",
              fontSize: "0.75rem",
              color: "#0369a1",
              lineHeight: 1.4,
            }}
          >
            <strong>Privacy Note (§39):</strong> Complainant personal details are restricted to
            authorized investigation officers and will never be disclosed to public feeds or the
            durable event outbox.
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              borderTop: "1px solid #e2e8f0",
              paddingTop: "0.85rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                padding: "0.5rem 1.25rem",
                fontSize: "0.85rem",
                background: "var(--color-navy-brand)",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Filing..." : "Submit Grievance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
