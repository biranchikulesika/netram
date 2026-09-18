import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { InspectionsView } from "./inspections-view";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canCreate = permissions.includes("inspection:create") || permissions.includes("*");

  const client = await getClient();
<<<<<<< HEAD
  const page = await client
    .listInspections({ pageSize: 50 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }));
=======
  const [page, projectsPage] = await Promise.all([
    client.listInspections({ pageSize: 50 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    canCreate
      ? client.listProjects({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 }))
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0 }),
  ]);
>>>>>>> origin/production

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
<<<<<<< HEAD
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
=======
        permissionsCount={permissions.length}
        permissions={permissions}
>>>>>>> origin/production
        activeSection="inspections"
      />

      <InspectionsView
        initialInspections={page.items}
        total={page.total}
<<<<<<< HEAD
=======
        availableProjects={projectsPage.items.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          districtId: p.districtId,
        }))}
        canCreate={canCreate}
>>>>>>> origin/production
      />
    </main>
  );
}
