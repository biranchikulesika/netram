import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { ControlRoomLayout } from "./control-room-layout";

export const dynamic = "force-dynamic";

export default async function ControlRoomPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();

  const [camerasPage, anomaliesPage] = await Promise.all([
    client
      .listCameras({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listAiAnomalies({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
  ]);

<<<<<<< HEAD
=======
  const canTransition = session.permissions.includes("ai:anomaly:transition");

>>>>>>> origin/production
  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="control-room"
      />

      <div className="section-header" style={{ marginBottom: "1.25rem" }}>
        <div>
<<<<<<< HEAD
          <h2>Control Room &amp; Live Surveillance</h2>
=======
          <h2>Control Room</h2>
>>>>>>> origin/production
          <p className="muted">Live surveillance feeds, camera endpoints, and advisory anomaly oversight</p>
        </div>
      </div>

      <ControlRoomLayout
        cameras={camerasPage.items}
        anomalies={anomaliesPage.items}
        anomaliesTotal={anomaliesPage.total}
<<<<<<< HEAD
=======
        canTransition={canTransition}
>>>>>>> origin/production
      />
    </main>
  );
}

