import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { AdminView } from "./admin-view";
import { IconAlertTriangle, IconBuilding } from "../components/icons";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const hasUserManage = permissions.includes("user:manage") || permissions.includes("*");
  const hasRoleManage = permissions.includes("role:manage") || permissions.includes("*");
  const isAuthorized = hasUserManage || hasRoleManage;

  // If user lacks administrative permissions, render an institutional access notice
  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="admin"
        />

        <div
          className="table-card"
          style={{
            padding: "2rem 1.5rem",
            maxWidth: "480px",
            margin: "3rem auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              background: "#fff7ed",
              color: "#c2410c",
              border: "1px solid #fed7aa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            <IconAlertTriangle style={{ width: 22, height: 22 }} />
          </div>

          <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1.1rem", color: "var(--color-navy-brand)" }}>
            Access Restricted
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            This section requires administrative permissions (<code>user:manage</code> or <code>role:manage</code>).
          </p>

          <div
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "6px",
              padding: "0.65rem 0.85rem",
              marginBottom: "1.25rem",
              textAlign: "left",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Account:</span>
              <span style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}>{session.user.email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Scopes:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-blue)" }}>
                {permissions.length} active
              </span>
            </div>
          </div>

          <Link
            href="/projects"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.5rem 1.15rem",
              borderRadius: "6px",
              background: "var(--action-green)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.82rem",
              textDecoration: "none",
            }}
          >
            <IconBuilding style={{ width: 14, height: 14 }} />
            <span>Return to Projects</span>
          </Link>
        </div>
      </main>
    );
  }

  // Fetch users and roles with permission checks and defensive fallback
  const client = await getClient();
<<<<<<< HEAD
  const [usersPage, roles] = await Promise.all([
=======
  const [usersPage, roles, jurisdictions] = await Promise.all([
>>>>>>> origin/production
    hasUserManage
      ? client.listUsers({ pageSize: 100 }).catch((err) => {
          console.error("Failed to load users for admin:", err);
          return { items: [], total: 0, page: 1, pageSize: 100 };
        })
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
    hasRoleManage
      ? client.listRoles().catch((err) => {
          console.error("Failed to load roles for admin:", err);
          return [];
        })
      : Promise.resolve([]),
<<<<<<< HEAD
=======
    isAuthorized
      ? client.listJurisdictions().catch((err) => {
          console.error("Failed to load jurisdictions for admin:", err);
          return [];
        })
      : Promise.resolve([]),
>>>>>>> origin/production
  ]);

  const safeUsers = Array.isArray(usersPage?.items) ? usersPage.items : [];
  const totalUsers = typeof usersPage?.total === "number" ? usersPage.total : safeUsers.length;
  const safeRoles = Array.isArray(roles) ? roles : [];
<<<<<<< HEAD
=======
  const safeJurisdictions = Array.isArray(jurisdictions) ? jurisdictions : [];
>>>>>>> origin/production

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="admin"
      />

      <AdminView
        users={safeUsers}
        totalUsers={totalUsers}
        roles={safeRoles}
<<<<<<< HEAD
=======
        jurisdictions={safeJurisdictions}
>>>>>>> origin/production
        currentEmail={session.user.email}
        hasUserManage={hasUserManage}
        hasRoleManage={hasRoleManage}
      />
    </main>
  );
}
