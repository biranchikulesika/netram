import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/api";
import { NavHeader } from "../../../components/nav-header";
import { ProjectRegistrationView } from "./project-registration-view";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const canCreate = session.permissions.includes("project:create");
  const canApprove = session.permissions.includes("project:approve");
  const isAuthority = canApprove;
  const isInstitutionAdmin = canCreate && !canApprove;

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="projects"
      />

      <ProjectRegistrationView
        userEmail={session.user.email}
        canCreate={canCreate}
        canApprove={canApprove}
        isAuthority={isAuthority}
        isInstitutionAdmin={isInstitutionAdmin}
      />
    </main>
  );
}
