"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PROJECT_TRANSITIONS } from "@netram/types";
import type { ProjectStatus } from "@netram/types";
import { IconChevronRight, IconSettings, IconAlertTriangle } from "../../../components/icons";

export interface TransitionButtonProps {
  projectId: string;
  currentStatus: ProjectStatus;
}

/**
 * Plain-language explanation for each lifecycle state (§33). Shown under the
 * state name in the transition options so the administrative consequence of
 * each choice is explicit before the caller commits to it.
 */
const STATUS_NOTES: Record<ProjectStatus, string> = {
  Draft: "Still being prepared; not yet submitted for verification.",
  "Pending Verification": "Submitted; awaiting authority verification.",
  Approved: "Verified by authority; ready to be activated.",
  Active: "Operational; inspections and monitoring are live.",
  Suspended: "Temporarily halted by an authority decision.",
  Closed: "Concluded; no further field activity.",
  Archived: "Read-only historical record.",
};

/** Forward-progress states get emphasised styling in the option list. */
const FORWARD_STATUSES = new Set<ProjectStatus>(["Approved", "Active"]);

/**
 * Lifecycle transition control for the facility banner tab line.
 * Provides interactive state progression (§33) with audit confirmation,
 * optional administrative note, and clear feedback.
 */
export function TransitionButton({ projectId, currentStatus }: TransitionButtonProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ProjectStatus | null>(null);

  const allowedNext = PROJECT_TRANSITIONS[currentStatus] || [];

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmTarget(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmTarget(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function executeTransition(to: ProjectStatus) {
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
      setConfirmTarget(null);
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
    <div className="transition-pop" ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="transition-trigger-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Lifecycle transition (administrative action)"
        title="Change project lifecycle state"
        onClick={() => {
          setOpen((v) => !v);
          setConfirmTarget(null);
        }}
      >
        <IconSettings width={13} height={13} />
        <span>Transition</span>
        <IconChevronRight
          width={11}
          height={11}
          className={`transition-chevron ${open ? "transition-chevron-open" : ""}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Project lifecycle transition"
          className="transition-pop-panel"
        >
          <div className="transition-pop-title">Lifecycle Transition</div>

          <div className="transition-current-row">
            <span className="transition-current">{currentStatus}</span>
            <IconChevronRight width={12} height={12} style={{ flex: "none" }} />
            <span className="transition-current-hint">
              {allowedNext.length} permitted state{allowedNext.length === 1 ? "" : "s"}
            </span>
          </div>

          {confirmTarget ? (
            <div className="transition-confirm-box">
              <div className="transition-confirm-header">
                <IconAlertTriangle width={15} height={15} style={{ color: "#dd501e", flex: "none" }} />
                <span>Confirm change to <strong>{confirmTarget}</strong>?</span>
              </div>
              <p className="transition-confirm-desc">
                {STATUS_NOTES[confirmTarget]}
              </p>
              <div className="transition-confirm-audit">
                This administrative action will be recorded in the permanent audit trail (§37).
              </div>
              {note.trim() && (
                <div className="transition-confirm-note">
                  <span className="muted">Note: </span>
                  <span>{note.trim()}</span>
                </div>
              )}
              <div className="transition-confirm-actions">
                <button
                  type="button"
                  className="btn-primary transition-confirm-btn"
                  disabled={busy}
                  onClick={() => executeTransition(confirmTarget)}
                >
                  {busy ? "Transitioning…" : `Confirm to ${confirmTarget}`}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => setConfirmTarget(null)}
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="transition-options">
                {allowedNext.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmTarget(nextStatus)}
                    className={`transition-option ${FORWARD_STATUSES.has(nextStatus) ? "forward" : ""}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <span className="transition-option-name">{nextStatus}</span>
                      <IconChevronRight width={12} height={12} style={{ opacity: 0.5 }} />
                    </div>
                    <span className="transition-option-desc">{STATUS_NOTES[nextStatus]}</span>
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Optional note / reference (e.g. file number)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                aria-label="Optional administrative note"
              />
            </>
          )}

          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
