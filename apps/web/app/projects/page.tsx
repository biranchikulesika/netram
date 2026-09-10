import Link from "next/link";
import { redirect } from "next/navigation";
import { loadClientEnv } from "@netram/config";
import { getClient, getSessionUser } from "../../lib/api";
import { CreateProjectForm } from "./create-project-form";
import { NavHeader } from "../components/nav-header";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const client = await getClient();
  const page = await client.listProjects({ pageSize: 50 });
  const apiUrl = loadClientEnv().NEXT_PUBLIC_API_URL;

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="projects"
      />

      <div className="section-header">
        <div>
          <h2>Projects</h2>
          <p className="muted">Monitored programmes, institutions, and infrastructure</p>
        </div>
      </div>

      <CreateProjectForm apiUrl={apiUrl} />

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Organisation</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/projects/${p.id}`}>{p.code}</Link>
              </td>
              <td>{p.name}</td>
              <td className="muted">{p.organisationId ? p.organisationId.slice(0, 8) : "—"}</td>
              <td>
                <span className="status">{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Total: {page.total}</p>
    </main>
  );
}
