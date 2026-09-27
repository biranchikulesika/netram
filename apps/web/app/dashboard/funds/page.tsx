import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { FundsDashboardClient } from "./funds-dashboard-client";

export const dynamic = "force-dynamic";

export default async function FundsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string; fy?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const initialView = ["allocations", "expenses", "stats", "flags"].includes(params.view ?? "")
    ? (params.view as "allocations" | "expenses" | "stats" | "flags")
    : "stats";
  const initialSearch = params.q?.trim() ?? "";
  const initialFyFilter = params.fy?.trim() ?? "";
  const initialStatuses = params.status ? params.status.split(",").filter(Boolean) : null;

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canViewRiskFlags =
    permissions.includes("financial_risk:read") ||
    permissions.includes("project_risk:read") ||
    permissions.includes("*");
  const client = await getClient();

  const [allocationsRes, expensesRes, flagsRes, projectsRes, organisations, districts] =
    await Promise.all([
      client
        .listAllocations({ pageSize: 100 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      client
        .listExpenses({ pageSize: 100 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      canViewRiskFlags
        ? client
            .listInspectionFlags({ pageSize: 100 })
            .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 }))
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
      client
        .listProjects({ pageSize: 100 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      client.listOrganisations().catch(() => []),
      client.listRegistryDistricts().catch(() => []),
    ]);

  const organisationNames = new Map(
    organisations.map((organisation) => [organisation.id, organisation.name]),
  );
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
        initialView={initialView}
        initialSearch={initialSearch}
        initialFyFilter={initialFyFilter}
        initialStatuses={initialStatuses}
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
              (project.organisationId
                ? organisationNames.get(project.organisationId)
                : undefined) ?? "Organisation not recorded",
          };
        })}
        permissions={permissions}
      />
    </main>
  );
}
