import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import {
  ControlRoomLayout,
  type ControlRoomTab,
  type FeedColumns,
  type StatusFilter,
} from "./control-room-layout";

export const dynamic = "force-dynamic";

export default async function ControlRoomPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    cols?: string;
    q?: string;
    alerts?: string;
    status?: string;
  }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const initialTab = ["feeds", "alerts", "status"].includes(params.tab ?? "")
    ? (params.tab as ControlRoomTab)
    : "feeds";
  const initialColumns = (["4", "3", "2"] as string[]).includes(params.cols ?? "")
    ? (Number(params.cols) as FeedColumns)
    : 3;
  const initialQuery = params.q?.trim() ?? "";
  const initialAlertView = params.alerts === "resolved" ? "resolved" : "active";
  const initialStatusFilter = ["all", "online", "offline"].includes(params.status ?? "")
    ? (params.status as StatusFilter)
    : "all";

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
        districtNames={districtNames}
        initialTab={initialTab}
        initialColumns={initialColumns}
        initialQuery={initialQuery}
        initialAlertView={initialAlertView}
        initialStatusFilter={initialStatusFilter}
      />
    </main>
  );
}
