import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { DashboardOverviewView } from "./dashboard-overview-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];

  const [
    projectsRes,
    inspectionsRes,
    camerasRes,
    complaintsRes,
    correctiveActionsRes,
    anomaliesRes,
    auditRes,
    notificationsRes,
  ] = await Promise.allSettled([
    client.listProjects({ page: 1, pageSize: 5 }),
    client.listInspections({ page: 1, pageSize: 5 }),
    client.listCameras({ pageSize: 50 }),
    client.listComplaints({ page: 1, pageSize: 5 }),
    client.listCorrectiveActions({ page: 1, pageSize: 5 }),
    client.listAiAnomalies({ pageSize: 5 }),
    client.listAuditEvents({ page: 1, pageSize: 6 }),
    permissions.includes("notification:read") || permissions.includes("*")
      ? client.listNotifications({ page: 1, pageSize: 1 })
      : Promise.resolve(null),
  ]);

  const projectsPage = projectsRes.status === "fulfilled" ? projectsRes.value : { items: [], total: 0 };
  const inspectionsPage = inspectionsRes.status === "fulfilled" ? inspectionsRes.value : { items: [], total: 0 };
  const camerasPage = camerasRes.status === "fulfilled" ? camerasRes.value : { items: [], total: 0 };
  const complaintsPage = complaintsRes.status === "fulfilled" ? complaintsRes.value : { items: [], total: 0 };
  const correctiveActionsPage = correctiveActionsRes.status === "fulfilled" ? correctiveActionsRes.value : { items: [], total: 0 };
  const anomaliesPage = anomaliesRes.status === "fulfilled" ? anomaliesRes.value : { items: [], total: 0 };
  const auditPage = auditRes.status === "fulfilled" ? auditRes.value : { items: [], total: 0 };
  const unreadCount =
    notificationsRes.status === "fulfilled" && notificationsRes.value
      ? notificationsRes.value.unread
      : 0;

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        unreadNotificationsCount={unreadCount}
        activeSection="dashboard"
      />
      <DashboardOverviewView
        userEmail={session.user.email}
        userDisplayName={session.user.displayName}
        permissions={permissions}
        stats={{
          projectsCount: projectsPage.total,
          inspectionsCount: inspectionsPage.total,
          camerasCount: camerasPage.total,
          complaintsCount: complaintsPage.total,
          correctiveActionsCount: correctiveActionsPage.total,
          anomaliesCount: anomaliesPage.total,
        }}
        recentProjects={projectsPage.items}
        recentInspections={inspectionsPage.items}
        recentCameras={camerasPage.items}
        recentComplaints={complaintsPage.items}
        recentCorrectiveActions={correctiveActionsPage.items}
        recentAnomalies={anomaliesPage.items}
        recentAuditEvents={auditPage.items}
      />
    </main>
  );
}
