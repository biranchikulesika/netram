import Link from "next/link";
import type { Project } from "@netram/types";
import {
  getAuthorityName,
  getDistrictName,
  getOrganisationName,
} from "../../../../lib/presentation";
import {
  IconBuilding,
  IconChevronLeft,
  IconMapPin,
  IconShieldCheck,
} from "../../../components/icons";
import { FacilityNav } from "./facility-nav";
import { StatusBadge } from "./status-badge";
import { TransitionButton } from "./transition-button";

const TYPE_LABELS: Record<string, string> = {
  institution: "Institution / NGO Facility",
  authority_project: "Authority Infrastructure Project",
};

const EDITABLE_STATUSES = new Set(["Draft", "Pending Verification"]);

interface FacilityShellProps {
  project: Project;
  permissions: string[];
}

/**
 * Compact facility masthead + integrated section tab strip.
 * Replaces the separate breadcrumb, header card and nav bar that previously
 * consumed vertical space above shared facility pages.
 */
export function FacilityShell({ project, permissions }: FacilityShellProps) {
  const typeLabel =
    TYPE_LABELS[project.type] ??
    "General Sanctioned Initiative";

  const districtLabel = getDistrictName(project.districtId, project.code);
  const orgLabel = getOrganisationName(project.organisationId, project.name);
  const authorityLabel = getAuthorityName(project.authorityId);

  return (
    <header className="facility-header">
      <Link className="facility-back" href="/dashboard/projects">
        <IconChevronLeft width={12} height={12} /> Projects Registry
      </Link>

      <div className="facility-header-main">
        <div style={{ minWidth: 0 }}>
          <div className="facility-code-line">
            <span className="code-badge">{project.code}</span>
            <span className="facility-type-label">{typeLabel}</span>
          </div>
          <h1 className="facility-name">{project.name}</h1>
          <div className="facility-identity-meta">
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
        </div>

        <div className="facility-header-side">
          <StatusBadge status={project.status} />
          {permissions.includes("project:create") && EDITABLE_STATUSES.has(project.status) && (
            <Link
              href={`/dashboard/projects/${project.id}/edit`}
              className="btn-secondary"
              style={{
                textDecoration: "none",
                padding: "0.45rem 0.9rem",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Edit
            </Link>
          )}
          <TransitionButton projectId={project.id} currentStatus={project.status} />
        </div>
      </div>

      <FacilityNav projectId={project.id} permissions={permissions} />
    </header>
  );
}