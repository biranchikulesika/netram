import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { FundsDashboardClient } from "./funds-dashboard-client";

export const dynamic = "force-dynamic";

export default async function FundsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canViewRiskFlags =
    permissions.includes("financial_risk:read") ||
    permissions.includes("project_risk:read") ||
    permissions.includes("*");
  const client = await getClient();

  const [allocationsRes, expensesRes, flagsRes, projectsRes, organisations, districts] =
    await Promise.all([
      client.listAllocations({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      client.listExpenses({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      canViewRiskFlags
        ? client.listInspectionFlags({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 }))
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
      client.listProjects({ pageSize: 100 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      client.listOrganisations().catch(() => []),
      client.listRegistryDistricts().catch(() => []),
    ]);

  const organisationNames = new Map(organisations.map((organisation) => [organisation.id, organisation.name]));
  const districtDetails = new Map(districts.map((district) => [district.id, district]));

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
        initialFlags={canViewRiskFlags ? flagsRes.items : []}
        canViewRiskFlags={canViewRiskFlags}
        projects={projectsRes.items.map((project) => {
          const district = project.districtId ? districtDetails.get(project.districtId) : undefined;
          return {
            id: project.id,
            name: project.name,
            code: project.code,
            districtId: project.districtId,
            organisationId: project.organisationId,
            status: project.status,
            approvedById: project.approvedById,
            stateName: district?.stateName ?? "State not recorded",
            districtName: district?.name ?? "District not recorded",
            organisationName:
              (project.organisationId ? organisationNames.get(project.organisationId) : undefined) ??
              "Organisation not recorded",
          };
        })}
        permissions={permissions}
      />
    </main>
  );
}
