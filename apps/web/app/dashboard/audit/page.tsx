import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { IconAlertTriangle } from "../../components/icons";
import { ErrorActions } from "../../components/error-actions";
import { getUserNames } from "../../../lib/facility";
import { AuditExplorerView } from "./audit-explorer-view";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const isAuthorized = permissions.includes("audit:read") || permissions.includes("*");

  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="audit"
        />

        <div
          className="table-card"
          style={{
            padding: "2.5rem 1.5rem",
            maxWidth: "480px",
            margin: "3rem auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--tint-red)",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            <IconAlertTriangle style={{ width: 22, height: 22 }} />
          </div>

          <h3
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--color-navy-brand)",
            }}
          >
            Access Restricted
          </h3>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}
          >
            Your official account does not have authorization to view the activity log. Please
            contact your administrative supervisor if you require elevated access.
          </p>

          <ErrorActions fallbackHref="/dashboard" />
        </div>
      </main>
    );
  }

  const client = await getClient();
  const page = await client
    .listAuditEvents({ pageSize: 100 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 }));

  // Actor directory (server-side; user-admin API is permission-gated). The
  // activity log degrades gracefully to role labels when the viewer lacks it.
  const userNames = await getUserNames();

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="audit"
      />

      <AuditExplorerView
        initialEvents={page.items}
        initialTotal={page.total}
        userNames={userNames}
      />
    </main>
  );
}
