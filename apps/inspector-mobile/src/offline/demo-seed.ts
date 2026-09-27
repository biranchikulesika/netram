/**
 * src/offline/demo-seed.ts
 *
 * Seeds realistic Bhubaneswar inspection data for demonstration and
 * development purposes. Called on first app launch when the SQLite
 * database is empty (no cached inspections).
 *
 * ALL data is SYNTHETIC — no real persons, no real credentials.
 * This module MUST NOT be imported in production builds that connect
 * to a live API (the API fetch will overwrite these records on sync).
 */

import { getOfflineDatabase } from "./db";

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86_400_000).toISOString();
const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString();
const twoDaysLater = new Date(Date.now() + 2 * 86_400_000).toISOString();
const threeDaysLater = new Date(Date.now() + 3 * 86_400_000).toISOString();
const fiveDaysLater = new Date(Date.now() + 5 * 86_400_000).toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// Demo inspection records — real Bhubaneswar locations
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_INSPECTIONS = [
  {
    id: "demo-insp-001",
    project_id: "demo-proj-001",
    project_name: "Sishhu Bhawan Senior Citizen Home",
    project_code: "DOSJE-BBR-001",
    type: "routine",
    status: "assigned",
    district_id: "Khordha",
    scheduled_start: twoDaysLater,
    scheduled_end: threeDaysLater,
    started_at: null,
    submitted_at: null,
  },
  {
    id: "demo-insp-002",
    project_id: "demo-proj-002",
    project_name: "Kalyan Mandap IRCA Rehabilitation Centre",
    project_code: "DOSJE-BBR-002",
    type: "special",
    status: "in_progress",
    district_id: "Khordha",
    scheduled_start: yesterday,
    scheduled_end: nextWeek,
    started_at: yesterday,
    submitted_at: null,
  },
  {
    id: "demo-insp-003",
    project_id: "demo-proj-003",
    project_name: "Navajyoti SC/ST Girls Hostel",
    project_code: "DOSJE-BBR-003",
    type: "routine",
    status: "assigned",
    district_id: "Khordha",
    scheduled_start: fiveDaysLater,
    scheduled_end: null,
    started_at: null,
    submitted_at: null,
  },
  {
    id: "demo-insp-004",
    project_id: "demo-proj-004",
    project_name: "Swadhar Greh Women Shelter",
    project_code: "DOSJE-BBR-004",
    type: "follow_up",
    status: "assigned",
    district_id: "Khordha",
    scheduled_start: nextWeek,
    scheduled_end: null,
    started_at: null,
    submitted_at: null,
  },
  {
    id: "demo-insp-005",
    project_id: "demo-proj-005",
    project_name: "Sunshine Skill Development Centre",
    project_code: "DOSJE-BBR-005",
    type: "social_audit",
    status: "submitted",
    district_id: "Khordha",
    scheduled_start: yesterday,
    scheduled_end: yesterday,
    started_at: yesterday,
    submitted_at: now,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Geofences — real Bhubaneswar coordinates (lat, lng)
// Each site has a 300–500 m radius circle
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_GEOFENCES = [
  {
    // Sishhu Bhawan — Unit-IX, Bhubaneswar
    projectId: "demo-proj-001",
    centerLat: 20.2672,
    centerLng: 85.8418,
    radiusMeters: 1000,
    name: "Sishhu Bhawan Senior Citizen Home",
  },
  {
    // Near Kalyan Mandap, Saheed Nagar, Bhubaneswar
    projectId: "demo-proj-002",
    centerLat: 20.2961,
    centerLng: 85.8485,
    radiusMeters: 1000,
    name: "Kalyan Mandap IRCA Rehabilitation Centre",
  },
  {
    // Navajyoti — near Nayapalli, Bhubaneswar
    projectId: "demo-proj-003",
    centerLat: 20.2849,
    centerLng: 85.8143,
    radiusMeters: 1000,
    name: "Navajyoti SC/ST Girls Hostel",
  },
  {
    // Swadhar Greh — near Khandagiri, Bhubaneswar
    projectId: "demo-proj-004",
    centerLat: 20.2536,
    centerLng: 85.7812,
    radiusMeters: 1000,
    name: "Swadhar Greh Women Shelter",
  },
  {
    // Sunshine SDC — near Rasulgarh, Bhubaneswar
    projectId: "demo-proj-005",
    centerLat: 20.3101,
    centerLng: 85.8643,
    radiusMeters: 1000,
    name: "Sunshine Skill Development Centre",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed function — idempotent (safe to call multiple times)
// ─────────────────────────────────────────────────────────────────────────────

export const STANDARD_CHECKLIST_TEMPLATE = [
  {
    category: "Safety & Security",
    question: "Are mandatory safety signages displayed at prominent entry and work locations?",
    isRequired: true,
  },
  {
    category: "Safety & Security",
    question: "Are fire safety apparatus installed, within valid certification, and unobstructed?",
    isRequired: true,
  },
  {
    category: "Safety & Security",
    question: "Is site perimeter and boundary fencing intact without unauthorized breach points?",
    isRequired: true,
  },
  {
    category: "Infrastructure & Quality",
    question: "Are civil structural elements free from visible cracks, dampness, or structural defects?",
    isRequired: true,
  },
  {
    category: "Infrastructure & Quality",
    question: "Is electrical wiring conduit-sheathed with functional MCBs and earthing pits?",
    isRequired: true,
  },
  {
    category: "Infrastructure & Quality",
    question: "Is clean potable drinking water facility functional on site for workers/beneficiaries?",
    isRequired: true,
  },
  {
    category: "Infrastructure & Quality",
    question: "Are gender-segregated sanitation facilities operational and hygienically maintained?",
    isRequired: true,
  },
  {
    category: "Compliance & Records",
    question: "Is the official scheme information display board legible and compliant with state guidelines?",
    isRequired: true,
  },
  {
    category: "Compliance & Records",
    question: "Is the daily labor muster roll and attendance register updated and available on site?",
    isRequired: true,
  },
  {
    category: "Compliance & Records",
    question: "Are material testing certificates and delivery challans verified and archived on site?",
    isRequired: false,
  },
];

export async function seedDemoDataIfEmpty(): Promise<void> {
  const db = await getOfflineDatabase();

  // Check if already seeded
  const existing = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM cached_inspections",
  );
  if (existing.length > 0) return; // already has data — don't overwrite

  const cachedAt = new Date().toISOString();

  for (const insp of DEMO_INSPECTIONS) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_inspections
        (id, project_id, project_name, project_code, type, status, district_id,
         scheduled_start, scheduled_end, started_at, submitted_at, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insp.id,
        insp.project_id,
        insp.project_name,
        insp.project_code,
        insp.type,
        insp.status,
        insp.district_id,
        insp.scheduled_start,
        insp.scheduled_end,
        insp.started_at,
        insp.submitted_at,
        cachedAt,
      ],
    );

    // Seed standard checklist items for each inspection
    for (let i = 0; i < STANDARD_CHECKLIST_TEMPLATE.length; i++) {
      const template = STANDARD_CHECKLIST_TEMPLATE[i]!;
      const itemId = `chk-${insp.id}-${String(i + 1).padStart(2, "0")}`;
      let initialResponse: string | null = null;
      if (insp.status === "submitted") {
        initialResponse = "pass";
      } else if (insp.status === "in_progress" && i < 3) {
        initialResponse = i === 1 ? "fail" : "pass";
      }

      await db.runAsync(
        `INSERT OR REPLACE INTO cached_checklist_items
          (id, inspection_id, category, question, is_required, response, note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          insp.id,
          template.category,
          template.question,
          template.isRequired ? 1 : 0,
          initialResponse,
          initialResponse === "fail" ? "Extinguisher inspection tag expired by 3 months" : null,
          cachedAt,
        ],
      );
    }
  }
}

