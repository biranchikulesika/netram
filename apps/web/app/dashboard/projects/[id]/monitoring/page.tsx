import { notFound } from "next/navigation";
import {
  getDistrictCameras,
  getFacility,
  getFacilityAiAnomalies,
} from "../../../../../lib/facility";
import { getClient, getSessionUser } from "../../../../../lib/api";
import { canAny } from "../../../../../lib/permissions";
import { ControlRoomLayout } from "../../../control-room/control-room-layout";

export const dynamic = "force-dynamic";

export default async function FacilityMonitoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // AI signals and CCTV coverage are oversight-side intelligence: institutions
  // are never shown them, on any entry path (§34 — omission, not hiding).
  const session = await getSessionUser();
  if (!session || !canAny(session.permissions, ["cctv:read", "ai:anomaly:read"])) notFound();

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const client = await getClient();
  const [anomalies, districtCameras, districts] = await Promise.all([
    getFacilityAiAnomalies(project.id),
    getDistrictCameras(project.districtId),
    client.listRegistryDistricts().catch(() => []),
  ]);

  const districtNames: Record<string, string> = {};
  for (const d of districts) districtNames[d.id] = d.name;
  if (project.districtId && project.districtName) {
    districtNames[project.districtId] = project.districtName;
  }

  const facilityCameras = districtCameras.filter((c) => c.projectId === project.id);
  const cameras = facilityCameras.length > 0 ? facilityCameras : districtCameras;

  const canTransition =
    session.permissions.includes("ai:anomaly:transition") || session.permissions.includes("*");

  return (
    <section>
      <ControlRoomLayout
        cameras={cameras}
        anomalies={anomalies}
        anomaliesTotal={anomalies.length}
        canTransition={canTransition}
        districtNames={districtNames}
      />
    </section>
  );
}
