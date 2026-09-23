import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { RegistryView } from "./registry-view";

export const dynamic = "force-dynamic";

export default async function RegistryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = new Set(session.permissions);
  const canListRegistryData = permissions.has("project:read");

  // Reference data for the "existing records" lists — fetched server-side so
  // the hub renders complete on first paint. Failures leave the lists empty.
  const client = await getClient();
  const [organisations, programmes, states, districts] = canListRegistryData
    ? await Promise.all([
        client.listOrganisations().catch(() => []),
        client.listProgrammes().catch(() => []),
        client.listStates().catch(() => []),
        client.listRegistryDistricts().catch(() => []),
      ])
    : [[], [], [], []];

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="registry"
      />
      <RegistryView
        canRegisterFacility={permissions.has("project:create")}
        canRegisterOrganisation={permissions.has("organisation:create")}
        canRegisterProgramme={permissions.has("programme:create")}
        canRegisterInspector={permissions.has("inspector:register")}
        canRegisterOfficial={permissions.has("official:register")}
        canListRegistryData={canListRegistryData}
        organisations={organisations}
        programmes={programmes}
        states={states}
        districts={districts}
      />
    </main>
  );
}
