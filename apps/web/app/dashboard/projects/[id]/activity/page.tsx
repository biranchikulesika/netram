import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "../../../../../lib/api";
import { can } from "../../../../../lib/permissions";
import { getFacility, getFacilityAudit, getUserNames } from "../../../../../lib/facility";
import { formatDateTime } from "../../../../../lib/presentation";
import { TransitionButton } from "../transition-button";

export const dynamic = "force-dynamic";

/**
 * Facility activity tab — the audit trail for this facility.
 *
 * Accessible only to viewers holding `audit:read` (authorities, auditors,
 * system administrators). Institutions never see who did what: the tab is
 * absent from the navigation and no audit events are fetched (§34 —
 * omission, not hiding; §37 — audit is authority-side oversight).
 */
export default async function FacilityActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !can(session.permissions, "audit:read")) notFound();

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) notFound();

  const [audit, userNames] = await Promise.all([
    getFacilityAudit(project.id),
    getUserNames(),
  ]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>
            Activity <span className="count-chip">{audit.length}</span>
          </h2>
          <p className="muted">
            Recorded administrative activity for this facility — append-only audit trail (§37).
          </p>
        </div>
        <div className="section-header-stats">
          <Link
            className="btn-secondary"
            href="/dashboard/audit"
            style={{ textDecoration: "none" }}
          >
            Full audit log
          </Link>
          {/*
           * Rare lifecycle action lives beside the audit trail by design: the
           * page enforcing its accountability hosts its only entry point.
           * The API independently re-enforces project:transition / project:approve
           * and jurisdiction server-side; this gate is presentational only.
           */}
          {(can(session.permissions, "project:transition") ||
            can(session.permissions, "project:approve")) && (
            <TransitionButton projectId={project.id} currentStatus={project.status} />
          )}
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "220px" }}>Action</th>
              <th>Actor</th>
              <th style={{ width: "220px" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                    No recorded activity for this facility yet.
                  </div>
                </td>
              </tr>
            ) : (
              audit.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="badge badge-routine">{e.action}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {e.actorUserId ? (userNames[e.actorUserId] ?? "Authority officer") : "Automated system"}
                  </td>
                  <td className="muted">{formatDateTime(e.occurredAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
