import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { ObservationsSection } from "./observations-section";
import { FindingsSection } from "./findings-section";
import { EvidenceGallery } from "./evidence-gallery";
import { VcPanel } from "./vc-panel";

export const dynamic = "force-dynamic";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const { id } = await params;
  const client = await getClient();

  let inspection;
  try {
    inspection = await client.getInspection(id);
  } catch {
    notFound();
  }

  // Fetch project details for context
  let project = null;
  try {
    project = await client.getProject(inspection.projectId);
  } catch {
    // Project info optional/fallback
  }

  // Fetch associated observations, findings, evidence, and VC sessions in parallel
  const [observations, findings, evidenceList, vcSessionsPage] = await Promise.all([
    client.listObservations(id).catch(() => []),
    client.listFindings(id).catch(() => []),
    client.listEvidence(id).catch(() => []),
    client
      .listVcSessions({ inspectionId: id })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
  ]);

  const isFieldStage = ["in_progress", "evidence_collection"].includes(inspection.status);
  const canCapture = session.permissions.includes("evidence:create") && isFieldStage;
  const canAddObs = session.permissions.includes("observation:create") && isFieldStage;
  const canManageVc =
    session.permissions.includes("vc_session:manage") ||
    session.permissions.includes("inspection:transition");

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        activeSection="inspections"
      />

      <div className="breadcrumb">
        <Link href="/inspections">← Back to Inspections</Link>
      </div>

      <header className="inspection-header">
        <div>
          <div className="type-row">
            <span
              className={`badge ${inspection.type === "surprise" ? "badge-surprise" : "badge-routine"}`}
            >
              {inspection.type.toUpperCase()} INSPECTION
            </span>
            <span className="trigger-pill">Trigger: {inspection.trigger.replace("_", " ")}</span>
          </div>
          <h2>{project ? project.name : `Inspection #${inspection.id.slice(0, 8)}`}</h2>
          {project && (
            <p className="muted">
              Project: <Link href={`/projects/${project.id}`}>{project.code}</Link> ·{" "}
              {project.districtId ? `District: ${project.districtId.slice(0, 8)}` : ""}
            </p>
          )}
        </div>
        <div>
          <span className={`status status-${inspection.status} status-large`}>
            {inspection.status.replace("_", " ").toUpperCase()}
          </span>
        </div>
      </header>

      {/* Overview Cards */}
      <section className="overview-cards">
        <div className="overview-card">
          <span className="card-label">Scheduled Window</span>
          <span className="card-val">
            {inspection.scheduledStart
              ? `${new Date(inspection.scheduledStart).toLocaleDateString()} - ${new Date(inspection.scheduledEnd ?? "").toLocaleDateString()}`
              : "Not scheduled"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">Field Started</span>
          <span className="card-val">
            {inspection.startedAt ? new Date(inspection.startedAt).toLocaleString() : "Not started"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">Submission Date</span>
          <span className="card-val">
            {inspection.submittedAt
              ? new Date(inspection.submittedAt).toLocaleString()
              : "Not submitted"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">Disclosure Policy</span>
          <span className="card-val">
            {inspection.disclosurePolicyId ? "Protected / Role-Gated" : "Standard"}
          </span>
        </div>
      </section>

      {/* Evidence Gallery with SHA-256 integrity & download */}
      <EvidenceGallery inspectionId={inspection.id} items={evidenceList} canCapture={canCapture} />

      {/* Observations Section */}
      <ObservationsSection inspectionId={inspection.id} items={observations} canAdd={canAddObs} />

      {/* Findings Section */}
      <FindingsSection items={findings} />

      {/* Video Conferencing / Tripartite Remote Review (§43) */}
      <VcPanel
        inspectionId={inspection.id}
        projectId={inspection.projectId}
        initialSessions={vcSessionsPage.items}
        canManage={canManageVc}
        userEmail={session.user.email}
      />
    </main>
  );
}
