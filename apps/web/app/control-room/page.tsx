import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { ControlRoomLayout } from "./control-room-layout";

export const dynamic = "force-dynamic";

export default async function ControlRoomPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();

  const [camerasPage, anomaliesPage, districts] = await Promise.all([
    client
      .listCameras({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listAiAnomalies({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client.listRegistryDistricts().catch(() => []),
  ]);

  const districtNames: Record<string, string> = {};
  for (const d of districts) districtNames[d.id] = d.name;

  const canTransition = session.permissions.includes("ai:anomaly:transition");

  // Exact camera → project links from the camera's own projectId (migration 0012).
  const cameraProjectLinks: Record<string, string> = {};
  for (const cam of camerasPage.items) {
    if (cam.projectId) cameraProjectLinks[cam.id] = `/projects/${cam.projectId}`;
  }

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="control-room"
      />

      <ControlRoomLayout
        cameras={camerasPage.items}
        anomalies={anomaliesPage.items}
        anomaliesTotal={anomaliesPage.total}
        canTransition={canTransition}
        cameraProjectLinks={cameraProjectLinks}
        districtNames={districtNames}
      />
    </main>
  );
}

