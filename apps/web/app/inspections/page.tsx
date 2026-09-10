import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();
  const page = await client.listInspections({ pageSize: 50 });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="inspections"
      />

      <div className="section-header">
        <div>
          <h2>Inspections</h2>
          <p className="muted">Monitoring, surprise visits, and routine oversight workflows</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Trigger</th>
            <th>Project</th>
            <th>Status</th>
            <th>Scheduled / Started</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((i) => {
            const isSurprise = i.type === "surprise";
            const dateStr = i.startedAt
              ? `Started: ${new Date(i.startedAt).toLocaleDateString()}`
              : i.scheduledStart
                ? `Sched: ${new Date(i.scheduledStart).toLocaleDateString()}`
                : "—";

            return (
              <tr key={i.id}>
                <td>
                  <span className={`badge ${isSurprise ? "badge-surprise" : "badge-routine"}`}>
                    {i.type.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span className="trigger-text">{i.trigger.replace("_", " ")}</span>
                </td>
                <td>
                  <Link href={`/projects/${i.projectId}`} className="project-link">
                    {i.projectId.slice(0, 8)}…
                  </Link>
                </td>
                <td>
                  <span className={`status status-${i.status}`}>{i.status.replace("_", " ")}</span>
                </td>
                <td className="muted">{dateStr}</td>
                <td>
                  <Link href={`/inspections/${i.id}`} className="action-link">
                    View Inspection →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: "1rem" }}>
        Total Inspections: {page.total}
      </p>
    </main>
  );
}
