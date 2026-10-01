/** @jsxRuntime automatic */
import type { AttendanceAnomaly, AttendanceReviewAction } from "@netram/types";
import { formatDateTime } from "../../../lib/presentation";

interface AnomalyReviewProps {
  anomaly: AttendanceAnomaly;
  onReview: (action: AttendanceReviewAction, note?: string) => void;
  onClose: () => void;
}

const REVIEW_ACTIONS: { action: AttendanceReviewAction; label: string; description: string }[] = [
  {
    action: "acknowledge",
    label: "Acknowledge",
    description: "Mark as reviewed - monitoring continues",
  },
  { action: "dismiss", label: "Dismiss", description: "False alarm - no further action" },
  { action: "false_positive", label: "False Positive", description: "Confirmed not an anomaly" },
  { action: "investigate", label: "Investigate", description: "Escalate for field verification" },
  { action: "actioned", label: "Actioned", description: "Corrective action taken" },
];

function severityColor(severity: string): string {
  return (
    {
      LOW: "#137e3a",
      MEDIUM: "#dd501e",
      HIGH: "#dd501e",
      CRITICAL: "#dc2626",
    }[severity] ?? "var(--text-muted)"
  );
}

export function AnomalyReviewPanel({ anomaly, onReview, onClose }: AnomalyReviewProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "8px",
        padding: "1.25rem",
        marginTop: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#002449" }}>Review Anomaly</h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--text-subtle)" }}>
            {anomaly.projectCode && `#${anomaly.projectCode}`} ·{" "}
            {anomaly.anomalyType.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.25rem",
            color: "var(--text-subtle)",
            cursor: "pointer",
            padding: "0.25rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.5rem",
          marginBottom: "1rem",
          fontSize: "0.85rem",
        }}
      >
        <span style={{ color: "var(--text-subtle)" }}>State:</span>
        <span
          style={{
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: "0.75rem",
            color: severityColor(anomaly.severity),
          }}
        >
          {anomaly.state}
        </span>
        <span style={{ color: "var(--text-subtle)" }}>Severity:</span>
        <span style={{ fontWeight: 600, color: severityColor(anomaly.severity) }}>
          {anomaly.severity}
        </span>
        <span style={{ color: "var(--text-subtle)" }}>Basis:</span>
        <span>
          {anomaly.anomalyType === "PERSISTENT_LOW_ATTENDANCE" &&
          typeof anomaly.supportingSignals?.streakDays === "number"
            ? `Attendance below expected for ${anomaly.supportingSignals.streakDays} consecutive days`
            : anomaly.anomalyType === "HISTORICAL_DEVIATION"
              ? "Attendance deviates from the project's recent baseline"
              : anomaly.anomalyType === "CROSS_SOURCE_DISCREPANCY"
                ? "Discrepancy between biometric and reported attendance"
                : anomaly.anomalyType === "SOURCE_QUALITY"
                  ? "Insufficient source coverage; result has reduced reliability"
                  : anomaly.anomalyType.replace(/_/g, " ")}
        </span>
        {anomaly.projectCode && (
          <>
            <span style={{ color: "var(--text-subtle)" }}>Project:</span>
            <span>{anomaly.projectCode}</span>
          </>
        )}
        {anomaly.operationalDate && (
          <>
            <span style={{ color: "var(--text-subtle)" }}>Op Day:</span>
            <span>{anomaly.operationalDate}</span>
          </>
        )}
      </div>

      {anomaly.reviewNotes && (
        <div
          style={{
            background: "var(--tint-green)",
            border: "1px solid var(--tint-green)",
            borderRadius: "6px",
            padding: "0.75rem",
            marginBottom: "1rem",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#137e3a" }}>
            Review Notes
          </div>
          <div style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
            {anomaly.reviewNotes}
          </div>
          {anomaly.reviewedAt && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-subtle)", marginTop: "0.25rem" }}>
              Reviewed {formatDateTime(anomaly.reviewedAt)}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          fontWeight: 600,
          fontSize: "0.85rem",
          marginBottom: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        Take action:
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {REVIEW_ACTIONS.map((a) => (
          <button
            key={a.action}
            onClick={() => onReview(a.action)}
            style={{
              flex: "1 1 140px",
              background: "#edf0f5",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "6px",
              padding: "0.6rem 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "var(--text-muted)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            title={a.description}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "0.75rem" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            marginBottom: "0.5rem",
            color: "var(--text-muted)",
          }}
        >
          Add note (optional):
        </div>
        <textarea
          id="review-note"
          rows={3}
          style={{
            width: "100%",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "6px",
            padding: "0.5rem",
            fontSize: "0.85rem",
            resize: "vertical",
            fontFamily: "inherit",
          }}
          placeholder="Add review notes…"
        />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button
          onClick={() => {
            const note = (document.getElementById("review-note") as HTMLTextAreaElement).value;
            onReview("note", note || undefined);
          }}
          style={{
            flex: 1,
            background: "#edf0f5",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "6px",
            padding: "0.5rem",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          Save Note
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: "var(--color-border-subtle)",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AnomalyReviewActions({
  anomaly,
  actions,
}: {
  anomaly: AttendanceAnomaly;
  actions: Array<{ action: string; note?: string; createdAt: string }>;
}) {
  if (actions.length === 0) return null;

  return (
    <div
      style={{
        background: "#edf0f5",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "6px",
        padding: "0.75rem",
        marginTop: "1rem",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-muted)" }}>
        Review History ({actions.length})
      </div>
      {actions.map((a, i) => (
        <div
          key={i}
          style={{
            padding: "0.4rem 0",
            borderBottom: i < actions.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
          }}
        >
          <div
            style={{
              fontWeight: 500,
              textTransform: "uppercase",
              fontSize: "0.7rem",
              color: severityColor(anomaly.severity),
            }}
          >
            {a.action}
          </div>
          {a.note && (
            <div
              style={{ color: "var(--text-muted)", marginTop: "0.15rem", whiteSpace: "pre-wrap" }}
            >
              {a.note}
            </div>
          )}
          <div style={{ fontSize: "0.65rem", color: "var(--text-subtle)", marginTop: "0.15rem" }}>
            {formatDateTime(a.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
