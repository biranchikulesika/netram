import { getFacility, getFacilityCorrectiveActions, getFacilityInspections } from "../../../../../lib/facility";
import { CorrectiveActionsLayout } from "../../../corrective-actions/corrective-actions-layout";

export const dynamic = "force-dynamic";

export default async function FacilityActionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const inspections = await getFacilityInspections(project.id);
  const actions = await getFacilityCorrectiveActions(project.id, inspections);

  const actionsWithProject = actions.map((a) => ({
    ...a,
    project: a.project ?? {
      id: project.id,
      code: project.code,
      name: project.name,
      districtId: project.districtId,
      districtName: null,
      stateName: null,
      description: project.description,
    },
  }));

  return (
    <section>
      <CorrectiveActionsLayout
        initialActions={actionsWithProject}
        totalActions={actionsWithProject.length}
        showMap={false}
        showProjectInfo={false}
      />
    </section>
  );
}