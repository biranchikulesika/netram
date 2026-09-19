"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_TRANSITIONS } from "@netram/types";
import type { ProjectStatus } from "@netram/types";

interface TransitionButtonProps {
  projectId: string;
  currentStatus: ProjectStatus;
}

/**
 * Compact lifecycle transition control for the facility header.
 * The regulatory lifecycle is a small administrative action, not a separate
 * facility section — the caller (project header) owns the placement.
 * Requests are proxied through the Next.js route handler so the httpOnly
 * session token authorizes the call.
 */
export function TransitionButton({ projectId, currentStatus }: TransitionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const allowedNext = PROJECT_TRANSITIONS[currentStatus] || [];

  async function handleTransition(to: ProjectStatus) {
    if (!window.confirm(`Are you sure you want to transition this project to '${to}'?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, note: note.trim() || undefined }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;

      if (!res.ok || payload?.error) {
        setError(payload?.error?.message ?? `Request failed (${res.status})`);
        return;
      }

      setNote("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (allowedNext.length === 0) {
    return null;
  }

  return (
    <div className="transition-pop" style={{ position: "relative" }}>
      <button
        type="button"
        className="transition-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? "Updating…" : "Transition"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Project lifecycle transition"
          className="transition-pop-panel"
        >
          <div className="transition-pop-title">Lifecycle transition</div>
          <div className="transition-pop-sub">
            Current: {currentStatus.replace(/_/g, " ")} — advance the facility through the authorized
            regulatory lifecycle.
          </div>

          {error && <div className="error-banner">{error}</div>}

          <input
            type="text"
            placeholder="Optional administrative note / reference..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />

          <div className="transition-pop-actions">
            {allowedNext.map((nextStatus) => {
              const primary = nextStatus === "Approved" || nextStatus === "Active";
              return (
                <button
                  key={nextStatus}
                  type="button"
                  disabled={busy}
                  onClick={() => handleTransition(nextStatus)}
                  className={primary ? "" : "btn-secondary"}
                >
                  {nextStatus}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}