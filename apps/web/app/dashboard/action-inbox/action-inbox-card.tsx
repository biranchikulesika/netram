import Link from "next/link";
import type { ActionInboxItem } from "@netram/types";
import { formatDate } from "../../../lib/presentation";
import {
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconIndianRupee,
  IconUser,
  IconX,
} from "../../components/icons";

export interface ActionInboxCardState {
  busy: boolean;
  error: string | null;
  done: boolean;
}

export interface InboxAction {
  label: string;
  kind: "approve" | "reject";
  endpoint: string;
  body: Record<string, unknown>;
}

/** Inline decision-in-flight spinner for CTA buttons. */
function AiSpinner() {
  return (
    <svg
      className="ai-btn-spinner"
      viewBox="0 0 24 24"
      fill="none"
      width={14}
      height={14}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Quick decision CTAs per kind — every endpoint is the workflow's own canonical
 * write path. Labels are short (≤8 chars) so Verify + Reject + Open fit on one
 * line inside a grid card.
 */
export function quickActionsFor(item: ActionInboxItem): InboxAction[] {
  switch (item.kind) {
    case "project_verification":
      return [
        { label: "Verify", kind: "approve", endpoint: `/api/projects/${item.id}/transition`, body: { to: "Approved" } },
        { label: "Reject", kind: "reject", endpoint: `/api/projects/${item.id}/transition`, body: { to: "Draft" } },
      ];
    case "corrective_action_review":
      return [
        { label: "Accept", kind: "approve", endpoint: `/api/corrective-actions/${item.id}/review`, body: { outcome: "accepted" } },
        { label: "Reject", kind: "reject", endpoint: `/api/corrective-actions/${item.id}/review`, body: { outcome: "rejected" } },
      ];
    case "expense_verification":
      return [
        { label: "Verify", kind: "approve", endpoint: `/api/v1/funds/expenses/${item.id}/verify`, body: {} },
        { label: "Reject", kind: "reject", endpoint: `/api/v1/funds/expenses/${item.id}/reject`, body: { reason: "Rejected from Action Inbox" } },
      ];
    case "attendance_correction_approval":
      return [
        { label: "Verify", kind: "approve", endpoint: `/api/v1/attendance/corrections/${item.id}/decide`, body: { decision: "approve" } },
        { label: "Reject", kind: "reject", endpoint: `/api/v1/attendance/corrections/${item.id}/decide`, body: { decision: "reject" } },
      ];
    default:
      return [];
  }
}

export interface ActionInboxCardProps {
  item: ActionInboxItem;
  state: ActionInboxCardState;
  onAction: (item: ActionInboxItem, action: InboxAction) => void;
}

/**
 * One pending-decision item rendered in the shared facility-card language
 * (same card family as the complaints grid), with per-kind decision CTAs.
 */
export function ActionInboxCard({ item, state, onAction }: ActionInboxCardProps) {
  const actions = quickActionsFor(item);

  return (
    <article
      className="facility-card"
      style={state.done ? { opacity: 0.45, pointerEvents: "none" } : undefined}
      aria-label={item.title}
    >
      <Link href={item.link.href} className="facility-card-link" aria-label={`Open ${item.link.label}`}>
        <h3 className="facility-card-title">{item.title}</h3>

        <p className="facility-card-desc">{item.summary}</p>

        <dl className="facility-card-meta">
          <div className="facility-card-meta-item">
            <dt title="Facility" aria-label="Facility">
              <IconBuilding className="meta-label-icon" />
            </dt>
            <dd>
              {item.project.name || item.project.code
                ? `${item.project.name ?? ""}${item.project.name && item.project.code ? ` (${item.project.code})` : item.project.code ?? ""}`
                : "No facility linked"}
            </dd>
          </div>

          {item.actor?.name && (
            <div className="facility-card-meta-item">
              <dt title="Submitted by" aria-label="Submitted by">
                <IconUser className="meta-label-icon" />
              </dt>
              <dd>{item.actor.name}</dd>
            </div>
          )}

          {item.amountInr !== null && (
            <div className="facility-card-meta-item">
              <dt title="Amount" aria-label="Amount">
                <IconIndianRupee className="meta-label-icon" style={{ color: "#15803d" }} />
              </dt>
              <dd style={{ fontWeight: 700, color: "#15803d" }}>
                ₹{item.amountInr.toLocaleString("en-IN")}
              </dd>
            </div>
          )}

          <div className="facility-card-meta-item">
            <dt title="Queued" aria-label="Queued">
              <IconClock className="meta-label-icon" />
            </dt>
            <dd>
              {formatDate(item.queuedAt)}
              {item.deadline ? ` · due ${formatDate(item.deadline)}` : ""}
            </dd>
          </div>
        </dl>
      </Link>

      <div className="ai-card-actions">
        {actions.map((a) => {
          const isBusy = state.busy;
          return (
            <button
              key={a.label}
              type="button"
              className={`ai-btn ${
                a.kind === "approve" ? "ai-btn-approve" : "ai-btn-reject"
              } ${state.done ? "ai-btn-done" : ""}`}
              disabled={state.done}
              onClick={() => onAction(item, a)}
            >
              {isBusy ? (
                <AiSpinner />
              ) : a.kind === "approve" ? (
                <IconCheck width={14} height={14} />
              ) : (
                <IconX width={14} height={14} />
              )}
              {a.label}
            </button>
          );
        })}
        <Link
          href={item.link.href}
          className="ai-open-btn"
          title={`Open the full dossier before deciding`}
        >
          Open
          <IconChevronRight width={13} height={13} />
        </Link>
      </div>

      {state.error && (
        <div className="ai-card-error" role="alert" style={{ padding: "0 1.1rem 0.7rem" }}>
          {state.error}
        </div>
      )}
    </article>
  );
}
