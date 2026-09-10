import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function CorrectiveActionsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client.listCorrectiveActions({ pageSize: 50 });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="corrective-actions"
      />

      <div className="section-header">
        <div>
          <h2>Corrective Actions</h2>
          <p className="muted">Remediation orders, submissions, and verification</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Finding</th>
            <th>Status</th>
            <th>Deadline</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {page.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No corrective actions.
              </td>
            </tr>
          ) : (
            page.items.map((ca) => (
              <tr key={ca.id}>
                <td className="muted">{ca.findingId.slice(0, 8)}…</td>
                <td>
                  <span className={`status status-${ca.status}`}>{ca.status.replace("_", " ")}</span>
                </td>
                <td className="muted">
                  {ca.deadline ? new Date(ca.deadline).toLocaleDateString() : "—"}
                </td>
                <td className="muted">
                  {new Date(ca.createdAt).toLocaleDateString()}
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
