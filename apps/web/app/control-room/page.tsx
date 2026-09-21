import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { ControlRoomLayout } from "./control-room-layout";

export const dynamic = "force-dynamic";

/**
 * Resolve each camera to the project whose name contains its facility (within
 * the same district) for the facility-name → project-details link.
 * Cameras currently carry only districtId, no projectId.
 */
function resolveCameraProjectLinks(
  cameras: { id: string; name: string; districtId: string | null }[],
  projects: { id: string; name: string; districtId: string | null }[],
): Record<string, string> {
  const links: Record<string, string> = {};
  for (const cam of cameras) {
    const facility = cam.name.split(" - ")[0]?.trim().toLowerCase() ?? "";
    if (!facility) continue;
    const matches = projects.filter(
      (p) =>
        p.districtId === cam.districtId &&
        p.name.toLowerCase().includes(facility),
    );
    if (matches.length === 1 && matches[0]) {
      links[cam.id] = `/projects/${matches[0].id}`;
    }
  }
  return links;
}

export default async function ControlRoomPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();

  const [camerasPage, anomaliesPage, projectsPage] = await Promise.all([
    client
      .listCameras({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listAiAnomalies({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listProjects({ pageSize: 200 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 200 })),
  ]);

  const canTransition = session.permissions.includes("ai:anomaly:transition");

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
        cameraProjectLinks={resolveCameraProjectLinks(camerasPage.items, projectsPage.items)}
      />
    </main>
  );
}

