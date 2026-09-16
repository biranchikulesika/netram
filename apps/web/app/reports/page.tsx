import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { formatDate } from "../../lib/presentation";
import { NavHeader } from "../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../components/icons";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const isAuthorized = permissions.includes("report:read") || permissions.includes("*");

  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="reports"
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
            Your official account does not have authorization to view inspection reports. Please contact your administrative supervisor if you require elevated access.
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
    .listReports({ pageSize: 50 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }));

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="reports"
      />

      <div className="section-header">
        <div>
          <h2>Reports</h2>
          <p className="muted">Inspection reports — generated, draft, and finalized</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Inspection Report</th>
            <th>Format</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {page.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No reports generated yet.
              </td>
            </tr>
          ) : (
            page.items.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link
                    href={`/inspections/${r.inspectionId}`}
                    style={{ fontWeight: 600, color: "var(--color-navy-brand)", textDecoration: "none" }}
                  >
                    Official Inspection Report
                  </Link>
                </td>
                <td>
                  <span className="badge badge-routine">{r.format.toUpperCase()}</span>
                </td>
                <td>
                  <span className={`status status-${r.status}`}>{r.status}</span>
                </td>
                <td className="muted">{formatDate(r.createdAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: "1rem" }}>
        Total: {page.total}
      </p>
    </main>
  );
}
