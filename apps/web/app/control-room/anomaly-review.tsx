/** @jsxRuntime automatic */
import type { AttendanceAnomaly, AttendanceReviewAction } from "@netram/types";

interface AnomalyReviewProps {
  anomaly: AttendanceAnomaly;
  onReview: (action: AttendanceReviewAction, note?: string) => void;
  onClose: () => void;
}

const REVIEW_ACTIONS: { action: AttendanceReviewAction; label: string; description: string }[] = [
  { action: "acknowledge", label: "Acknowledge", description: "Mark as reviewed — monitoring continues" },
  { action: "dismiss", label: "Dismiss", description: "False alarm — no further action" },
  { action: "false_positive", label: "False Positive", description: "Confirmed not an anomaly" },
  { action: "investigate", label: "Investigate", description: "Escalate for field verification" },
  { action: "actioned", label: "Actioned", description: "Corrective action taken" },
];

function severityColor(severity: string): string {
  return {
    LOW: "#22c55e",
    MEDIUM: "#eab308",
    HIGH: "#f97316",
    CRITICAL: "#ef4444",
  }[severity] ?? "#6b7280";
}

export function AnomalyReviewPanel({ anomaly, onReview, onClose }: AnomalyReviewProps) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "1.25rem",
        marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#1e293b" }}>
            Review Anomaly
          </h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
            {anomaly.projectCode && `#${anomaly.projectCode}`} · {anomaly.anomalyType.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.25rem",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "0.25rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem", marginBottom: "1rem", fontSize: "0.85rem" }}>
        <span style={{ color: "#64748b" }}>State:</span>
        <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", color: severityColor(anomaly.severity) }}>
          {anomaly.state}
        </span>
        <span style={{ color: "#64748b" }}>Severity:</span>
        <span style={{ fontWeight: 600, color: severityColor(anomaly.severity) }}>
          {anomaly.severity}
        </span>
        <span style={{ color: "#64748b" }}>Score:</span>
        <span style={{ fontWeight: 600 }}>{Math.round(anomaly.score * 100)}%</span>
        <span style={{ color: "#64748b" }}>Confidence:</span>
        <span style={{ fontWeight: 600 }}>{Math.round(anomaly.confidence * 100)}%</span>
        {anomaly.projectCode && (
          <>
            <span style={{ color: "#64748b" }}>Project:</span>
            <span>{anomaly.projectCode}</span>
          </>
        )}
        {anomaly.operationalDate && (
          <>
            <span style={{ color: "#64748b" }}>Op Day:</span>
            <span>{anomaly.operationalDate}</span>
          </>
        )}
      </div>

      {anomaly.supportingSignals && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "0.75rem",
            marginBottom: "1rem",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#475569" }}>
            Supporting Signals
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.75rem",
              color: "#64748b",
              margin: 0,
            }}
          >
            {JSON.stringify(anomaly.supportingSignals, null, 2)}
          </pre>
        </div>
      )}

      {anomaly.reviewNotes && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "6px",
            padding: "0.75rem",
            marginBottom: "1rem",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#16a34a" }}>
            Review Notes
          </div>
          <div style={{ color: "#475569", whiteSpace: "pre-wrap" }}>
            {anomaly.reviewNotes}
          </div>
          {anomaly.reviewedAt && (
            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.25rem" }}>
              Reviewed {new Date(anomaly.reviewedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem", color: "#334155" }}>
        Take action:
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {REVIEW_ACTIONS.map((a) => (
          <button
            key={a.action}
            onClick={() => onReview(a.action)}
            style={{
              flex: "1 1 140px",
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              padding: "0.6rem 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "#334155",
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

      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem", color: "#334155" }}>
          Add note (optional):
        </div>
        <textarea
          id="review-note"
          rows={3}
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
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
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "0.5rem",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "#334155",
          }}
        >
          Save Note
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: "#e2e8f0",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "#475569",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AnomalyReviewActions({ anomaly, actions }: { anomaly: AttendanceAnomaly; actions: Array<{ action: string; note?: string; createdAt: string }> }) {
  if (actions.length === 0) return null;

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        padding: "0.75rem",
        marginTop: "1rem",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#475569" }}>
        Review History ({actions.length})
      </div>
      {actions.map((a, i) => (
        <div
          key={i}
          style={{
            padding: "0.4rem 0",
            borderBottom: i < actions.length - 1 ? "1px solid #e2e8f0" : "none",
          }}
        >
          <div style={{ fontWeight: 500, textTransform: "uppercase", fontSize: "0.7rem", color: severityColor(anomaly.severity) }}>
            {a.action}
          </div>
          {a.note && (
            <div style={{ color: "#475569", marginTop: "0.15rem", whiteSpace: "pre-wrap" }}>
              {a.note}
            </div>
          )}
          <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: "0.15rem" }}>
            {new Date(a.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
