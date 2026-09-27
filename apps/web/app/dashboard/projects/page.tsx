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
    params.view === "cards" || params.view === "map"
      ? (params.view as "table" | "cards" | "map")
      : ("table" as "table" | "cards" | "map");
  const searchQuery = params.q?.trim() ?? "";

  const client = await getClient();
  const page = await client
    .listProjects({
      page: pageNumber,
      pageSize,
      status: validStatus,
    })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize }));

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
        apiUrl={apiUrl}
      />
    </main>
  );
}
