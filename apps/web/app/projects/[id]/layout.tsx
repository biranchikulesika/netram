import { notFound, redirect } from "next/navigation";
import { getCachedSessionUser } from "../../../lib/api";
import { getFacility } from "../../../lib/facility";
import { NavHeader } from "../../components/nav-header";
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

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="projects"
      />

      <div className="facility-page">
        {/* Facility identity + section tabs — one compact shell */}
        <FacilityShell project={project} permissions={session.permissions} />

        <div className="facility-content">{children}</div>
      </div>
    </main>
  );
}