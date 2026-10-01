import { getFacility, getFacilityComplaints } from "../../../../../lib/facility";
import { ComplaintsLayout } from "../../../complaints/complaints-layout";

export const dynamic = "force-dynamic";

export default async function FacilityComplaintsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const complaints = await getFacilityComplaints(project.id);

  return (
    <section>
      <ComplaintsLayout
        initialComplaints={complaints}
        totalComplaints={complaints.length}
        showMap={false}
        showProjectInfo={false}
      />
    </section>
  );
}
