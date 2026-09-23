import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { AccountView } from "./account-view";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="account"
      />

      <AccountView
        user={session.user}
        permissions={session.permissions}
      />
    </main>
  );
}
