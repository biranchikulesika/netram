import Link from "next/link";
import type { CorrectiveAction, Finding, OrganisationView } from "@netram/types";
import { formatDate } from "../../../../lib/presentation";
import { IconGavel } from "../../../components/icons";
import { OrderCorrectiveActionButton } from "../../../components/order-corrective-action-button";

export interface FindingsSectionProps {
  items: Finding[];
  inspectionId: string;
  project: { name: string; code: string; organisationId: string | null } | null;
  organisations: OrganisationView[];
  canOrder: boolean;
  caByFindingId: Record<string, CorrectiveAction>;
}

export function FindingsSection({
  items,
  inspectionId,
  project,
  organisations,
  canOrder,
  caByFindingId,
}: FindingsSectionProps) {
  return (
    <section className="findings-section">
      <div className="section-title-row">
        <div>
          <h3>Formal Findings</h3>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconGavel width={20} height={20} />
          </div>
          <div className="empty-state-title">No formal findings</div>
          <p className="empty-state-sub">
            Authority-reviewed compliance issues and remediation orders will appear here.
          </p>
        </div>
      ) : (
        <div className="findings-list">
          {items.map((f) => {
            const existingCa = caByFindingId[f.id];
            const canOrderFinding = canOrder && f.status === "confirmed" && !existingCa;
            const showButton = Boolean(existingCa || canOrderFinding);

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

                {showButton && (
                  <div
                    style={{
                      marginTop: "0.85rem",
                      paddingTop: "0.65rem",
                      borderTop: "1px dashed #e2e8f0",
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    {canOrderFinding ? (
                      <OrderCorrectiveActionButton
                        finding={{
                          id: f.id,
                          severity: f.severity,
                          description: f.description,
                          remediation: f.remediation,
                        }}
                        inspectionId={inspectionId}
                        project={
                          project && {
                            name: project.name,
                            code: project.code,
                            organisationId: project.organisationId,
                          }
                        }
                        organisations={organisations}
                      />
                    ) : (
                      <Link
                        href={existingCa ? `/dashboard/corrective-actions/${existingCa.id}` : "/dashboard/corrective-actions"}
                        className="btn-secondary"
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.6rem",
                          textDecoration: "none",
                          color: "var(--color-navy-brand)",
                          fontWeight: 600,
                        }}
                      >
                        View Remediation Order →
                      </Link>
                    )}
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