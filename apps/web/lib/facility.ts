import { cache } from "react";
import type {
  Project,
  ProjectPhoto,
  Inspection,
  Complaint,
  CorrectiveAction,
  AttendanceCalculation,
  AttendanceOverviewItem,
  AttendanceAnomaly,
  AIAnomaly,
  AuditEvent,
  PublicCctvCamera,
  ProjectRiskSnapshot,
} from "@netram/types";
import { getClient } from "./api";

/**
 * Facility-centric data access (§CORE IA).
 *
 * A facility is the primary operational context. These helpers serve one
 * facility's aspects (inspections, complaints, monitoring, attendance,
 * corrective actions, activity) from the existing REST API so the
 * facility hub can present them without duplicating global navigation.
 *
 * APIs without a native project filter (AI anomalies, corrective
 * actions, CCTV) are scoped here by following the facility's own records
 * (inspection/project context). Server-side jurisdiction still applies at the
 * API layer; these filters only narrow to the current facility.
 */

const EMPTY_INSPECTIONS = { items: [] as Inspection[], total: 0, page: 1, pageSize: 0 };
const EMPTY_COMPLAINTS = { items: [] as Complaint[], total: 0, page: 1, pageSize: 0 };
const EMPTY_CORRECTIVE_ACTIONS = {
  items: [] as CorrectiveAction[],
  total: 0,
  page: 1,
  pageSize: 0,
};
const EMPTY_ANOMALIES = { items: [] as AIAnomaly[], total: 0, page: 1, pageSize: 0 };
const EMPTY_AUDIT = {
  items: [] as AuditEvent[],
  total: 0,
  page: 1,
  pageSize: 0,
};
const EMPTY_CAMERAS = { items: [] as PublicCctvCamera[], total: 0, page: 1, pageSize: 0 };
const EMPTY_ATTENDANCE_OVERVIEW = {
  items: [] as AttendanceOverviewItem[],
  total: 0,
  page: 1,
  pageSize: 0,
};
const EMPTY_ATTENDANCE_ANOMALIES = {
  items: [] as AttendanceAnomaly[],
  total: 0,
  page: 1,
  pageSize: 0,
};

/** Loads the facility (project) once per request across layout + pages. */
export const getFacility = cache(async (id: string): Promise<Project | null> => {
  const client = await getClient();
  try {
    return await client.getProject(id);
  } catch {
    return null;
  }
});

/**
 * User directory as `userId -> displayName`.
 *
 * The user-admin API is permission-gated, so this degrades to an empty map for
 * viewers without it; callers then fall back to honest role labels. Shared
 * across every page that renders a person, and cached so one request fetches it
 * once.
 */
export const getUserNames = cache(async (): Promise<Record<string, string>> => {
  const client = await getClient();
  const page = await client
    .listUsers({ pageSize: 200 })
    .catch(() => ({ items: [], total: 0, page: 1, pageSize: 0 }));
  const names: Record<string, string> = {};
  for (const u of page.items) {
    if (u.displayName) names[u.id] = u.displayName;
  }
  return names;
});

export const getFacilityPhotos = cache(async (id: string): Promise<ProjectPhoto[]> => {
  const client = await getClient();
  try {
    return await client.listProjectPhotos(id);
  } catch {
    return [];
  }
});

export async function getFacilityInspections(projectId: string): Promise<Inspection[]> {
  const client = await getClient();
  const page = await client
    .listInspections({ projectId, pageSize: 100 })
    .catch(() => EMPTY_INSPECTIONS);
  return page.items;
}

export async function getFacilityComplaints(projectId: string): Promise<Complaint[]> {
  const client = await getClient();
  const page = await client
    .listComplaints({ projectId, pageSize: 100 })
    .catch(() => EMPTY_COMPLAINTS);
  return page.items;
}

/**
 * Corrective actions are reached through findings attached to an inspection.
 * The API has no project filter, so collect the facility's inspections first.
 */
export async function getFacilityCorrectiveActions(
  projectId: string,
  inspections?: Inspection[],
): Promise<CorrectiveAction[]> {
  const list = inspections ?? (await getFacilityInspections(projectId));
  const inspectionIds = list.map((i) => i.id);
  if (inspectionIds.length === 0) return [];

  const client = await getClient();
  const pages = await Promise.all(
    inspectionIds.map((inspectionId) =>
      client
        .listCorrectiveActions({ inspectionId, pageSize: 100 })
        .catch(() => EMPTY_CORRECTIVE_ACTIONS),
    ),
  );
  return pages.flatMap((p) => p.items);
}

/**
 * AI anomalies are reviewable signals tied to this facility. Filtering happens
 * server-side (API contract supports projectId); jurisdiction scoping still
 * applies at the API layer on top of this.
 */
export async function getFacilityAiAnomalies(projectId: string): Promise<AIAnomaly[]> {
  const client = await getClient();
  const page = await client
    .listAiAnomalies({ projectId, pageSize: 100 })
    .catch(() => EMPTY_ANOMALIES);
  return page.items;
}

export async function getFacilityAttendance(projectId: string): Promise<{
  overview: AttendanceOverviewItem[];
  anomalies: AttendanceAnomaly[];
}> {
  const client = await getClient();
  const [overview, anomalies] = await Promise.all([
    client
      .listAttendanceOverview({ projectId, pageSize: 50 })
      .catch(() => EMPTY_ATTENDANCE_OVERVIEW),
    client
      .listAttendanceAnomalies({ projectId, pageSize: 50 })
      .catch(() => EMPTY_ATTENDANCE_ANOMALIES),
  ]);
  return { overview: overview.items, anomalies: anomalies.items };
}

export async function getFacilityAttendanceCalculations(
  projectId: string,
): Promise<AttendanceCalculation[]> {
  const client = await getClient();
  const all: AttendanceCalculation[] = [];
  for (let page = 1; page <= 20; page += 1) {
    try {
      const res = await client.listAttendanceCalculations({ projectId, page, pageSize: 100 });
      all.push(...res.items);
      if (res.items.length < 100) break;
    } catch {
      break;
    }
  }
  return all;
}

export async function getFacilityAudit(projectId: string, pageSize = 100): Promise<AuditEvent[]> {
  const client = await getClient();
  const page = await client
    .listAuditEvents({ resourceType: "project", resourceId: projectId, pageSize })
    .catch(() => EMPTY_AUDIT);
  return page.items;
}

/** CCTV coverage in the facility's district (cameras are district-scoped). */
export async function getDistrictCameras(districtId: string | null): Promise<PublicCctvCamera[]> {
  if (!districtId) return [];
  const client = await getClient();
  const page = await client
    .listCameras({ districtId, pageSize: 100 })
    .catch(() => EMPTY_CAMERAS);
  return page.items;
}

export async function getFacilityFunds(projectId: string) {
  const client = await getClient();
  return client.getProjectFundOverview(projectId).catch(() => null);
}

/**
 * Returns the latest snapshot, or null when the project has never been scored.
 * A failed request is deliberately NOT swallowed: a 200-with-null body is the
 * API's "not scored yet" signal, so an error here is a real fault and must not
 * be rendered as a missing score.
 */
export const getFacilityRiskSnapshot = cache(
  async (projectId: string): Promise<ProjectRiskSnapshot | null> => {
    const client = await getClient();
    return client.getLatestProjectRiskSnapshot(projectId);
  },
);