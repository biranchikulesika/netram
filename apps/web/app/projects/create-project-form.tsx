"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
<<<<<<< HEAD
import { NetramApiClient, ApiError } from "@netram/api-client";
import type { ProjectType } from "@netram/types";

interface CreateProjectFormProps {
  apiUrl: string;
=======
import type { ProjectType } from "@netram/types";

interface CreateProjectFormProps {
  apiUrl?: string;
>>>>>>> origin/production
  onCancel?: () => void;
  onCreated?: () => void;
}

<<<<<<< HEAD
export function CreateProjectForm({ apiUrl, onCancel, onCreated }: CreateProjectFormProps) {
=======
export function CreateProjectForm({ onCancel, onCreated }: CreateProjectFormProps) {
>>>>>>> origin/production
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("institution");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
<<<<<<< HEAD
      await new NetramApiClient({ baseUrl: apiUrl }).createProject({
        name: name.trim(),
        type,
        description: description.trim() || undefined,
=======
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
        }),
>>>>>>> origin/production
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? `Failed with status ${res.status}`);
      }
      setName("");
      setDescription("");
      setType("institution");
      if (onCreated) {
        onCreated();
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <div className="form-card-header">
        <div>
          <div className="section-eyebrow">REGISTRATION WORKFLOW</div>
          <h3>Register New Project / Facility</h3>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          >
            Cancel
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={onSubmit}>
        <div className="form-card-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="project-name">
              Project / Facility Name *
            </label>
            <input
              id="project-name"
              placeholder="e.g. Sambalpur De-addiction & Rehabilitation Centre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={200}
              required
            />
            <span className="form-helper">Official registered facility title (min 3 chars)</span>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="project-type">
              Classification Type
            </label>
            <select
              id="project-type"
              value={type}
              onChange={(e) => setType(e.target.value as ProjectType)}
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--color-border-strong)",
                padding: "0.5rem 0.85rem",
                borderRadius: "6px",
                fontFamily: "inherit",
                fontSize: "0.85rem",
              }}
            >
              <option value="institution">Institution / NGO Facility</option>
              <option value="authority_project">Authority Infrastructure Project</option>
              <option value="other">Other Sanctioned Initiative</option>
            </select>
            <span className="form-helper">Determines oversight scope & reporting rules</span>
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label" htmlFor="project-description">
              Scope & Operational Description (Optional)
            </label>
            <input
              id="project-description"
              placeholder="Brief description of operations, target beneficiaries, or sanction reference..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
            <span className="form-helper">Auditable notes recorded in central project dossier</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Discard
            </button>
          )}
          <button type="submit" disabled={busy || name.trim().length < 3}>
            {busy ? "Registering in Database…" : "Submit Registration to Registry"}
          </button>
        </div>
      </form>
    </div>
  );
}
