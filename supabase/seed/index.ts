import { resolve } from "node:path";
import { v5 as uuidv5 } from "uuid";
import { getDb } from "@netram/data";
import * as s from "@netram/data/schema";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../.env"));
} catch (err) {
  console.log("ENV LOAD FAILED:", err);
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
    // Districts below appear in the official DoSJE social audit calendar
    // (docs/DoSJE.md §34): Jajapur (PM-AJAY village audits), Baleshwar and
    // Bhadrak (IRCA / senior citizen home audits).
    {
      id: did("district:jajapur"),
      stateId: did("state:odisha"),
      code: "JAJ",
      name: "Jajapur",
    },
    {
      id: did("district:baleshwar"),
      stateId: did("state:odisha"),
      code: "BAL",
      name: "Baleshwar",
    },
    {
      id: did("district:bhadrak"),
      stateId: did("state:odisha"),
      code: "BHD",
      name: "Bhadrak",
    },
  ];
  for (const d of districtRows) {
    await db.insert(s.districts).values(d).onConflictDoNothing();
  }

  // Sub-district geography for village-type audit targets (docs/DoSJE.md §25).
  // Block name follows public census records; GP/village rows are demo data
  // (the public MIS carries district only).
  await db
    .insert(s.blocks)
    .values({
      id: did("block:jajapur-dharmasala"),
      districtId: did("district:jajapur"),
      code: "BLK-JAJ-DHA",
      name: "Dharmasala",
    })
    .onConflictDoNothing();
  await db
    .insert(s.gramPanchayats)
    .values({
      id: did("gp:jajapur-dharmasala-1"),
      blockId: did("block:jajapur-dharmasala"),
      code: "GP-JAJ-DHA-1",
      name: "Dharmasala GP (demo)",
    })
    .onConflictDoNothing();
  await db
    .insert(s.villages)
    .values({
      id: did("village:jajapur-adarsh-1"),
      gramPanchayatId: did("gp:jajapur-dharmasala-1"),
      code: "VIL-JAJ-001",
      name: "Adarsh Gram Village (demo)",
    })
    .onConflictDoNothing();

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
      email: "admin@netram.dev",
      displayName: "Biranchi (Dept Admin)",
      status: "active",
    },
    {
      id: did("user:officer-khordha"),
      email: "officer@netram.dev",
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
      email: "controlroom@netram.dev",
      displayName: "Room Ops",
      status: "active",
    },
    {
      id: did("user:institution"),
      email: "institute@netram.dev",
      displayName: "Vani Vihar Hostel Admin",
      status: "active",
    },
    {
      id: did("user:inspector-1"),
      email: "inspector@netram.dev",
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
    {
      id: did("user:sanctioning-authority"),
      email: "authority.sanction@dev.netram.in",
      displayName: "Dr. K. S. Rathore (Competent Authority / Joint Secy)",
      status: "active",
    },
    {
      id: did("user:programme-officer"),
      email: "programme.officer@dev.netram.in",
      displayName: "M. P. Mohapatra (Authorized Programme Officer / DDO)",
      status: "active",
    },
    {
      id: did("user:auditor"),
      email: "auditor.state@dev.netram.in",
      displayName: "Sunita Rao (Authorized Officer / Senior Auditor)",
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
      code: "organisation:create",
      name: "Register organisations",
      description: "Register operating agencies and societies",
    },
    {
      code: "programme:create",
      name: "Register programmes",
      description: "Register welfare schemes and programmes",
    },
    {
      code: "inspector:register",
      name: "Register inspectors",
      description: "Invite field inspectors and assign their jurisdictions",
    },
    {
      code: "official:register",
      name: "Register officials",
      description: "Invite authority officials and grant roles, authorities and jurisdictions",
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
    {
      code: "fund:read",
      name: "Read funds",
      description: "Read fund allocations, releases, and summaries",
    },
    {
      code: "fund:allocate",
      name: "Allocate funds",
      description: "Sanction and update fund allocations",
    },
    {
      code: "fund:release",
      name: "Release funds",
      description: "Authorize and record fund releases/disbursements",
    },
    {
      code: "expense:read",
      name: "Read expenses",
      description: "List and view project expenditures",
    },
    {
      code: "expense:submit",
      name: "Submit expenses",
      description: "Create and submit expenditure claims",
    },
    {
      code: "expense:verify",
      name: "Verify expenses",
      description: "Officially verify or reject submitted expenditures",
    },
    {
      code: "expense:void",
      name: "Void expenses",
      description: "Void verified or submitted expenditures with audit rationale",
    },
    {
      code: "financial_document:upload",
      name: "Upload financial documents",
      description: "Upload invoices, bills, and supporting evidence",
    },
    {
      code: "financial_document:verify",
      name: "Verify financial documents",
      description: "Verify or reject financial supporting documents",
    },
    {
      code: "financial_risk:read",
      name: "Read financial risk",
      description: "View financial discrepancy rules and evaluated risk events",
    },
    {
      code: "financial_risk:configure",
      name: "Configure financial risk rules",
      description: "Enable, disable, and tune financial risk detection engine rules",
    },
    {
      code: "inspection_flag:read",
      name: "Read inspection flags",
      description: "View inspection review flags generated by the risk engine",
    },
    {
      code: "inspection_flag:assign",
      name: "Assign inspection flags",
      description: "Assign review flags to field inspectors",
    },
    {
      code: "inspection_flag:review",
      name: "Review inspection flags",
      description: "Review, resolve, or dismiss financial inspection flags",
    },
    {
      code: "project_risk:read",
      name: "Read project risk",
      description: "View project risk rankings and historical snapshots",
    },
    {
      code: "project_risk:evaluate",
      name: "Evaluate project risk",
      description: "Trigger evaluation of project risk and auto-scheduling",
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
        "project:create",
        "project:transition",
        "project:approve",
        "organisation:create",
        "programme:create",
        "inspector:register",
        "inspection:read",
        "inspection:create",
        "inspection:assign",
        "inspection:transition",
        "inspection:review",
        "complaint:read",
        "complaint:create",
        "complaint:resolve",
        "ai:anomaly:read",
        "ai:anomaly:transition",
        "corrective_action:read",
        "corrective_action:submit",
        "corrective_action:approve",
        "audit:read",
        "notification:read",
        "cctv:read",
        "cctv:stream",
        "vc_session:read",
        "vc_session:create",
        "vc_session:manage",
        "fund:read",
        "fund:allocate",
        "fund:release",
        "expense:read",
        "expense:verify",
        "expense:void",
        "financial_document:upload",
        "financial_document:verify",
        "financial_risk:read",
        "financial_risk:configure",
        "inspection_flag:read",
        "inspection_flag:assign",
        "inspection_flag:review",
        "project_risk:read",
        "project_risk:evaluate",
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
        "notification:read",
        "cctv:read",
        "cctv:stream",
        "vc_session:read",
        "fund:read",
        "expense:read",
        "financial_risk:read",
        "inspection_flag:read",
        "project_risk:read",
      ],
    },
    {
      id: did("role:institution_admin"),
      code: "institution_admin",
      name: "Institution / Organisation Admin",
      // The establishment is the oversight SUBJECT, not an oversight reader.
      // Deliberately lacks:
      //   project:approve  — institutions cannot approve themselves.
      //   project:create   — authorities register facilities and link the
      //                      organisation; institutions do not self-register.
      //   inspection:read  — they never see inspections against themselves.
      //   complaint:read / inspection_flag:read / risk reads — oversight
      //                      instruments against them are not disclosed (§34).
      // They are PULSED through notifications + their section queues when the
      // authority orders an action: ATR submission (corrective_action:submit)
      // and expense claims remain their active duties.
      permissions: [
        "project:read",
        "project:transition",
        "corrective_action:read",
        "corrective_action:submit",
        "notification:read",
        "vc_session:read",
        "fund:read",
        "expense:read",
        "expense:submit",
        "financial_document:upload",
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
        "fund:read",
        "expense:read",
        "inspection_flag:read",
      ],
    },
    {
      id: did("role:competent_authority"),
      code: "competent_authority",
      name: "Competent Department / Sanctioning Authority",
      permissions: [
        "project:read",
        "project:approve",
        "programme:create",
        "organisation:create",
        "fund:read",
        "fund:allocate",
        "expense:read",
        "financial_risk:read",
        "inspection_flag:read",
        "audit:read",
        "notification:read",
      ],
    },
    {
      id: did("role:programme_officer"),
      code: "programme_officer",
      name: "Authorized Programme / Department Officer",
      permissions: [
        "project:read",
        "fund:read",
        "fund:release",
        "expense:read",
        "financial_risk:read",
        "inspection_flag:read",
        "notification:read",
      ],
    },
    {
      id: did("role:auditor"),
      code: "auditor",
      name: "Authorized Officer / Auditor",
      permissions: [
        "project:read",
        "fund:read",
        "expense:read",
        "expense:verify",
        "expense:void",
        "financial_document:verify",
        "financial_risk:read",
        "inspection_flag:read",
        "inspection_flag:review",
        "inspection:read",
        "inspection:create",
        "audit:read",
        "notification:read",
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
      {
        id: did("ra:sanctioning-authority"),
        userId: did("user:sanctioning-authority"),
        roleCode: "competent_authority",
        jurisdictionId: did("jurisdiction:national"),
        scope: "national",
      },
      {
        id: did("ra:programme-officer"),
        userId: did("user:programme-officer"),
        roleCode: "programme_officer",
        authorityId: did("authority:dosje-khordha"),
        jurisdictionId: did("jurisdiction:khordha"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:auditor"),
        userId: did("user:auditor"),
        roleCode: "auditor",
        authorityId: did("authority:dosje-khordha"),
        jurisdictionId: did("jurisdiction:khordha"),
        scope: "jurisdiction",
      },
      {
        // Social audit resource persons operate state-wide (docs/DoSJE.md §10);
        // inspector-1 doubles as the SAU resource person for Odisha-wide audits.
        id: did("ra:inspector-1-state"),
        userId: did("user:inspector-1"),
        roleCode: "inspector",
        jurisdictionId: did("jurisdiction:odisha"),
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
      },
      {
        id: did("org:rajdhani"),
        code: "ORG-RAJDHANI",
        name: "Rajdhani Boys' Hostel (ST)",
        category: "ST Hostel",
        authorityId: did("authority:dosje-khordha"),
      },
      {
        id: did("org:cuttack-girls"),
        code: "ORG-CUTG",
        name: "Cuttack Girls' Hostel",
        category: "SC/ST Girls Hostel",
        authorityId: did("authority:dosje-cuttack"),
      },
      {
        id: did("org:puri-model"),
        code: "ORG-PURI",
        name: "Puri Model Boys' Hostel",
        category: "Model Hostel",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:ganjam-school"),
        code: "ORG-GANJ",
        name: "Ganjam Model School Hostel",
        category: "Model School Hostel",
        authorityId: did("authority:dosje"),
      },
      // Real implementing organisations from the official DoSJE social audit
      // calendar, Odisha rows (docs/DoSJE.md §34). Names recorded verbatim.
      {
        id: did("org:nilachal"),
        code: "ORG-NILACHAL",
        name: "Nilachal Seva Pratisthan",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:bankeswari"),
        code: "ORG-BANKESWARI",
        name: "Bankeswari Jubak Sangha",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:cards"),
        code: "ORG-CARDS",
        name: "Council for All Round Development of Society",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:ava"),
        code: "ORG-AVA",
        name: "Association for Voluntary Action",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:prayas"),
        code: "ORG-PRAYAS",
        name: "Prayas Voluntary Organisation",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:peacebird"),
        code: "ORG-PEACEBIRD",
        name: "PEACE BIRD OF CAPABILITY",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("org:nikhila-utkal"),
        code: "ORG-NUHASS",
        name: "Nikhila Utkal Harijan Adivasi Seva Sangha",
        category: "NGO / VO",
        authorityId: did("authority:dosje"),
      },
      // State Social Audit Unit (docs/DoSJE.md §10): OSSAAT.
      {
        id: did("org:ossaat"),
        code: "ORG-OSSAAT",
        name: "Odisha Society for Social Audit Accountability and Transparency (OSSAAT)",
        category: "Social Audit Unit",
        authorityId: null,
        stateId: did("state:odisha"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Programmes ----------
  // Real DoSJE schemes (docs/DoSJE.md §21). scopeLevel demonstrates the
  // scheme geographic scope model: all central schemes are national; the
  // I-MESA PMU surprise-inspection drive is seeded as an Odisha state run.
  await db
    .insert(s.programmes)
    .values([
      {
        id: did("programme:avyay"),
        code: "PGM-AVYAY",
        name: "Atal Vayo Abhyuday Yojana (AVYAY)",
        description:
          "Umbrella scheme for senior citizens; the IPSrC component funds senior citizen homes.",
        scopeLevel: "national",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("programme:napddr"),
        code: "PGM-NAPDDR",
        name: "National Action Plan for Drug Demand Reduction (NAPDDR)",
        description:
          "GIA to Integrated Rehabilitation Centres for Addicts (IRCA) and preventive education.",
        scopeLevel: "national",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("programme:pmajay"),
        code: "PGM-PMAJAY",
        name: "Pradhan Mantri Anusuchit Jaati Abhyuday Yojana (PM-AJAY)",
        description:
          "Merged SC-development scheme: Adarsh Gram (villages), BJRC hostels, GIA to NGOs.",
        scopeLevel: "national",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("programme:shreshta"),
        code: "PGM-SHRESHTA",
        name: "SHRESHTA (Residential Education for SC Students in Targeted Areas)",
        description: "Mode 1: best private CBSE residential schools; Mode 2: NGO/VO schools.",
        scopeLevel: "national",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("programme:pm-yasasvi"),
        code: "PGM-YASASVI",
        name: "PM Young Achievers Scholarship Award Scheme for Vibrant India (PM-YASASVI)",
        description: "OBC/EBC/DNT scholarships and OBC hostel construction.",
        scopeLevel: "national",
        authorityId: did("authority:dosje"),
      },
      {
        id: did("programme:surprise-audit"),
        code: "PGM-IMESA-OR",
        name: "I-MESA PMU Surprise Inspections (Odisha)",
        description:
          "Odisha run of the I-MESA Project Monitoring Unit surprise inspection programme.",
        scopeLevel: "state",
        stateId: did("state:odisha"),
        authorityId: did("authority:dosje"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Scheme components (docs/DoSJE.md §21) ----------
  await db
    .insert(s.schemeComponents)
    .values([
      {
        id: did("component:ipsrc"),
        programmeId: did("programme:avyay"),
        code: "SC-IPSRC",
        name: "Integrated Programme for Senior Citizens (IPSrC)",
        description: "GIA to NGOs/VOs running senior citizen homes.",
        targetKind: "institution",
      },
      {
        id: did("component:irca"),
        programmeId: did("programme:napddr"),
        code: "SC-IRCA",
        name: "Integrated Rehabilitation Centre for Addicts (IRCA)",
        description: "GIA to NGOs running de-addiction and rehabilitation centres.",
        targetKind: "institution",
      },
      {
        id: did("component:pmajay-adarsh"),
        programmeId: did("programme:pmajay"),
        code: "SC-ADARSH-GRAM",
        name: "Adarsh Gram",
        description:
          "Integrated development of SC-majority villages; the village is the audited unit.",
        targetKind: "village",
      },
      {
        id: did("component:pmajay-bjrc"),
        programmeId: did("programme:pmajay"),
        code: "SC-BJRC",
        name: "Babu Jagjivan Ram Chhatrawas Yojana (BJRC)",
        description: "Hostels for SC boys and girls.",
        targetKind: "institution",
      },
      {
        id: did("component:shreshta-m1"),
        programmeId: did("programme:shreshta"),
        code: "SC-SHRESHTA-M1",
        name: "SHRESHTA Mode 1 (CBSE residential schools)",
        targetKind: "institution",
      },
      {
        id: did("component:shreshta-m2"),
        programmeId: did("programme:shreshta"),
        code: "SC-SHRESHTA-M2",
        name: "SHRESHTA Mode 2 (NGO/VO schools)",
        targetKind: "institution",
      },
      {
        id: did("component:yasasvi-obc-hostel"),
        programmeId: did("programme:pm-yasasvi"),
        code: "SC-OBC-HOSTEL",
        name: "OBC Hostel Construction",
        targetKind: "institution",
      },
    ])
    .onConflictDoNothing();

  // ---------- Finding categories (docs/DoSJE.md §15) ----------
  await db
    .insert(s.findingCategories)
    .values([
      { id: did("fcat:financial"), code: "FIN", name: "Financial irregularity" },
      { id: did("fcat:infra"), code: "INFRA", name: "Infrastructure & works quality" },
      { id: did("fcat:rolls"), code: "ROLLS", name: "Beneficiary rolls & eligibility" },
      { id: did("fcat:food"), code: "FOOD", name: "Food & nutrition" },
      { id: did("fcat:water"), code: "WATSAN", name: "Water & sanitation" },
      { id: did("fcat:staffing"), code: "STAFF", name: "Staffing & attendance" },
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
      schemeComponentId: did("component:pmajay-bjrc"),
      description: "SC/ST hostel near Vani Vihar, Bhubaneswar. 120 residents.",
      organisationId: did("org:vani"),
      authorityId: did("authority:dosje-khordha"),
      districtId: did("district:khordha"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2026-01-10T09:30:00Z"),
      contactName: "Rabindra Mohanty",
      contactPhone: "+91 94370 11223",
      contactEmail: "rabindra.mohanty@vanihostel.dev.netram.in",
      programmeIds: [did("programme:pmajay"), did("programme:surprise-audit")],
    },
    {
      id: did("project:rajdhani"),
      code: "PRJ-RAJDHANI-002",
      name: "Rajdhani Boys' Hostel (ST)",
      type: "institution",
      schemeComponentId: did("component:pmajay-bjrc"),
      description: "ST boys' hostel, Khordha. Under verification.",
      organisationId: did("org:rajdhani"),
      authorityId: did("authority:dosje-khordha"),
      districtId: did("district:khordha"),
      status: "Pending Verification",
      approvedById: null,
      approvedAt: null,
      contactName: "Sushanta Behera",
      contactPhone: "+91 94370 44556",
      contactEmail: "sushanta.behera@rajdhanihostel.dev.netram.in",
      programmeIds: [did("programme:pmajay")],
    },
    {
      id: did("project:cuttack-girls"),
      code: "PRJ-CUTG-003",
      name: "Cuttack Girls' Hostel",
      type: "institution",
      schemeComponentId: did("component:pmajay-bjrc"),
      description: "Girls' hostel in Cuttack. Suspended during compliance review.",
      organisationId: did("org:cuttack-girls"),
      authorityId: did("authority:dosje-cuttack"),
      districtId: did("district:cuttack"),
      status: "Suspended",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-11-02T09:00:00Z"),
      contactName: "Pranati Das",
      contactPhone: "+91 94372 77889",
      contactEmail: "pranati.das@cuttackgirls.dev.netram.in",
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
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      programmeIds: [],
    },
    {
      id: did("project:ganjam-school"),
      code: "PRJ-GANJ-005",
      name: "Ganjam Model School Hostel",
      type: "institution",
      schemeComponentId: did("component:pmajay-bjrc"),
      description: "Model school hostel in Ganjam.",
      organisationId: did("org:ganjam-school"),
      authorityId: did("authority:dosje"),
      districtId: did("district:ganjam"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-12-01T09:00:00Z"),
      contactName: "Binod Chandra Panda",
      contactPhone: "+91 94374 99001",
      contactEmail: "binod.panda@ganjamschool.dev.netram.in",
      programmeIds: [did("programme:pmajay"), did("programme:surprise-audit")],
    },
    // Real audit targets from the official DoSJE social audit calendar,
    // Odisha rows (docs/DoSJE.md §34).
    {
      id: did("project:purisch-1"),
      code: "PRJ-PURISCH-007",
      name: "Nilachal Seva Pratisthan - Astaraag (Senior Citizen Home)",
      type: "institution",
      schemeComponentId: did("component:ipsrc"),
      description:
        "Senior citizen home under AVYAY/IPSrC, Puri district. Named in the official DoSJE social audit calendar (Odisha rows).",
      organisationId: did("org:nilachal"),
      authorityId: did("authority:dosje"),
      districtId: did("district:puri"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-10-01T09:00:00Z"),
      contactName: "Krushna Chandra Sahoo",
      contactPhone: "+91 94375 22334",
      contactEmail: "krushna.sahoo@nilachalseva.dev.netram.in",
      programmeIds: [did("programme:avyay"), did("programme:surprise-audit")],
    },
    {
      id: did("project:puri-irca"),
      code: "PRJ-PURIIRCA-008",
      name: "IRCA - Nilachal Seva Pratisthan (Puri)",
      type: "institution",
      schemeComponentId: did("component:irca"),
      description:
        "Integrated Rehabilitation Centre for Addicts under NAPDDR, Puri district. Named in the official DoSJE social audit calendar (Odisha rows).",
      organisationId: did("org:nilachal"),
      authorityId: did("authority:dosje"),
      districtId: did("district:puri"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-10-01T09:00:00Z"),
      contactName: "Anita Routray",
      contactPhone: "+91 94376 55667",
      contactEmail: "anita.routray@ircapuri.dev.netram.in",
      programmeIds: [did("programme:napddr")],
    },
    {
      id: did("project:jajapur-adarsh"),
      code: "PRJ-JAJAGRAM-009",
      name: "Adarsh Gram Village (PM-AJAY), Dharmasala",
      type: "village",
      schemeComponentId: did("component:pmajay-adarsh"),
      description:
        "SC-majority village under the PM-AJAY Adarsh Gram component, Jajapur. The village itself is the audited unit; no implementing institute (official calendar shows institute N/A for Jajapur village audits).",
      organisationId: null,
      authorityId: did("authority:dosje"),
      districtId: did("district:jajapur"),
      villageId: did("village:jajapur-adarsh-1"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2025-11-15T09:00:00Z"),
      // Village-type target: no institute contact; the district office coordinates.
      contactName: "District Welfare Office (Dharmasala)",
      contactPhone: "+91 94377 88990",
      contactEmail: null,
      programmeIds: [did("programme:pmajay")],
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
      {
        id: did("template:srch"),
        name: "Senior Citizen Home Minimum Standards (AVYAY/IPSrC)",
        version: "1.0",
        schema: {
          sections: [
            {
              key: "boarding",
              label: "Boarding & Nutrition",
              items: ["ration_register", "kitchen_hygiene", "diet_chart"],
            },
            {
              key: "health",
              label: "Health Care",
              items: ["medical_checkups", "medicine_stock", "tieup_hospital"],
            },
            {
              key: "living",
              label: "Living Conditions",
              items: ["bedding", "recreation", "caregiver_presence"],
            },
          ],
        },
      },
      {
        id: did("template:sa-village"),
        name: "Social Audit Format - PM Adarsh Village",
        version: "1.0",
        schema: {
          sections: [
            {
              key: "vdp",
              label: "Village Development Plan",
              items: ["vdp_prepared", "gram_sabha_approval", "fund_utilisation"],
            },
            {
              key: "works",
              label: "Works & Assets",
              items: ["roads", "electrification", "water_supply"],
            },
            {
              key: "services",
              label: "Village Services",
              items: ["anganwadi", "school", "csc_connectivity"],
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

  // ---------- Social audit inspections: pilot Odisha run ----------
  // The `social_audit` inspection type (docs/DoSJE.md §11) demonstrates the
  // SAU workflow alongside the PMU surprise-inspection types. NOTE: the DoSJE
  // Annual Report 2025-26 (§3.38) records that Odisha did not conduct DoSJE
  // social audits in FY 2024-25; these rows are a forward-looking pilot run
  // on real calendar targets, not a record of completed official audits.
  await db
    .insert(s.inspections)
    .values([
      {
        id: did("inspection:purisch-sa"),
        projectId: did("project:purisch-1"),
        templateId: did("template:srch"),
        type: "social_audit",
        trigger: "automatic",
        status: "closed",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2026-01-20T09:00:00Z"),
        scheduledEnd: new Date("2026-01-21T17:00:00Z"),
        startedAt: new Date("2026-01-20T09:20:00Z"),
        submittedAt: new Date("2026-01-21T16:30:00Z"),
      },
      {
        id: did("inspection:jajapur-sa"),
        projectId: did("project:jajapur-adarsh"),
        templateId: did("template:sa-village"),
        type: "social_audit",
        trigger: "automatic",
        status: "findings",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2026-02-10T09:00:00Z"),
        scheduledEnd: new Date("2026-02-11T17:00:00Z"),
        startedAt: new Date("2026-02-10T09:10:00Z"),
        submittedAt: new Date("2026-02-11T15:45:00Z"),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.inspectionAssignments)
    .values([
      {
        id: did("ia:purisch-sa-1"),
        inspectionId: did("inspection:purisch-sa"),
        userId: did("user:inspector-1"),
        role: "lead",
        assignedAt: new Date("2026-01-12T10:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:jajapur-sa-1"),
        inspectionId: did("inspection:jajapur-sa"),
        userId: did("user:inspector-1"),
        role: "lead",
        assignedAt: new Date("2026-02-02T10:00:00Z"),
        status: "assigned",
      },
    ])
    .onConflictDoNothing();

  // Findings raised by the social audit team (categories per docs/DoSJE.md §15).
  await db
    .insert(s.observations)
    .values([
      {
        id: did("observation:purisch-sa-1"),
        inspectionId: did("inspection:purisch-sa"),
        userId: did("user:inspector-1"),
        text: "Ration purchase register shows procurement above sanctioned beneficiary strength for Nov and Dec.",
      },
      {
        id: did("observation:jajapur-sa-1"),
        inspectionId: did("inspection:jajapur-sa"),
        userId: did("user:inspector-1"),
        text: "VDP approved by Gram Sabha; internal road completed; new street-light poles not energised.",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.findings)
    .values([
      {
        id: did("finding:purisch-sa-1"),
        inspectionId: did("inspection:purisch-sa"),
        observationId: did("observation:purisch-sa-1"),
        severity: "high",
        description:
          "Ration procurement exceeds sanctioned beneficiary strength for two consecutive months.",
        remediation:
          "Reconcile beneficiary register with procurement records; refund or regularise the excess.",
        status: "confirmed",
        categoryId: did("fcat:financial"),
        amountInr: 42000,
        responsibleOrganisationId: did("org:nilachal"),
      },
      {
        id: did("finding:jajapur-sa-1"),
        inspectionId: did("inspection:jajapur-sa"),
        observationId: did("observation:jajapur-sa-1"),
        severity: "medium",
        description:
          "Street lights installed under VDP works remain non-functional (not energised).",
        remediation: "Energise the installed poles via the electricity distribution licensee.",
        status: "confirmed",
        categoryId: did("fcat:infra"),
        responsibleOrganisationId: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.correctiveActions)
    .values([
      {
        id: did("ca:purisch-sa-1"),
        findingId: did("finding:purisch-sa-1"),
        inspectionId: did("inspection:purisch-sa"),
        organisationId: did("org:nilachal"),
        status: "under_review",
        deadline: new Date("2026-02-20T23:59:00Z"),
        submittedAt: new Date("2026-02-12T10:00:00Z"),
        actionSummary:
          "Procurement records reconciled with the beneficiary register; excess stock of Rs 42,000 regularised against enhanced admissions.",
      },
      {
        id: did("ca:jajapur-sa-1"),
        findingId: did("finding:jajapur-sa-1"),
        inspectionId: did("inspection:jajapur-sa"),
        // Village-type target: no implementing organisation; the district
        // administration answers the ATR (docs/DoSJE.md §25).
        organisationId: null,
        status: "submitted",
        deadline: new Date("2026-03-15T23:59:00Z"),
        submittedAt: new Date("2026-03-02T10:00:00Z"),
        actionSummary:
          "Village development plan review completed; energisation requested from the distribution licensee.",
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
        categoryId: did("fcat:food"),
        responsibleOrganisationId: did("org:vani"),
      },
      {
        id: did("finding:vani-2"),
        inspectionId: did("inspection:vani-surprise"),
        observationId: did("observation:vani-2"),
        severity: "medium",
        description: "RO filter replacement overdue by 45 days.",
        remediation: "Replace RO filter and attach technician report.",
        status: "action_required",
        categoryId: did("fcat:water"),
        responsibleOrganisationId: did("org:vani"),
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
        status: "escalated",
        deadline: new Date("2026-03-11T23:59:00Z"),
      },
      {
        id: did("ca:vani-2"),
        findingId: did("finding:vani-2"),
        inspectionId: did("inspection:vani-surprise"),
        organisationId: did("org:vani"),
        status: "overdue",
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

  // ---------- AI anomalies: camera-feed conflict detections (§36) ----------
  await db
    .insert(s.aiAnomalies)
    .values([
      {
        id: did("ai:cuttack-conflict-dining"),
        inspectionId: did("inspection:cuttack-routine"),
        evidenceId: null,
        type: "conflict",
        severity: "high",
        confidence: 0.81,
        modelVersion: "conflict-detector-0.1",
        explanation:
          "Altercation detected on the dining hall camera feed during the evening window.",
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
        // Dev-rig camera: endpoint path segment IS the MediaMTX media path
        // (facility-vani/cam-gate) that the Phase 1–2 rig provisions.
        endpoint: "rtsp://facility-nvr:8554/facility-vani/cam-gate",
        districtId: did("district:khordha"),
        projectId: did("project:vani"),
        status: "active",
      },
      {
        id: did("cctv:cuttack-dinning"),
        name: "Cuttack Girls' Hostel - Dining Hall",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/cuttack/dining",
        districtId: did("district:cuttack"),
        projectId: did("project:cuttack-girls"),
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

  // ---------- Video Oversight Call Contacts & Records ----------
  const DEMO_VIDEO_FALLBACK = "https://raw.githubusercontent.com/OpenTalker/video-retalking/main/examples/face/1.mp4";

  await db
    .insert(s.callContacts)
    .values([
      {
        id: "cnt-01",
        name: "Ramesh Jena",
        role: "staff",
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
        role: "staff",
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
        role: "beneficiary",
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
        role: "staff",
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
        role: "staff",
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
        role: "beneficiary",
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
        role: "staff",
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
        role: "beneficiary",
        title: "Resident Beneficiary",
        projectCode: "DOSJE-BBR-004",
        projectName: "Swadhar Greh Women Shelter",
        phone: "+91 96924 55301",
        isOnline: true,
        avatarColor: "#0c2a52",
        videoUri: DEMO_VIDEO_FALLBACK,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.callRecords)
    .values([
      {
        id: "hist-01",
        contactId: "cnt-02",
        contactName: "Dr. Anita Behera",
        contactTitle: "Medical Officer",
        role: "staff",
        projectCode: "DOSJE-BBR-002",
        projectName: "Kalyan Mandap IRCA Rehabilitation",
        callType: "video",
        durationSeconds: 374,
        condition: "minor_issue",
        reviewText:
          "Medical supplies stock is adequate for 2 weeks. Reported delay in quarterly fund release for ambulance fuel. Staff attendance verified over camera.",
        flagInspection: false,
        videoUri: DEMO_VIDEO_FALLBACK,
        inspectorVideoUri: DEMO_VIDEO_FALLBACK,
        direction: "outgoing",
        status: "answered",
        startedAt: new Date(Date.now() - 3600 * 1000 * 2),
      },
      {
        id: "hist-02",
        contactId: "cnt-03",
        contactName: "Bipin Bihari Das",
        contactTitle: "Senior Resident Lead",
        role: "beneficiary",
        projectCode: "DOSJE-BBR-001",
        projectName: "Sishhu Bhawan Senior Citizen Home",
        callType: "video",
        durationSeconds: 220,
        condition: "satisfactory",
        reviewText:
          "Beneficiary confirmed warm meals served on schedule. RO water filter is operational. Zero staff misconduct or grievances reported.",
        flagInspection: false,
        videoUri: DEMO_VIDEO_FALLBACK,
        inspectorVideoUri: DEMO_VIDEO_FALLBACK,
        direction: "incoming",
        status: "answered",
        startedAt: new Date(Date.now() - 3600 * 1000 * 24),
      },
      {
        id: "hist-03",
        contactId: "cnt-04",
        contactName: "Er. Manoj Nayak",
        contactTitle: "Site Engineer",
        role: "staff",
        projectCode: "DOSJE-BBR-003",
        projectName: "Navajyoti SC/ST Girls Hostel",
        callType: "video",
        durationSeconds: 502,
        condition: "critical_problem",
        reviewText:
          "Perimeter boundary wall construction halted due to cement shortage. Deep unpaved trench waterlogged creating severe safety hazard for resident girls.",
        flagInspection: true,
        videoUri: DEMO_VIDEO_FALLBACK,
        inspectorVideoUri: DEMO_VIDEO_FALLBACK,
        direction: "outgoing",
        status: "answered",
        startedAt: new Date(Date.now() - 3600 * 1000 * 48),
      },
      {
        id: "hist-04",
        contactId: "cnt-05",
        contactName: "Sunita Mohanty",
        contactTitle: "Shelter Superintendent",
        role: "staff",
        projectCode: "DOSJE-BBR-004",
        projectName: "Swadhar Greh Women Shelter",
        callType: "video",
        durationSeconds: 0,
        condition: "satisfactory",
        reviewText: "Missed incoming call. Beneficiary intake inquiry pending.",
        flagInspection: false,
        direction: "incoming",
        status: "missed",
        startedAt: new Date(Date.now() - 3600 * 1000 * 72),
      },
      {
        id: "hist-05",
        contactId: "cnt-01",
        contactName: "Ramesh Jena",
        contactTitle: "Facility In-Charge",
        role: "staff",
        projectCode: "DOSJE-BBR-001",
        projectName: "Sishhu Bhawan Senior Citizen Home",
        callType: "video",
        durationSeconds: 0,
        condition: "satisfactory",
        reviewText: "Unanswered outgoing call. Facility lines engaged during evening check.",
        flagInspection: false,
        direction: "outgoing",
        status: "missed",
        startedAt: new Date(Date.now() - 3600 * 1000 * 96),
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
        metadata: { inspector: "inspector@netram.dev" },
        occurredAt: new Date("2026-02-10T18:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Attendance: devices, populations, windows, config, identity mappings ----------
  await db
    .insert(s.attendanceConfigs)
    .values([
      {
        dayStartTime: "05:00",
        thresholds: {
          crossSourceDiscrepancy: 0.15,
          historicalDeviation: 0.25,
          persistenceWindowDays: 5,
          materialityThreshold: 0.1,
        },
        baseline: { windowDays: 14, minObservations: 5 },
        retention: { rawTransactionsDays: 365, exportsHours: 24 },
      },
      {
        projectId: did("project:vani"),
        dayStartTime: "05:00",
        thresholds: {
          crossSourceDiscrepancy: 0.15,
          historicalDeviation: 0.25,
          persistenceWindowDays: 5,
          materialityThreshold: 0.1,
        },
        baseline: { windowDays: 14, minObservations: 5 },
        retention: { rawTransactionsDays: 365, exportsHours: 24 },
      },
      {
        projectId: did("project:cuttack-girls"),
        dayStartTime: "05:00",
        thresholds: {
          crossSourceDiscrepancy: 0.15,
          historicalDeviation: 0.25,
          persistenceWindowDays: 5,
          materialityThreshold: 0.1,
        },
        baseline: { windowDays: 14, minObservations: 5 },
        retention: { rawTransactionsDays: 365, exportsHours: 24 },
      },
    ])
    .onConflictDoNothing();

  // Populations (must be inserted before windows that reference them).
  await db
    .insert(s.attendancePopulations)
    .values([
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
    ])
    .onConflictDoNothing();

  // Morning window for Vani Vihar.
  await db
    .insert(s.attendanceWindows)
    .values([
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
    ])
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
    .values([
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
    ])
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
    .values([
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
    ])
    .onConflictDoNothing();

  // Attendance calculations: pre-computed for the demo dates.
  await db
    .insert(s.attendanceCalculations)
    .values([
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
    ])
    .onConflictDoNothing();

  // Data quality records.
  await db
    .insert(s.attendanceDataQuality)
    .values([
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
    ])
    .onConflictDoNothing();

  // Anomaly: cross-source discrepancy for Cuttack (142 biometric vs 168 reported).
  await db
    .insert(s.attendanceAnomalyGroups)
    .values([
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
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceAnomalies)
    .values([
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
        supportingSignals: {
          difference: 26,
          relative: 0.18,
          biometric: 142,
          reported: 168,
          expected: 150,
        },
        state: "NEW",
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        groupId: did("attgroup:cuttack-discrepancy"),
        linkedInspectionId: did("inspection:cuttack-routine"),
        linkedComplaintId: null,
        sourceData: {
          present: 11,
          expected: 12,
          biometric: 11,
          reported: 168,
          detectorVersion: "attendance-hybrid-0.1",
        },
        createdAt: new Date("2026-03-01T10:00:00Z"),
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
      },
    ])
    .onConflictDoNothing();

  // Review action for the reviewed anomaly.
  await db
    .insert(s.attendanceReviewActions)
    .values([
      {
        id: did("attrev:vani-reviewed"),
        anomalyId: did("atanom:vani-low-reviewed"),
        actorUserId: did("user:officer-khordha"),
        action: "acknowledge",
        note: "Reviewed — attendance within acceptable range; monitoring continued.",
        createdAt: new Date("2026-03-01T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // Correction: pending correction on a calculation.
  await db
    .insert(s.attendanceCorrections)
    .values([
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
    ])
    .onConflictDoNothing();

  // ==========================================================================
  // Seed enrichment: realistic operational history across projects (§13).
  // Deterministic, interconnected data that exercises every facility aspect.
  // ==========================================================================

  const enrichedUsers = [
    {
      id: did("user:institution-ganjam"),
      email: "institution.ganjam@dev.netram.in",
      displayName: "Ganjam School Hostel Admin",
      status: "active",
    },
    {
      id: did("user:inspector-4"),
      email: "inspector.four@dev.netram.in",
      displayName: "Inspector Sudhanshu",
      status: "active",
    },
  ] as const;
  for (const u of enrichedUsers) {
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

  await db
    .insert(s.jurisdictions)
    .values({
      id: did("jurisdiction:sundargarh"),
      code: "J-SNDR",
      name: "Sundargarh District",
      districtId: did("district:sundargarh"),
      scopeLevel: "jurisdiction",
    })
    .onConflictDoNothing();

  await db
    .insert(s.roleAssignments)
    .values([
      {
        id: did("ra:institution-ganjam"),
        userId: did("user:institution-ganjam"),
        roleCode: "institution_admin",
        authorityId: did("authority:dosje"),
        jurisdictionId: did("jurisdiction:ganjam"),
        scope: "jurisdiction",
      },
      {
        id: did("ra:inspector-4"),
        userId: did("user:inspector-4"),
        roleCode: "inspector",
        jurisdictionId: did("jurisdiction:sundargarh"),
        scope: "jurisdiction",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.organisations)
    .values({
      id: did("org:rourkela"),
      code: "ORG-ROURKELA",
      name: "Rourkela Model Girls' Hostel (ST)",
      category: "ST Hostel",
      authorityId: did("authority:dosje"),
    })
    .onConflictDoNothing();

  const enrichedProjects = [
    {
      id: did("project:rourkela"),
      code: "PRJ-ROURKELA-006",
      name: "Rourkela Model Girls' Hostel (ST)",
      type: "institution",
      schemeComponentId: did("component:pmajay-bjrc"),
      description: "Model ST girls' hostel in Rourkela, Sundargarh. 90 residents.",
      organisationId: did("org:rourkela"),
      authorityId: did("authority:dosje"),
      districtId: did("district:sundargarh"),
      status: "Active",
      approvedById: did("user:dept-admin"),
      approvedAt: new Date("2026-01-05T09:30:00Z"),
      programmeIds: [did("programme:pmajay"), did("programme:surprise-audit")],
    },
  ] as const;
  for (const p of enrichedProjects) {
    await db
      .insert(s.projects)
      .values({
        ...p,
        programmeIds: [...p.programmeIds],
      })
      .onConflictDoNothing();
  }

  // ---------- Inspection teams for enriched projects ----------
  await db
    .insert(s.inspectionTeams)
    .values([
      { id: did("team:ganjam-1"), name: "Ganjam Model School Inspection Team" },
      { id: did("team:rourkela-1"), name: "Rourkela Hostel Inspection Team" },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.teamMembers)
    .values([
      {
        teamId: did("team:ganjam-1"),
        inspectorUserId: did("user:inspector-3"),
        role: "lead",
      },
      {
        teamId: did("team:rourkela-1"),
        inspectorUserId: did("user:inspector-4"),
        role: "lead",
      },
    ])
    .onConflictDoNothing();

  // ---------- Inspections: historical + in-flight across projects ----------
  await db
    .insert(s.inspections)
    .values([
      {
        id: did("inspection:vani-nov-routine"),
        projectId: did("project:vani"),
        templateId: did("template:hostel"),
        type: "routine",
        trigger: "automatic",
        status: "closed",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2025-11-10T06:00:00Z"),
        scheduledEnd: new Date("2025-11-10T10:00:00Z"),
        startedAt: new Date("2025-11-10T06:05:00Z"),
        submittedAt: new Date("2025-11-10T09:50:00Z"),
      },
      {
        id: did("inspection:vani-jan-midnight"),
        projectId: did("project:vani"),
        templateId: did("template:hostel"),
        type: "surprise",
        trigger: "officer",
        status: "closed",
        disclosurePolicyId: did("policy:hidden"),
        scheduledStart: new Date("2026-01-15T00:00:00Z"),
        scheduledEnd: new Date("2026-01-15T03:00:00Z"),
        startedAt: new Date("2026-01-15T00:10:00Z"),
        submittedAt: new Date("2026-01-15T02:40:00Z"),
      },
      {
        id: did("inspection:vani-followup-mar"),
        projectId: did("project:vani"),
        templateId: did("template:hostel"),
        type: "follow_up",
        trigger: "officer",
        status: "verification",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2026-03-02T06:00:00Z"),
        scheduledEnd: new Date("2026-03-02T09:00:00Z"),
        startedAt: new Date("2026-03-02T06:15:00Z"),
        submittedAt: new Date("2026-03-02T08:45:00Z"),
      },
      {
        id: did("inspection:ganjam-jan-routine"),
        projectId: did("project:ganjam-school"),
        templateId: did("template:hostel"),
        type: "routine",
        trigger: "risk_engine",
        status: "closed",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2026-01-12T06:00:00Z"),
        scheduledEnd: new Date("2026-01-12T10:00:00Z"),
        startedAt: new Date("2026-01-12T06:10:00Z"),
        submittedAt: new Date("2026-01-12T09:40:00Z"),
      },
      {
        id: did("inspection:ganjam-feb-surprise"),
        projectId: did("project:ganjam-school"),
        templateId: did("template:hostel"),
        type: "surprise",
        trigger: "officer",
        status: "corrective_actions",
        disclosurePolicyId: did("policy:hidden"),
        scheduledStart: new Date("2026-02-18T06:00:00Z"),
        scheduledEnd: new Date("2026-02-18T11:00:00Z"),
        startedAt: new Date("2026-02-18T06:20:00Z"),
        submittedAt: new Date("2026-02-18T10:20:00Z"),
      },
      {
        id: did("inspection:ganjam-apr-followup"),
        projectId: did("project:ganjam-school"),
        templateId: did("template:hostel"),
        type: "follow_up",
        trigger: "officer",
        status: "assigned",
        disclosurePolicyId: did("policy:hidden"),
        scheduledStart: new Date("2026-04-02T06:00:00Z"),
        scheduledEnd: new Date("2026-04-02T10:00:00Z"),
        startedAt: null,
        submittedAt: null,
      },
      {
        id: did("inspection:cuttack-oct-routine"),
        projectId: did("project:cuttack-girls"),
        templateId: did("template:hostel"),
        type: "routine",
        trigger: "automatic",
        status: "closed",
        disclosurePolicyId: did("policy:officer"),
        scheduledStart: new Date("2025-10-12T05:30:00Z"),
        scheduledEnd: new Date("2025-10-12T11:30:00Z"),
        startedAt: new Date("2025-10-12T05:45:00Z"),
        submittedAt: new Date("2025-10-12T11:00:00Z"),
      },
      {
        id: did("inspection:rourkela-sep-surprise"),
        projectId: did("project:rourkela"),
        templateId: did("template:hostel"),
        type: "surprise",
        trigger: "officer",
        status: "in_progress",
        disclosurePolicyId: did("policy:hidden"),
        scheduledStart: new Date("2026-09-10T06:00:00Z"),
        scheduledEnd: new Date("2026-09-10T11:00:00Z"),
        startedAt: new Date("2026-09-10T06:30:00Z"),
        submittedAt: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.inspectionAssignments)
    .values([
      {
        id: did("ia:vani-nov-1"),
        inspectionId: did("inspection:vani-nov-routine"),
        userId: did("user:inspector-1"),
        role: "lead",
        assignedAt: new Date("2025-11-08T10:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:vani-jan-1"),
        inspectionId: did("inspection:vani-jan-midnight"),
        userId: did("user:inspector-1"),
        role: "lead",
        assignedAt: new Date("2026-01-14T14:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:vani-followup-1"),
        inspectionId: did("inspection:vani-followup-mar"),
        userId: did("user:inspector-1"),
        role: "lead",
        assignedAt: new Date("2026-03-01T09:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:ganjam-jan-1"),
        inspectionId: did("inspection:ganjam-jan-routine"),
        userId: did("user:inspector-3"),
        role: "lead",
        assignedAt: new Date("2026-01-10T10:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:ganjam-feb-1"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        userId: did("user:inspector-3"),
        role: "lead",
        assignedAt: new Date("2026-02-16T14:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:ganjam-followup-1"),
        inspectionId: did("inspection:ganjam-apr-followup"),
        userId: did("user:inspector-3"),
        role: "lead",
        assignedAt: new Date("2026-03-28T09:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:cuttack-oct-1"),
        inspectionId: did("inspection:cuttack-oct-routine"),
        userId: did("user:inspector-2"),
        role: "lead",
        assignedAt: new Date("2025-10-10T10:00:00Z"),
        status: "assigned",
      },
      {
        id: did("ia:rourkela-1"),
        inspectionId: did("inspection:rourkela-sep-surprise"),
        userId: did("user:inspector-4"),
        role: "lead",
        assignedAt: new Date("2026-09-08T11:00:00Z"),
        status: "assigned",
      },
    ])
    .onConflictDoNothing();

  // ---------- Observations, findings, evidence, corrective actions ----------
  await db
    .insert(s.observations)
    .values([
      {
        id: did("observation:vani-nov-1"),
        inspectionId: did("inspection:vani-nov-routine"),
        userId: did("user:inspector-1"),
        text: "First-aid cabinet inventory checked; three blister packs were past their expiry date.",
      },
      {
        id: did("observation:vani-jan-1"),
        inspectionId: did("inspection:vani-jan-midnight"),
        userId: did("user:inspector-1"),
        text: "Night patrol of kitchen premises found one tray of cooked food uncovered at 01:20.",
      },
      {
        id: did("observation:vani-followup-1"),
        inspectionId: did("inspection:vani-followup-mar"),
        userId: did("user:inspector-1"),
        text: "Verified RO filter replacement certificate and inspected the fitted filter unit in situ.",
      },
      {
        id: did("observation:ganjam-jan-1"),
        inspectionId: did("inspection:ganjam-jan-routine"),
        userId: did("user:inspector-3"),
        text: "Sanitation register reviewed; toilet cleaning entries were missing for the second week of January.",
      },
      {
        id: did("observation:ganjam-feb-1"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        userId: did("user:inspector-3"),
        text: "Kitchen storage room: sacks of rice exposed directly on the floor without pallets.",
      },
      {
        id: did("observation:ganjam-feb-2"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        userId: did("user:inspector-3"),
        text: "Drinking water sample collected; residual chlorine below acceptable range.",
      },
      {
        id: did("observation:ganjam-feb-3"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        userId: did("user:inspector-3"),
        text: "Roll-call register mismatch: register shows 118 present, physical headcount was 104.",
      },
      {
        id: did("observation:cuttack-oct-1"),
        inspectionId: did("inspection:cuttack-oct-routine"),
        userId: did("user:inspector-2"),
        text: "Dining hall washrooms: two taps non-functional and water logging on the floor.",
      },
      {
        id: did("observation:rourkela-1"),
        inspectionId: did("inspection:rourkela-sep-surprise"),
        userId: did("user:inspector-4"),
        text: "Kitchen pantry door found unlatched during inspection; storage bins uncovered.",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.findings)
    .values([
      {
        id: did("finding:vani-nov-1"),
        inspectionId: did("inspection:vani-nov-routine"),
        observationId: did("observation:vani-nov-1"),
        severity: "low",
        description: "First-aid cabinet contained expired stock.",
        remediation: "Replace expired stock and maintain a quarterly checklist.",
        status: "action_required",
      },
      {
        id: did("finding:vani-jan-1"),
        inspectionId: did("inspection:vani-jan-midnight"),
        observationId: did("observation:vani-jan-1"),
        severity: "low",
        description: "Cooked food left uncovered in the kitchen during the night.",
        remediation: "Enforce close-of-day food storage protocol.",
        status: "action_required",
      },
      {
        id: did("finding:vani-followup-1"),
        inspectionId: did("inspection:vani-followup-mar"),
        observationId: did("observation:vani-followup-1"),
        severity: "low",
        description: "RO filter replacement verified; residual log-keeping gaps found.",
        remediation: "Maintain a monthly RO service log.",
        status: "action_required",
      },
      {
        id: did("finding:ganjam-jan-1"),
        inspectionId: did("inspection:ganjam-jan-routine"),
        observationId: did("observation:ganjam-jan-1"),
        severity: "low",
        description: "Sanitation register entries incomplete for a one-week period.",
        remediation: "Complete daily sanitation logs and submit a summary.",
        status: "action_required",
      },
      {
        id: did("finding:ganjam-feb-1"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        observationId: did("observation:ganjam-feb-1"),
        severity: "high",
        description: "Food grain sacks stored directly on the floor; rodent access risk.",
        remediation: "Palletize storage, seal all bins, and submit a pest-control report.",
        status: "action_required",
        categoryId: did("fcat:food"),
        responsibleOrganisationId: did("org:ganjam-school"),
      },
      {
        id: did("finding:ganjam-feb-2"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        observationId: did("observation:ganjam-feb-2"),
        severity: "medium",
        description: "Residual chlorine in drinking water below acceptable range.",
        remediation: "Service the chlorination unit and submit a lab report.",
        status: "action_required",
        categoryId: did("fcat:water"),
        responsibleOrganisationId: did("org:ganjam-school"),
      },
      {
        id: did("finding:ganjam-feb-3"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        observationId: did("observation:ganjam-feb-3"),
        severity: "medium",
        description: "Roll-call register overstates resident headcount versus physical count.",
        remediation: "Reconcile the register with biometric headcount and document variance.",
        status: "action_required",
        categoryId: did("fcat:rolls"),
        amountInr: 56000,
        responsibleOrganisationId: did("org:ganjam-school"),
      },
      {
        id: did("finding:cuttack-oct-1"),
        inspectionId: did("inspection:cuttack-oct-routine"),
        observationId: did("observation:cuttack-oct-1"),
        severity: "medium",
        description: "Dining hall washrooms reported water logging and non-functional taps.",
        remediation: "Repair fixtures and install anti-skid flooring.",
        status: "action_required",
      },
      {
        id: did("finding:rourkela-1"),
        inspectionId: did("inspection:rourkela-sep-surprise"),
        observationId: did("observation:rourkela-1"),
        severity: "medium",
        description: "Pantry door unlatched and storage bins uncovered during inspection.",
        remediation: "Complete a pest-control sweep and enforce close-of-day storage protocol.",
        status: "action_required",
      },
      // Confirmed findings still awaiting a remediation order (§32 queue):
      // status "confirmed" with no corrective action row, so the Action Inbox
      // finding_review section and the corrective-actions ordering surface
      // both have deterministic pending work.
      {
        id: did("finding:ganjam-feb-4"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        observationId: did("observation:ganjam-feb-1"),
        severity: "high",
        description: "Kitchen exhaust and chimney heavily greased; fire risk during bulk cooking.",
        remediation:
          "Degrease exhaust system, commission a pre-monsoon safety audit, and institute a monthly cleaning rota.",
        status: "confirmed",
        categoryId: did("fcat:infra"),
        responsibleOrganisationId: did("org:ganjam-school"),
      },
      {
        id: did("finding:ganjam-feb-5"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        observationId: did("observation:ganjam-feb-2"),
        severity: "medium",
        description:
          "Medicines in the infirmary stored beyond expiry; no disposal register maintained.",
        remediation:
          "Segregate and dispose of expired stock per biomedical waste rules; open a disposal register.",
        status: "confirmed",
        categoryId: did("fcat:food"),
        responsibleOrganisationId: did("org:ganjam-school"),
      },
      {
        id: did("finding:cuttack-oct-2"),
        inspectionId: did("inspection:cuttack-oct-routine"),
        observationId: did("observation:cuttack-oct-1"),
        severity: "high",
        description: "Boundary wall collapsed along the rear lane; resident safety compromised.",
        remediation:
          "Emergency barricading, structural assessment by PWD, and reconstruction with third-party quality check.",
        status: "confirmed",
        categoryId: did("fcat:infra"),
        amountInr: 185000,
        responsibleOrganisationId: did("org:cuttack-girls"),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.evidence)
    .values([
      {
        id: did("evidence:vani-jan-1"),
        inspectionId: did("inspection:vani-jan-midnight"),
        findingId: did("finding:vani-jan-1"),
        capturedAt: new Date("2026-01-15T01:25:00Z"),
        latitude: 20.2961,
        longitude: 85.8245,
        evidenceType: "photo",
        fileName: "kitchen-nightshelf.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1523401,
        contentHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        deviceId: "DEV-IPHONE-01",
        uploadState: "uploaded",
        integrityState: "verified",
      },
      {
        id: did("evidence:vani-followup-1"),
        inspectionId: did("inspection:vani-followup-mar"),
        findingId: did("finding:vani-followup-1"),
        capturedAt: new Date("2026-03-02T07:05:00Z"),
        latitude: 20.2961,
        longitude: 85.8245,
        evidenceType: "photo",
        fileName: "ro-filter-installed.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2011934,
        contentHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        deviceId: "DEV-IPHONE-01",
        uploadState: "uploaded",
        integrityState: "verified",
      },
      {
        id: did("evidence:ganjam-feb-1"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        findingId: did("finding:ganjam-feb-1"),
        capturedAt: new Date("2026-02-18T07:40:00Z"),
        latitude: 19.2665,
        longitude: 84.8354,
        evidenceType: "photo",
        fileName: "ganjam-storage.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 3118820,
        contentHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        deviceId: "DEV-ANDROID-02",
        uploadState: "uploaded",
        integrityState: "verified",
      },
      {
        id: did("evidence:cuttack-oct-1"),
        inspectionId: did("inspection:cuttack-oct-routine"),
        findingId: did("finding:cuttack-oct-1"),
        capturedAt: new Date("2025-10-12T08:15:00Z"),
        latitude: 20.4625,
        longitude: 85.8797,
        evidenceType: "photo",
        fileName: "cuttack-washroom.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1842650,
        contentHash: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        deviceId: "DEV-ANDROID-02",
        uploadState: "uploaded",
        integrityState: "verified",
      },
      {
        id: did("evidence:rourkela-1"),
        inspectionId: did("inspection:rourkela-sep-surprise"),
        findingId: did("finding:rourkela-1"),
        capturedAt: new Date("2026-09-10T07:10:00Z"),
        latitude: 22.0664,
        longitude: 84.8366,
        evidenceType: "photo",
        fileName: "rourkela-pantry.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1330021,
        contentHash: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        deviceId: "DEV-IPHONE-03",
        uploadState: "uploaded",
        integrityState: "verified",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.correctiveActions)
    .values([
      {
        id: did("ca:vani-nov-1"),
        findingId: did("finding:vani-nov-1"),
        inspectionId: did("inspection:vani-nov-routine"),
        organisationId: did("org:vani"),
        status: "accepted",
        deadline: new Date("2025-11-25T23:59:00Z"),
        submittedAt: new Date("2025-11-18T10:00:00Z"),
        actionSummary:
          "Expired first-aid stock replaced; quarterly checklist circulated to wardens.",
        verifiedAt: new Date("2025-11-22T10:00:00Z"),
        verifiedByUserId: did("user:officer-khordha"),
        reviewRemarks: "Verified against replaced stock photographs and the new checklist.",
      },
      {
        id: did("ca:vani-jan-1"),
        findingId: did("finding:vani-jan-1"),
        inspectionId: did("inspection:vani-jan-midnight"),
        organisationId: did("org:vani"),
        status: "accepted",
        deadline: new Date("2026-01-30T23:59:00Z"),
        submittedAt: new Date("2026-01-24T10:00:00Z"),
      },
      {
        id: did("ca:vani-followup-1"),
        findingId: did("finding:vani-followup-1"),
        inspectionId: did("inspection:vani-followup-mar"),
        organisationId: did("org:vani"),
        status: "under_review",
        deadline: new Date("2026-03-20T23:59:00Z"),
        submittedAt: new Date("2026-03-18T10:00:00Z"),
      },
      {
        id: did("ca:ganjam-jan-1"),
        findingId: did("finding:ganjam-jan-1"),
        inspectionId: did("inspection:ganjam-jan-routine"),
        organisationId: did("org:ganjam-school"),
        status: "accepted",
        deadline: new Date("2026-01-30T23:59:00Z"),
        submittedAt: new Date("2026-01-26T10:00:00Z"),
        actionSummary: "Sanitation log backfilled and daily supervisor sign-off introduced.",
        verifiedAt: new Date("2026-01-29T10:00:00Z"),
        verifiedByUserId: did("user:dept-admin"),
      },
      {
        id: did("ca:ganjam-feb-1"),
        findingId: did("finding:ganjam-feb-1"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        organisationId: did("org:ganjam-school"),
        status: "overdue",
        deadline: new Date("2026-03-10T23:59:00Z"),
        submittedAt: null,
      },
      {
        id: did("ca:ganjam-feb-2"),
        findingId: did("finding:ganjam-feb-2"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        organisationId: did("org:ganjam-school"),
        status: "under_review",
        deadline: new Date("2026-03-15T23:59:00Z"),
        submittedAt: new Date("2026-03-12T10:00:00Z"),
      },
      {
        id: did("ca:ganjam-feb-3"),
        findingId: did("finding:ganjam-feb-3"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        organisationId: did("org:ganjam-school"),
        status: "pending",
        deadline: new Date("2026-03-18T23:59:00Z"),
        submittedAt: null,
      },
      {
        id: did("ca:cuttack-oct-1"),
        findingId: did("finding:cuttack-oct-1"),
        inspectionId: did("inspection:cuttack-oct-routine"),
        organisationId: did("org:cuttack-girls"),
        status: "accepted",
        deadline: new Date("2025-11-05T23:59:00Z"),
        submittedAt: new Date("2025-10-28T10:00:00Z"),
      },
      {
        id: did("ca:rourkela-1"),
        findingId: did("finding:rourkela-1"),
        inspectionId: did("inspection:rourkela-sep-surprise"),
        organisationId: did("org:rourkela"),
        status: "pending",
        deadline: new Date("2026-09-25T23:59:00Z"),
        submittedAt: null,
      },
    ])
    .onConflictDoNothing();

  // ---------- Complaints: a mix of open, resolved, and screened-out (§35) ----------
  await db
    .insert(s.complaints)
    .values([
      {
        id: did("complaint:vani-noise"),
        projectId: did("project:vani"),
        complainantName: "Guardian (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0002",
        description: "Repeated complaint about late-night noise from the common room.",
        status: "closed",
        receivedAt: new Date("2025-12-20T09:00:00Z"),
        resolutionText:
          "Verified on two night visits — no consistent pattern; closed after review.",
        resolvedAt: new Date("2026-01-10T10:00:00Z"),
      },
      {
        id: did("complaint:vani-mattress"),
        projectId: did("project:vani"),
        complainantName: "Guardian (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0003",
        description: "Worn mattresses reported in the dormitory wing.",
        status: "resolved",
        receivedAt: new Date("2026-01-18T09:00:00Z"),
        resolutionText: "Replaced 12 worn mattresses under annual maintenance.",
        resolvedAt: new Date("2026-02-05T10:00:00Z"),
      },
      {
        id: did("complaint:ganjam-electrical"),
        projectId: did("project:ganjam-school"),
        complainantName: "Parent (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0004",
        description: "Exposed wiring and damaged power sockets in the dormitory wing.",
        status: "resolved",
        receivedAt: new Date("2026-02-10T09:00:00Z"),
        resolutionText: "Damaged sockets replaced; electrical audit completed.",
        resolvedAt: new Date("2026-02-20T10:00:00Z"),
      },
      {
        id: did("complaint:cuttack-headcount"),
        projectId: did("project:cuttack-girls"),
        complainantName: "Guardian (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0005",
        description:
          "Concern that reported resident headcount exceeds actual roll-call attendance.",
        status: "escalated",
        receivedAt: new Date("2026-03-03T09:00:00Z"),
        resolutionText: null,
        resolvedAt: null,
      },
      {
        id: did("complaint:rajdhani-water"),
        projectId: did("project:rajdhani"),
        complainantName: "Resident (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0006",
        description: "Intermittent potable water supply in hostel blocks A and B.",
        status: "received",
        receivedAt: new Date("2026-09-05T09:00:00Z"),
        resolutionText: null,
        resolvedAt: null,
      },
      {
        id: did("complaint:ganjam-nutrition"),
        projectId: did("project:ganjam-school"),
        complainantName: "Parent (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0007",
        description: "Midday meal portion sizes reportedly reduced in recent weeks.",
        status: "received",
        receivedAt: new Date("2026-09-08T09:00:00Z"),
        resolutionText: null,
        resolvedAt: null,
      },
      {
        id: did("complaint:rourkela-power"),
        projectId: did("project:rourkela"),
        complainantName: "Resident (redacted)",
        contactInfo: "****@dev.netram.in",
        trackingCode: "CMP-2026-0008",
        description: "Evening power fluctuations reported by residents in the hostel.",
        status: "under_review",
        receivedAt: new Date("2026-09-12T09:00:00Z"),
        resolutionText: null,
        resolvedAt: null,
      },
    ])
    .onConflictDoNothing();

  // ---------- AI anomalies: camera-feed conflict detections across districts (§36) ----------
  await db
    .insert(s.aiAnomalies)
    .values([
      {
        id: did("ai:vani-gate-conflict"),
        inspectionId: did("inspection:vani-jan-midnight"),
        evidenceId: null,
        type: "conflict",
        severity: "high",
        confidence: 0.87,
        modelVersion: "conflict-detector-0.1",
        explanation:
          "Physical altercation detected near the main gate camera during the evening window.",
        status: "new",
      },
      {
        id: did("ai:vani-dining-conflict-resolved"),
        inspectionId: did("inspection:vani-surprise"),
        evidenceId: null,
        type: "conflict",
        severity: "medium",
        confidence: 0.64,
        modelVersion: "conflict-detector-0.1",
        explanation:
          "Raised voices flagged on the dining hall feed; short-lived, reviewed as a verbal dispute.",
        status: "dismissed",
        reviewedAt: new Date("2026-02-20T09:00:00Z"),
        reviewedBy: did("user:officer-khordha"),
      },
      {
        id: did("ai:vani-gate-conflict-action"),
        inspectionId: did("inspection:vani-jan-midnight"),
        evidenceId: did("evidence:vani-jan-1"),
        type: "conflict",
        severity: "critical",
        confidence: 0.92,
        modelVersion: "conflict-detector-0.1",
        explanation:
          "Sustained struggle between two individuals at the gate; linked evidence reviewed and acted upon by authority.",
        status: "acted_upon",
        reviewedAt: new Date("2026-01-16T09:00:00Z"),
        reviewedBy: did("user:officer-khordha"),
      },
      {
        id: did("ai:ganjam-conflict"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        evidenceId: null,
        type: "conflict",
        severity: "medium",
        confidence: 0.72,
        modelVersion: "conflict-detector-0.1",
        explanation: "Scuffle flagged on the assembly ground feed during recess.",
        status: "new",
      },
      {
        id: did("ai:ganjam-conflict-review"),
        inspectionId: did("inspection:ganjam-jan-routine"),
        evidenceId: null,
        type: "conflict",
        severity: "low",
        confidence: 0.55,
        modelVersion: "conflict-detector-0.1",
        explanation:
          "Brief push flagged on the corridor feed; assessed by district admin as a minor incident.",
        status: "reviewed",
        reviewedAt: new Date("2026-01-15T09:00:00Z"),
        reviewedBy: did("user:dept-admin"),
      },
      {
        id: did("ai:cuttack-conflict-investigate"),
        inspectionId: did("inspection:cuttack-routine"),
        evidenceId: null,
        type: "conflict",
        severity: "high",
        confidence: 0.85,
        modelVersion: "conflict-detector-0.1",
        explanation:
          "Altercation detected on the dining hall feed; escalated for physical inspection verification.",
        status: "investigated",
        reviewedAt: new Date("2026-03-05T09:00:00Z"),
        reviewedBy: did("user:officer-cuttack"),
      },
    ])
    .onConflictDoNothing();

  // ---------- CCTV cameras and streams across districts (§42) ----------
  await db
    .insert(s.cctvCameras)
    .values([
      {
        id: did("cctv:vani-dormitory"),
        name: "Vani Vihar - Dormitory Block",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/vani/dormitory",
        districtId: did("district:khordha"),
        projectId: did("project:vani"),
        status: "active",
      },
      {
        id: did("cctv:vani-kitchen"),
        name: "Vani Vihar - Kitchen Entry",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/vani/kitchen",
        districtId: did("district:khordha"),
        projectId: did("project:vani"),
        status: "inactive",
      },
      {
        id: did("cctv:cuttack-gate"),
        name: "Cuttack Girls' Hostel - Main Gate",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/cuttack/gate",
        districtId: did("district:cuttack"),
        projectId: did("project:cuttack-girls"),
        status: "active",
      },
      {
        id: did("cctv:ganjam-gate"),
        name: "Ganjam Model School - Main Gate",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/ganjam/gate",
        districtId: did("district:ganjam"),
        projectId: did("project:ganjam-school"),
        status: "active",
      },
      {
        id: did("cctv:ganjam-kitchen"),
        name: "Ganjam Model School - Kitchen",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/ganjam/kitchen",
        districtId: did("district:ganjam"),
        projectId: did("project:ganjam-school"),
        status: "inactive",
      },
      {
        id: did("cctv:rajdhani-gate"),
        name: "Rajdhani Boys' Hostel - Main Gate",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/rajdhani/gate",
        districtId: did("district:khordha"),
        projectId: did("project:rajdhani"),
        status: "active",
      },
      {
        id: did("cctv:rourkela-gate"),
        name: "Rourkela Model Girls' Hostel - Main Gate",
        provider: "simulated",
        protocol: "rtsp",
        endpoint: "rtsp://sim.local/rourkela/gate",
        districtId: did("district:sundargarh"),
        projectId: did("project:rourkela"),
        status: "active",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.cctvStreams)
    .values([
      {
        id: did("stream:vani-kitchen-1"),
        cameraId: did("cctv:vani-kitchen"),
        status: "active",
        startedAt: new Date("2026-02-11T06:00:00Z"),
      },
      {
        id: did("stream:ganjam-gate-1"),
        cameraId: did("cctv:ganjam-gate"),
        status: "active",
        startedAt: new Date("2026-02-18T06:00:00Z"),
      },
      {
        id: did("stream:rourkela-gate-1"),
        cameraId: did("cctv:rourkela-gate"),
        status: "active",
        startedAt: new Date("2026-09-10T06:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- VC review sessions (§43) ----------
  await db
    .insert(s.vcSessions)
    .values([
      {
        id: did("vc:ganjam-tripartite"),
        inspectionId: did("inspection:ganjam-feb-surprise"),
        projectId: did("project:ganjam-school"),
        title: "Ganjam School Hostel Tripartite Review",
        status: "scheduled",
        hostUserId: did("user:dept-admin"),
        roomName: "netram-review-ganjam-surprise",
        provider: "webrtc",
        scheduledAt: new Date("2026-03-22T10:00:00Z"),
        metadata: { agenda: "Review remediation timeline for food storage and water findings" },
      },
      {
        id: did("vc:rourkela-review"),
        inspectionId: did("inspection:rourkela-sep-surprise"),
        projectId: did("project:rourkela"),
        title: "Rourkela Hostel Review Session",
        status: "scheduled",
        hostUserId: did("user:dept-admin"),
        roomName: "netram-review-rourkela-surprise",
        provider: "webrtc",
        scheduledAt: new Date("2026-09-18T10:00:00Z"),
        metadata: { agenda: "Discuss initial surprise inspection findings" },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.vcParticipants)
    .values([
      {
        id: did("vcp:cuttack-host"),
        sessionId: did("vc:cuttack-review"),
        userId: did("user:officer-cuttack"),
        role: "host",
      },
      {
        id: did("vcp:cuttack-inspector"),
        sessionId: did("vc:cuttack-review"),
        userId: did("user:inspector-2"),
        role: "inspector",
      },
      {
        id: did("vcp:ganjam-host"),
        sessionId: did("vc:ganjam-tripartite"),
        userId: did("user:dept-admin"),
        role: "host",
      },
      {
        id: did("vcp:ganjam-inspector"),
        sessionId: did("vc:ganjam-tripartite"),
        userId: did("user:inspector-3"),
        role: "inspector",
      },
      {
        id: did("vcp:ganjam-org"),
        sessionId: did("vc:ganjam-tripartite"),
        userId: did("user:institution-ganjam"),
        role: "organisation_rep",
      },
      {
        id: did("vcp:rourkela-host"),
        sessionId: did("vc:rourkela-review"),
        userId: did("user:dept-admin"),
        role: "host",
      },
      {
        id: did("vcp:rourkela-inspector"),
        sessionId: did("vc:rourkela-review"),
        userId: did("user:inspector-4"),
        role: "inspector",
      },
    ])
    .onConflictDoNothing();

  // ---------- Notifications ----------
  await db
    .insert(s.notifications)
    .values([
      {
        id: did("notif:inv1-followup"),
        userId: did("user:inspector-1"),
        type: "inspection.assigned",
        title: "Follow-up inspection assigned",
        body: "Vani Vihar follow-up inspection was assigned to you.",
        status: "sent",
        sentAt: new Date("2026-03-01T09:00:00Z"),
      },
      {
        id: did("notif:inv3-ganjam"),
        userId: did("user:inspector-3"),
        type: "inspection.assigned",
        title: "Surprise inspection assigned",
        body: "Ganjam Model School surprise inspection was assigned to you.",
        status: "sent",
        sentAt: new Date("2026-02-16T14:00:00Z"),
      },
      {
        id: did("notif:inv4-rourkela"),
        userId: did("user:inspector-4"),
        type: "inspection.assigned",
        title: "Surprise inspection assigned",
        body: "Rourkela Model Girls' Hostel surprise inspection was assigned to you.",
        status: "sent",
        sentAt: new Date("2026-09-08T11:00:00Z"),
      },
      {
        id: did("notif:admin-ganjam-overdue"),
        userId: did("user:dept-admin"),
        type: "corrective_action.overdue",
        title: "Corrective action overdue",
        body: "A corrective action at Ganjam Model School Hostel is overdue.",
        status: "sent",
        sentAt: new Date("2026-03-11T00:05:00Z"),
      },
      {
        id: did("notif:org-ganjam-complaint"),
        userId: did("user:institution-ganjam"),
        type: "complaint.received",
        title: "Complaint received",
        body: "A complaint was registered against your facility.",
        status: "sent",
        sentAt: new Date("2026-09-08T10:00:00Z"),
      },
      {
        id: did("notif:admin-rourkela-anomaly"),
        userId: did("user:dept-admin"),
        type: "ai.anomaly_detected",
        title: "AI anomaly detected",
        body: "A new AI signal requires review at Rourkela Model Girls' Hostel.",
        status: "sent",
        sentAt: new Date("2026-09-10T12:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Audit trail: project-scoped (facility activity) + entity-scoped (§22) ----------
  await db
    .insert(s.auditEvents)
    .values([
      {
        id: did("audit:vani-nov-inspection"),
        action: "inspection.created",
        actorUserId: did("user:officer-khordha"),
        resourceType: "project",
        resourceId: did("project:vani"),
        metadata: { code: "PRJ-VANI-001", inspectionType: "routine" },
        occurredAt: new Date("2025-11-08T10:00:00Z"),
      },
      {
        id: did("audit:vani-jan-closed"),
        action: "inspection.closed",
        actorUserId: did("user:officer-khordha"),
        resourceType: "project",
        resourceId: did("project:vani"),
        metadata: { code: "PRJ-VANI-001", findings: 1 },
        occurredAt: new Date("2026-01-16T10:00:00Z"),
      },
      {
        id: did("audit:vani-complaint-resolved"),
        action: "complaint.resolved",
        actorUserId: did("user:officer-khordha"),
        resourceType: "project",
        resourceId: did("project:vani"),
        metadata: { code: "PRJ-VANI-001", trackingCode: "CMP-2026-0003" },
        occurredAt: new Date("2026-02-05T10:00:00Z"),
      },
      {
        id: did("audit:vani-anomaly-reviewed"),
        action: "ai.anomaly_reviewed",
        actorUserId: did("user:officer-khordha"),
        resourceType: "project",
        resourceId: did("project:vani"),
        metadata: { code: "PRJ-VANI-001", anomalyType: "conflict" },
        occurredAt: new Date("2026-02-20T09:00:00Z"),
      },
      {
        id: did("audit:vani-ca-escalated"),
        action: "corrective_action.escalated",
        actorUserId: did("user:officer-khordha"),
        resourceType: "project",
        resourceId: did("project:vani"),
        metadata: { code: "PRJ-VANI-001", finding: "Kitchen hygiene" },
        occurredAt: new Date("2026-03-12T09:00:00Z"),
      },
      {
        id: did("audit:ganjam-created"),
        action: "project.created",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:ganjam-school"),
        metadata: { code: "PRJ-GANJ-005" },
        occurredAt: new Date("2025-11-22T09:00:00Z"),
      },
      {
        id: did("audit:ganjam-approved"),
        action: "project.approved",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:ganjam-school"),
        metadata: { code: "PRJ-GANJ-005" },
        occurredAt: new Date("2025-12-01T09:00:00Z"),
      },
      {
        id: did("audit:ganjam-insp-submitted"),
        action: "inspection.submitted",
        actorUserId: did("user:inspector-3"),
        resourceType: "project",
        resourceId: did("project:ganjam-school"),
        metadata: { code: "PRJ-GANJ-005", findings: 3 },
        occurredAt: new Date("2026-02-18T10:20:00Z"),
      },
      {
        id: did("audit:ganjam-ca-overdue"),
        action: "corrective_action.overdue",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:ganjam-school"),
        metadata: { code: "PRJ-GANJ-005", finding: "Food grain storage" },
        occurredAt: new Date("2026-03-11T00:05:00Z"),
      },
      {
        id: did("audit:ganjam-complaint"),
        action: "complaint.received",
        actorUserId: did("user:control-room"),
        resourceType: "project",
        resourceId: did("project:ganjam-school"),
        metadata: { code: "PRJ-GANJ-005", trackingCode: "CMP-2026-0007" },
        occurredAt: new Date("2026-09-08T09:00:00Z"),
      },
      {
        id: did("audit:cuttack-suspended"),
        action: "project.suspended",
        actorUserId: did("user:officer-cuttack"),
        resourceType: "project",
        resourceId: did("project:cuttack-girls"),
        metadata: {
          code: "PRJ-CUTG-003",
          reason: "Compliance review during headcount reconciliation",
        },
        occurredAt: new Date("2026-02-25T09:00:00Z"),
      },
      {
        id: did("audit:cuttack-insp-started"),
        action: "inspection.started",
        actorUserId: did("user:inspector-2"),
        resourceType: "project",
        resourceId: did("project:cuttack-girls"),
        metadata: { code: "PRJ-CUTG-003", trigger: "risk_engine" },
        occurredAt: new Date("2026-03-01T05:45:00Z"),
      },
      {
        id: did("audit:rajdhani-created"),
        action: "project.created",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:rajdhani"),
        metadata: { code: "PRJ-RAJDHANI-002" },
        occurredAt: new Date("2025-12-15T09:00:00Z"),
      },
      {
        id: did("audit:rajdhani-submitted"),
        action: "project.submitted_for_verification",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:rajdhani"),
        metadata: { code: "PRJ-RAJDHANI-002" },
        occurredAt: new Date("2026-01-04T09:00:00Z"),
      },
      {
        id: did("audit:rourkela-created"),
        action: "project.created",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:rourkela"),
        metadata: { code: "PRJ-ROURKELA-006" },
        occurredAt: new Date("2025-12-22T09:00:00Z"),
      },
      {
        id: did("audit:rourkela-approved"),
        action: "project.approved",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:rourkela"),
        metadata: { code: "PRJ-ROURKELA-006" },
        occurredAt: new Date("2026-01-05T09:30:00Z"),
      },
      {
        id: did("audit:rourkela-insp-started"),
        action: "inspection.started",
        actorUserId: did("user:inspector-4"),
        resourceType: "project",
        resourceId: did("project:rourkela"),
        metadata: { code: "PRJ-ROURKELA-006", surprise: true },
        occurredAt: new Date("2026-09-10T06:30:00Z"),
      },
      {
        id: did("audit:puri-created"),
        action: "project.created",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:puri-model"),
        metadata: { code: "PRJ-PURI-004", status: "Draft" },
        occurredAt: new Date("2026-08-01T09:00:00Z"),
      },
      {
        id: did("audit:vani-followup-submitted"),
        action: "inspection.submitted",
        actorUserId: did("user:inspector-1"),
        resourceType: "inspection",
        resourceId: did("inspection:vani-followup-mar"),
        metadata: { verificationStage: true },
        occurredAt: new Date("2026-03-02T08:45:00Z"),
      },
      {
        id: did("audit:ganjam-feb-findings"),
        action: "inspection.findings_recorded",
        actorUserId: did("user:inspector-3"),
        resourceType: "inspection",
        resourceId: did("inspection:ganjam-feb-surprise"),
        metadata: { findings: 3 },
        occurredAt: new Date("2026-02-20T09:00:00Z"),
      },
      {
        id: did("audit:jajapur-sa-closed"),
        action: "inspection.closed",
        actorUserId: did("user:dept-admin"),
        resourceType: "project",
        resourceId: did("project:jajapur-adarsh"),
        metadata: { code: "PRJ-JAJAGRAM-009", inspectionType: "social_audit", findings: 1 },
        occurredAt: new Date("2026-02-12T10:00:00Z"),
      },
      {
        id: did("audit:purisch-atr-submitted"),
        action: "corrective_action.submitted",
        actorUserId: did("user:institution"),
        resourceType: "project",
        resourceId: did("project:purisch-1"),
        metadata: { code: "PRJ-PURISCH-007" },
        occurredAt: new Date("2026-02-12T10:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Attendance: recent Vani calculations (realistic daily values) ----------
  await db
    .insert(s.attendanceSourceObservations)
    .values([
      {
        id: did("attobs:vani-biometric-2026-09-12"),
        projectId: did("project:vani"),
        source: "BIOMETRIC",
        windowId: did("attwindow:vani-morning"),
        operationalDate: "2026-09-12",
        observedAt: new Date("2026-09-12T09:00:00Z"),
        observedCount: 154,
        expectedCount: 160,
        confidence: 0.97,
        coverage: "COMPLETE",
        health: "ONLINE",
        note: "Biometric roll call for morning window.",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceCalculations)
    .values([
      {
        id: did("attcalc:vani-2026-09-11"),
        projectId: did("project:vani"),
        windowId: did("attwindow:vani-morning"),
        operationalDate: "2026-09-11",
        expected: 160,
        present: 151,
        absent: 9,
        unknown: 0,
        sourceCounts: { BIOMETRIC: 149, INSTITUTION_REPORTED: 151, CCTV: 0, MANUAL: 2 },
        coverage: "COMPLETE",
        dataQuality: "GOOD",
        freshness: new Date("2026-09-11T08:00:00Z"),
        policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
        computedAt: new Date("2026-09-11T09:00:00Z"),
      },
      {
        id: did("attcalc:vani-2026-09-12"),
        projectId: did("project:vani"),
        windowId: did("attwindow:vani-morning"),
        operationalDate: "2026-09-12",
        expected: 160,
        present: 154,
        absent: 6,
        unknown: 0,
        sourceCounts: { BIOMETRIC: 154, INSTITUTION_REPORTED: 154, CCTV: 0, MANUAL: 0 },
        coverage: "COMPLETE",
        dataQuality: "GOOD",
        freshness: new Date("2026-09-12T08:00:00Z"),
        policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
        computedAt: new Date("2026-09-12T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Attendance: deterministic daily Vani series across 2026 ----------
  // Feeds the yearly attendance record calendar (per-institute track record).
  // Deterministic: present follows a weekly + monthly wave seeded by day-of-year
  // (not random), with a summer school-holiday dip in May-June.
  {
    const vaniId = did("project:vani");
    const windowId = did("attwindow:vani-morning");
    const rows: (typeof s.attendanceCalculations.$inferInsert)[] = [];
    for (let day = 1; day <= 365; day++) {
      const base = new Date(Date.UTC(2026, 0, 1));
      base.setUTCDate(base.getUTCDate() + day - 1);
      if (base.getUTCFullYear() !== 2026) break;
      const iso = base.toISOString().slice(0, 10);
      const dow = base.getUTCDay();
      const month = base.getUTCMonth(); // 0-based
      const holidayDip = month === 4 || month === 5 ? 12 : 0; // May/June
      const wave = Math.round(Math.sin(day / 9) * 6 + Math.cos(day / 29) * 4);
      const weekendLift = dow === 0 ? 3 : 0;
      const present = Math.min(160, Math.max(108, 148 + wave + weekendLift - holidayDip));
      const absent = 160 - present;
      rows.push({
        id: did(`attcalc:vani-${iso}`),
        projectId: vaniId,
        windowId,
        operationalDate: iso,
        expected: 160,
        present,
        absent,
        unknown: 0,
        sourceCounts: { BIOMETRIC: present, INSTITUTION_REPORTED: present, CCTV: 0, MANUAL: 0 },
        coverage: "COMPLETE",
        dataQuality: "GOOD",
        freshness: new Date(`${iso}T08:00:00Z`),
        policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
        computedAt: new Date(`${iso}T09:00:00Z`),
      });
    }
    await db.insert(s.attendanceCalculations).values(rows).onConflictDoNothing();
  }
  await db
    .insert(s.attendanceConfigs)
    .values([
      {
        projectId: did("project:ganjam-school"),
        dayStartTime: "05:00",
        thresholds: {
          crossSourceDiscrepancy: 0.15,
          historicalDeviation: 0.25,
          persistenceWindowDays: 5,
          materialityThreshold: 0.1,
        },
        baseline: { windowDays: 14, minObservations: 5 },
        retention: { rawTransactionsDays: 365, exportsHours: 24 },
      },
      {
        projectId: did("project:rourkela"),
        dayStartTime: "05:00",
        thresholds: {
          crossSourceDiscrepancy: 0.15,
          historicalDeviation: 0.25,
          persistenceWindowDays: 5,
          materialityThreshold: 0.1,
        },
        baseline: { windowDays: 14, minObservations: 5 },
        retention: { rawTransactionsDays: 365, exportsHours: 24 },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendancePopulations)
    .values([
      {
        id: did("attpop:ganjam-beneficiaries"),
        projectId: did("project:ganjam-school"),
        code: "BEN-003",
        name: "Ganjam School Beneficiaries",
        populationType: "BENEFICIARY",
        expectedStrategy: "ROSTER",
        expectedCount: null,
        config: {},
      },
      {
        id: did("attpop:ganjam-staff"),
        projectId: did("project:ganjam-school"),
        code: "STF-003",
        name: "Ganjam School Staff",
        populationType: "STAFF",
        expectedStrategy: "CONFIGURED",
        expectedCount: 15,
        config: {},
      },
      {
        id: did("attpop:rourkela-beneficiaries"),
        projectId: did("project:rourkela"),
        code: "BEN-004",
        name: "Rourkela Beneficiaries",
        populationType: "BENEFICIARY",
        expectedStrategy: "ROSTER",
        expectedCount: null,
        config: {},
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceWindows)
    .values([
      {
        id: did("attwindow:ganjam-morning"),
        projectId: did("project:ganjam-school"),
        code: "MORNING",
        name: "Morning Roll Call",
        startTime: "06:00",
        endTime: "09:00",
        populationId: did("attpop:ganjam-beneficiaries"),
        minCoverage: 0.5,
        config: { source: "biometric" },
      },
      {
        id: did("attwindow:rourkela-morning"),
        projectId: did("project:rourkela"),
        code: "MORNING",
        name: "Morning Roll Call",
        startTime: "06:00",
        endTime: "09:00",
        populationId: did("attpop:rourkela-beneficiaries"),
        minCoverage: 0.5,
        config: { source: "biometric" },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceDevices)
    .values([
      {
        id: did("attdev:ganjam-main"),
        projectId: did("project:ganjam-school"),
        name: "Ganjam Model School Main Gate Biometric",
        provider: "simulated",
        deviceExternalId: "GANJ-MAIN-01",
        status: "ONLINE",
        lastSeenAt: new Date("2026-09-12T07:45:00Z"),
        lastEventAt: new Date("2026-09-12T07:00:00Z"),
        syncCursor: "2026-09-12",
        config: { scenario: "normal" },
        createdAt: new Date("2025-12-15T00:00:00Z"),
      },
      {
        id: did("attdev:ganjam-backup"),
        projectId: did("project:ganjam-school"),
        name: "Ganjam Backup Device",
        provider: "simulated",
        deviceExternalId: "GANJ-BACKUP-01",
        status: "OFFLINE",
        lastSeenAt: new Date("2026-09-05T18:00:00Z"),
        lastEventAt: new Date("2026-09-05T18:00:00Z"),
        syncCursor: "2026-09-05",
        config: { scenario: "offline_buffered" },
        createdAt: new Date("2025-12-15T00:00:00Z"),
      },
      {
        id: did("attdev:rourkela-main"),
        projectId: did("project:rourkela"),
        name: "Rourkela Hostel Main Gate Biometric",
        provider: "simulated",
        deviceExternalId: "RRK-MAIN-01",
        status: "ONLINE",
        lastSeenAt: new Date("2026-09-12T07:30:00Z"),
        lastEventAt: new Date("2026-09-12T07:30:00Z"),
        syncCursor: "2026-09-12",
        config: { scenario: "normal" },
        createdAt: new Date("2026-01-06T00:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  for (let n = 1; n <= 110; n++) {
    await db
      .insert(s.attendancePopulationMembers)
      .values({
        id: did(`attmember:ganjam-${n}`),
        populationId: did("attpop:ganjam-beneficiaries"),
        personExternalId: `ganjam-person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        joinedAt: new Date("2025-12-15T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  for (let n = 1; n <= 110; n++) {
    await db
      .insert(s.attendanceIdentityMappings)
      .values({
        id: did(`attmap:ganjam-main-${n}`),
        projectId: did("project:ganjam-school"),
        deviceId: did("attdev:ganjam-main"),
        externalUserId: `ganjam-person-${String(n).padStart(3, "0")}`,
        personExternalId: `ganjam-person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        createdAt: new Date("2025-12-15T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  for (let n = 1; n <= 90; n++) {
    await db
      .insert(s.attendancePopulationMembers)
      .values({
        id: did(`attmember:rourkela-${n}`),
        populationId: did("attpop:rourkela-beneficiaries"),
        personExternalId: `rourkela-person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        joinedAt: new Date("2026-01-06T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  for (let n = 1; n <= 90; n++) {
    await db
      .insert(s.attendanceIdentityMappings)
      .values({
        id: did(`attmap:rourkela-main-${n}`),
        projectId: did("project:rourkela"),
        deviceId: did("attdev:rourkela-main"),
        externalUserId: `rourkela-person-${String(n).padStart(3, "0")}`,
        personExternalId: `rourkela-person-${String(n).padStart(3, "0")}`,
        netramUserId: null,
        createdAt: new Date("2026-01-06T00:00:00Z"),
      })
      .onConflictDoNothing();
  }

  await db
    .insert(s.attendanceSourceObservations)
    .values([
      {
        id: did("attobs:ganjam-biometric-2026-09-12"),
        projectId: did("project:ganjam-school"),
        source: "BIOMETRIC",
        windowId: did("attwindow:ganjam-morning"),
        operationalDate: "2026-09-12",
        observedAt: new Date("2026-09-12T09:00:00Z"),
        observedCount: 104,
        expectedCount: 110,
        confidence: 0.97,
        coverage: "COMPLETE",
        health: "ONLINE",
        note: "Biometric roll call for morning window.",
      },
      {
        id: did("attobs:rourkela-biometric-2026-09-12"),
        projectId: did("project:rourkela"),
        source: "BIOMETRIC",
        windowId: did("attwindow:rourkela-morning"),
        operationalDate: "2026-09-12",
        observedAt: new Date("2026-09-12T09:00:00Z"),
        observedCount: 84,
        expectedCount: 90,
        confidence: 0.96,
        coverage: "COMPLETE",
        health: "ONLINE",
        note: "Biometric roll call for morning window.",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceCalculations)
    .values([
      {
        id: did("attcalc:ganjam-2026-09-12"),
        projectId: did("project:ganjam-school"),
        windowId: did("attwindow:ganjam-morning"),
        operationalDate: "2026-09-12",
        expected: 110,
        present: 104,
        absent: 6,
        unknown: 0,
        sourceCounts: { BIOMETRIC: 104, INSTITUTION_REPORTED: 104, CCTV: 0, MANUAL: 0 },
        coverage: "COMPLETE",
        dataQuality: "GOOD",
        freshness: new Date("2026-09-12T08:00:00Z"),
        policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
        computedAt: new Date("2026-09-12T09:00:00Z"),
      },
      {
        id: did("attcalc:rourkela-2026-09-12"),
        projectId: did("project:rourkela"),
        windowId: did("attwindow:rourkela-morning"),
        operationalDate: "2026-09-12",
        expected: 90,
        present: 84,
        absent: 6,
        unknown: 0,
        sourceCounts: { BIOMETRIC: 84, INSTITUTION_REPORTED: 84, CCTV: 0, MANUAL: 0 },
        coverage: "COMPLETE",
        dataQuality: "GOOD",
        freshness: new Date("2026-09-12T08:00:00Z"),
        policy: { calculationVersion: "attendance-calc-0.1", expectedStrategy: "ROSTER" },
        computedAt: new Date("2026-09-12T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceDataQuality)
    .values([
      {
        id: did("attdq:ganjam-biometric-2026-09-12"),
        projectId: did("project:ganjam-school"),
        source: "BIOMETRIC",
        periodStart: new Date("2026-09-12T06:00:00Z"),
        periodEnd: new Date("2026-09-12T09:00:00Z"),
        coverage: "COMPLETE",
        freshness: new Date("2026-09-12T08:00:00Z"),
        duplicateRate: 0,
        invalidCount: 0,
        unmatchedCount: 0,
        health: "ONLINE",
        assessedAt: new Date("2026-09-12T09:00:00Z"),
      },
      {
        id: did("attdq:rourkela-biometric-2026-09-12"),
        projectId: did("project:rourkela"),
        source: "BIOMETRIC",
        periodStart: new Date("2026-09-12T06:00:00Z"),
        periodEnd: new Date("2026-09-12T09:00:00Z"),
        coverage: "COMPLETE",
        freshness: new Date("2026-09-12T08:00:00Z"),
        duplicateRate: 0,
        invalidCount: 0,
        unmatchedCount: 0,
        health: "ONLINE",
        assessedAt: new Date("2026-09-12T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // Ganjam anomaly: register vs biometric discrepancy (ties to Feb inspection finding).
  await db
    .insert(s.attendanceAnomalyGroups)
    .values([
      {
        id: did("attgroup:ganjam-discrepancy"),
        projectId: did("project:ganjam-school"),
        populationId: did("attpop:ganjam-beneficiaries"),
        anomalyType: "CROSS_SOURCE_DISCREPANCY",
        state: "NEW",
        openedAt: new Date("2026-02-18T10:30:00Z"),
        closedAt: null,
      },
      {
        id: did("attgroup:ganjam-low-dismissed"),
        projectId: did("project:ganjam-school"),
        populationId: did("attpop:ganjam-beneficiaries"),
        anomalyType: "PERSISTENT_LOW_ATTENDANCE",
        state: "NEW",
        openedAt: new Date("2026-01-12T10:00:00Z"),
        closedAt: new Date("2026-01-15T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceAnomalies)
    .values([
      {
        id: did("atanom:ganjam-discrepancy-2026-02-18"),
        projectId: did("project:ganjam-school"),
        populationId: did("attpop:ganjam-beneficiaries"),
        windowId: did("attwindow:ganjam-morning"),
        operationalDate: "2026-02-18",
        observationStart: new Date("2026-02-18T06:00:00Z"),
        observationEnd: new Date("2026-02-18T09:00:00Z"),
        anomalyType: "CROSS_SOURCE_DISCREPANCY",
        score: 0.12,
        severity: "LOW",
        confidence: 0.66,
        dataQuality: "GOOD",
        detectorVersion: "attendance-hybrid-0.1",
        supportingSignals: {
          difference: 14,
          relative: 0.13,
          biometric: 104,
          reported: 118,
          expected: 110,
        },
        state: "NEW",
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        groupId: did("attgroup:ganjam-discrepancy"),
        linkedInspectionId: did("inspection:ganjam-feb-surprise"),
        linkedComplaintId: null,
        sourceData: {
          present: 104,
          expected: 110,
          biometric: 104,
          reported: 118,
          detectorVersion: "attendance-hybrid-0.1",
        },
        createdAt: new Date("2026-02-18T10:30:00Z"),
      },
      {
        id: did("atanom:ganjam-low-2026-01-12"),
        projectId: did("project:ganjam-school"),
        populationId: did("attpop:ganjam-beneficiaries"),
        windowId: did("attwindow:ganjam-morning"),
        operationalDate: "2026-01-12",
        observationStart: new Date("2026-01-12T06:00:00Z"),
        observationEnd: new Date("2026-01-12T09:00:00Z"),
        anomalyType: "PERSISTENT_LOW_ATTENDANCE",
        score: 0.5,
        severity: "MEDIUM",
        confidence: 0.72,
        dataQuality: "GOOD",
        detectorVersion: "attendance-hybrid-0.1",
        supportingSignals: { streakDays: 3, lowRatio: 0.52, expected: 110, present: 0 },
        state: "FALSE_POSITIVE",
        reviewedBy: did("user:dept-admin"),
        reviewedAt: new Date("2026-01-15T09:00:00Z"),
        reviewNotes:
          "Verified manually — low biometric count was caused by a device offline window, not absenteeism.",
        groupId: did("attgroup:ganjam-low-dismissed"),
        linkedInspectionId: null,
        linkedComplaintId: null,
        sourceData: { present: 0, expected: 110, detectorVersion: "attendance-hybrid-0.1" },
        createdAt: new Date("2026-01-12T10:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.attendanceReviewActions)
    .values([
      {
        id: did("attrev:ganjam-dismissed"),
        anomalyId: did("atanom:ganjam-low-2026-01-12"),
        actorUserId: did("user:dept-admin"),
        action: "dismiss",
        note: "Verified manually — low biometric count was caused by a device offline window, not absenteeism.",
        createdAt: new Date("2026-01-15T09:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Financial Risk Rules (13 Core Rules) ----------
  const riskRuleRows = [
    {
      id: did("rule:exp-001"),
      code: "EXP-001",
      name: "Incomplete Supporting Documentation",
      category: "DOCUMENTATION",
      description: "Flags expenditures lacking verified supporting document attachments.",
      conditionConfig: { required: true },
      weight: 15,
      severity: "high",
      enabled: true,
    },
    {
      id: did("rule:exp-002"),
      code: "EXP-002",
      name: "Round Number Cluster",
      category: "STATISTICAL",
      description: "Detects anomalous clusters of exact round numbers in claimed expenses.",
      conditionConfig: { minClusterSize: 3 },
      weight: 8,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-003"),
      code: "EXP-003",
      name: "Duplicate Invoice Number",
      category: "INTEGRITY",
      description:
        "Detects multiple expenses citing identical invoice numbers across time or projects.",
      conditionConfig: {},
      weight: 20,
      severity: "high",
      enabled: true,
    },
    {
      id: did("rule:exp-004"),
      code: "EXP-004",
      name: "Duplicate Document Content Hash",
      category: "INTEGRITY",
      description: "Flags binary byte-level identical document uploads across claims.",
      conditionConfig: {},
      weight: 25,
      severity: "critical",
      enabled: true,
    },
    {
      id: did("rule:exp-005"),
      code: "EXP-005",
      name: "Vendor Concentration",
      category: "PROCUREMENT",
      description: "Flags excessive expenditure volume concentrated on a single vendor.",
      conditionConfig: { concentrationThreshold: 0.6 },
      weight: 10,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-006"),
      code: "EXP-006",
      name: "Benford's Law Discrepancy",
      category: "STATISTICAL",
      description: "Analyzes leading digit distributions for non-conformance with Benford's Law.",
      conditionConfig: { minSampleSize: 20, significanceLevel: 0.05 },
      weight: 12,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-007"),
      code: "EXP-007",
      name: "Spending Velocity Surge",
      category: "VELOCITY",
      description: "Detects rapid disbursement spikes near fiscal year-end or reporting cutoffs.",
      conditionConfig: { surgeMultiplier: 2.5 },
      weight: 12,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-008"),
      code: "EXP-008",
      name: "Weekend/Holiday Spending Cluster",
      category: "TIMING",
      description: "Identifies procurement claims recorded on official holidays or Sundays.",
      conditionConfig: {},
      weight: 6,
      severity: "low",
      enabled: true,
    },
    {
      id: did("rule:exp-009"),
      code: "EXP-009",
      name: "Unregistered GSTIN / Missing Tax Details",
      category: "COMPLIANCE",
      description: "Flags commercial procurements over threshold lacking valid GSTIN format.",
      conditionConfig: { thresholdAmount: "50000.00" },
      weight: 10,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-010"),
      code: "EXP-010",
      name: "Budget Category Overrun",
      category: "BUDGET",
      description: "Flags expenditure exceeding allocated category budget limits.",
      conditionConfig: { overrunMargin: 0.1 },
      weight: 15,
      severity: "high",
      enabled: true,
    },
    {
      id: did("rule:exp-011"),
      code: "EXP-011",
      name: "Prior Incomplete Corrective Actions",
      category: "GOVERNANCE",
      description:
        "Elevates risk when an institution has unresolved corrective actions from prior inspections.",
      conditionConfig: {},
      weight: 10,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-012"),
      code: "EXP-012",
      name: "High-Risk Location / Negative Findings",
      category: "FIELD",
      description: "Considers inspection findings and adverse field signals in the risk profile.",
      conditionConfig: {},
      weight: 10,
      severity: "medium",
      enabled: true,
    },
    {
      id: did("rule:exp-013"),
      code: "EXP-013",
      name: "Discrepancy with Attendance/Activity",
      category: "CROSS_CHECK",
      description:
        "Cross-references claimed operational or meal spending against recorded attendance.",
      conditionConfig: {},
      weight: 14,
      severity: "high",
      enabled: true,
    },
  ];

  for (const r of riskRuleRows) {
    await db.insert(s.financialRiskRules).values(r).onConflictDoNothing();
  }

  // ---------- Fund Allocations ----------
  const allocationRows = [
    {
      id: did("alloc:vani-2024"),
      projectId: did("project:vani"),
      organisationId: did("org:vani"),
      allocatedAmount: "7500000.00",
      fiscalYear: "2024-2025",
      currency: "INR",
      description: "Phase 1 capital grant",
      notes: "Sanctioned under Department of Social Justice & Empowerment Annual Budget",
      scheme: "State Children Home Scheme",
      status: "active",
      createdAt: new Date("2024-04-01T00:00:00Z"),
      updatedAt: new Date("2024-04-01T00:00:00Z"),
    },
    {
      id: did("alloc:cuttack-2024"),
      projectId: did("project:cuttack-girls"),
      organisationId: did("org:cuttack-girls"),
      allocatedAmount: "5000000.00",
      fiscalYear: "2024-2025",
      currency: "INR",
      description: "Special operational grant",
      notes: "Sanctioned for child care and protective rehabilitation",
      scheme: "Mission Vatsalya",
      status: "active",
      createdAt: new Date("2024-04-01T00:00:00Z"),
      updatedAt: new Date("2024-04-01T00:00:00Z"),
    },
    {
      id: did("alloc:rajdhani-2024"),
      projectId: did("project:rajdhani"),
      organisationId: did("org:rajdhani"),
      allocatedAmount: "12000000.00",
      fiscalYear: "2024-2025",
      currency: "INR",
      description: "Residential old age care and geriatric facilities",
      notes: "Sanctioned for old age residential care and geriatric facilities",
      scheme: "National Senior Living & Senior Citizens Welfare",
      status: "active",
      createdAt: new Date("2024-04-01T00:00:00Z"),
      updatedAt: new Date("2024-04-01T00:00:00Z"),
    },
    {
      id: did("alloc:ganjam-2024"),
      projectId: did("project:ganjam-school"),
      organisationId: did("org:ganjam-school"),
      allocatedAmount: "6500000.00",
      fiscalYear: "2024-2025",
      currency: "INR",
      description: "Tribal and backward area educational boarding",
      notes: "Sanctioned for tribal and backward area educational boarding",
      scheme: "Integrated Model School & Hostel Development Grant",
      status: "active",
      createdAt: new Date("2024-04-01T00:00:00Z"),
      updatedAt: new Date("2024-04-01T00:00:00Z"),
    },
  ];

  for (const a of allocationRows) {
    await db.insert(s.fundAllocations).values(a).onConflictDoNothing();
  }

  // ---------- Fund Releases ----------
  const releaseRows = [
    {
      id: did("release:vani-01"),
      allocationId: did("alloc:vani-2024"),
      releasedAmount: "3000000.00",
      releaseDate: new Date("2024-04-15T00:00:00Z"),
      referenceNumber: "PFMS-OR-2024-0012",
      remarks: "First Quarter Scheme Release via PFMS",
      status: "released",
      createdAt: new Date("2024-04-15T00:00:00Z"),
      updatedAt: new Date("2024-04-15T00:00:00Z"),
    },
    {
      id: did("release:vani-02"),
      allocationId: did("alloc:vani-2024"),
      releasedAmount: "2500000.00",
      releaseDate: new Date("2024-08-20T00:00:00Z"),
      referenceNumber: "PFMS-OR-2024-0089",
      remarks: "Second Tranche Grant Disbursal",
      status: "released",
      createdAt: new Date("2024-08-20T00:00:00Z"),
      updatedAt: new Date("2024-08-20T00:00:00Z"),
    },
    {
      id: did("release:cuttack-01"),
      allocationId: did("alloc:cuttack-2024"),
      releasedAmount: "2500000.00",
      releaseDate: new Date("2024-05-10T00:00:00Z"),
      referenceNumber: "TR-CUT-2024-0034",
      remarks: "District Treasury Disbursal Order #34",
      status: "released",
      createdAt: new Date("2024-05-10T00:00:00Z"),
      updatedAt: new Date("2024-05-10T00:00:00Z"),
    },
    {
      id: did("release:rajdhani-01"),
      allocationId: did("alloc:rajdhani-2024"),
      releasedAmount: "6000000.00",
      releaseDate: new Date("2024-04-01T00:00:00Z"),
      referenceNumber: "PFMS-OR-2024-0004",
      remarks: "Advance Operational Grant via PFMS",
      status: "released",
      createdAt: new Date("2024-04-01T00:00:00Z"),
      updatedAt: new Date("2024-04-01T00:00:00Z"),
    },
  ];

  for (const r of releaseRows) {
    await db.insert(s.fundReleases).values(r).onConflictDoNothing();
  }

  // ---------- Expenses ----------
  const expenseRows = [
    {
      id: did("expense:vani-01"),
      projectId: did("project:vani"),
      organisationId: did("org:vani"),
      allocationId: did("alloc:vani-2024"),
      category: "Materials & Supplies",
      description: "Classroom furniture, study desks, and educational materials",
      amount: "450000.00",
      transactionDate: new Date("2024-05-15T00:00:00Z"),
      vendorName: "Odisha State Civil Supplies Corp",
      vendorGstin: "21AAACG0000A1Z5",
      invoiceNumber: "OSCSC-2024-9981",
      invoiceDate: new Date("2024-05-14T00:00:00Z"),
      paymentMethod: "PFMS_TRANSFER",
      paymentReference: "UTR9988112233",
      status: "verified",
      submittedAt: new Date("2024-05-16T00:00:00Z"),
      verifiedAt: new Date("2024-05-20T00:00:00Z"),
      createdAt: new Date("2024-05-16T00:00:00Z"),
      updatedAt: new Date("2024-05-20T00:00:00Z"),
    },
    {
      id: did("expense:vani-02"),
      projectId: did("project:vani"),
      organisationId: did("org:vani"),
      allocationId: did("alloc:vani-2024"),
      category: "Equipment & Machinery",
      description: "CCTV surveillance units and computer lab workstations",
      amount: "820000.00",
      transactionDate: new Date("2024-06-20T00:00:00Z"),
      vendorName: "Bhubaneswar Medical & Tech Equipments",
      vendorGstin: "21AABCB1111B1Z2",
      invoiceNumber: "BMTE-INV-0421",
      invoiceDate: new Date("2024-06-19T00:00:00Z"),
      paymentMethod: "RTGS",
      paymentReference: "RTGS-BBSR-0044",
      status: "verified",
      submittedAt: new Date("2024-06-21T00:00:00Z"),
      verifiedAt: new Date("2024-06-25T00:00:00Z"),
      createdAt: new Date("2024-06-21T00:00:00Z"),
      updatedAt: new Date("2024-06-25T00:00:00Z"),
    },
    {
      id: did("expense:vani-03"),
      projectId: did("project:vani"),
      organisationId: did("org:vani"),
      allocationId: did("alloc:vani-2024"),
      category: "Labor & Personnel",
      description: "Hostel supervisory and vocational trainer stipends (May-June)",
      amount: "345000.00",
      transactionDate: new Date("2024-07-02T00:00:00Z"),
      vendorName: "Utkal Security & Facility Services",
      vendorGstin: "21AACCS2222C1Z3",
      invoiceNumber: "USFS-STIP-102",
      invoiceDate: new Date("2024-07-01T00:00:00Z"),
      paymentMethod: "DIRECT_CREDIT",
      paymentReference: "PAY-SAL-0702",
      status: "under_review",
      submittedAt: new Date("2024-07-03T00:00:00Z"),
      createdAt: new Date("2024-07-03T00:00:00Z"),
      updatedAt: new Date("2024-07-05T00:00:00Z"),
    },
    {
      id: did("expense:vani-04"),
      projectId: did("project:vani"),
      organisationId: did("org:vani"),
      allocationId: did("alloc:vani-2024"),
      category: "Services & Operations",
      description: "Kitchen staff and caretaker wages (Q3)",
      amount: "265000.00",
      transactionDate: new Date("2025-01-20T00:00:00Z"),
      vendorName: "Utkal Security & Facility Services",
      vendorGstin: "21AACCS2222C1Z3",
      invoiceNumber: "USFS-WAGE-114",
      invoiceDate: new Date("2025-01-19T00:00:00Z"),
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "NEFT-BBSR-0147",
      status: "submitted",
      submittedAt: new Date("2025-01-21T00:00:00Z"),
      createdAt: new Date("2025-01-21T00:00:00Z"),
      updatedAt: new Date("2025-01-21T00:00:00Z"),
    },
    {
      id: did("expense:cuttack-01"),
      projectId: did("project:cuttack-girls"),
      organisationId: did("org:cuttack-girls"),
      allocationId: did("alloc:cuttack-2024"),
      category: "Food & Nutrition",
      description: "Nutritional grains, pulses, dairy, and dietary supplements",
      amount: "185000.00",
      transactionDate: new Date("2024-06-10T00:00:00Z"),
      vendorName: "Cuttack Agro Traders",
      vendorGstin: "21AADCA3333D1Z4",
      invoiceNumber: "CAT-NUT-8812",
      invoiceDate: new Date("2024-06-09T00:00:00Z"),
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "NEFT-CUT-0091",
      status: "verified",
      submittedAt: new Date("2024-06-11T00:00:00Z"),
      verifiedAt: new Date("2024-06-14T00:00:00Z"),
      createdAt: new Date("2024-06-11T00:00:00Z"),
      updatedAt: new Date("2024-06-14T00:00:00Z"),
    },
    {
      id: did("expense:cuttack-02"),
      projectId: did("project:cuttack-girls"),
      organisationId: did("org:cuttack-girls"),
      allocationId: did("alloc:cuttack-2024"),
      category: "Clothing & Amenities",
      description: "Quarterly clothing, bedding and hygiene kits",
      amount: "158000.00",
      transactionDate: new Date("2025-02-10T00:00:00Z"),
      vendorName: "Cuttack Agro Traders",
      vendorGstin: "21AADCA3333D1Z4",
      invoiceNumber: "CAT-CLB-0977",
      invoiceDate: new Date("2025-02-09T00:00:00Z"),
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "NEFT-CUT-0229",
      status: "submitted",
      submittedAt: new Date("2025-02-11T00:00:00Z"),
      createdAt: new Date("2025-02-11T00:00:00Z"),
      updatedAt: new Date("2025-02-11T00:00:00Z"),
    },
    {
      id: did("expense:rajdhani-01"),
      projectId: did("project:rajdhani"),
      organisationId: did("org:rajdhani"),
      allocationId: did("alloc:rajdhani-2024"),
      category: "Maintenance & Repairs",
      description: "Facility solar water heater installation and plumbing overhaul",
      amount: "290000.00",
      transactionDate: new Date("2024-07-14T00:00:00Z"),
      vendorName: "Capital Works & Builders",
      vendorGstin: "21AAECB4444E1Z5",
      invoiceNumber: "CWB-MAINT-504",
      invoiceDate: new Date("2024-07-13T00:00:00Z"),
      paymentMethod: "PFMS_TRANSFER",
      paymentReference: "UTR5544332211",
      status: "rejected",
      submittedAt: new Date("2024-07-15T00:00:00Z"),
      createdAt: new Date("2024-07-15T00:00:00Z"),
      updatedAt: new Date("2024-07-22T00:00:00Z"),
    },
    {
      id: did("expense:rajdhani-02"),
      projectId: did("project:rajdhani"),
      organisationId: did("org:rajdhani"),
      allocationId: did("alloc:rajdhani-2024"),
      category: "Medical & Health Supplies",
      description: "Geriatric care medical supplies and pharmacy stock",
      amount: "520000.00",
      transactionDate: new Date("2025-03-18T00:00:00Z"),
      vendorName: "Capital Works & Builders",
      vendorGstin: "21AAECB4444E1Z5",
      invoiceNumber: "CWB-MED-531",
      invoiceDate: new Date("2025-03-17T00:00:00Z"),
      paymentMethod: "PFMS_TRANSFER",
      paymentReference: "UTR7711223344",
      status: "verified",
      submittedAt: new Date("2025-03-19T00:00:00Z"),
      verifiedAt: new Date("2025-03-25T00:00:00Z"),
      createdAt: new Date("2025-03-19T00:00:00Z"),
      updatedAt: new Date("2025-03-25T00:00:00Z"),
    },
  ];

  for (const e of expenseRows) {
    await db.insert(s.expenses).values(e).onConflictDoNothing();
  }

  // ---------- Financial Documents ----------
  const docRows = [
    {
      id: did("findoc:vani-inv-1"),
      expenseId: did("expense:vani-01"),
      projectId: did("project:vani"),
      documentType: "invoice",
      fileName: "invoice_oscsc_9981.pdf",
      mimeType: "application/pdf",
      sizeBytes: 245000,
      sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      storageKey: "financial-docs/vani/invoice_oscsc_9981.pdf",
      verificationStatus: "verified",
      createdAt: new Date("2024-05-16T00:00:00Z"),
    },
    {
      id: did("findoc:vani-inv-2"),
      expenseId: did("expense:vani-02"),
      projectId: did("project:vani"),
      documentType: "invoice",
      fileName: "bmte_cctv_receipt.pdf",
      mimeType: "application/pdf",
      sizeBytes: 312000,
      sha256Hash: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
      storageKey: "financial-docs/vani/bmte_cctv_receipt.pdf",
      verificationStatus: "verified",
      createdAt: new Date("2024-06-21T00:00:00Z"),
    },
    {
      id: did("findoc:vani-inv-3"),
      expenseId: did("expense:vani-03"),
      projectId: did("project:vani"),
      documentType: "supporting_voucher",
      fileName: "trainer_attendance_june.pdf",
      mimeType: "application/pdf",
      sizeBytes: 180000,
      sha256Hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
      storageKey: "financial-docs/vani/trainer_attendance_june.pdf",
      verificationStatus: "pending",
      createdAt: new Date("2024-07-03T00:00:00Z"),
    },
  ];

  for (const d of docRows) {
    await db.insert(s.financialDocuments).values(d).onConflictDoNothing();
  }

  // ===========================================================================
  // Funds Action Inbox variety (§32): a Rourkela allocation, a submitted
  // expense, an under-review expense, a pending verification document, and an
  // open inspection flag — so verifiers and reviewers have deterministic
  // pending work in every funds queue after db:setup.
  // ===========================================================================

  await db
    .insert(s.fundAllocations)
    .values({
      id: did("alloc:rourkela-2024"),
      projectId: did("project:rourkela"),
      organisationId: did("org:rourkela"),
      allocatedAmount: "8000000.00",
      fiscalYear: "2024-2025",
      currency: "INR",
      description: "Model ST girls' hostel operations grant",
      notes: "Sanctioned for residential operations, nutrition and maintenance",
      scheme: "Integrated Model School & Hostel Development Grant",
      status: "active",
      createdAt: new Date("2024-04-01T00:00:00Z"),
      updatedAt: new Date("2024-04-01T00:00:00Z"),
    })
    .onConflictDoNothing();

  // Submitted expense awaiting verification in the funds queue.
  await db
    .insert(s.expenses)
    .values({
      id: did("expense:rourkela-03"),
      projectId: did("project:rourkela"),
      organisationId: did("org:rourkela"),
      allocationId: did("alloc:rourkela-2024"),
      category: "Food & Nutrition",
      description: "Quarterly ration procurement: grains, pulses, cooking oil and condiments",
      amount: "412500.00",
      transactionDate: new Date("2025-04-12T00:00:00Z"),
      vendorName: "Rourkela Wholesale Provisions",
      vendorGstin: "21AAJCR5555F1Z6",
      invoiceNumber: "RWP-RATION-0231",
      invoiceDate: new Date("2025-04-11T00:00:00Z"),
      paymentMethod: "PFMS_TRANSFER",
      paymentReference: "UTR2211445566",
      status: "submitted",
      submittedAt: new Date("2025-04-14T00:00:00Z"),
      createdAt: new Date("2025-04-14T00:00:00Z"),
      updatedAt: new Date("2025-04-14T00:00:00Z"),
    })
    .onConflictDoNothing();

  // Under-review expense: second verification-queue state.
  await db
    .insert(s.expenses)
    .values({
      id: did("expense:rourkela-04"),
      projectId: did("project:rourkela"),
      organisationId: did("org:rourkela"),
      allocationId: did("alloc:rourkela-2024"),
      category: "Maintenance & Repairs",
      description: "Dormitory mosquito-net replacement and drainage desilting",
      amount: "128700.00",
      transactionDate: new Date("2025-05-06T00:00:00Z"),
      vendorName: "Rourkela Wholesale Provisions",
      vendorGstin: "21AAJCR5555F1Z6",
      invoiceNumber: "RWP-MAINT-0244",
      invoiceDate: new Date("2025-05-05T00:00:00Z"),
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "NEFT-RKL-0312",
      status: "under_review",
      submittedAt: new Date("2025-05-07T00:00:00Z"),
      createdAt: new Date("2025-05-07T00:00:00Z"),
      updatedAt: new Date("2025-05-09T00:00:00Z"),
    })
    .onConflictDoNothing();

  // Pending financial document attached to the submitted expense.
  await db
    .insert(s.financialDocuments)
    .values({
      id: did("findoc:rourkela-ration-1"),
      expenseId: did("expense:rourkela-03"),
      projectId: did("project:rourkela"),
      documentType: "invoice",
      fileName: "rwp_ration_invoice_0231.pdf",
      mimeType: "application/pdf",
      sizeBytes: 268400,
      sha256Hash: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
      storageKey: "financial-docs/rourkela/rwp_ration_invoice_0231.pdf",
      verificationStatus: "pending",
      createdAt: new Date("2025-04-14T00:00:00Z"),
    })
    .onConflictDoNothing();

  // An open inspection flag referencing the ration expense, so the
  // inspection_flag_review queue holds a dispatchable item.
  await db
    .insert(s.inspectionFlags)
    .values({
      id: did("flag:rourkela-rations"),
      projectId: did("project:rourkela"),
      organisationId: did("org:rourkela"),
      allocationId: did("alloc:rourkela-2024"),
      riskScore: 68,
      riskLevel: "high",
      triggerSource: "risk_engine",
      explanation:
        "Ration spend concentrated with a single new vendor ahead of the reporting window; three invoices share sequential numbers across different purchase orders.",
      evidenceRefs: [
        {
          type: "expense",
          id: did("expense:rourkela-03"),
          label: "Expense: Quarterly ration procurement (RWP-RATION-0231)",
        },
      ],
      status: "open",
      createdAt: new Date("2026-09-23T10:00:00Z"),
      updatedAt: new Date("2026-09-23T10:00:00Z"),
    })
    .onConflictDoNothing();

  // ---------- Inspection Flags ----------
  await db
    .insert(s.inspectionFlags)
    .values([
      {
        id: did("flag:vani-advisory"),
        projectId: did("project:vani"),
        organisationId: did("org:vani"),
        allocationId: did("alloc:vani-2024"),
        riskScore: 42,
        riskLevel: "medium",
        triggerSource: "risk_engine",
        explanation:
          "Advisory review flag: Spending velocity surge observed in late Q2 alongside unverified supporting vouchers.",
        evidenceRefs: [
          {
            type: "expense",
            id: did("expense:vani-03"),
            label: "Expense: Stipend Vouchers Pending Review",
          },
        ],
        status: "open",
        createdAt: new Date("2024-07-05T00:00:00Z"),
        updatedAt: new Date("2024-07-05T00:00:00Z"),
      },
    ])
    .onConflictDoNothing();

  // ---------- Project Risk Snapshots ----------
  const riskSnapshots = [
    {
      id: did("risk-snap:rourkela"),
      projectId: did("project:rourkela"),
      scoringVersion: "1.0.0",
      totalScore: 78,
      riskLevel: "critical",
      financialScore: 85,
      inspectionQualityScore: 72,
      attendanceAnomalyScore: 80,
      complaintDensityScore: 70,
      aiAnomalyScore: 60,
      financialSignals: { surgeMultiplier: 3.1, unverifiedExpenses: 2 },
      inspectionQualitySignals: { overdueActions: 1, criticalFindings: 1 },
      attendanceAnomalySignals: { mismatchRate: 0.28, ghostWorkerRisk: "high" },
      complaintDensitySignals: { openComplaints: 2, severity: "high" },
      aiAnomalySignals: { cameraTampering: true, occupancyDiscrepancy: true },
      topContributors: [
        {
          dimension: "Financial Risk",
          contribution: 34.0,
          percentage: 43.6,
          explanation: "Unverified bulk expenditure surge near reporting window",
        },
        {
          dimension: "Inspection Quality",
          contribution: 18.0,
          percentage: 23.1,
          explanation: "Overdue corrective action for hostel sanitation and kitchen maintenance",
        },
        {
          dimension: "Attendance Anomaly",
          contribution: 16.0,
          percentage: 20.5,
          explanation: "Significant divergence between biometric attendance and physical counts",
        },
      ],
      explanation:
        "Elevated composite risk driven by fund front-loading, overdue sanitation findings, and CCTV tampering signals.",
      scheduledInspectionId: did("inspection:rourkela-sep-surprise"),
      createdAt: new Date("2026-09-20T10:00:00Z"),
      calculatedAt: new Date("2026-09-20T10:00:00Z"),
    },
    {
      id: did("risk-snap:puri"),
      projectId: did("project:purisch-1"),
      scoringVersion: "1.0.0",
      totalScore: 58,
      riskLevel: "high",
      financialScore: 65,
      inspectionQualityScore: 60,
      attendanceAnomalyScore: 48,
      complaintDensityScore: 50,
      aiAnomalyScore: 30,
      financialSignals: { roundNumberClusters: 3 },
      inspectionQualitySignals: { pendingCorrectiveActions: 2 },
      attendanceAnomalySignals: { mismatchRate: 0.14 },
      complaintDensitySignals: { openComplaints: 1 },
      aiAnomalySignals: { cameraHealth: "degraded" },
      topContributors: [
        {
          dimension: "Financial Risk",
          contribution: 26.0,
          percentage: 44.8,
          explanation: "Concentrated disbursements on single vendor without tax registration",
        },
        {
          dimension: "Inspection Quality",
          contribution: 15.0,
          percentage: 25.9,
          explanation: "Pending inspection corrective action nearing statutory deadline",
        },
      ],
      explanation:
        "High risk score driven by unverified invoice clusters and repeat inspection findings.",
      createdAt: new Date("2026-09-20T10:00:00Z"),
      calculatedAt: new Date("2026-09-20T10:00:00Z"),
    },
    {
      id: did("risk-snap:vani"),
      projectId: did("project:vani"),
      scoringVersion: "1.0.0",
      totalScore: 42,
      riskLevel: "medium",
      financialScore: 45,
      inspectionQualityScore: 40,
      attendanceAnomalyScore: 38,
      complaintDensityScore: 30,
      aiAnomalyScore: 15,
      financialSignals: { voucherSubmissionsDelayed: true },
      inspectionQualitySignals: { routineCycle: "due_soon" },
      attendanceAnomalySignals: { mismatchRate: 0.08 },
      complaintDensitySignals: { openComplaints: 0 },
      aiAnomalySignals: {},
      topContributors: [
        {
          dimension: "Financial Risk",
          contribution: 18.0,
          percentage: 42.9,
          explanation: "Late submission of supporting vouchers for Phase 1 grant release",
        },
      ],
      explanation: "Moderate risk score. Standard monitoring recommended.",
      createdAt: new Date("2026-09-20T10:00:00Z"),
      calculatedAt: new Date("2026-09-20T10:00:00Z"),
    },
    {
      id: did("risk-snap:cuttack"),
      projectId: did("project:cuttack-girls"),
      scoringVersion: "1.0.0",
      totalScore: 32,
      riskLevel: "medium",
      financialScore: 35,
      inspectionQualityScore: 30,
      attendanceAnomalyScore: 25,
      complaintDensityScore: 20,
      aiAnomalyScore: 10,
      financialSignals: {},
      inspectionQualitySignals: { minorFindings: 1 },
      attendanceAnomalySignals: {},
      complaintDensitySignals: {},
      aiAnomalySignals: {},
      topContributors: [
        {
          dimension: "Inspection Quality",
          contribution: 7.5,
          percentage: 23.4,
          explanation: "Minor observation on electrical wiring pending verification",
        },
      ],
      explanation: "Low-to-moderate risk profile. Normal monitoring.",
      createdAt: new Date("2026-09-20T10:00:00Z"),
      calculatedAt: new Date("2026-09-20T10:00:00Z"),
    },
    {
      id: did("risk-snap:ganjam"),
      projectId: did("project:ganjam-school"),
      scoringVersion: "1.0.0",
      totalScore: 18,
      riskLevel: "low",
      financialScore: 15,
      inspectionQualityScore: 12,
      attendanceAnomalyScore: 10,
      complaintDensityScore: 5,
      aiAnomalyScore: 0,
      financialSignals: {},
      inspectionQualitySignals: {},
      attendanceAnomalySignals: {},
      complaintDensitySignals: {},
      aiAnomalySignals: {},
      topContributors: [
        {
          dimension: "Financial Risk",
          contribution: 6.0,
          percentage: 33.3,
          explanation: "Baseline expenditure tracking compliant",
        },
      ],
      explanation: "Low risk score across all five operational dimensions.",
      createdAt: new Date("2026-09-20T10:00:00Z"),
      calculatedAt: new Date("2026-09-20T10:00:00Z"),
    },
    {
      id: did("risk-snap:rajdhani"),
      projectId: did("project:rajdhani"),
      scoringVersion: "1.0.0",
      totalScore: 12,
      riskLevel: "low",
      financialScore: 10,
      inspectionQualityScore: 8,
      attendanceAnomalyScore: 10,
      complaintDensityScore: 0,
      aiAnomalyScore: 0,
      financialSignals: {},
      inspectionQualitySignals: {},
      attendanceAnomalySignals: {},
      complaintDensitySignals: {},
      aiAnomalySignals: {},
      topContributors: [
        {
          dimension: "Attendance Anomaly",
          contribution: 2.0,
          percentage: 16.7,
          explanation: "High biometric device uptime and reliable attendance records",
        },
      ],
      explanation: "Clean profile with zero adverse findings and prompt accounting.",
      createdAt: new Date("2026-09-20T10:00:00Z"),
      calculatedAt: new Date("2026-09-20T10:00:00Z"),
    },
  ];

  for (const snap of riskSnapshots) {
    await db.insert(s.projectRiskSnapshots).values(snap).onConflictDoNothing();
  }

  // ===========================================================================
  // Action Inbox variety (§32): every decision queue must hold at least one
  // deterministic pending item so approvers, reviewers and verifiers can
  // exercise the unified inbox immediately after db:setup.
  // ===========================================================================

  // Pending attendance correction awaiting an authority decision (approver is
  // a different user than the requester — §34 independence rule).
  await db
    .insert(s.attendanceCorrections)
    .values({
      id: did("attcorr:rourkela-present-adjust"),
      projectId: did("project:rourkela"),
      targetType: "calculation",
      targetId: did("attcalc:vani-2026-03-01"),
      field: "present",
      originalValue: { present: 22, expected: 25 },
      newValue: { present: 25 },
      reason:
        "Three beneficiaries marked absent due to biometric device outage; wardens confirmed full attendance on the manual roll.",
      requestedBy: did("user:inspector-2"),
      status: "PENDING",
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date("2026-09-23T09:30:00Z"),
    })
    .onConflictDoNothing();

  console.log(
    `Seed complete: ${projects.length + enrichedProjects.length} projects, ${users.length + enrichedUsers.length} users across ${districtRows.length} districts.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
