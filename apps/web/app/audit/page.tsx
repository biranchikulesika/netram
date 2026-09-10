import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client.listAuditEvents({ pageSize: 50 });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="audit"
      />

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
                No audit events.
              </td>
            </tr>
          ) : (
            page.items.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="badge badge-routine">{e.action}</span>
                </td>
                <td className="muted">{e.actorUserId?.slice(0, 8) ?? "system"}</td>
                <td className="muted">
                  {e.resourceType ? `${e.resourceType}:${e.resourceId?.slice(0, 8) ?? ""}` : "—"}
                </td>
                <td className="muted">{e.requestId?.slice(0, 8) ?? "—"}</td>
                <td className="muted">
                  {new Date(e.occurredAt).toLocaleString()}
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
