/**
 * Netram Presentation Layer
 *
 * Translates backend technical identifiers (UUIDs, foreign keys, database codes)
 * and machine-level timestamps into human-meaningful government administrative labels.
 */

// Known District Mappings (Synthetic dev seed data + standard Odisha registry)
const DISTRICT_MAP: Record<string, { name: string; state: string; code: string }> = {
  "5f6c6fcf-fc88-5bf1-9f63-cad86ee0bd3b": { name: "Khordha", state: "Odisha", code: "KHOL" },
  "92f0e386-2b80-5ca4-94a0-9c7d90d47dbf": { name: "Cuttack", state: "Odisha", code: "CUT" },
  "ec220eb3-d4a3-5b12-9412-26d8badeafe7": { name: "Puri", state: "Odisha", code: "PURI" },
  "a2dfd214-5aa0-5c7a-aa78-7b59865ba0a3": { name: "Ganjam", state: "Odisha", code: "GANJ" },
  "e71c0cc4-6569-5e2b-bb73-cc3cae07fb8d": { name: "Sundargarh", state: "Odisha", code: "SNDR" },
};

// Known Authority Mappings
const AUTHORITY_MAP: Record<string, { name: string; code: string }> = {
  "ade6cce4-1485-5314-9610-a9de994a477a": {
    name: "Department of Social Justice & Empowerment, Odisha",
    code: "DOSJE-OR",
  },
  "0c808442-4c5b-5c9c-8a99-98dbbd080be0": {
    name: "District Social Welfare Office, Khordha",
    code: "DOSJE-KHOL",
  },
  "e399bacd-6dd3-55c5-95e4-9d0fca2b52cd": {
    name: "District Social Welfare Office, Cuttack",
    code: "DOSJE-CUT",
  },
};

// Known Organisation Mappings
const ORGANISATION_MAP: Record<string, { name: string; code: string; category?: string }> = {
  "5266b3f3-5695-5db7-8d95-2c4a945db254": {
    name: "Vani Vihar SC/ST Hostel Society",
    code: "ORG-VANI",
    category: "SC/ST Hostel",
  },
  "c0d66822-60ae-504f-9706-7eaecacd9cf5": {
    name: "Rajdhani Educational Trust",
    code: "ORG-RAJDHANI",
    category: "ST Hostel",
  },
  "ebb58aff-76d7-5982-a3a0-0cd5413444c9": {
    name: "Cuttack Welfare & Education Society",
    code: "ORG-CUTG",
    category: "SC/ST Girls Hostel",
  },
  "c7d11f0c-e82c-53e7-baa7-d9a7c13ee981": {
    name: "Puri Model Residential Society",
    code: "ORG-PURI",
    category: "Model Hostel",
  },
  "6aa7e13a-b8ab-50aa-a43d-28c1464ec8a6": {
    name: "Ganjam District Development Committee",
    code: "ORG-GANJ",
    category: "Model School Hostel",
  },
};

// Known Programme Mappings
const PROGRAMME_MAP: Record<string, { name: string; code: string }> = {
  "3c704771-9317-50bb-9479-7c4c9ff4f46c": {
    name: "National Scholarship Programme - Special Hostels",
    code: "PGM-NSP",
  },
  "d9df7c02-a898-5423-8e77-8cd6aa5925ca": {
    name: "Annual Surprise Inspection Drive",
    code: "PGM-SURPRISE",
  },
};

// Known User Mappings
const USER_MAP: Record<string, { displayName: string; role: string }> = {
  "8038000d-55cf-5adf-b415-d89f75c09ed5": {
    displayName: "Biranchi (Directorate Admin)",
    role: "Department Administrator",
  },
  "dce6caae-1730-5259-8331-8232d33c6030": {
    displayName: "Sruti (Welfare Officer)",
    role: "Officer, Khordha",
  },
  "3ea52f69-5873-59c8-b489-140e0e6ea66a": {
    displayName: "Jyotirmaya (Welfare Officer)",
    role: "Officer, Cuttack",
  },
  "d2d244ef-d926-51f8-8b2e-6cd7cd977bd9": {
    displayName: "Control Room Operations",
    role: "Operations Officer",
  },
  "07806a3a-4951-5ee7-a56b-905ef915de9f": {
    displayName: "Hostel Superintendent (Vani Vihar)",
    role: "Facility In-charge",
  },
  "36abc3db-213f-5946-8d8c-ecfba4125116": {
    displayName: "Inspector Smruti",
    role: "Field Inspector",
  },
  "49c82fb0-e07b-5ee1-8ed2-a81290da68f6": {
    displayName: "Inspector Diptesh",
    role: "Field Inspector",
  },
  "6988193f-09fc-5eda-af38-1be724ee76df": {
    displayName: "Inspector Bishnu",
    role: "Field Inspector",
  },
};

// Known Project Mappings (for foreign references in inspections, attendance, audit)
const PROJECT_MAP: Record<string, { name: string; code: string; district: string }> = {
  "38f08190-9353-5d58-8d5e-74452e66c3f5": {
    name: "Ganjam Model School Hostel",
    code: "PRJ-GANJ-005",
    district: "Ganjam, Odisha",
  },
  "00782106-3c2d-5c52-8c26-485b20c9f6bd": {
    name: "Puri Model Boys' Hostel",
    code: "PRJ-PURI-004",
    district: "Puri, Odisha",
  },
  "fba38ba3-0044-5118-967a-c7fefe0cc06f": {
    name: "Cuttack Girls' Hostel",
    code: "PRJ-CUTG-003",
    district: "Cuttack, Odisha",
  },
  "fbe36976-d2d0-57ed-9128-1e14c738a4a0": {
    name: "Rajdhani Boys' Hostel (ST)",
    code: "PRJ-RAJDHANI-002",
    district: "Khordha, Odisha",
  },
  "f2e4fac4-8505-5877-b483-5c6acf76dcc0": {
    name: "Vani Vihar SC/ST Hostel",
    code: "PRJ-VANI-001",
    district: "Khordha, Odisha",
  },
};

/**
 * Returns human-readable District & State name (e.g. "Ganjam, Odisha")
 */
export function getDistrictName(districtId?: string | null, contextCode?: string): string {
  if (districtId && DISTRICT_MAP[districtId]) {
    const d = DISTRICT_MAP[districtId];
    return `${d.name}, ${d.state}`;
  }

  // Infer from facility/code prefixes if UUID was unmapped
  if (contextCode) {
    const upper = contextCode.toUpperCase();
    if (upper.includes("GANJ")) return "Ganjam, Odisha";
    if (upper.includes("CUT")) return "Cuttack, Odisha";
    if (upper.includes("PURI")) return "Puri, Odisha";
    if (upper.includes("KHOL") || upper.includes("RAJDHANI") || upper.includes("VANI"))
      return "Khordha, Odisha";
    if (upper.includes("SNDR")) return "Sundargarh, Odisha";
  }

  return "Odisha State Jurisdiction";
}

/**
 * Returns short District name (e.g. "Ganjam")
 */
export function getDistrictShortName(districtId?: string | null, contextCode?: string): string {
  if (districtId && DISTRICT_MAP[districtId]) {
    return DISTRICT_MAP[districtId].name;
  }

  if (contextCode) {
    const upper = contextCode.toUpperCase();
    if (upper.includes("GANJ")) return "Ganjam";
    if (upper.includes("CUT")) return "Cuttack";
    if (upper.includes("PURI")) return "Puri";
    if (upper.includes("KHOL") || upper.includes("RAJDHANI") || upper.includes("VANI"))
      return "Khordha";
    if (upper.includes("SNDR")) return "Sundargarh";
  }

  return "Odisha";
}

/**
 * Returns human-readable Authority name
 */
export function getAuthorityName(authorityId?: string | null): string {
  if (authorityId && AUTHORITY_MAP[authorityId]) {
    return AUTHORITY_MAP[authorityId].name;
  }
  return "Department of Social Justice & Empowerment, Odisha";
}

/**
 * Returns human-readable Organisation name
 */
export function getOrganisationName(organisationId?: string | null, facilityName?: string): string {
  if (organisationId && ORGANISATION_MAP[organisationId]) {
    return ORGANISATION_MAP[organisationId].name;
  }
  if (facilityName) {
    return `${facilityName} Managing Committee`;
  }
  return "Registered Public Facility Management";
}

/**
 * Returns human-readable Programme / Scheme name
 */
export function getProgrammeName(programmeId: string): string {
  if (PROGRAMME_MAP[programmeId]) {
    return PROGRAMME_MAP[programmeId].name;
  }
  return "Central Sanctioned Welfare Scheme";
}

/**
 * Returns human-readable User display name
 */
export function getUserDisplayName(userId?: string | null, fallback = "Authorized Officer"): string {
  if (!userId) return fallback;
  if (USER_MAP[userId]) {
    return USER_MAP[userId].displayName;
  }
  return fallback;
}

/**
 * Returns human-readable Facility / Project Name from ID
 */
export function getProjectName(projectId?: string | null, fallback = "Sanctioned Facility"): string {
  if (!projectId) return fallback;
  if (PROJECT_MAP[projectId]) {
    return PROJECT_MAP[projectId].name;
  }
  return fallback;
}

/**
 * Returns human-readable Project Code (e.g. PRJ-GANJ-005) from ID
 */
export function getProjectCode(projectId?: string | null, fallback = "FACILITY"): string {
  if (!projectId) return fallback;
  if (PROJECT_MAP[projectId]) {
    return PROJECT_MAP[projectId].code;
  }
  return fallback;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Formats parts of a Date in Asia/Kolkata using numeric month for composition. */
function getCalendarParts(
  d: Date,
  withTime: boolean,
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
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "—";
    const p = getCalendarParts(d, false);
    const month = SHORT_MONTHS[Number(p.month) - 1] ?? "—";
    return `${p.day} ${month} ${p.year}`;
  } catch {
    return "—";
  }
}

/**
 * Formats date into standard short administrative format: "12 Sep 2026"
 */
export function formatShortDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "—";
    const p = getCalendarParts(d, false);
    const month = SHORT_MONTHS[Number(p.month) - 1] ?? "—";
    return `${p.day} ${month} ${p.year}`;
  } catch {
    return "—";
  }
}

function formatDateTimeParts(d: Date): string {
  const p = getCalendarParts(d, true);
  const month = SHORT_MONTHS[Number(p.month) - 1] ?? "—";
  const period = (p.dayPeriod ?? "").toUpperCase();
  return `${p.day} ${month}, ${p.year} at ${p.hour}:${p.minute} ${period}`;
}

/**
 * Formats datetime into short administrative format: "12 Sep, 2026 at 10:58 PM"
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "—";
    return formatDateTimeParts(d);
  } catch {
    return "—";
  }
}
