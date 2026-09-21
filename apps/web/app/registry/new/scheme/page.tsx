import { NavHeader } from "../../../components/nav-header";
import { loadTerritories, requireRegistryPermission } from "../shared";
import { SchemeFormBody } from "../../form-body";

export const dynamic = "force-dynamic";

export default async function RegisterSchemePage() {
  const session = await requireRegistryPermission("programme:create");
  const { states, districts } = await loadTerritories();

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="registry"
      />
      <SchemeFormBody states={states} districts={districts} />
    </main>
  );
}
