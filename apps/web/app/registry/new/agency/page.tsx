import { NavHeader } from "../../../components/nav-header";
import { loadTerritories, requireRegistryPermission } from "../shared";
import { AgencyFormBody } from "../../form-body";

export const dynamic = "force-dynamic";

export default async function RegisterAgencyPage() {
  const session = await requireRegistryPermission("organisation:create");
  const { districts } = await loadTerritories();

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="registry"
      />
      <AgencyFormBody districts={districts} />
    </main>
  );
}
