import { notFound } from "next/navigation";
import { getSessionUser } from "../../../../../lib/api";
import { can } from "../../../../../lib/permissions";
import { getFacility, getFacilityAudit, getUserNames } from "../../../../../lib/facility";
import { AuditExplorerView } from "../../../audit/audit-explorer-view";

export const dynamic = "force-dynamic";

/**
 * Facility activity tab - the audit trail for this facility.
 *
 * Accessible only to viewers holding `audit:read` (authorities, auditors,
 * system administrators). Institutions never see who did what: the tab is
 * absent from the navigation and no audit events are fetched (§34 -
 * omission, not hiding; §37 - audit is authority-side oversight).
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

  const [audit, userNames] = await Promise.all([getFacilityAudit(project.id), getUserNames()]);

  return (
    <section>
      <AuditExplorerView initialEvents={audit} initialTotal={audit.length} userNames={userNames} />
    </section>
  );
}
