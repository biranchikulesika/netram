import Link from "next/link";
import type { ActionInboxItem, FindingSeverity, OrganisationView } from "@netram/types";
import { formatDate } from "../../../lib/presentation";
import { OrderCorrectiveActionButton } from "../../components/order-corrective-action-button";
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
 * write path. Only self-contained decisions may be taken from the card: the
 * whole change is visible in the summary (attendance correction before/after),
 * or the decision popup itself carries the full record (expenditure payment
 * verification, see ExpenseVerifyPopup). Anything whose wider record
 * materially informs the decision (facility registration, ATR review, finding
 * review) offers no inline options and routes into its page instead.
 */
export function quickActionsFor(item: ActionInboxItem): InboxAction[] {
  switch (item.kind) {
    case "attendance_correction_approval":
      return [
        { label: "Verify", kind: "approve", endpoint: `/api/v1/attendance/corrections/${item.id}/decide`, body: { decision: "approve" } },
        { label: "Reject", kind: "reject", endpoint: `/api/v1/attendance/corrections/${item.id}/decide`, body: { decision: "reject" } },
      ];
    default:
      // Record-required kinds and expense_verification (popup-decided): no
      // inline write CTAs.
      return [];
  }
}

/** Verify-payment action for an expenditure, staged through the confirm modal. */
export function expenseVerifyAction(item: ActionInboxItem): InboxAction {
  return {
    label: "Verify",
    kind: "approve",
    endpoint: `/api/v1/funds/expenses/${item.id}/verify`,
    body: {},
  };
}

/** Reject-payment action for an expenditure, with the stated reason. */
export function expenseRejectAction(item: ActionInboxItem, reason: string): InboxAction {
  return {
    label: "Reject",
    kind: "reject",
    endpoint: `/api/v1/funds/expenses/${item.id}/reject`,
    body: { reason },
  };
}

export interface ActionInboxCardProps {
  item: ActionInboxItem;
  state: ActionInboxCardState;
  /** Opens the type-to-confirm modal; execution happens after confirmation. */
  onAction: (item: ActionInboxItem, action: InboxAction) => void;
  /** Opens the verify-payment popup for expenditure items. */
  onVerifyPayment?: (item: ActionInboxItem) => void;
  /** Responsible-organisation options for the remediation-order dialog. */
  organisations?: OrganisationView[];
}

/** Reads a context value the server may legitimately omit (§34). */
function ctxString(item: ActionInboxItem, key: string): string | null {
  const v = item.context[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * One pending-decision item rendered in the shared facility-card language
 * (same card family as the complaints grid), with per-kind decision CTAs.
 */
export function ActionInboxCard({
  item,
  state,
  onAction,
  onVerifyPayment,
  organisations = [],
}: ActionInboxCardProps) {
  const actions = quickActionsFor(item);
  // Confirmed findings awaiting remediation expose the order itself, so the
  // authority does not have to leave the inbox to act (§32).
  const inspectionId = item.kind === "finding_review" ? ctxString(item, "inspectionId") : null;
  const remediation = item.kind === "finding_review" ? ctxString(item, "remediation") : null;
  const canOrderFinding = Boolean(inspectionId) && !state.done;

  return (
    <article
      className="facility-card"
      style={state.done ? { opacity: 0.45, pointerEvents: "none" } : undefined}
      aria-label={item.title}
    >
      <Link
        href={item.link.href}
        className="facility-card-link"
        aria-label={item.link.label}
      >
        <h3 className="facility-card-title">{item.title}</h3>

        <p className="facility-card-desc">{item.summary}</p>

        {remediation && (
          <p className="facility-card-desc" style={{ marginTop: "-0.35rem" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Required remediation:</span>{" "}
            {remediation}
          </p>
        )}

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
              <dt title="Amount (INR)" aria-label="Amount in Indian rupees">
                <IconIndianRupee className="meta-label-icon" style={{ color: "#137e3a" }} />
              </dt>
              <dd style={{ fontWeight: 700, color: "#137e3a" }}>
                {item.amountInr.toLocaleString("en-IN")}
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
        {item.kind === "expense_verification" && onVerifyPayment && (
          <button
            type="button"
            className="ai-btn ai-btn-approve"
            disabled={state.done}
            onClick={() => onVerifyPayment(item)}
          >
            {state.busy ? (
              <AiSpinner />
            ) : (
              <IconIndianRupee width={14} height={14} />
            )}
            Verify payment
          </button>
        )}
        {canOrderFinding && inspectionId && (
          <OrderCorrectiveActionButton
            finding={{
              id: item.id,
              // The inbox widens severity to `string` across kinds; for
              // finding_review it is always a FindingSeverity.
              severity: (item.severity ?? "low") as FindingSeverity,
              description: item.summary,
              remediation,
            }}
            inspectionId={inspectionId}
            project={{
              name: item.project.name ?? "",
              code: item.project.code ?? "",
              organisationId: ctxString(item, "organisationId"),
            }}
            organisations={organisations}
          />
        )}
        <Link
          href={item.link.href}
          className="ai-open-btn"
          title={`Open the full record before deciding`}
        >
          {item.link.label}
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
