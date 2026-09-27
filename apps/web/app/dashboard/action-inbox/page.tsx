import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { ActionInboxView } from "./action-inbox-view";

export const dynamic = "force-dynamic";

export default async function ActionInboxPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  const client = await getClient();

  // The server decides what belongs in the caller's inbox (permission-gated,
  // jurisdiction-scoped). An empty response for an unauthorised caller is a
  // normal empty inbox, not an error.
  const inbox = await client.listActionInbox().catch(() => ({
    sections: [],
    total: 0,
    generatedAt: new Date().toISOString(),
  }));

  // Responsible-organisation options for the remediation-order dialog. The
  // inbox itself discloses no organisation roster (§34), so this is fetched
  // here and permission-gated by the API like any other list endpoint.
  const organisations = await client.listOrganisations().catch(() => []);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="action-inbox"
      />
      <ActionInboxView
        sections={inbox.sections}
        generatedAt={inbox.generatedAt}
        organisations={organisations}
      />
    </main>
  );
}
