import { getFacility, getFacilityInspections } from "../../../../../lib/facility";
import { getSessionUser } from "../../../../../lib/api";
import { FacilityInspectionsTable } from "./facility-inspections-table";

export const dynamic = "force-dynamic";

export default async function FacilityInspectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canCreate = permissions.includes("inspection:create") || permissions.includes("*");

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const inspections = await getFacilityInspections(project.id);

  return (
    <section>
      <FacilityInspectionsTable
        inspections={inspections}
        project={{
          id: project.id,
          name: project.name,
          code: project.code,
          districtId: project.districtId,
        }}
        canCreate={canCreate}
      />
    </section>
  );
}
