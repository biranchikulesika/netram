"use client";

import { useState } from "react";
import type { Observation } from "@netram/types";
import { useRouter } from "next/navigation";
import { formatDateTime } from "../../../../lib/presentation";
import { IconClipboard } from "../../../components/icons";

export interface ObservationsSectionProps {
  inspectionId: string;
  items: Observation[];
  canAdd: boolean;
  /** userId -> displayName, resolved server-side (user-admin API is permission-gated). */
  userNames: Record<string, string>;
}

export function ObservationsSection({
  inspectionId,
  items,
  canAdd,
  userNames,
}: ObservationsSectionProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Failed to add observation");
      }

      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add observation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="observations-section">
      <div className="section-title-row">
        <div>
          <h3>Field Observations</h3>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconClipboard width={20} height={20} />
          </div>
          <div className="empty-state-title">No field observations yet</div>
          <p className="empty-state-sub">
            Time-stamped notes captured on site by inspection team members will appear here.
          </p>
        </div>
      ) : (
        <div className="observation-list">
          {items.map((obs) => (
            <article key={obs.id} className="observation-item">
              <div className="observation-header">
                <span className="obs-author">{userNames[obs.userId] ?? "Field inspector"}</span>
                <span className="obs-time">{formatDateTime(obs.createdAt)}</span>
              </div>
              <p className="obs-text">{obs.text}</p>
            </article>
          ))}
        </div>
      )}

      {canAdd && (
        <form onSubmit={handleSubmit} className="observation-form">
          <h4>Record Field Observation</h4>
          <textarea
            placeholder="Describe on-site observation, discrepancy, or checklist finding..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            required
            disabled={submitting}
          />
          <div className="form-actions">
            <button type="submit" disabled={!text.trim() || submitting}>
              {submitting ? "Adding..." : "Add Observation"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
