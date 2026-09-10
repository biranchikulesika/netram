import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client.listNotifications({ pageSize: 50 });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="notifications"
      />

      <div className="section-header">
        <div>
          <h2>Notifications</h2>
          <p className="muted">Inbox for assignment alerts, overdue actions, and system events</p>
        </div>
        <div>
          {page.unread > 0 && (
            <span className="badge badge-surprise">{page.unread} unread</span>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Title</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {page.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                No notifications.
              </td>
            </tr>
          ) : (
            page.items.map((n) => (
              <tr key={n.id}>
                <td>
                  <span className="badge badge-routine">{n.type}</span>
                </td>
                <td>{n.title}</td>
                <td>
                  <span className={`status status-${n.status}`}>{n.status}</span>
                </td>
                <td className="muted">
                  {new Date(n.createdAt).toLocaleDateString()}
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
