import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { InspectionsView } from "./inspections-view";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client
    .listInspections({ pageSize: 50 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }));

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="inspections"
      />

      <InspectionsView
        initialInspections={page.items}
        total={page.total}
      />
    </main>
  );
}
