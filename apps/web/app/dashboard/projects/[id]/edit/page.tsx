import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "../../../../../lib/api";
import { getFacility, getFacilityPhotos } from "../../../../../lib/facility";
import { ProjectRegistrationView } from "../../new/project-registration-view";

export const dynamic = "force-dynamic";

const EDITABLE_STATUSES = new Set(["Draft", "Pending Verification"]);

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) notFound();

  const canEdit = session.permissions.includes("project:create");
  if (!canEdit || !EDITABLE_STATUSES.has(project.status)) {
    redirect(`/dashboard/projects/${id}`);
  }

  const canApprove = session.permissions.includes("project:approve");
  const photos = await getFacilityPhotos(id);

  return (
    <ProjectRegistrationView
      userEmail={session.user.email}
      canCreate={canEdit}
      canApprove={canApprove}
      isAuthority={canApprove}
      isInstitutionAdmin={canEdit && !canApprove}
      mode="edit"
      initialProject={project}
      initialPhotos={photos}
    />
  );
}
