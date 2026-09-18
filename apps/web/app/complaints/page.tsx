import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { formatDate } from "../../lib/presentation";
import { NavHeader } from "../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../components/icons";
<<<<<<< HEAD
=======
import { ComplaintsLayout } from "./complaints-layout";
>>>>>>> origin/production

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const isAuthorized = permissions.includes("complaint:read") || permissions.includes("*");

  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="complaints"
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
            Your official account does not have authorization to view grievance and complaint records. Please contact your administrative supervisor if you require elevated access.
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
<<<<<<< HEAD
  const page = await client
    .listComplaints({ pageSize: 50 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }));
=======
  const [page, projectsPage] = await Promise.all([
    client
      .listComplaints({ pageSize: 50 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
    client
      .listProjects({ pageSize: 100 })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
  ]);

  const canCreate = permissions.includes("complaint:create") || permissions.includes("*");
  const canResolve = permissions.includes("complaint:resolve") || permissions.includes("*");

  const projectOptions = projectsPage.items.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));
>>>>>>> origin/production

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
<<<<<<< HEAD
        permissionsCount={session.permissions.length}
=======
        permissionsCount={permissions.length}
>>>>>>> origin/production
        permissions={permissions}
        activeSection="complaints"
      />

<<<<<<< HEAD
      <div className="section-header">
        <div>
          <h2>Complaints</h2>
          <p className="muted">Public and internal grievances regarding monitored facilities</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Tracking Code</th>
            <th>Project Code</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {page.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No complaints recorded.
              </td>
            </tr>
          ) : (
            page.items.map((c) => (
              <tr key={c.id}>
                <td className="muted">{c.trackingCode}</td>
                <td className="muted">{c.projectCode}</td>
                <td>
                  <span className={`status status-${c.status}`}>{c.status}</span>
                </td>
                <td className="muted">{formatDate(c.createdAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: "1rem" }}>
        Total: {page.total}
      </p>
=======
      <ComplaintsLayout
        initialComplaints={page.items}
        totalComplaints={page.total}
        projects={projectOptions}
        canCreate={canCreate}
        canResolve={canResolve}
      />
>>>>>>> origin/production
    </main>
  );
}

