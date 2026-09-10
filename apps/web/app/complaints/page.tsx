import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client.listComplaints({ pageSize: 50 });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="complaints"
      />

      <div className="section-header">
        <div>
          <h2>Complaints</h2>
          <p className="muted">Beneficiary oversight inputs and resolution tracking</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Tracking Code</th>
            <th>Project</th>
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
                <td className="muted">
                  {new Date(c.createdAt).toLocaleDateString()}
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
