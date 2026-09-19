import { resolve } from "node:path";
import { v5 as uuidv5 } from "uuid";
import { getDb } from "@netram/data";
import * as s from "@netram/data/schema";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../.env"));
} catch {
  // Ignore if .env does not exist or already loaded
}

/** Deterministic namespace for all seed IDs. */
const SEED_NS = "d3a5e19a-9a1e-4f0b-8f44-3b0b8f44b1a2";

export function did(seed: string): string {
  return uuidv5(seed, SEED_NS);
}

export async function seedDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for seeding.");
  const db = getDb(databaseUrl);

  // ---------- Geography ----------
  const [india] = await db
    .insert(s.countries)
    .values({ id: did("country:india"), code: "IN", name: "India" })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(s.states)
    .values({
      id: did("state:odisha"),
      countryId: india?.id ?? did("country:india"),
      code: "OR",
      name: "Odisha",
    })
    .onConflictDoNothing();

  const districtRows = [
    {
      id: did("district:khordha"),
      stateId: did("state:odisha"),
      code: "KHOL",
      name: "Khordha",
    },
    {
      id: did("district:cuttack"),
      stateId: did("state:odisha"),
      code: "CUT",
      name: "Cuttack",
    },
    {
      id: did("district:puri"),
      stateId: did("state:odisha"),
      code: "PURI",
      name: "Puri",
    },
    {
      id: did("district:ganjam"),
      stateId: did("state:odisha"),
      code: "GANJ",
      name: "Ganjam",
    },
    {
      id: did("district:sundargarh"),
      stateId: did("state:odisha"),
      code: "SNDR",
      name: "Sundargarh",
    },
  ];
  for (const d of districtRows) {
    await db.insert(s.districts).values(d).onConflictDoNothing();
  }

  // ---------- Authorities ----------
  await db
    .insert(s.authorities)
    .values([
      {
        id: did("authority:dosje"),
        code: "DOSJE-OR",
        name: "Department of Social Justice & Empowerment, Odisha",
        type: "department",
      },
      {
        id: did("authority:dosje-khordha"),
        code: "DOSJE-KHOL",
        name: "District Social Welfare Office, Khordha",
        type: "district-unit",
        parentId: did("authority:dosje"),
      },
      {
        id: did("authority:dosje-cuttack"),
        code: "DOSJE-CUT",
        name: "District Social Welfare Office, Cuttack",
        type: "district-unit",
        parentId: did("authority:dosje"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Jurisdictions ----------
  await db
    .insert(s.jurisdictions)
    .values([
      {
        id: did("jurisdiction:national"),
        code: "J-NATIONAL",
        name: "National (DoSJE)",
        countryId: india?.id ?? did("country:india"),
        scopeLevel: "national",
      },
      {
        id: did("jurisdiction:khordha"),
        code: "J-KHOL",
        name: "Khordha District",
        districtId: did("district:khordha"),
        scopeLevel: "jurisdiction",
      },
      {
        id: did("jurisdiction:cuttack"),
        code: "J-CUT",
        name: "Cuttack District",
        districtId: did("district:cuttack"),
        scopeLevel: "jurisdiction",
      },
      {
        id: did("jurisdiction:puri"),
        code: "J-PURI",
        name: "Puri District",
        districtId: did("district:puri"),
        scopeLevel: "jurisdiction",
      },
      {
        id: did("jurisdiction:ganjam"),
        code: "J-GANJ",
        name: "Ganjam District",
        districtId: did("district:ganjam"),
        scopeLevel: "jurisdiction",
      },
      {
        id: did("jurisdiction:odisha"),
        code: "J-OR",
        name: "Odisha State",
        stateId: did("state:odisha"),
        scopeLevel: "jurisdiction",
      },
    ])
    .onConflictDoNothing();

  // ---------- Users (development-only, synthetic) ----------
  const users = [
    {
      id: did("user:dept-admin"),
      email: "admin.example-social@dev.netram.in",
      displayName: "Biranchi (Dept Admin)",
      status: "active",
    },
    {
      id: did("user:officer-khordha"),
      email: "officer.khordha@dev.netram.in",
      displayName: "Sruti (Officer, Khordha)",
      status: "active",
    },
    {
      id: did("user:officer-cuttack"),
      email: "officer.cuttack@dev.netram.in",
      displayName: "Jyotirmaya (Officer, Cuttack)",
      status: "active",
    },
    {
      id: did("user:control-room"),
      email: "controlroom@dev.netram.in",
      displayName: "Room Ops",
      status: "active",
    },
    {
      id: did("user:institution"),
      email: "institution.vani@dev.netram.in",
      displayName: "Vani Vihar Hostel Admin",
      status: "active",
    },
    {
      id: did("user:inspector-1"),
      email: "inspector.one@dev.netram.in",
      displayName: "Inspector Smruti",
      status: "active",
    },
    {
      id: did("user:inspector-2"),
      email: "inspector.two@dev.netram.in",
      displayName: "Inspector Diptesh",
      status: "active",
    },
    {
      id: did("user:inspector-3"),
      email: "inspector.three@dev.netram.in",
      displayName: "Inspector Bishnu",
      status: "active",
    },
  ] as const;
  for (const u of users) {
    await db
      .insert(s.users)
      .values({ ...u })
      .onConflictDoNothing();
    await db
      .insert(s.identities)
      .values({
        id: did(`identity:${u.email}`),
        userId: u.id,
        provider: "dev",
        providerSubject: u.id,
        email: u.email,
      })
      .onConflictDoNothing();
  }

  // ---------- Roles & permissions ----------
  const permissionRows = [
    {
      code: "project:read",
      name: "Read projects",
      description: "List and view project details",
    },
    {
      code: "project:create",
      name: "Create projects",
      description: "Register new projects",
    },
    {
      code: "project:transition",
      name: "Transition projects",
      description: "Move projects through the lifecycle",
    },
    {
      code: "project:approve",
      name: "Approve projects",
      description: "Approve pending projects (authority only)",
    },
    {
      code: "audit:read",
      name: "Read audit log",
      description: "View audit events",
    },
    {
      code: "inspection:read",
      name: "Read inspections",
      description: "View inspections and their details",
    },
    {
      code: "inspection:create",
      name: "Create inspections",
      description: "Initiate an inspection against a project",
    },
    {
      code: "inspection:assign",
      name: "Assign inspections",
      description: "Assign inspectors to inspections",
    },
    {
      code: "inspection:transition",
      name: "Progress inspections",
      description: "Start/submit inspections (inspector-owned steps)",
    },
    {
      code: "inspection:review",
      name: "Review inspections",
      description: "Authority review/findings/closure decisions",
    },
    {
      code: "observation:create",
      name: "Create observations",
      description: "Record field observations during an inspection",
    },
    {
      code: "evidence:create",
      name: "Capture evidence",
      description: "Capture and manage inspection evidence metadata",
    },
    {
      code: "complaint:read",
      name: "Read complaints",
      description: "View complaints",
    },
    {
      code: "complaint:create",
      name: "Create complaints",
      description: "Register a new complaint",
    },
    {
      code: "complaint:resolve",
      name: "Resolve complaints",
      description: "Review, escalate, resolve, or close complaints",
    },
    {
      code: "corrective_action:read",
      name: "Read corrective actions",
      description: "View corrective actions",
    },
    {
      code: "corrective_action:submit",
      name: "Submit corrective actions",
      description: "Submit remediation for corrective actions (institutions)",
    },
    {
      code: "corrective_action:approve",
      name: "Approve corrective actions",
      description: "Review and accept/reject corrective actions (authority)",
    },
    {
      code: "ai:anomaly:read",
      name: "Read AI anomalies",
      description: "View advisory AI anomaly alerts",
    },
    {
      code: "ai:anomaly:transition",
      name: "Transition AI anomalies",
      description: "Review, dismiss, investigate, or act on AI anomalies (authority)",
    },
    {
      code: "report:read",
      name: "Read reports",
      description: "View generated reports",
    },
    {
      code: "report:generate",
      name: "Generate reports",
      description: "Request and generate derived inspection reports",
    },
    {
      code: "report:finalize",
      name: "Finalize reports",
      description: "Finalize generated reports (immutable)",
    },
    {
      code: "notification:read",
      name: "Read notifications",
      description: "View own in-app notifications",
    },
    {
      code: "attendance:monitor:read",
      name: "Read attendance monitoring",
      description: "View attendance overview and calculations",
    },
    {
      code: "attendance:anomaly:read",
      name: "Read attendance anomalies",
      description: "View attendance anomaly alerts",
    },
    {
      code: "attendance:anomaly:review",
      name: "Review attendance anomalies",
      description: "Review, dismiss, investigate, or act on attendance anomalies",
    },
    {
      code: "attendance:ingest",
      name: "Ingest attendance events",
      description: "Receive and process biometric device events",
    },
    {
      code: "attendance:export",
      name: "Export attendance data",
      description: "Generate and download attendance CSV exports",
    },
    {
      code: "attendance:individual:read",
      name: "Read individual attendance",
      description: "View person-level attendance events (audited per access)",
    },
    {
      code: "user:manage",
      name: "Manage users",
      description: "Create/update users and identities",
    },
    {
      code: "role:manage",
      name: "Manage roles",
      description: "Change roles and permissions",
    },
    {
      code: "cctv:read",
      name: "Read CCTV cameras",
      description: "List and view CCTV cameras and status",
    },
    {
      code: "cctv:stream",
      name: "Stream CCTV feeds",
      description: "Request authorized CCTV streaming sessions",
    },
    {
      code: "vc_session:read",
      name: "Read VC sessions",
      description: "View and join video conferencing review sessions",
    },
    {
      code: "vc_session:create",
      name: "Create VC sessions",
      description: "Schedule video conferencing review sessions",
    },
    {
      code: "vc_session:manage",
      name: "Manage VC sessions",
      description: "Start, end, and moderate video conferencing sessions",
    },
  ] as const;
  for (const p of permissionRows) {
    await db
      .insert(s.permissions)
      .values({ ...p })
      .onConflictDoNothing();
  }

  const roles = [
    {
      id: did("role:system_admin"),
      code: "system_admin",
      name: "System Administrator",
      permissions: permissionRows.map((p) => p.code),
    },
    {
      id: did("role:authority_officer"),
      code: "authority_officer",
      name: "Authority Officer",
      permissions: [
        "project:read",
        "project:transition",
        "project:approve",
        "inspection:read",
        "inspection:create",
        "inspection:assign",
        "inspection:transition",
        "inspection:review",
        "complaint:read",
        "complaint:resolve",
        "ai:anomaly:read",
        "ai:anomaly:transition",
        "corrective_action:read",
        "corrective_action:approve",
        "report:read",
        "report:generate",
        "report:finalize",
        "audit:read",
        "notification:read",
        "cctv:read",
        "cctv:stream",
        "vc_session:read",
        "vc_session:create",
        "vc_session:manage",
      ],
    },
    {
      id: did("role:control_room"),
      code: "control_room",
      name: "Control Room",
      permissions: [
        "project:read",
        "inspection:read",
        "complaint:read",
        "complaint:create",
        "complaint:resolve",
        "ai:anomaly:read",
        "corrective_action:read",
        "report:read",
        "notification:read",
        "cctv:read",
        "cctv:stream",
        "vc_session:read",
      ],
    },
    {
      id: did("role:institution_admin"),
      code: "institution_admin",
      name: "Institution / Organisation Admin",
      // Explicitly lacks project:approve: institutions cannot approve themselves.
      permissions: [
        "project:read",
        "project:create",
        "project:transition",
        "inspection:read",
        "complaint:read",
        "corrective_action:read",
        "corrective_action:submit",
        "notification:read",
        "vc_session:read",
      ],
    },
    {
      id: did("role:inspector"),
      code: "inspector",
      name: "Inspector",
      permissions: [
        "project:read",
        "inspection:read",
        "inspection:transition",
        "observation:create",
        "evidence:create",
        "notification:read",
        "vc_session:read",
      ],
    },
  ] as const;

  for (const role of roles) {
    await db
      .insert(s.roles)
      .values({ id: role.id, code: role.code, name: role.name })
      .onConflictDoNothing();
    for (const permissionCode of role.permissions) {
      await db
        .insert(s.rolePermissions)
        .values({ roleId: role.id, permissionCode })
        .onConflictDoNothing();
    }
  }

  // ---------- Role assignments ----------
  await db
    .insert(s.roleAssignments)
    .values([
      {
        id: did("ra:admin"),
        userId: did("user:dept-admin"),
        roleCode: "system_admin",
        jurisdictionId: did("jurisdiction:national"),
        scope: "national",
      },
      {
        id: did("ra:officer-khordha"),
        userId: did("user:officer-khordha"),
        roleCode: "authority_officer",
        authorityId: did("authority:dosje-khordha"),
        jurisdictionId: did("jurisdiction:khordha"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:officer-cuttack"),
        userId: did("user:officer-cuttack"),
        roleCode: "authority_officer",
        authorityId: did("authority:dosje-cuttack"),
        jurisdictionId: did("jurisdiction:cuttack"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:control-room"),
        userId: did("user:control-room"),
        roleCode: "control_room",
        jurisdictionId: did("jurisdiction:odisha"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:institution"),
        userId: did("user:institution"),
        roleCode: "institution_admin",
        authorityId: did("authority:dosje-khordha"),
        jurisdictionId: did("jurisdiction:khordha"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:inspector-1"),
        userId: did("user:inspector-1"),
        roleCode: "inspector",
        jurisdictionId: did("jurisdiction:khordha"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:inspector-2"),
        userId: did("user:inspector-2"),
        roleCode: "inspector",
        jurisdictionId: did("jurisdiction:cuttack"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:inspector-3"),
        userId: did("user:inspector-3"),
        roleCode: "inspector",
        jurisdictionId: did("jurisdiction:ganjam"),
        scope: "jurisdiction",
      },
    ])
    .onConflictDoNothing();

  // ---------- Organisations ----------
  await db
    .insert(s.organisations)
    .values([
      {
        id: did("org:vani"),
        code: "ORG-VANI",
        name: "Vani Vihar SC/ST Hostel",
        category: "SC/ST Hostel",
        authorityId: did("authority:dosje-khordha"),
        districtId: did("district:khordha"),
      },
      {
        id: did("org:rajdhani"),
        code: "ORG-RAJDHANI",
        name: "Rajdhani Boys' Hostel (ST)",
        category: "ST Hostel",
        authorityId: did("authority:dosje-khordha"),
        districtId: did("district:khordha"),
      },
      {
        id: did("org:cuttack-girls"),
        code: "ORG-CUTG",
        name: "Cuttack Girls' Hostel",
        category: "SC/ST Girls Hostel",
        authorityId: did("authority:dosje-cuttack"),
        districtId: did("district:cuttack"),
      },
      {
        id: did("org:puri-model"),
        code: "ORG-PURI",
        name: "Puri Model Boys' Hostel",
        category: "Model Hostel",
        authorityId: did("authority:dosje"),
        districtId: did("district:puri"),
      },
      {
        id: did("org:ganjam-school"),
        code: "ORG-GANJ",
        name: "Ganjam Model School Hostel",
        category: "Model School Hostel",
        authorityId: did("authority:dosje"),
        districtId: did("district:ganjam"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Programmes ----------
  await db
    .insert(s.programmes)
    .values([
      {
        id: did("programme:nsp"),
        code: "PGM-NSP",
        name: "National Scholarship Programme - Special Hostels",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("programme:surprise-audit"),
        code: "PGM-SURPRISE",
        name: "Annual Surprise Inspection Drive",
        authorityId: did("authority:dosje"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Disclosure policies ----------
  await db
    .insert(s.disclosurePolicies)
    .values([
      {
        id: did("policy:hidden"),
        code: "DP-HIDDEN",
        name: "Hidden until inspection start",
        ruleType: "at_start",
        ruleParams: { release: "inspection_started" },
      },
      {
        id: did("policy:officer"),
        code: "DP-OFFICER",
        name: "Officer visible before acceptance",
        ruleType: "after_accept",
        ruleParams: { release: "accepted" },
      },
    ])
    .onConflictDoNothing();

  // ---------- Projects ----------
  const projects = [
    {
      id: did("project:vani"),
      code: "PRJ-VANI-001",
      name: "Vani Vihar SC/ST Hostel",
      type: "institution",
      description: "SC/ST hostel near Vani Vihar, Bhubaneswar. 120 residents.",
      organisationId: did("org:vani"),
      authorityId: did("authority:dosje-khordha"),
      districtId: did("district:khordha"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2026-01-10T09:30:00Z"),
      programmeIds: [did("programme:nsp"), did("programme:surprise-audit")],
    },
    {
      id: did("project:rajdhani"),
      code: "PRJ-RAJDHANI-002",
      name: "Rajdhani Boys' Hostel (ST)",
      type: "institution",
      description: "ST boys' hostel, Khordha. Under verification.",
      organisationId: did("org:rajdhani"),
      authorityId: did("authority:dosje-khordha"),
      districtId: did("district:khordha"),
      status: "Pending Verification",
      approvedById: null,
      approvedAt: null,
      programmeIds: [did("programme:nsp")],
    },
    {
      id: did("project:cuttack-girls"),
      code: "PRJ-CUTG-003",
      name: "Cuttack Girls' Hostel",
      type: "institution",
      description: "Girls' hostel in Cuttack. Suspended during compliance review.",
      organisationId: did("org:cuttack-girls"),
      authorityId: did("authority:dosje-cuttack"),
      districtId: did("district:cuttack"),
      status: "Suspended",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-11-02T09:00:00Z"),
      programmeIds: [did("programme:surprise-audit")],
    },
    {
      id: did("project:puri-model"),
      code: "PRJ-PURI-004",
      name: "Puri Model Boys' Hostel",
      type: "institution",
      description: "Model hostel in Puri, entered as a draft.",
      organisationId: did("org:puri-model"),
      authorityId: did("authority:dosje"),
      districtId: did("district:puri"),
      status: "Draft",
      approvedById: null,
      approvedAt: null,
      programmeIds: [],
    },
    {
      id: did("project:ganjam-school"),
      code: "PRJ-GANJ-005",
      name: "Ganjam Model School Hostel",
      type: "institution",
      description: "Model school hostel in Ganjam.",
      organisationId: did("org:ganjam-school"),
      authorityId: did("authority:dosje"),
      districtId: did("district:ganjam"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-12-01T09:00:00Z"),
      programmeIds: [did("programme:nsp"), did("programme:surprise-audit")],
    },
  ] as const;

  for (const p of projects) {
    await db
      .insert(s.projects)
      .values({
        ...p,
        programmeIds: [...p.programmeIds],
      })
      .onConflictDoNothing();
  }

  // ---------- Inspection teams / templates ----------
  await db
    .insert(s.inspectionTeams)
    .values([
      { id: did("team:khordha-1"), name: "Khordha Surprise Inspection Team" },
      { id: did("team:cuttack-1"), name: "Cuttack Hostel Inspection Team" },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.teamMembers)
    .values([
      {
        teamId: did("team:khordha-1"),
        inspectorUserId: did("user:inspector-1"),
        role: "lead",
      },
      {
        teamId: did("team:cuttack-1"),
        inspectorUserId: did("user:inspector-2"),
        role: "lead",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.inspectionTemplates)
    .values([
      {
        id: did("template:hostel"),
        name: "Hostel Minimum Standards Checklist",
        version: "1.0",
        schema: {
          sections: [
            {
              key: "kitchen",
              label: "Kitchen & Hygiene",
              items: ["fire_safety", "cooking_area_cleanliness", "food_storage"],
            },
            {
              key: "dormitory",
              label: "Dormitory",
              items: ["bedding", "ventilation", "occupancy"],
            },
            {
              key: "sanitation",
              label: "Water & Sanitation",
              items: ["drinking_water", "toilets"],
            },
          ],
        },
      },
    ])
    .onConflictDoNothing();

  // ---------- Inspections ----------
  await db
    .insert(s.inspections)
    .values([
      {
        id: did("inspection:vani-surprise"),
        projectId: did("project:vani"),
        templateId: did("template:hostel"),
        type: "surprise",
        trigger: "officer",
        status: "findings",
        disclosurePolicyId: did("policy:hidden"),
        scheduledStart: new Date("2026-02-11T06:00:00Z"),
        scheduledEnd: new Date("2026-02-11T10:00:00Z"),
        startedAt: new Date("2026-02-11T06:12:00Z"),
        submittedAt: new Date("2026-02-11T09:40:00Z"),
      },
      {
        id: did("inspection:cuttack-routine"),
        projectId: did("project:cuttack-girls"),
        templateId: did("template:hostel"),
        type: "routine",
        trigger: "risk_engine",
        status: "in_progress",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2026-03-01T05:30:00Z"),
        scheduledEnd: new Date("2026-03-01T11:30:00Z"),
        startedAt: new Date("2026-03-01T05:45:00Z"),
        submittedAt: null,
      },
      {
        id: did("inspection:khordha-surprise"),
        projectId: did("project:rajdhani"),
        templateId: did("template:hostel"),
        type: "surprise",
        trigger: "officer",
        status: "assigned",
        disclosurePolicyId: did("policy:hidden"),
        scheduledStart: new Date("2026-04-20T06:00:00Z"),
        scheduledEnd: new Date("2026-04-20T10:30:00Z"),
        startedAt: null,
        submittedAt: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.inspectionAssignments)
    .values([
      {
        id: did("ia:vani-1"),
        inspectionId: did("inspection:vani-surprise"),
        userId: did("user:inspector-1"),
        role: "lead",
      },
      {
        id: did("ia:cuttack-1"),
        inspectionId: did("inspection:cuttack-routine"),
        userId: did("user:inspector-2"),
        role: "lead",
      },
      {
        id: did("ia:khordha-1"),
        inspectionId: did("inspection:khordha-surprise"),
        userId: did("user:inspector-1"),
        role: "lead",
      },
    ])
    .onConflictDoNothing();

  // ---------- Observations, findings, evidence, corrective actions ----------
  await db
    .insert(s.observations)
    .values([
      {
        id: did("observation:vani-1"),
        inspectionId: did("inspection:vani-surprise"),
        userId: did("user:inspector-1"),
        text: "Kitchen cooking area showed unwashed utensils and open food storage.",
      },
      {
        id: did("observation:vani-2"),
        inspectionId: did("inspection:vani-surprise"),
        userId: did("user:inspector-1"),
        text: "Drinking water logs reviewed; RO filter replacement overdue.",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.findings)
    .values([
      {
        id: did("finding:vani-1"),
        inspectionId: did("inspection:vani-surprise"),
        observationId: did("observation:vani-1"),
        severity: "high",
        description: "Kitchen hygiene non-compliance: open food storage and unwashed utensils.",
        remediation: "Clean kitchen, enforce storage protocol, submit photo evidence.",
        status: "action_required",
      },
      {
        id: did("finding:vani-2"),
        inspectionId: did("inspection:vani-surprise"),
        observationId: did("observation:vani-2"),
        severity: "medium",
        description: "RO filter replacement overdue by 45 days.",
        remediation: "Replace RO filter and attach technician report.",
        status: "action_required",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.evidence)
    .values([
      {
        id: did("evidence:vani-1"),
        inspectionId: did("inspection:vani-surprise"),
        findingId: did("finding:vani-1"),
        capturedAt: new Date("2026-02-11T06:20:00Z"),
        latitude: 20.2961,
        longitude: 85.8245,
        evidenceType: "photo",
        fileName: "kitchen-storage.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2487132,
        contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        deviceId: "DEV-IPHONE-01",
        uploadState: "uploaded",
        integrityState: "verified",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.correctiveActions)
    .values([
      {
        id: did("ca:vani-1"),
        findingId: did("finding:vani-1"),
        inspectionId: did("inspection:vani-surprise"),
        organisationId: did("org:vani"),
        status: "pending",
        deadline: new Date("2026-03-11T23:59:00Z"),
      },
      {
        id: did("ca:vani-2"),
        findingId: did("finding:vani-2"),
        inspectionId: did("inspection:vani-surprise"),
        organisationId: did("org:vani"),
        status: "pending",
        deadline: new Date("2026-03-01T23:59:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Complaints ----------
  await db
    .insert(s.complaints)
    .values([
      {
        id: did("complaint:vani-food"),
        projectId: did("project:vani"),
        complainantName: "Guardian (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0001",
        description: "Report of sub-standard midday meal quality at Vani Vihar hostel.",
        status: "under_review",
        receivedAt: new Date("2026-02-01T10:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- AI anomalies ----------
  await db
    .insert(s.aiAnomalies)
    .values([
      {
        id: did("ai:cuttack-low-attendance"),
        inspectionId: did("inspection:cuttack-routine"),
        evidenceId: null,
        type: "attendance_estimate",
        severity: "medium",
        confidence: 0.82,
        modelVersion: "attendance-estimator-0.1",
        explanation: "Estimated occupancy below declared hostel capacity during morning roll-call.",
        status: "new",
      },
    ])
    .onConflictDoNothing();

  // ---------- CCTV ----------
  await db
    .insert(s.cctvCameras)
    .values([
      {
        id: did("cctv:vani-gate"),
        name: "Vani Vihar - Main Gate",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/vani/gate",
        districtId: did("district:khordha"),
        status: "active",
      },
      {
        id: did("cctv:cuttack-dinning"),
        name: "Cuttack Girls' Hostel - Dining Hall",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/cuttack/dining",
        districtId: did("district:cuttack"),
        status: "active",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.cctvStreams)
    .values([
      {
        id: did("stream:vani-gate-1"),
        cameraId: did("cctv:vani-gate"),
        status: "active",
        startedAt: new Date("2026-02-11T06:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- VC sessions ----------
  await db
    .insert(s.vcSessions)
    .values([
      {
        id: did("vc:cuttack-review"),
        projectId: did("project:cuttack-girls"),
        inspectionId: did("inspection:cuttack-routine"),
        startedAt: new Date("2026-03-02T04:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Notifications ----------
  await db
    .insert(s.notifications)
    .values([
      {
        id: did("notif:officer-khordha"),
        userId: did("user:officer-khordha"),
        type: "inspection.submitted",
        title: "Inspection submitted",
        body: "Vani Vihar surprise inspection was submitted.",
        status: "sent",
        sentAt: new Date("2026-02-11T09:40:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Video Conferencing ----------
  await db
    .insert(s.vcSessions)
    .values([
      {
        id: did("vc:vani-tripartite"),
        inspectionId: did("inspection:vani-surprise"),
        projectId: did("project:vani"),
        title: "Vani Vihar Tripartite Remote Hearing",
        status: "scheduled",
        hostUserId: did("user:officer-khordha"),
        roomName: "netram-review-vani-surprise",
        provider: "webrtc",
        scheduledAt: new Date("2026-03-01T10:00:00Z"),
        metadata: { agenda: "Review structural findings and remedial timeline" },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.vcParticipants)
    .values([
      {
        id: did("vcp:vani-host"),
        sessionId: did("vc:vani-tripartite"),
        userId: did("user:officer-khordha"),
        role: "host",
      },
      {
        id: did("vcp:vani-inspector"),
        sessionId: did("vc:vani-tripartite"),
        userId: did("user:inspector-1"),
        role: "inspector",
      },
      {
        id: did("vcp:vani-org"),
        sessionId: did("vc:vani-tripartite"),
        userId: did("user:institution"),
        role: "organisation_rep",
      },
    ])
    .onConflictDoNothing();

  // ---------- Feature flags ----------
  await db
    .insert(s.featureFlagTable)
    .values([
      {
        id: did("flag:ai"),
        key: "ai.anomaly_detection",
        enabled: false,
        allowedEnvironments: ["development", "demo", "ci"],
      },
      {
        id: did("flag:realtime"),
        key: "realtime.delivery",
        enabled: true,
        allowedEnvironments: ["development", "test", "ci", "demo", "production"],
      },
      {
        id: did("flag:random-assignment"),
        key: "inspections.random_assignment",
        enabled: true,
        allowedEnvironments: ["development", "demo", "production"],
      },
    ])
    .onConflictDoNothing();

  // ---------- Audit events (historical, to demonstrate the pattern) ----------
  await db
    .insert(s.auditEvents)
    .values([
      {
        id: did("audit:vani-approve"),
        action: "project.approved",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:vani"),
        metadata: { code: "PRJ-VANI-001" },
        occurredAt: new Date("2026-01-10T09:30:00Z"),
      },
      {
        id: did("audit:vani-inspection-assigned"),
        action: "inspection.assigned",
        actorUserId: did("user:officer-khordha"),
        resourceType: "inspection",
        resourceId: did("inspection:vani-surprise"),
        metadata: { inspector: "inspector.one@dev.netram.in" },
        occurredAt: new Date("2026-02-10T18:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Attendance: devices, populations, windows, config, identity mappings ----------
  await db
    .insert(s.attendanceConfigs)
    .values(
      [
        {
          id: did("attconfig:programme-default"),
          dayStartTime: "05:00",
          thresholds: { crossSourceDiscrepancy: 0.15, historicalDeviation: 0.25, persistenceWindowDays: 5, materialityThreshold: 0.1 },
          baseline: { windowDays: 14, minObservations: 5 },
          retention: { rawTransactionsDays: 365, exportsHours: 24 },
        },
        {
          id: did("attconfig:vani"),
          projectId: did("project:vani"),
          dayStartTime: "05:00",
          thresholds: { crossSourceDiscrepancy: 0.15, historicalDeviation: 0.25, persistenceWindowDays: 5, materialityThreshold: 0.1 },
          baseline: { windowDays: 14, minObservations: 5 },
          retention: { rawTransactionsDays: 365, exportsHours: 24 },
        },
        {
          id: did("attconfig:cuttack"),
          projectId: did("project:cuttack-girls"),
          dayStartTime: "05:00",
          thresholds: { crossSourceDiscrepancy: 0.15, historicalDeviation: 0.25, persistenceWindowDays: 5, materialityThreshold: 0.1 },
          baseline: { windowDays: 14, minObservations: 5 },
          retention: { rawTransactionsDays: 365, exportsHours: 24 },
        },
      ]
    )
    .onConflictDoNothing();

  // Populations (must be inserted before windows that reference them).
  await db
    .insert(s.attendancePopulations)
    .values(
      [
        {
          id: did("attpop:vani-beneficiaries"),
          projectId: did("project:vani"),
          code: "BEN-001",
          name: "Vani Vihar Beneficiaries",
          populationType: "BENEFICIARY",
          expectedStrategy: "ROSTER",
          expectedCount: null,
          config: {},
        },
        {
          id: did("attpop:vani-staff"),
          projectId: did("project:vani"),
          code: "STF-001",
          name: "Vani Vihar Staff",
          populationType: "STAFF",
          expectedStrategy: "CONFIGURED",
          expectedCount: 18,
          config: {},
        },
        {
          id: did("attpop:cuttack-beneficiaries"),
          projectId: did("project:cuttack-girls"),
          code: "BEN-002",
          name: "Cuttack Girls Beneficiaries",
          populationType: "BENEFICIARY",
          expectedStrategy: "ROSTER",
          expectedCount: null,
          config: {},
        },
        {
          id: did("attpop:generic"),
          projectId: did("project:vani"),
          code: "GEN-001",
          name: "Generic Population",
          populationType: "GENERIC",
          expectedStrategy: "CONFIGURED",
          expectedCount: 100,
          config: {},
        },
      ]
    )
    .onConflictDoNothing();

  // Morning window for Vani Vihar.
  await db
    .insert(s.attendanceWindows)
    .values(
      [
        {
          id: did("attwindow:vani-morning"),
          projectId: did("project:vani"),
          code: "MORNING",
          name: "Morning Roll Call",
          startTime: "06:00",
          endTime: "09:00",
          populationId: did("attpop:vani-beneficiaries"),
          minCoverage: 0.5,
          config: { source: "biometric" },
        },
        {
          id: did("attwindow:cuttack-morning"),
          projectId: did("project:cuttack-girls"),
          code: "MORNING",
          name: "Morning Roll Call",
          startTime: "06:00",
          endTime: "09:00",
          populationId: did("attpop:cuttack-beneficiaries"),
          minCoverage: 0.5,
          config: { source: "biometric" },
        },
      ]
    )
    .onConflictDoNothing();

  // Population members (roster for Vani beneficiaries — match simulator range).
  for (let n = 1; n <= 160; n++) {
    await db
      .insert(s.attendancePopulationMembers)
      .values({
        id: did(`attmember:vani-${n}`),
        populationId: did("attpop:vani-beneficiaries"),
        personExternalId: `person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        joinedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  // Population members for Cuttack — match simulator range.
  for (let n = 1; n <= 142; n++) {
    await db
      .insert(s.attendancePopulationMembers)
      .values({
        id: did(`attmember:cuttack-${n}`),
        populationId: did("attpop:cuttack-beneficiaries"),
        personExternalId: `cuttack-person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        joinedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  // Devices.
  await db
    .insert(s.attendanceDevices)
    .values(
      [
        {
          id: did("attdev:vani-main"),
          projectId: did("project:vani"),
          name: "Vani Vihar Main Gate Biometric",
          provider: "simulated",
          deviceExternalId: "VN-MAIN-01",
          status: "ONLINE",
          lastSeenAt: new Date("2026-03-01T08:00:00Z"),
          lastEventAt: new Date("2026-03-01T08:00:00Z"),
          syncCursor: "2026-03-01",
          config: { scenario: "normal" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: did("attdev:cuttack-main"),
          projectId: did("project:cuttack-girls"),
          name: "Cuttack Girls Main Gate Biometric",
          provider: "simulated",
          deviceExternalId: "CT-MAIN-01",
          status: "ONLINE",
          lastSeenAt: new Date("2026-03-01T07:30:00Z"),
          lastEventAt: new Date("2026-03-01T07:30:00Z"),
          syncCursor: "2026-03-01",
          config: { scenario: "discrepancy" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: did("attdev:cuttack-backup"),
          projectId: did("project:cuttack-girls"),
          name: "Cuttack Girls Backup Device",
          provider: "simulated",
          deviceExternalId: "CT-BACKUP-01",
          status: "OFFLINE",
          lastSeenAt: new Date("2026-02-28T18:00:00Z"),
          lastEventAt: new Date("2026-02-28T18:00:00Z"),
          syncCursor: "2026-02-28",
          config: { scenario: "offline_buffered" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: did("attdev:low-attendance"),
          projectId: did("project:vani"),
          name: "Vani Vihar Low Attendance Device (demo)",
          provider: "simulated",
          deviceExternalId: "VN-LOW-01",
          status: "ONLINE",
          lastSeenAt: new Date("2026-03-01T06:30:00Z"),
          lastEventAt: new Date("2026-03-01T06:30:00Z"),
          syncCursor: "2026-03-01",
          config: { scenario: "low_attendance" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: did("attdev:duplicates-demo"),
          projectId: did("project:vani"),
          name: "Vani Vihar Duplicate Demo Device",
          provider: "simulated",
          deviceExternalId: "VN-DUP-01",
          status: "ONLINE",
          lastSeenAt: new Date("2026-03-01T06:00:00Z"),
          lastEventAt: new Date("2026-03-01T06:00:00Z"),
          syncCursor: "2026-03-01",
          config: { scenario: "duplicates" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: did("attdev:unmatched-demo"),
          projectId: did("project:vani"),
          name: "Vani Vihar Unmatched Demo Device",
          provider: "simulated",
          deviceExternalId: "VN-UNM-01",
          status: "ONLINE",
          lastSeenAt: new Date("2026-03-01T06:00:00Z"),
          lastEventAt: new Date("2026-03-01T06:00:00Z"),
          syncCursor: "2026-03-01",
          config: { scenario: "unmatched" },
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ]
    )
    .onConflictDoNothing();

  // Identity mappings: map device external users to person external IDs.
  // Vani main device: the simulator 'normal' scenario generates person-001..person-160.
  // We map all 160 so sync produces a clean normalized set for demo.
  for (let n = 1; n <= 160; n++) {
    await db
      .insert(s.attendanceIdentityMappings)
      .values({
        id: did(`attmap:vani-main-${n}`),
        projectId: did("project:vani"),
        deviceId: did("attdev:vani-main"),
        externalUserId: `person-${String(n).padStart(3, "0")}`,
        personExternalId: `person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  // Vani low-attendance device: same person range, mapped to same persons.
  for (let n = 1; n <= 160; n++) {
    await db
      .insert(s.attendanceIdentityMappings)
      .values({
        id: did(`attmap:vani-low-${n}`),
        projectId: did("project:vani"),
        deviceId: did("attdev:low-attendance"),
        externalUserId: `person-${String(n).padStart(3, "0")}`,
        personExternalId: `person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  // Vani duplicates demo device.
  for (let n = 1; n <= 160; n++) {
    await db
      .insert(s.attendanceIdentityMappings)
      .values({
        id: did(`attmap:vani-dup-${n}`),
        projectId: did("project:vani"),
        deviceId: did("attdev:duplicates-demo"),
        externalUserId: `person-${String(n).padStart(3, "0")}`,
        personExternalId: `person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  // Cuttack main device: the simulator 'discrepancy' scenario generates
  // cuttack-person-001..cuttack-person-142. Map all of them.
  for (let n = 1; n <= 142; n++) {
    await db
      .insert(s.attendanceIdentityMappings)
      .values({
        id: did(`attmap:cuttack-main-${n}`),
        projectId: did("project:cuttack-girls"),
        deviceId: did("attdev:cuttack-main"),
        externalUserId: `cuttack-person-${String(n).padStart(3, "0")}`,
        personExternalId: `cuttack-person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  // Source observations: institution-reported for Cuttack (168 claimed vs 142 biometric = discrepancy).
  await db
    .insert(s.attendanceSourceObservations)
    .values(
      [
        {
          id: did("attobs:cuttack-reported-2026-03-01"),
          projectId: did("project:cuttack-girls"),
          source: "INSTITUTION_REPORTED",
          windowId: did("attwindow:cuttack-morning"),
          operationalDate: "2026-03-01",
          observedAt: new Date("2026-03-01T10:00:00Z"),
          observedCount: 168,
          expectedCount: 150,
          confidence: 0.9,
          coverage: "COMPLETE",
          health: "ONLINE",
          note: "Institution-reported headcount for morning roll call.",
        },
        {
          id: did("attobs:vani-cctv-2026-03-01"),
          projectId: did("project:vani"),
          source: "CCTV",
          windowId: did("attwindow:vani-morning"),
          operationalDate: "2026-03-01",
          observedAt: new Date("2026-03-01T09:00:00Z"),
          observedCount: 120,
          expectedCount: 150,
          confidence: 0.6,
          coverage: "PARTIAL",
          health: "ONLINE",
          note: "CCTV coverage partial — only main gate camera operational.",
        },
        {
          id: did("attobs:cuttack-cctv-2026-03-01"),
          projectId: did("project:cuttack-girls"),
          source: "CCTV",
          windowId: did("attwindow:cuttack-morning"),
          operationalDate: "2026-03-01",
          observedAt: new Date("2026-03-01T09:00:00Z"),
          observedCount: null,
          expectedCount: null,
          confidence: null,
          coverage: "INSUFFICIENT",
          health: "OFFLINE",
          note: "CCTV dining hall camera offline during morning roll call.",
        },
      ]
    )
    .onConflictDoNothing();

  // Attendance calculations: pre-computed for the demo dates.
  await db
    .insert(s.attendanceCalculations)
    .values(
      [
        {
          id: did("attcalc:vani-2026-03-01"),
          projectId: did("project:vani"),
          windowId: did("attwindow:vani-morning"),
          operationalDate: "2026-03-01",
          expected: 160,
          present: 0,
          absent: null,
          unknown: 0,
          sourceCounts: { BIOMETRIC: 0, INSTITUTION_REPORTED: 0, CCTV: 120, MANUAL: 0 },
          coverage: "COMPLETE",
          dataQuality: "GOOD",
          freshness: new Date("2026-03-01T08:00:00Z"),
          policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
          computedAt: new Date("2026-03-01T10:00:00Z"),
        },
        {
          id: did("attcalc:cuttack-2026-03-01"),
          projectId: did("project:cuttack-girls"),
          windowId: did("attwindow:cuttack-morning"),
          operationalDate: "2026-03-01",
          expected: 142,
          present: 0,
          absent: null,
          unknown: 0,
          sourceCounts: { BIOMETRIC: 0, INSTITUTION_REPORTED: 168, CCTV: 0, MANUAL: 0 },
          coverage: "PARTIAL",
          dataQuality: "DEGRADED",
          freshness: new Date("2026-03-01T10:00:00Z"),
          policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
          computedAt: new Date("2026-03-01T10:00:00Z"),
        },
      ]
    )
    .onConflictDoNothing();

  // Data quality records.
  await db
    .insert(s.attendanceDataQuality)
    .values(
      [
        {
          id: did("attdq:vani-biometric-2026-03-01"),
          projectId: did("project:vani"),
          source: "BIOMETRIC",
          periodStart: new Date("2026-03-01T06:00:00Z"),
          periodEnd: new Date("2026-03-01T09:00:00Z"),
          coverage: "COMPLETE",
          freshness: new Date("2026-03-01T08:00:00Z"),
          duplicateRate: 0,
          invalidCount: 0,
          unmatchedCount: 0,
          health: "ONLINE",
          assessedAt: new Date("2026-03-01T10:00:00Z"),
        },
        {
          id: did("attdq:cuttack-biometric-2026-03-01"),
          projectId: did("project:cuttack-girls"),
          source: "BIOMETRIC",
          periodStart: new Date("2026-03-01T06:00:00Z"),
          periodEnd: new Date("2026-03-01T09:00:00Z"),
          coverage: "COMPLETE",
          freshness: new Date("2026-03-01T10:00:00Z"),
          duplicateRate: 0,
          invalidCount: 0,
          unmatchedCount: 0,
          health: "ONLINE",
          assessedAt: new Date("2026-03-01T10:00:00Z"),
        },
      ]
    )
    .onConflictDoNothing();

  // Anomaly: cross-source discrepancy for Cuttack (142 biometric vs 168 reported).
  await db
    .insert(s.attendanceAnomalyGroups)
    .values(
      [
        {
          id: did("attgroup:cuttack-discrepancy"),
          projectId: did("project:cuttack-girls"),
          populationId: did("attpop:cuttack-beneficiaries"),
          anomalyType: "CROSS_SOURCE_DISCREPANCY",
          state: "NEW",
          openedAt: new Date("2026-03-01T10:00:00Z"),
          closedAt: null,
        },
        {
          id: did("attgroup:vani-low-persistent"),
          projectId: did("project:vani"),
          populationId: did("attpop:vani-beneficiaries"),
          anomalyType: "PERSISTENT_LOW_ATTENDANCE",
          state: "NEW",
          openedAt: new Date("2026-03-01T10:00:00Z"),
          closedAt: null,
        },
      ]
    )
    .onConflictDoNothing();

  await db
    .insert(s.attendanceAnomalies)
    .values(
      [
        {
          id: did("atanom:cuttack-discrepancy-2026-03-01"),
          projectId: did("project:cuttack-girls"),
          populationId: did("attpop:cuttack-beneficiaries"),
          windowId: did("attwindow:cuttack-morning"),
          operationalDate: "2026-03-01",
          observationStart: new Date("2026-03-01T06:00:00Z"),
          observationEnd: new Date("2026-03-01T09:00:00Z"),
          anomalyType: "CROSS_SOURCE_DISCREPANCY",
          score: 0.18,
          severity: "LOW",
          confidence: 0.65,
          dataQuality: "DEGRADED",
          detectorVersion: "attendance-hybrid-0.1",
          supportingSignals: { difference: 26, relative: 0.18, biometric: 142, reported: 168, expected: 150 },
          state: "NEW",
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          groupId: did("attgroup:cuttack-discrepancy"),
          linkedInspectionId: did("inspection:cuttack-routine"),
          linkedComplaintId: null,
          sourceData: { present: 11, expected: 12, biometric: 11, reported: 168, detectorVersion: "attendance-hybrid-0.1" },
          createdAt: new Date("2026-03-01T10:00:00Z"),
          projectCode: "PRJ-CUTG-003",
          projectName: "Cuttack Girls' Hostel",
          districtId: did("district:cuttack"),
        },
        {
          id: did("atanom:vani-low-2026-03-01"),
          projectId: did("project:vani"),
          populationId: did("attpop:vani-beneficiaries"),
          windowId: did("attwindow:vani-morning"),
          operationalDate: "2026-03-01",
          observationStart: new Date("2026-03-01T06:00:00Z"),
          observationEnd: new Date("2026-03-01T09:00:00Z"),
          anomalyType: "PERSISTENT_LOW_ATTENDANCE",
          score: 0.45,
          severity: "MEDIUM",
          confidence: 0.7,
          dataQuality: "GOOD",
          detectorVersion: "attendance-hybrid-0.1",
          supportingSignals: { streakDays: 5, lowRatio: 0.6, expected: 160, present: 0 },
          state: "NEW",
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
          groupId: did("attgroup:vani-low-persistent"),
          linkedInspectionId: null,
          linkedComplaintId: null,
          sourceData: { present: 0, expected: 160, detectorVersion: "attendance-hybrid-0.1" },
          createdAt: new Date("2026-03-01T10:00:00Z"),
          projectCode: "PRJ-VANI-001",
          projectName: "Vani Vihar SC/ST Hostel",
          districtId: did("district:khordha"),
        },
        {
          id: did("atanom:vani-low-reviewed"),
          projectId: did("project:vani"),
          populationId: did("attpop:vani-beneficiaries"),
          windowId: did("attwindow:vani-morning"),
          operationalDate: "2026-02-28",
          observationStart: new Date("2026-02-28T06:00:00Z"),
          observationEnd: new Date("2026-02-28T09:00:00Z"),
          anomalyType: "PERSISTENT_LOW_ATTENDANCE",
          score: 0.4,
          severity: "MEDIUM",
          confidence: 0.68,
          dataQuality: "GOOD",
          detectorVersion: "attendance-hybrid-0.1",
          supportingSignals: { streakDays: 5, lowRatio: 0.6, expected: 160, present: 0 },
          state: "REVIEWED",
          reviewedBy: did("user:officer-khordha"),
          reviewedAt: new Date("2026-03-01T09:00:00Z"),
          reviewNotes: "Reviewed — attendance within acceptable range; monitoring continued.",
          groupId: did("attgroup:vani-low-persistent"),
          linkedInspectionId: null,
          linkedComplaintId: null,
          sourceData: { present: 0, expected: 160, detectorVersion: "attendance-hybrid-0.1" },
          createdAt: new Date("2026-02-28T10:00:00Z"),
          projectCode: "PRJ-VANI-001",
          projectName: "Vani Vihar SC/ST Hostel",
          districtId: did("district:khordha"),
        },
      ]
    )
    .onConflictDoNothing();

  // Review action for the reviewed anomaly.
  await db
    .insert(s.attendanceReviewActions)
    .values(
      [
        {
          id: did("attrev:vani-reviewed"),
          anomalyId: did("atanom:vani-low-reviewed"),
          actorUserId: did("user:officer-khordha"),
          action: "acknowledge",
          note: "Reviewed — attendance within acceptable range; monitoring continued.",
          createdAt: new Date("2026-03-01T09:00:00Z"),
        },
      ]
    )
    .onConflictDoNothing();

  // Correction: pending correction on a calculation.
  await db
    .insert(s.attendanceCorrections)
    .values(
      [
        {
          id: did("attcorr:vani-present-adjust"),
          projectId: did("project:vani"),
          targetType: "calculation",
          targetId: did("attcalc:vani-2026-03-01"),
          field: "present",
          originalValue: { present: 14, expected: 15 },
          newValue: { present: 15 },
          reason: "Inspector confirmed 15th beneficiary present via manual roll call.",
          requestedBy: did("user:inspector-1"),
          status: "PENDING",
          approvedBy: null,
          approvedAt: null,
          createdAt: new Date("2026-03-01T11:00:00Z"),
        },
      ]
    )
    .onConflictDoNothing();

  console.log(
    `Seed complete: ${projects.length} projects, ${users.length} users across ${districtRows.length} districts.`,
  );
}

seedDatabase()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });