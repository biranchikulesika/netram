/**
 * Netram Presentation Layer
 *
 * Translates backend technical identifiers (UUIDs, foreign keys, database codes)
 * and machine-level timestamps into human-meaningful government administrative labels.
 *
 * Reference names (district, user, project) are resolved by the API and carried
 * on the entity itself. This module formats them; it never invents them. A
 * facility with no implementing organisation is a legitimate state, so those
 * helpers fall back to neutral labels rather than guessing a name from a UUID
 * or a project code.
 */

/**
 * Formats a resolved district, qualified by state when both are known
 * (e.g. "Ganjam, Odisha"). Only `Project` carries a state name; inspections and
 * complaints resolve their district through their project.
 */
export function formatDistrict(districtName?: string | null, stateName?: string | null): string {
  if (!districtName) return "Unknown district";
  return stateName ? `${districtName}, ${stateName}` : districtName;
}

/**
 * Returns human-readable Authority name.
 *
 * `resolvedName` is the authority name joined by the API and is authoritative.
 * A facility with no authority assigned is a legitimate state, not missing
 * data, so it is labelled as such instead of defaulting to a department.
 */
export function getAuthorityName(authorityId?: string | null, resolvedName?: string | null): string {
  if (resolvedName) return resolvedName;
  return authorityId ? "Assigned authority" : "No authority assigned";
}

/**
 * Returns human-readable Organisation name.
 *
 * `resolvedName` is the organisation name joined by the API and is
 * authoritative. Village-type targets have no implementing organisation
 * (docs/DoSJE.md §23, §38), so a null organisation is legitimate rather than
 * missing data.
 */
export function getOrganisationName(resolvedName?: string | null): string {
  return resolvedName || "No managing organisation";
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Formats parts of a Date in Asia/Kolkata using numeric month for composition. */
function getCalendarParts(
  d: Date,
  withTime: boolean,
  withSeconds = false,
): Record<string, string> {
  const parts = new Intl.DateTimeFormat(
    "en-IN",
    withTime
      ? {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          ...(withSeconds ? { second: "2-digit" } : {}),
          hour12: true,
          timeZone: "Asia/Kolkata",
        }
      : {
          day: "numeric",
          month: "numeric",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        },
  ).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

/**
 * Formats date into short administrative format: "12 Sep 2026"
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    const p = getCalendarParts(d, false);
    const month = SHORT_MONTHS[Number(p.month) - 1] ?? "-";
    return `${p.day} ${month} ${p.year}`;
  } catch {
    return "-";
  }
}

/**
 * Formats date into standard short administrative format: "12 Sep 2026"
 */
export function formatShortDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    const p = getCalendarParts(d, false);
    const month = SHORT_MONTHS[Number(p.month) - 1] ?? "-";
    return `${p.day} ${month} ${p.year}`;
  } catch {
    return "-";
  }
}

function formatDateTimeParts(d: Date): string {
  const p = getCalendarParts(d, true);
  const month = SHORT_MONTHS[Number(p.month) - 1] ?? "-";
  const period = (p.dayPeriod ?? "").toUpperCase();
  return `${p.day} ${month}, ${p.year} at ${p.hour}:${p.minute} ${period}`;
}

/**
 * Formats datetime into short administrative format: "12 Sep, 2026 at 10:58 PM"
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    return formatDateTimeParts(d);
  } catch {
    return "-";
  }
}

/**
 * Formats datetime into exact administrative timestamp with seconds: "12 Sep, 2026 at 10:58:24 PM"
 */
export function formatTimestamp(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    const p = getCalendarParts(d, true, true);
    const month = SHORT_MONTHS[Number(p.month) - 1] ?? "-";
    const period = (p.dayPeriod ?? "").toUpperCase();
    const second = p.second ? p.second.padStart(2, "0") : "00";
    return `${p.day} ${month}, ${p.year} at ${p.hour}:${p.minute}:${second} ${period}`;
  } catch {
    return "-";
  }
}

const ROLE_TITLE_MAP: Record<string, string> = {
  system_admin: "System Administrator",
  authority_officer: "Authority Officer",
  control_room: "Control Room Operator",
  institution_admin: "Institution Admin",
  inspector: "Field Inspector",
  competent_authority: "Competent Authority",
  programme_officer: "Programme Officer",
  auditor: "Financial Auditor",
};

/**
 * Translates backend role codes (e.g. "inspector", "authority_officer")
 * into human-readable, executive administrative role titles.
 */
export function formatRoleTitle(roleCode?: string | null, rawName?: string | null): string {
  if (!roleCode && !rawName) return "-";
  const code = (roleCode || "").toLowerCase().trim();
  if (code && ROLE_TITLE_MAP[code]) {
    return ROLE_TITLE_MAP[code];
  }
  if (rawName && rawName.trim() && rawName.toLowerCase() !== code) {
    const rawLower = rawName.toLowerCase().trim();
    if (ROLE_TITLE_MAP[rawLower]) return ROLE_TITLE_MAP[rawLower];
    return rawName.trim();
  }
  if (!code) return rawName?.trim() || "-";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
