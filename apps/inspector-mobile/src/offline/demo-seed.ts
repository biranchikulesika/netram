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

  const existing = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM cached_inspections",
  );
  if (existing.length === 0) {
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

  // Seed call contacts if empty
  const existingContacts = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM cached_call_contacts",
  );
  if (existingContacts.length === 0) {
    for (const c of DEMO_CALL_CONTACTS) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_call_contacts
          (id, name, role, title, project_code, project_name, phone, is_online, avatar_color, video_uri)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.name,
          c.role,
          c.title,
          c.projectCode,
          c.projectName,
          c.phone,
          c.isOnline ? 1 : 0,
          c.avatarColor,
          c.videoUri,
        ],
      );
    }
  }

  // Seed call history if empty
  const existingHistory = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM cached_call_history",
  );
  if (existingHistory.length === 0) {
    for (const h of DEMO_CALL_HISTORY) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_call_history
          (id, contact_id, contact_name, contact_title, role, project_name, project_code,
           call_type, duration_seconds, timestamp, condition, review_text, flag_inspection,
           video_uri, inspector_video_uri, direction, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          h.id,
          h.contactId,
          h.contactName,
          h.contactTitle,
          h.role,
          h.projectName,
          h.projectCode,
          h.callType,
          h.durationSeconds,
          h.timestamp,
          h.condition,
          h.reviewText,
          h.flagInspection ? 1 : 0,
          h.videoUri,
          h.inspectorVideoUri,
          h.direction,
          h.status,
          h.createdAt,
        ],
      );
    }
  }
}

const DEMO_VIDEO_FALLBACK =
  "https://raw.githubusercontent.com/OpenTalker/video-retalking/main/examples/face/1.mp4";

export const DEMO_CALL_CONTACTS = [
  {
    id: "cnt-01",
    name: "Ramesh Jena",
    role: "staff" as const,
    title: "Facility In-Charge",
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    phone: "+91 94370 12890",
    isOnline: true,
    avatarColor: "#3a488b",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-02",
    name: "Dr. Anita Behera",
    role: "staff" as const,
    title: "Medical Officer",
    projectCode: "DOSJE-BBR-002",
    projectName: "Kalyan Mandap IRCA Rehabilitation",
    phone: "+91 98610 44521",
    isOnline: true,
    avatarColor: "#15803d",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-03",
    name: "Bipin Bihari Das",
    role: "beneficiary" as const,
    title: "Senior Resident Lead",
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    phone: "+91 94381 77230",
    isOnline: true,
    avatarColor: "#f59e0b",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-04",
    name: "Er. Manoj Nayak",
    role: "staff" as const,
    title: "Site Engineer",
    projectCode: "DOSJE-BBR-003",
    projectName: "Navajyoti SC/ST Girls Hostel",
    phone: "+91 97760 99312",
    isOnline: false,
    avatarColor: "#1c3a63",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-05",
    name: "Sunita Mohanty",
    role: "staff" as const,
    title: "Shelter Superintendent",
    projectCode: "DOSJE-BBR-004",
    projectName: "Swadhar Greh Women Shelter",
    phone: "+91 94392 65410",
    isOnline: true,
    avatarColor: "#002449",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-06",
    name: "Laxmi Murmu",
    role: "beneficiary" as const,
    title: "Beneficiary Representative",
    projectCode: "DOSJE-BBR-003",
    projectName: "Navajyoti SC/ST Girls Hostel",
    phone: "+91 98533 11840",
    isOnline: true,
    avatarColor: "#c2410c",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-07",
    name: "Pravat Kumar Rout",
    role: "staff" as const,
    title: "Project Coordinator",
    projectCode: "DOSJE-BBR-002",
    projectName: "Kalyan Mandap IRCA Centre",
    phone: "+91 94371 88902",
    isOnline: false,
    avatarColor: "#15803d",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
  {
    id: "cnt-08",
    name: "Minati Sahoo",
    role: "beneficiary" as const,
    title: "Resident Beneficiary",
    projectCode: "DOSJE-BBR-004",
    projectName: "Swadhar Greh Women Shelter",
    phone: "+91 96924 55301",
    isOnline: true,
    avatarColor: "#0c2a52",
    videoUri: DEMO_VIDEO_FALLBACK,
  },
];

export const DEMO_CALL_HISTORY = [
  {
    id: "hist-01",
    contactId: "cnt-02",
    contactName: "Dr. Anita Behera",
    contactTitle: "Medical Officer",
    role: "staff" as const,
    projectCode: "DOSJE-BBR-002",
    projectName: "Kalyan Mandap IRCA Rehabilitation",
    callType: "video" as const,
    durationSeconds: 374,
    timestamp: "Today, 11:30 AM",
    condition: "minor_issue" as const,
    reviewText:
      "Medical supplies stock is adequate for 2 weeks. Reported delay in quarterly fund release for ambulance fuel. Staff attendance verified over camera.",
    flagInspection: false,
    videoUri: DEMO_VIDEO_FALLBACK,
    inspectorVideoUri: DEMO_VIDEO_FALLBACK,
    direction: "outgoing" as const,
    status: "answered" as const,
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
  },
  {
    id: "hist-02",
    contactId: "cnt-03",
    contactName: "Bipin Bihari Das",
    contactTitle: "Senior Resident Lead",
    role: "beneficiary" as const,
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    callType: "video" as const,
    durationSeconds: 220,
    timestamp: "Yesterday, 04:15 PM",
    condition: "satisfactory" as const,
    reviewText:
      "Beneficiary confirmed warm meals served on schedule. RO water filter is operational. Zero staff misconduct or grievances reported.",
    flagInspection: false,
    videoUri: DEMO_VIDEO_FALLBACK,
    inspectorVideoUri: DEMO_VIDEO_FALLBACK,
    direction: "incoming" as const,
    status: "answered" as const,
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: "hist-03",
    contactId: "cnt-04",
    contactName: "Er. Manoj Nayak",
    contactTitle: "Site Engineer",
    role: "staff" as const,
    projectCode: "DOSJE-BBR-003",
    projectName: "Navajyoti SC/ST Girls Hostel",
    callType: "video" as const,
    durationSeconds: 502,
    timestamp: "Sep 24, 02:20 PM",
    condition: "critical_problem" as const,
    reviewText:
      "Perimeter boundary wall construction halted due to cement shortage. Deep unpaved trench waterlogged creating severe safety hazard for resident girls.",
    flagInspection: true,
    videoUri: DEMO_VIDEO_FALLBACK,
    inspectorVideoUri: DEMO_VIDEO_FALLBACK,
    direction: "outgoing" as const,
    status: "answered" as const,
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
  },
  {
    id: "hist-04",
    contactId: "cnt-05",
    contactName: "Sunita Mohanty",
    contactTitle: "Shelter Superintendent",
    role: "staff" as const,
    projectCode: "DOSJE-BBR-004",
    projectName: "Swadhar Greh Women Shelter",
    callType: "video" as const,
    durationSeconds: 0,
    timestamp: "Sep 23, 10:15 AM",
    condition: "satisfactory" as const,
    reviewText: "Missed incoming call. Beneficiary intake inquiry pending.",
    flagInspection: false,
    direction: "incoming" as const,
    status: "missed" as const,
    createdAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
  },
  {
    id: "hist-05",
    contactId: "cnt-01",
    contactName: "Ramesh Jena",
    contactTitle: "Facility In-Charge",
    role: "staff" as const,
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    callType: "video" as const,
    durationSeconds: 0,
    timestamp: "Sep 22, 06:45 PM",
    condition: "satisfactory" as const,
    reviewText: "Unanswered outgoing call. Facility lines engaged during evening check.",
    flagInspection: false,
    direction: "outgoing" as const,
    status: "missed" as const,
    createdAt: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
  },
];


