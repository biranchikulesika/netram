"use client";

import Link from "next/link";
import type { DistrictView, OrganisationView, ProgrammeView, StateView } from "@netram/types";
import {
  IconBuilding,
  IconChevronRight,
  IconClipboard,
  IconShieldCheck,
  IconTag,
  IconUser,
} from "../../components/icons";

/**
 * Registrations hub: one card per registrable entity, permission-filtered
 * server-side (page.tsx) — a user simply never sees a card they cannot use.
 * Every card links to its dedicated registration page; the API re-checks the
 * same permission on submit.
 */

interface RegistryViewProps {
  canRegisterFacility: boolean;
  canRegisterOrganisation: boolean;
  canRegisterProgramme: boolean;
  canRegisterInspector: boolean;
  canRegisterOfficial: boolean;
  canListRegistryData: boolean;
  organisations: OrganisationView[];
  programmes: ProgrammeView[];
  states: StateView[];
  districts: DistrictView[];
}

const CARDS = [
  {
    key: "facility",
    href: "/dashboard/projects/new",
    icon: IconBuilding,
    label: "Facility / Project",
    description: "Register a welfare facility: sanction, location, agency, capacity, photos.",
    permission: "canRegisterFacility",
  },
  {
    key: "organisation",
    href: "/dashboard/registry/new/agency",
    icon: IconShieldCheck,
    label: "Agency / Society",
    description: "Register an operating agency or society that runs facilities.",
    permission: "canRegisterOrganisation",
  },
  {
    key: "programme",
    href: "/dashboard/registry/new/scheme",
    icon: IconClipboard,
    label: "Scheme / Programme",
    description: "Register a welfare scheme that facilities participate in.",
    permission: "canRegisterProgramme",
  },
  {
    key: "inspector",
    href: "/dashboard/registry/new/inspector",
    icon: IconUser,
    label: "Inspector",
    description: "Invite a field inspector and assign their jurisdiction.",
    permission: "canRegisterInspector",
  },
  {
    key: "official",
    href: "/dashboard/registry/new/official",
    icon: IconTag,
    label: "Authority Official / Admin",
    description: "Invite an official and grant role, authority and jurisdiction.",
    permission: "canRegisterOfficial",
  },
] as const;

type PermissionKey = (typeof CARDS)[number]["permission"];

export function RegistryView({
  canRegisterFacility,
  canRegisterOrganisation,
  canRegisterProgramme,
  canRegisterInspector,
  canRegisterOfficial,
  canListRegistryData,
  organisations,
  programmes,
  states,
  districts,
}: RegistryViewProps) {
  const allowed: Record<PermissionKey, boolean> = {
    canRegisterFacility,
    canRegisterOrganisation,
    canRegisterProgramme,
    canRegisterInspector,
    canRegisterOfficial,
  };

  const visibleCards = CARDS.filter((c) => allowed[c.permission]);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="registry-grid">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.key} href={card.href} className="registry-card">
              <div className="registry-card-head">
                <span className="registry-card-icon">
                  <Icon width={16} height={16} />
                </span>
                <div className="registry-card-titles">
                  <h2>{card.label}</h2>
                  <p className="registry-card-desc">{card.description}</p>
                </div>
              </div>
              <div className="registry-card-foot">
                <span className="registry-card-link">
                  Open form
                  <IconChevronRight width={12} height={12} className="registry-card-chev" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Existing records */}
      {canListRegistryData && (organisations.length > 0 || programmes.length > 0) && (
        <div className="registry-lists">
          {organisations.length > 0 && (
            <div className="registry-list">
              <h3>Registered agencies</h3>
              <ul>
                {organisations.slice(0, 8).map((o) => (
                  <li key={o.id}>
                    <span className="registry-list-code">{o.code}</span> {o.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {programmes.length > 0 && (
            <div className="registry-list">
              <h3>Registered schemes</h3>
              <ul>
                {programmes.slice(0, 8).map((p) => {
                  const scopeLabel =
                    p.scopeLevel === "national"
                      ? "National"
                      : p.scopeLevel === "state"
                        ? (states.find((s) => s.id === p.stateId)?.name ?? "State")
                        : (districts.find((d) => d.id === p.districtId)?.name ?? "District");
                  return (
                    <li key={p.id}>
                      <span className="registry-list-code">{p.code}</span> {p.name}
                      <span className="registry-list-scope">{scopeLabel}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
