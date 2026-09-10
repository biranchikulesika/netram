import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client.listReports({ pageSize: 50 });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
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
            <th>Inspection</th>
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
                <td className="muted">{r.inspectionId.slice(0, 8)}…</td>
                <td>
                  <span className="badge badge-routine">{r.format}</span>
                </td>
                <td>
                  <span className={`status status-${r.status}`}>{r.status}</span>
                </td>
                <td className="muted">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
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
