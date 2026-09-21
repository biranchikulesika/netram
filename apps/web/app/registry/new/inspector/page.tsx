import { NavHeader } from "../../../components/nav-header";
import { loadJurisdictions, requireRegistryPermission } from "../shared";
import { InspectorFormBody } from "../../form-body";

export const dynamic = "force-dynamic";

export default async function RegisterInspectorPage() {
  const session = await requireRegistryPermission("inspector:register");
  const jurisdictions = await loadJurisdictions();

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="registry"
      />
      <InspectorFormBody jurisdictions={jurisdictions} />
    </main>
  );
}
