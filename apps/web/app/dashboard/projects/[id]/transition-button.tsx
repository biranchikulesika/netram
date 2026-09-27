"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PROJECT_TRANSITIONS } from "@netram/types";
import type { ProjectStatus } from "@netram/types";
import { IconChevronRight, IconSettings } from "../../../components/icons";

interface TransitionButtonProps {
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
 * Lifecycle transition control for the facility status strip. Deliberately
 * unobtrusive (a "⋯" overflow control): a lifecycle transition happens once
 * in the facility's lifetime, so it must not compete with day-to-day readouts.
 * Discoverable via tooltip + aria-label; opens a popover listing only the
 * states the regulatory lifecycle permits from here (§33). Requests are
 * proxied through the Next.js route handler so the httpOnly session token
 * authorizes the call, and the API re-enforces the transition rule
 * server-side.
 */
export function TransitionButton({ projectId, currentStatus }: TransitionButtonProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const allowedNext = PROJECT_TRANSITIONS[currentStatus] || [];

  // Close on outside click or Escape — the previous version only closed via
  // the trigger, leaving the popover stuck open over page content.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleTransition(to: ProjectStatus) {
    if (!window.confirm(`Transition this facility to '${to}'? This action is audited.`)) {
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
    <div className="transition-pop" ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="transition-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Lifecycle transition (administrative action)"
        title="Lifecycle transition — rare administrative action"
        onClick={() => setOpen((v) => !v)}
      >
        <IconSettings width={14} height={14} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Project lifecycle transition"
          className="transition-pop-panel"
        >
          <div className="transition-pop-title">Lifecycle transition</div>

          <div className="transition-current-row">
            <span className="transition-current">{currentStatus}</span>
            <IconChevronRight width={12} height={12} style={{ flex: "none" }} />
            <span className="transition-current-hint">
              {allowedNext.length} permitted state{allowedNext.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="transition-options">
            {allowedNext.map((nextStatus) => (
              <button
                key={nextStatus}
                type="button"
                disabled={busy}
                onClick={() => handleTransition(nextStatus)}
                className={`transition-option ${FORWARD_STATUSES.has(nextStatus) ? "forward" : ""}`}
              >
                <span className="transition-option-name">{nextStatus}</span>
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
