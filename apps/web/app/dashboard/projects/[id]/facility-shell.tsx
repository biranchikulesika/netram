import Link from "next/link";
import type { Project, ProjectRiskSnapshot } from "@netram/types";
import {
  formatDistrict,
  getAuthorityName,
  getOrganisationName,
} from "../../../../lib/presentation";
import {
  IconBuilding,
  IconMail,
  IconMapPin,
  IconPhone,
  IconShieldCheck,
  IconUser,
} from "../../../components/icons";
import { FacilityNav } from "./facility-nav";
import { HealthGauge } from "./health-gauge";
import { StatusBadge } from "./status-badge";

/**
 * Status is part of the permanent identity (district/org/authority) and stays
 * in the meta row for most lifecycle states. Abnormal states — suspended or
 * archived — are promoted next to the facility name instead, so they read as
 * an urgent condition on the title rather than routine metadata.
 */
const PROMINENT_STATUSES = new Set(["Suspended", "Archived"]);

/**
 * `Active` is the expected steady state for a sanctioned facility, so its
 * badge carries no information. Rendering it would spend a whole row of the
 * masthead restating the absence of a problem.
 */
const SILENT_STATUSES = new Set(["Active"]);

const EDITABLE_STATUSES = new Set(["Draft", "Pending Verification"]);

/** Same muted empty-state wording the Facility Facts card uses. */
const NOT_RECORDED = "Not recorded";

interface FacilityShellProps {
  project: Project;
  permissions: string[];
  /** Present only for viewers holding project_risk:read (layout-gated). */
  riskSnapshot: ProjectRiskSnapshot | null;
  /** Whether this viewer may see risk information at all (§34). */
  canViewRisk: boolean;
}

/**
 * Compact facility masthead + integrated section tab strip.
 * Replaces the separate breadcrumb, header card and nav bar that previously
 * consumed vertical space above shared facility pages.
 */
export function FacilityShell({
  project,
  permissions,
  riskSnapshot,
  canViewRisk,
}: FacilityShellProps) {
  const prominentStatus = PROMINENT_STATUSES.has(project.status);
  // The badge's own row is rendered only when it actually holds a badge, so a
  // silent or already-prominent status costs no vertical space at all.
  const showStatusRow = !prominentStatus && !SILENT_STATUSES.has(project.status);

  const districtLabel = formatDistrict(project.districtName, project.stateName);
  const orgLabel = getOrganisationName(project.organisationName);
  const authorityLabel = getAuthorityName(project.authorityId, project.authorityName);
  const contactName = project.contactName ?? NOT_RECORDED;
  const contactPhone = project.contactPhone ?? NOT_RECORDED;
  const contactEmail = project.contactEmail ?? NOT_RECORDED;

  return (
    <header className="facility-header">
      <div className="facility-header-main">
        <div className="facility-identity">
          <div className="facility-name-line">
            <div className="facility-name-main">
              <div className="facility-name-block">
                <h1 className="facility-name">{project.name}</h1>
                <span className="code-badge facility-code-badge">{project.code}</span>
              </div>
              {prominentStatus && <StatusBadge status={project.status} />}
            </div>
            <div className="facility-name-side">
              <div className="facility-ownership-meta">
                <span>
                  <IconMapPin width={13} height={13} />
                  {districtLabel}
                </span>
                <span>
                  <IconBuilding width={13} height={13} />
                  {orgLabel}
                </span>
                <span>
                  <IconShieldCheck width={13} height={13} />
                  {authorityLabel}
                </span>
              </div>
              <div className="facility-contact-meta">
                <span>
                  <IconUser width={13} height={13} />
                  {contactName}
                </span>
                <span>
                  <IconPhone width={13} height={13} />
                  {contactPhone}
                </span>
                <span>
                  <IconMail width={13} height={13} />
                  {contactEmail}
                </span>
              </div>
            </div>
          </div>
          {showStatusRow && (
            <div className="facility-identity-meta">
              <StatusBadge status={project.status} />
            </div>
          )}
        </div>

        <div className="facility-header-side">
          <div className="facility-header-actions">
            {permissions.includes("project:create") && EDITABLE_STATUSES.has(project.status) && (
              <Link
                href={`/dashboard/projects/${project.id}/edit`}
                className="btn-secondary facility-edit-btn"
              >
                Edit
              </Link>
            )}
          </div>
          {riskSnapshot ? (
            <div className="facility-gauge-slot">
              <HealthGauge snapshot={riskSnapshot} />
            </div>
          ) : (
            canViewRisk && (
              <div className="facility-gauge-slot facility-gauge-empty">
                <span className="facility-gauge-empty-label">Risk score</span>
                <span className="facility-gauge-empty-value">Not scored</span>
              </div>
            )
          )}
        </div>
      </div>

      <FacilityNav projectId={project.id} permissions={permissions} />
    </header>
  );
}
