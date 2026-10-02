import { notFound, redirect } from "next/navigation";
import { getCachedSessionUser } from "../../../../lib/api";
import { can } from "../../../../lib/permissions";
import { getFacility, getFacilityRiskSnapshot } from "../../../../lib/facility";
import { NavHeader } from "../../../components/nav-header";
import { FacilityShell } from "./facility-shell";

export const dynamic = "force-dynamic";

export default async function FacilityLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const session = await getCachedSessionUser();
  if (!session) redirect("/login");
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) notFound();

  // The health gauge is authority-side oversight information (§34): the
  // snapshot is fetched only for viewers holding project_risk:read and is
  // never sent to anyone else. Institutions see no gauge at all - not even a
  // placeholder, since its absence would itself hint that a score exists.
  const canViewRisk = can(session.permissions, "project_risk:read");
  const snapshot = canViewRisk ? await getFacilityRiskSnapshot(project.id) : null;

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="projects"
      />

      <div className="facility-page">
        {/* Facility identity + section tabs - one compact shell */}
        <FacilityShell
          project={project}
          permissions={session.permissions}
          riskSnapshot={snapshot}
          canViewRisk={canViewRisk}
        />

        <div className="facility-content">{children}</div>
      </div>
    </main>
  );
}
