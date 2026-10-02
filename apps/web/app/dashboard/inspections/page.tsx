import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { InspectionsView } from "./inspections-view";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; q?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const initialStatus = ["ACTIVE", "REVIEW", "SCHEDULED", "COMPLETED"].includes(params.status ?? "")
    ? (params.status as "ACTIVE" | "REVIEW" | "SCHEDULED" | "COMPLETED")
    : "ALL";
  const initialView = ["table", "cards", "map"].includes(params.view ?? "")
    ? (params.view as "table" | "cards" | "map")
    : "cards";
  const initialSearch = params.q?.trim() ?? "";

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canCreate = permissions.includes("inspection:create") || permissions.includes("*");

  const client = await getClient();
  const [page, projectsPage] = await Promise.all([
    client
      .listInspections({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    canCreate
      ? client
          .listProjects({ pageSize: 100 })
          .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 }))
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0 }),
  ]);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="inspections"
      />

      <InspectionsView
        initialInspections={page.items}
        total={page.total}
        availableProjects={projectsPage.items.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          districtId: p.districtId,
        }))}
        canCreate={canCreate}
        initialStatus={initialStatus}
        initialView={initialView}
        initialSearch={initialSearch}
      />
    </main>
  );
}
