import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { categoryForAction, formatAuditActivity } from "../../lib/audit-activity";
import { NavHeader } from "../components/nav-header";
import { DashboardOverviewView } from "./dashboard-overview-view";
import {
  buildAttention,
  buildUpcoming,
  isOperationalCategory,
  summariseState,
  type ActivityEntry,
  type OverviewData,
} from "./overview-model";

export const dynamic = "force-dynamic";

/** Complaints the authority still owes an outcome to; summed for a true total. */
const OPEN_COMPLAINT_STATUSES = ["received", "under_review", "escalated"] as const;

const EMPTY_PAGE = { items: [], total: 0 };

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  const now = Date.now();

  /**
   * Every list is requested with the narrowest scope that answers one of the
   * four overview questions, so `total` is a real count rather than a page we
   * counted ourselves. Rejections are absorbed here: a role that cannot read a
   * list sees no numbers for it.
   */
  const [main, complaintPages] = await Promise.all([
    Promise.allSettled([
      client.listProjects({ page: 1, pageSize: 50 }),
      client.listProjects({ page: 1, pageSize: 1, status: "Active" }),
      client.listInspections({ page: 1, pageSize: 50 }),
      client.listCorrectiveActions({ page: 1, pageSize: 50, status: "overdue" }),
      client.listAiAnomalies({ page: 1, pageSize: 50, status: "new" }),
      client.listAuditEvents({ page: 1, pageSize: 12 }),
      permissions.includes("notification:read") || permissions.includes("*")
        ? client.listNotifications({ page: 1, pageSize: 1 })
        : Promise.resolve(null),
    ]),
    Promise.allSettled(
      OPEN_COMPLAINT_STATUSES.map((status) =>
        client.listComplaints({ page: 1, pageSize: 50, status }),
      ),
    ),
  ]);

  const [
    projectsRes,
    activeProjectsRes,
    inspectionsRes,
    overdueActionsRes,
    anomaliesRes,
    auditRes,
    notificationsRes,
  ] = main;

  const page = (result: PromiseSettledResult<{ items: unknown[]; total: number }>) =>
    result.status === "fulfilled" ? result.value : EMPTY_PAGE;

  const projectsPage = page(projectsRes);
  const activeProjectsPage = page(activeProjectsRes);
  const inspectionsPage = page(inspectionsRes);
  const overdueActionsPage = page(overdueActionsRes);
  const anomaliesPage = page(anomaliesRes);
  const auditPage = auditRes.status === "fulfilled" ? auditRes.value : EMPTY_PAGE;
  const openComplaintPages = complaintPages.map(page);

  const unreadCount =
    notificationsRes.status === "fulfilled" && notificationsRes.value
      ? notificationsRes.value.unread
      : 0;

  const data: OverviewData = {
    projects: projectsPage.items as OverviewData["projects"],
    inspections: inspectionsPage.items as OverviewData["inspections"],
    overdueActions: overdueActionsPage.items as OverviewData["overdueActions"],
    complaints: openComplaintPages.flatMap((result) => result.items) as OverviewData["complaints"],
    anomalies: anomaliesPage.items as OverviewData["anomalies"],
    totals: {
      projects: projectsPage.total,
      activeProjects: activeProjectsPage.total,
      inspections: inspectionsPage.total,
      openComplaints: openComplaintPages.reduce((sum, result) => sum + result.total, 0),
    },
  };

  const attention = buildAttention(data, now);
  const attentionReadable = [
    projectsRes,
    inspectionsRes,
    overdueActionsRes,
    anomaliesRes,
    ...complaintPages,
  ].every((result) => result.status === "fulfilled");

  const readable = {
    facilities: projectsRes.status === "fulfilled",
    active: activeProjectsRes.status === "fulfilled",
    inspections: inspectionsRes.status === "fulfilled",
    overdueActions: overdueActionsRes.status === "fulfilled",
    openComplaints: complaintPages.every((result) => result.status === "fulfilled"),
    attention: attentionReadable,
  };

  /**
   * Audit events only ever carry a project code. Resolve it to a facility name
   * for the activity line, and drop the subject entirely when the facility is
   * outside what this user may see - a raw reference is not worth showing.
   */
  const facilityNames = new Map(data.projects.map((p) => [p.code, p.name]));

  const activity: ActivityEntry[] = auditPage.items
    .filter((event) => isOperationalCategory(categoryForAction(event.action)))
    .slice(0, 6)
    .map((event) => {
      const entry = formatAuditActivity(event);
      return {
        id: event.id,
        summary: entry.summary,
        subject: entry.subject ? (facilityNames.get(entry.subject) ?? null) : null,
        status: entry.status,
        tone: entry.tone,
        occurredAt: event.occurredAt,
      };
    });

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
        attention={attention}
        metrics={summariseState(data, attention.length, readable)}
        upcoming={buildUpcoming(data.inspections, now)}
        activity={activity}
        activityReadable={auditRes.status === "fulfilled"}
        now={now}
      />
    </main>
  );
}
