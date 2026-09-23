import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../../components/icons";
import { ReportsView } from "./reports-view";

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
            href="/dashboard/projects"
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

  const canGenerate = permissions.includes("report:generate") || permissions.includes("*");
  const canFinalize = permissions.includes("report:finalize") || permissions.includes("*");

  const client = await getClient();
  const [page, inspectionsPage] = await Promise.all([
    client.listReports({ pageSize: 50 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    canGenerate
      ? client.listInspections({ pageSize: 50 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }))
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0 }),
  ]);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="reports"
      />

      <ReportsView
        initialReports={page.items}
        total={page.total}
        canGenerate={canGenerate}
        canFinalize={canFinalize}
        availableInspections={inspectionsPage.items.map((i) => ({
          id: i.id,
          projectCode: i.projectCode,
          projectName: i.projectName,
          type: i.type,
          status: i.status,
        }))}
      />
    </main>
  );
}
