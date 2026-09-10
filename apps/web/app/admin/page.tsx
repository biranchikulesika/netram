import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const [usersPage, roles] = await Promise.all([
    client.listUsers({ pageSize: 50 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client.listRoles().catch(() => []),
  ]);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="admin"
      />

      <div className="section-header">
        <div>
          <h2>User Administration</h2>
          <p className="muted">Manage users, roles, and permissions</p>
        </div>
      </div>

      <h3 style={{ marginBottom: "0.5rem" }}>Users</h3>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Roles</th>
          </tr>
        </thead>
        <tbody>
          {usersPage.items.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No users found.
              </td>
            </tr>
          ) : (
            usersPage.items.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td className="muted">{u.displayName ?? "—"}</td>
                <td className="muted">
                  {u.assignments?.map((r) => r.roleCode).join(", ") ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "2rem" }}>
        Total: {usersPage.total}
      </p>

      <h3 style={{ marginBottom: "0.5rem" }}>Roles</h3>
      <table>
        <thead>
          <tr>
            <th>Role Code</th>
            <th>Description</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          {roles.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No roles configured.
              </td>
            </tr>
          ) : (
            roles.map((r) => (
              <tr key={r.code}>
                <td>
                  <span className="badge badge-routine">{r.code}</span>
                </td>
                <td className="muted">{r.name}</td>
                <td className="muted">{r.permissions?.length ?? 0} permissions</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
