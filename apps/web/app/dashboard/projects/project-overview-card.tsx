"use client";

import Link from "next/link";
import type { Project } from "@netram/types";
import {
  IconBuilding,
  IconFileText,
  IconGavel,
  IconShieldCheck,
  IconTag,
} from "../../components/icons";
import {
  getAuthorityName,
  formatDistrict,
  getOrganisationName,
} from "../../../lib/presentation";
import { StatusBadge } from "./[id]/status-badge";

function getProjectTypeLabel(type: Project["type"]): string {
  if (type === "institution") return "Institution / NGO";
  if (type === "authority_project") return "Authority Project";
  return "General Project";
}

/** Compact administrative date, e.g. "20 Sep, 2026" */
export function formatRegisteredDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("day")} ${get("month")}, ${get("year")}`;
  } catch {
    return "—";
  }
}

interface ProjectOverviewCardProps {
  project: Project;
  /** Link target for the card. When omitted, the card renders without link wrappers (e.g. an already-selected detail panel). */
  href?: string;
}

/**
 * Shared project overview card.
 *
 * Used by the projects registry cards view and the GIS map details panel so
 * both surfaces present identical information; the map panel only adds its
 * geofence/location controls below this card.
 */
export function ProjectOverviewCard({ project, href }: ProjectOverviewCardProps) {
  const hasOrganisation = Boolean(project.organisationId);
  const hasAuthority = Boolean(project.authorityId);
  const orgName = getOrganisationName(project.organisationName);
  const authorityName = getAuthorityName(project.authorityId, project.authorityName);
  const schemeNames = project.programmeNames ?? [];
  const hasSchemes = schemeNames.length > 0;
  const schemeLabel =
    schemeNames.length <= 2 ? schemeNames.join(", ") : `${schemeNames[0]} +${schemeNames.length - 2}`;

  const body = (
    <>
      <div className="facility-card-header">
        <span className="facility-card-code">{project.code}</span>
        <StatusBadge status={project.status} />
      </div>

      <h3 className="facility-card-title">{project.name}</h3>

      {project.description ? (
        <p className="facility-card-desc">{project.description}</p>
      ) : (
        <p className="facility-card-desc facility-card-desc-placeholder">
          No description provided.
        </p>
      )}

      <dl className="facility-card-meta">
        <div className="facility-card-meta-item">
          <dt title="Project type" aria-label="Project type">
            <IconTag className="meta-label-icon" />
          </dt>
          <dd>{getProjectTypeLabel(project.type)}</dd>
        </div>
        <div className="facility-card-meta-item">
          <dt title="District jurisdiction" aria-label="District jurisdiction">
            <IconGavel className="meta-label-icon" />
          </dt>
          <dd>{formatDistrict(project.districtName, project.stateName)}</dd>
        </div>
        <div className="facility-card-meta-item">
          <dt title="Managing organisation" aria-label="Managing organisation">
            <IconBuilding className="meta-label-icon" />
          </dt>
          {hasOrganisation ? (
            <dd title={orgName}>{orgName}</dd>
          ) : (
            <dd className="meta-placeholder">No organisation linked</dd>
          )}
        </div>
        <div className="facility-card-meta-item">
          <dt title="Responsible authority" aria-label="Responsible authority">
            <IconShieldCheck className="meta-label-icon" />
          </dt>
          {hasAuthority ? (
            <dd title={authorityName}>{authorityName}</dd>
          ) : (
            <dd className="meta-placeholder">No authority assigned</dd>
          )}
        </div>
        <div className="facility-card-meta-item">
          <dt title="Linked welfare schemes" aria-label="Linked welfare schemes">
            <IconFileText className="meta-label-icon" />
          </dt>
          {hasSchemes ? (
            <dd title={schemeNames.join(", ")}>{schemeLabel}</dd>
          ) : (
            <dd className="meta-placeholder">No scheme linked</dd>
          )}
        </div>
      </dl>

      <div className="facility-card-footer">
        <span className="facility-card-date">
          Regd. {formatRegisteredDate(project.createdAt)}
        </span>
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="facility-card facility-card-static">
        <div className="facility-card-link">{body}</div>
      </div>
    );
  }

  return (
    <article className="facility-card">
      <Link href={href} className="facility-card-link" aria-label={`Open dossier for ${project.name}`}>
        {body}
      </Link>
    </article>
  );
}
