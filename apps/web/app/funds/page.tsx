import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { FundsDashboardClient } from "./funds-dashboard-client";

export const dynamic = "force-dynamic";

export default async function FundsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const client = await getClient();

  const [allocationsRes, expensesRes, flagsRes, rulesRes, projectsRes] = await Promise.all([
    client.listAllocations({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
    client.listExpenses({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
    client.listInspectionFlags({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
    client.listRiskRules().catch(() => []),
    client.listProjects({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
  ]);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="funds"
      />
      <FundsDashboardClient
        initialAllocations={allocationsRes.items}
        initialExpenses={expensesRes.items}
        initialFlags={flagsRes.items}
        initialRules={rulesRes}
        projects={projectsRes.items.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          districtId: p.districtId,
        }))}
        permissions={permissions}
      />
    </main>
  );
}
