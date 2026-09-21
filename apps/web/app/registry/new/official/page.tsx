import { NavHeader } from "../../../components/nav-header";
import { loadJurisdictions, requireRegistryPermission } from "../shared";
import { OfficialFormBody } from "../../form-body";

export const dynamic = "force-dynamic";

export default async function RegisterOfficialPage() {
  const session = await requireRegistryPermission("official:register");
  const jurisdictions = await loadJurisdictions();

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="registry"
      />
      <OfficialFormBody jurisdictions={jurisdictions} />
    </main>
  );
}
