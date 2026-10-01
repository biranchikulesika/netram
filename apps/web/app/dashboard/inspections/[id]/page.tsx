import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../../lib/api";
import { getUserNames } from "../../../../lib/facility";
import { formatDate, formatDateTime, formatDistrict } from "../../../../lib/presentation";
import { NavHeader } from "../../../components/nav-header";
import { IconBuilding, IconClock, IconPlay, IconCheck, IconLock } from "../../../components/icons";
import { ObservationsSection } from "./observations-section";
import { FindingsSection } from "./findings-section";
import { EvidenceGallery } from "./evidence-gallery";
import { InspectionLifecyclePanel } from "./inspection-lifecycle-panel";

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

  const [evidenceList, observations, findings, organisations, correctiveActions, userNames] =
    await Promise.all([
      client.listEvidence(inspection.id).catch(() => []),
      client.listObservations(inspection.id).catch(() => []),
      client.listFindings(inspection.id).catch(() => []),
      client.listOrganisations().catch(() => []),
      client
        .listCorrectiveActions({ inspectionId: inspection.id, pageSize: 100 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 })),
      getUserNames(),
    ]);

  const caByFindingId = Object.fromEntries(correctiveActions.items.map((ca) => [ca.findingId, ca]));

  const canCapture =
    session.permissions.includes("evidence:capture") || session.permissions.includes("*");
  const canAddObs =
    session.permissions.includes("observation:record") || session.permissions.includes("*");
  const canTransitionAuthority =
    session.permissions.includes("inspection:review") || session.permissions.includes("*");

  const statusLabel = inspection.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const districtLabel = project?.districtId
    ? formatDistrict(project.districtName, project.stateName)
    : "Odisha State Jurisdiction";

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="inspections"
      />

      <header className="inspection-hero">
        <div className="inspection-hero-main">
          <h1 className="inspection-hero-title">
            {project ? project.name : "Sanctioned Facility Inspection"}
          </h1>
          {project && (
            <div className="inspection-hero-meta">
              <span className="inspection-meta-chip">
                <IconBuilding width={13} height={13} style={{ color: "#0c2a52" }} />
                <Link href={`/dashboard/projects/${project.id}`} style={{ fontWeight: 600 }}>
                  Facility: {project.code}
                </Link>
              </span>
              <span className="inspection-meta-sep" />
              <span>{districtLabel}</span>
              <span className="inspection-meta-sep" />
              <span className="inspection-id">Inspection ref: {inspection.id.slice(0, 12)}</span>
            </div>
          )}
        </div>
        <div className="inspection-hero-side">
          <span className={`status status-${inspection.status} status-large`}>{statusLabel}</span>
        </div>
      </header>

      {/* Lifecycle Progression Stepper (§32) */}
      <InspectionLifecyclePanel inspection={inspection} />

      {/* Overview Cards */}
      <section className="overview-cards">
        <div className="overview-card">
          <span className="card-label">
            <IconClock width={13} height={13} /> Scheduled Window
          </span>
          <span className="card-val">
            {inspection.scheduledStart
              ? `${formatDate(inspection.scheduledStart)} – ${formatDate(inspection.scheduledEnd)}`
              : "Not scheduled"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconPlay width={13} height={13} /> Field Started
          </span>
          <span className="card-val">
            {inspection.startedAt ? formatDateTime(inspection.startedAt) : "Not started"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconCheck width={13} height={13} /> Submission Date
          </span>
          <span className="card-val">
            {inspection.submittedAt ? formatDateTime(inspection.submittedAt) : "Not submitted"}
          </span>
        </div>
        <div className="overview-card">
          <span className="card-label">
            <IconLock width={13} height={13} /> Disclosure Policy
          </span>
          <span className="card-val">
            {inspection.disclosurePolicyId ? "Protected / Role-Gated" : "Standard Public"}
          </span>
        </div>
      </section>

      {/* Evidence Gallery with SHA-256 integrity & download */}
      <EvidenceGallery inspectionId={inspection.id} items={evidenceList} canCapture={canCapture} />

      {/* Observations + Findings side-by-side */}
      <div className="section-pair-grid">
        <ObservationsSection
          inspectionId={inspection.id}
          items={observations}
          canAdd={canAddObs}
          userNames={userNames}
        />

        <FindingsSection
          items={findings}
          inspectionId={inspection.id}
          project={
            project
              ? { name: project.name, code: project.code, organisationId: project.organisationId }
              : null
          }
          organisations={organisations}
          canOrder={canTransitionAuthority}
          caByFindingId={caByFindingId}
        />
      </div>
    </main>
  );
}
