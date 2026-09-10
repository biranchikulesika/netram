import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { StatusBadge } from "./status-badge";
import { NavHeader } from "../../components/nav-header";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const { id } = await params;
  const client = await getClient();
  let project;
  try {
    project = await client.getProject(id);
  } catch {
    notFound();
  }

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="projects"
      />

      <div className="breadcrumb">
        <Link href="/projects">← Back to Projects</Link>
      </div>

      <header>
        <h1 style={{ margin: 0 }}>{project.name}</h1>
        <StatusBadge status={project.status} />
      </header>
      <dl style={{ display: "grid", gap: "0.5rem", maxWidth: 480 }}>
        <div>
          <dt className="muted">Code</dt>
          <dd>{project.code}</dd>
        </div>
        <div>
          <dt className="muted">Description</dt>
          <dd>{project.description ?? "—"}</dd>
        </div>
        <div>
          <dt className="muted">Organisation</dt>
          <dd>{project.organisationId ?? "—"}</dd>
        </div>
        <div>
          <dt className="muted">District</dt>
          <dd>{project.districtId ?? "—"}</dd>
        </div>
        <div>
          <dt className="muted">Programmes</dt>
          <dd>{project.programmeIds.length}</dd>
        </div>
      </dl>
    </main>
  );
}
