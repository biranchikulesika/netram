import { redirect } from "next/navigation";
import { loadClientEnv } from "@netram/config";
import type { ProjectStatus } from "@netram/types";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { ProjectsView } from "./projects-view";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    status?: string;
    view?: string;
    q?: string;
  }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const pageNumber = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize ?? "20", 10) || 20));
  const validStatus =
    params.status && params.status !== "ALL"
      ? (params.status as ProjectStatus)
      : undefined;
  const validView =
    params.view === "cards" || params.view === "map" || params.view === "risk"
      ? (params.view as "table" | "cards" | "map" | "risk")
      : ("table" as "table" | "cards" | "map" | "risk");
  const searchQuery = params.q?.trim() ?? "";

  const canReadRisk =
    session.permissions.includes("project_risk:read") ||
    session.permissions.includes("*");
  const canEvaluateRisk =
    session.permissions.includes("project_risk:evaluate") ||
    session.permissions.includes("*");

  const client = await getClient();
  const [page, rankingsResult] = await Promise.all([
    client
      .listProjects({
        page: pageNumber,
        pageSize,
        status: validStatus,
      })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize })),
    canReadRisk
      ? client.listProjectRiskRankings({ pageSize: 100 }).catch(() => ({ items: [], total: 0 }))
      : Promise.resolve({ items: [], total: 0 }),
  ]);

  // Verification queue: facility registrations awaiting an approve/reject
  // decision. Only fetched for users holding project:approve — for everyone
  // else the section simply does not render.
  const canApprove = session.permissions.includes("project:approve");
  const verificationQueue = canApprove
    ? await client
        .listVerificationQueue()
        .then((r) => r.items)
        .catch(() => [])
      : [];

  const apiUrl = loadClientEnv().NEXT_PUBLIC_API_URL;

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="projects"
      />

      <ProjectsView
        initialProjects={page.items}
        totalProjects={page.total}
        serverPage={page.page}
        serverPageSize={page.pageSize}
        initialStatus={params.status ?? "ALL"}
        initialView={validView}
        initialSearch={searchQuery}
        verificationQueue={verificationQueue}
        initialRankings={rankingsResult.items}
        canEvaluateRisk={canEvaluateRisk}
        apiUrl={apiUrl}
      />
    </main>
  );
}
