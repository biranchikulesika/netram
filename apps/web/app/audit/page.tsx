import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { getUserDisplayName, getProjectCode, formatDateTime } from "../../lib/presentation";
import { NavHeader } from "../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../components/icons";
<<<<<<< HEAD
=======
import { AuditExplorerView } from "./audit-explorer-view";
>>>>>>> origin/production

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
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            <IconAlertTriangle style={{ width: 22, height: 22 }} />
          </div>

          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
            Access Restricted
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}>
            Your official account does not have authorization to view the statutory audit ledger. Please contact your administrative supervisor if you require elevated access.
          </p>

          <Link
            href="/projects"
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <IconBuilding style={{ width: 14, height: 14 }} />
            <span>Return to Projects</span>
          </Link>
        </div>
      </main>
    );
  }

  const client = await getClient();
  const page = await client
    .listAuditEvents({ pageSize: 50 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }));

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="audit"
      />

<<<<<<< HEAD
      <div className="section-header">
        <div>
          <h2>Audit Log</h2>
          <p className="muted">Append-only record of significant system actions</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Actor</th>
            <th>Resource</th>
            <th>Request</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {page.items.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No audit events recorded.
              </td>
            </tr>
          ) : (
            page.items.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="badge badge-routine">{e.action}</span>
                </td>
                <td style={{ fontWeight: 500 }}>
                  {getUserDisplayName(e.actorUserId, "Automated System")}
                </td>
                <td className="muted">
                  {e.resourceType === "project" && e.resourceId
                    ? `Project: ${getProjectCode(e.resourceId)}`
                    : e.resourceType
                      ? `${e.resourceType.toUpperCase()}`
                      : "—"}
                </td>
                <td className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  {e.requestId ? `#${e.requestId.slice(0, 6)}` : "—"}
                </td>
                <td className="muted">{formatDateTime(e.occurredAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: "1rem" }}>
        Total: {page.total}
      </p>
=======
      <AuditExplorerView initialEvents={page.items} initialTotal={page.total} />
>>>>>>> origin/production
    </main>
  );
}

