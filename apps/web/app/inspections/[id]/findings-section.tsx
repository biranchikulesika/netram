import type { Finding } from "@netram/types";
import { formatDate } from "../../../lib/presentation";

export interface FindingsSectionProps {
  items: Finding[];
}

export function FindingsSection({ items }: FindingsSectionProps) {
  return (
    <section className="findings-section">
      <div className="section-title-row">
        <div>
          <h3>Formal Findings</h3>
          <p className="muted">Authority-reviewed compliance issues and remediation orders</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-box">No formal findings recorded for this inspection.</div>
      ) : (
        <div className="findings-list">
          {items.map((f) => {
            return (
              <article key={f.id} className={`finding-item severity-${f.severity}`}>
                <div className="finding-header">
                  <div className="finding-badges">
                    <span className={`badge-severity ${f.severity}`}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className={`badge-status ${f.status}`}>{f.status.replace("_", " ")}</span>
                  </div>
                  <span className="finding-time">{formatDate(f.createdAt)}</span>
                </div>

                <p className="finding-desc">{f.description}</p>

                {f.remediation && (
                  <div className="remediation-box">
                    <span className="remediation-label">Required Remediation:</span>
                    <p className="remediation-text">{f.remediation}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
