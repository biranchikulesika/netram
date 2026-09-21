import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { RegistryView } from "./registry-view";

export const dynamic = "force-dynamic";

export default async function RegistryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = new Set(session.permissions);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="registry"
      />
      <RegistryView
        currentEmail={session.user.email}
        canRegisterFacility={permissions.has("project:create")}
        canRegisterOrganisation={permissions.has("organisation:create")}
        canRegisterProgramme={permissions.has("programme:create")}
        canRegisterInspector={permissions.has("inspector:register")}
        canRegisterOfficial={permissions.has("official:register")}
        canListRegistryData={permissions.has("project:read")}
      />
    </main>
  );
}
