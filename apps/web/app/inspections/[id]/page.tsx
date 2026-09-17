import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { formatDate, formatDateTime, getDistrictName } from "../../../lib/presentation";
import { NavHeader } from "../../components/nav-header";
import { ObservationsSection } from "./observations-section";
import { FindingsSection } from "./findings-section";
import { EvidenceGallery } from "./evidence-gallery";
import { VcPanel } from "./vc-panel";
import { InspectionLifecyclePanel } from "./inspection-lifecycle-panel";
import { GenerateInspectionReportButton } from "./generate-inspection-report-button";

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

  let project = null;
  try {
    project = await client.getProject(inspection.projectId);
  } catch {
    // optional
  }

  const [evidenceList, observations, findings, vcSessionsPage, reportsPage] = await Promise.all([
    client.listEvidence(inspection.id).catch(() => []),
    client.listObservations(inspection.id).catch(() => []),
    client.listFindings(inspection.id).catch(() => []),
    client
      .listVcSessions({ inspectionId: inspection.id })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    client
      .listReports({ inspectionId: inspection.id })
      .catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
  ]);

  const canCapture =
    session.permissions.includes("evidence:capture") ||
    session.permissions.includes("*");
  const canAddObs =
    session.permissions.includes("observation:record") ||
    session.permissions.includes("*");
  const canManageVc =
    session.permissions.includes("vc:create") ||
    session.permissions.includes("inspection:transition") ||
    session.permissions.includes("*");
  const canTransitionInspector =
    session.permissions.includes("inspection:transition") ||
    session.permissions.includes("*");
  const canTransitionAuthority =
    session.permissions.includes("inspection:review") ||
    session.permissions.includes("*");
  const canGenerateReport =
    session.permissions.includes("report:generate") ||
    session.permissions.includes("*");

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="inspections"
      />

      <div className="breadcrumb">
        <Link href="/inspections">&larr; Return to Inspections</Link>
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
          <h2>{project ? project.name : "Sanctioned Facility Inspection"}</h2>
          {project && (
            <p className="muted">
              Facility: <Link href={`/projects/${project.id}`} style={{ fontWeight: 600 }}>{project.code}</Link> ·{" "}
              {project.districtId ? getDistrictName(project.districtId, project.code) : "Odisha State Jurisdiction"}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <span className={`status status-${inspection.status} status-large`}>
            {inspection.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
          {canGenerateReport && (
            <GenerateInspectionReportButton
              inspectionId={inspection.id}
              hasExistingReport={reportsPage.items.length > 0}
              existingReportId={reportsPage.items[0]?.id}
            />
          )}
        </div>
      </header>

      {/* Lifecycle Progression Stepper (§32) */}
      <InspectionLifecyclePanel
        inspection={inspection}
        canTransitionInspector={canTransitionInspector}
        canTransitionAuthority={canTransitionAuthority}
      />

      {/* Overview Cards */}
      <section className="overview-cards">
        <div className="overview-card">
          <span className="card-label">Scheduled Window</span>
          <span className="card-val">
            {inspection.scheduledStart
              ? `${formatDate(inspection.scheduledStart)} – ${formatDate(inspection.scheduledEnd)}`
              : "Not scheduled"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">Field Started</span>
          <span className="card-val">
            {inspection.startedAt ? formatDateTime(inspection.startedAt) : "Not started"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">Submission Date</span>
          <span className="card-val">
            {inspection.submittedAt
              ? formatDateTime(inspection.submittedAt)
              : "Not submitted"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">Disclosure Policy</span>
          <span className="card-val">
            {inspection.disclosurePolicyId ? "Protected / Role-Gated" : "Standard Public"}
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
