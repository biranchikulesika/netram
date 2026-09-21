import {
  index,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  integer,
  real,
  doublePrecision,
  unique,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/* ---------- Geography ---------- */

export const countries = pgTable("countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 10 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
});

export const states = pgTable("states", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryId: uuid("country_id")
    .notNull()
    .references(() => countries.id),
  code: varchar("code", { length: 10 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
});

export const districts = pgTable("districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  stateId: uuid("state_id")
    .notNull()
    .references(() => states.id),
  code: varchar("code", { length: 10 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
});

/* ---------- Authorities & Jurisdictions ---------- */

export const authorities = pgTable("authorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => authorities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  countryId: uuid("country_id").references(() => countries.id),
  stateId: uuid("state_id").references(() => states.id),
  districtId: uuid("district_id").references(() => districts.id),
  scopeLevel: varchar("scope_level", { length: 20 }).notNull().default("national"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Users & Identities ---------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  displayName: varchar("display_name", { length: 200 }),
  /** Optional contact phone captured at registration (inspectors, officials). */
  phone: varchar("phone", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const identities = pgTable(
  "identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("identities_provider_subject").on(t.provider, t.providerSubject)],
);

/* ---------- Roles & Permissions ---------- */

export const permissions = pgTable("permissions", {
  code: varchar("code", { length: 80 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionCode: varchar("permission_code", { length: 80 })
      .notNull()
      .references(() => permissions.code),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })],
);

export const roleAssignments = pgTable("role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  roleCode: varchar("role_code", { length: 50 }).notNull(),
  authorityId: uuid("authority_id").references(() => authorities.id),
  jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
  scope: varchar("scope", { length: 20 }).notNull().default("national"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Organisations & Programmes ---------- */

export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  authorityId: uuid("authority_id").references(() => authorities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const programmes = pgTable("programmes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  /** Geographic reach: national | state | district. */
  scopeLevel: varchar("scope_level", { length: 20 }).notNull().default("national"),
  /** Set when scopeLevel = "state". */
  stateId: uuid("state_id").references(() => states.id),
  /** Set when scopeLevel = "district" (implies its state). */
  districtId: uuid("district_id").references(() => districts.id),
  authorityId: uuid("authority_id").references(() => authorities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Projects ---------- */

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("institution"),
  description: text("description"),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  authorityId: uuid("authority_id").references(() => authorities.id),
  districtId: uuid("district_id").references(() => districts.id),
  status: varchar("status", { length: 30 }).notNull().default("Draft"),
  approvedById: uuid("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  programmeIds: json("programme_ids").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectGeofences = pgTable("project_geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull().default("circle"),
  radiusMeters: integer("radius_meters").notNull().default(250),
  centerLat: doublePrecision("center_lat"),
  centerLng: doublePrecision("center_lng"),
  polygonVertices: json("polygon_vertices").$type<[number, number][]>().default([]).notNull(),
  sealedById: uuid("sealed_by_id").references(() => users.id),
  sealedAt: timestamp("sealed_at", { withTimezone: true }).defaultNow().notNull(),
  auditTx: varchar("audit_tx", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectPhotos = pgTable("project_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  caption: varchar("caption", { length: 500 }),
  fileName: varchar("file_name", { length: 300 }),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  contentHash: varchar("content_hash", { length: 128 }),
  storageKey: varchar("storage_key", { length: 300 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Disclosure ---------- */

export const disclosurePolicies = pgTable("disclosure_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  ruleType: varchar("rule_type", { length: 50 }).notNull(),
  ruleParams: json("rule_params").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Inspections ---------- */

export const inspectionTeams = pgTable("inspection_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => inspectionTeams.id),
    inspectorUserId: uuid("inspector_user_id")
      .notNull()
      .references(() => users.id),
    role: varchar("role", { length: 50 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.inspectorUserId] })],
);

export const inspectionTemplates = pgTable("inspection_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  schema: json("schema").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inspections = pgTable("inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  templateId: uuid("template_id").references(() => inspectionTemplates.id),
  type: varchar("type", { length: 50 }).notNull(),
  trigger: varchar("trigger", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("assigned"),
  disclosurePolicyId: uuid("disclosure_policy_id").references(() => disclosurePolicies.id),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inspectionAssignments = pgTable("inspection_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: varchar("role", { length: 50 }).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("assigned"),
});

export const observations = pgTable("observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  observationId: uuid("observation_id").references(() => observations.id),
  severity: varchar("severity", { length: 20 }).notNull(),
  description: text("description").notNull(),
  remediation: text("remediation"),
  status: varchar("status", { length: 30 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Evidence ---------- */

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  findingId: uuid("finding_id").references(() => findings.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  evidenceType: varchar("evidence_type", { length: 50 }).notNull(),
  fileName: varchar("file_name", { length: 300 }),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  contentHash: varchar("content_hash", { length: 128 }),
  storageKey: varchar("storage_key", { length: 300 }),
  deviceId: varchar("device_id", { length: 100 }),
  uploadState: varchar("upload_state", { length: 20 }).notNull().default("pending"),
  integrityState: varchar("integrity_state", { length: 20 }).notNull().default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Corrective Actions ---------- */

export const correctiveActions = pgTable("corrective_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id")
    .notNull()
    .references(() => findings.id),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  deadline: timestamp("deadline", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Complaints ---------- */

export const complaints = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  complainantName: varchar("complainant_name", { length: 200 }),
  contactInfo: varchar("contact_info", { length: 300 }),
  trackingCode: varchar("tracking_code", { length: 50 }).unique().notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("received"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  resolutionText: text("resolution_text"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- AI ---------- */

export const aiAnomalies = pgTable("ai_anomalies", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id").references(() => inspections.id),
  evidenceId: uuid("evidence_id").references(() => evidence.id),
  type: varchar("type", { length: 80 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  confidence: real("confidence").notNull(),
  modelVersion: varchar("model_version", { length: 50 }),
  explanation: text("explanation"),
  status: varchar("status", { length: 30 }).notNull().default("new"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- CCTV ---------- */

export const cctvCameras = pgTable("cctv_cameras", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  protocol: varchar("protocol", { length: 50 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  districtId: uuid("district_id").references(() => districts.id),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cctvStreams = pgTable("cctv_streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  cameraId: uuid("camera_id")
    .notNull()
    .references(() => cctvCameras.id),
  sessionId: varchar("session_id", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Video Conferencing ---------- */

export const vcSessions = pgTable("vc_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id").references(() => inspections.id),
  projectId: uuid("project_id").references(() => projects.id),
  title: varchar("title", { length: 200 }).notNull().default("Tripartite Review Session"),
  status: varchar("status", { length: 20 }).notNull().default("scheduled"),
  hostUserId: uuid("host_user_id").references(() => users.id),
  roomName: varchar("room_name", { length: 120 }).notNull().default(""),
  provider: varchar("provider", { length: 50 }).notNull().default("webrtc"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vcParticipants = pgTable("vc_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => vcSessions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: varchar("role", { length: 50 }).notNull().default("observer"),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  leftAt: timestamp("left_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Notifications ---------- */

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Audit ---------- */

/* ---------- Reports ---------- */

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  format: varchar("format", { length: 20 }).notNull().default("json"),
  status: varchar("status", { length: 20 }).notNull().default("requested"),
  requestedBy: uuid("requested_by").references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  artifact: json("artifact").$type<Record<string, unknown>>(),
  storageRef: varchar("storage_ref", { length: 300 }),
  generatedBy: uuid("generated_by").references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  error: text("error"),
  finalizedBy: uuid("finalized_by").references(() => users.id),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Audit ---------- */

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 80 }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 100 }),
  requestId: varchar("request_id", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Outbox ---------- */

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 80 }).notNull(),
  correlationId: varchar("correlation_id", { length: 100 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id", { length: 100 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  availableAfter: timestamp("available_after", { withTimezone: true }),
  lastError: text("last_error"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

/* ---------- Feature Flags ---------- */

export const featureFlagTable = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).unique().notNull(),
  enabled: boolean("enabled").notNull().default(false),
  allowedEnvironments: json("allowed_environments").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Offline Inspection Sync Operations (§5, §31) ---------- */

export const inspectionSyncOperations = pgTable("inspection_sync_operations", {
  id: uuid("id").primaryKey(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  operationType: varchar("operation_type", { length: 50 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  code: varchar("code", { length: 50 }),
  message: text("message"),
  resultData: json("result_data").$type<Record<string, unknown>>(),
  clientTimestamp: timestamp("client_timestamp", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------- Attendance (§4-§24, §26-§42) ---------- */

export const attendanceDevices = pgTable(
  "attendance_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    name: varchar("name", { length: 200 }).notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    deviceExternalId: varchar("device_external_id", { length: 200 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("UNKNOWN"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    syncCursor: varchar("sync_cursor", { length: 200 }),
    config: json("config").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("attendance_devices_project_external").on(t.projectId, t.deviceExternalId)],
);

export const attendancePopulations = pgTable("attendance_populations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  populationType: varchar("population_type", { length: 30 }).notNull().default("BENEFICIARY"),
  expectedStrategy: varchar("expected_strategy", { length: 30 }).notNull().default("CONFIGURED"),
  expectedCount: integer("expected_count"),
  config: json("config").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendancePopulationMembers = pgTable(
  "attendance_population_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    populationId: uuid("population_id")
      .notNull()
      .references(() => attendancePopulations.id),
    personExternalId: varchar("person_external_id", { length: 200 }).notNull(),
    netramUserId: uuid("netram_user_id").references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("attendance_members_population_person").on(t.populationId, t.personExternalId)],
);

export const attendanceIdentityMappings = pgTable(
  "attendance_identity_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => attendanceDevices.id),
    externalUserId: varchar("external_user_id", { length: 200 }).notNull(),
    personExternalId: varchar("person_external_id", { length: 200 }).notNull(),
    netramUserId: uuid("netram_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("attendance_identity_device_external").on(t.deviceId, t.externalUserId),
    index("attendance_identity_project_idx").on(t.projectId),
  ],
);

export const attendanceWindows = pgTable("attendance_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  populationId: uuid("population_id").references(() => attendancePopulations.id),
  minCoverage: real("min_coverage").notNull().default(0.5),
  config: json("config").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceConfigs = pgTable(
  "attendance_configs",
  {
    projectId: uuid("project_id")
      .references(() => projects.id)
      .unique(),
    dayStartTime: varchar("day_start_time", { length: 5 }).notNull().default("05:00"),
    thresholds: json("thresholds")
      .$type<{
        crossSourceDiscrepancy: number;
        historicalDeviation: number;
        persistenceWindowDays: number;
        materialityThreshold: number;
      }>()
      .default({
        crossSourceDiscrepancy: 0.15,
        historicalDeviation: 0.25,
        persistenceWindowDays: 5,
        materialityThreshold: 0.1,
      })
      .notNull(),
    baseline: json("baseline")
      .$type<{ windowDays: number; minObservations: number }>()
      .default({
        windowDays: 14,
        minObservations: 5,
      })
      .notNull(),
    retention: json("retention")
      .$type<{ rawTransactionsDays: number; exportsHours: number }>()
      .default({
        rawTransactionsDays: 365,
        exportsHours: 24,
      })
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attendance_configs_project_idx").on(t.projectId)],
);

export const attendanceRawTransactions = pgTable(
  "attendance_raw_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => attendanceDevices.id),
    externalUserId: varchar("external_user_id", { length: 200 }).notNull(),
    deviceEventId: varchar("device_event_id", { length: 200 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    rawType: varchar("raw_type", { length: 50 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>(),
    syncCursor: varchar("sync_cursor", { length: 200 }),
    status: varchar("status", { length: 20 }).notNull().default("RECEIVED"),
    mappingStatus: varchar("mapping_status", { length: 30 }),
    error: text("error"),
  },
  (t) => [
    unique("attendance_raw_device_event").on(t.deviceId, t.deviceEventId),
    index("attendance_raw_device_occurred_idx").on(t.deviceId, t.occurredAt),
    index("attendance_raw_status_idx").on(t.status),
  ],
);

export const attendanceEvents = pgTable(
  "attendance_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => attendanceDevices.id),
    populationId: uuid("population_id").references(() => attendancePopulations.id),
    personExternalId: varchar("person_external_id", { length: 200 }).notNull(),
    netramUserId: uuid("netram_user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    rawTransactionId: uuid("raw_transaction_id")
      .notNull()
      .references(() => attendanceRawTransactions.id),
    windowId: uuid("window_id").references(() => attendanceWindows.id),
    operationalDate: varchar("operational_date", { length: 10 }),
    dedupKey: varchar("dedup_key", { length: 200 }),
    status: varchar("status", { length: 20 }).notNull().default("NORMALIZED"),
  },
  (t) => [
    index("attendance_events_project_operational_idx").on(t.projectId, t.operationalDate),
    index("attendance_events_person_idx").on(t.projectId, t.personExternalId, t.operationalDate),
    index("attendance_events_dedup_idx").on(t.dedupKey),
  ],
);

export const attendanceSourceObservations = pgTable(
  "attendance_source_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    source: varchar("source", { length: 30 }).notNull(),
    windowId: uuid("window_id").references(() => attendanceWindows.id),
    operationalDate: varchar("operational_date", { length: 10 }).notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    observedCount: integer("observed_count"),
    expectedCount: integer("expected_count"),
    confidence: real("confidence"),
    coverage: varchar("coverage", { length: 20 }).notNull().default("UNKNOWN"),
    health: varchar("health", { length: 20 }).notNull().default("UNKNOWN"),
    note: text("note"),
  },
  (t) => [index("attendance_observations_project_date_idx").on(t.projectId, t.operationalDate)],
);

export const attendanceCalculations = pgTable(
  "attendance_calculations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    windowId: uuid("window_id")
      .notNull()
      .references(() => attendanceWindows.id),
    operationalDate: varchar("operational_date", { length: 10 }).notNull(),
    expected: integer("expected"),
    present: integer("present").notNull().default(0),
    absent: integer("absent"),
    unknown: integer("unknown").notNull().default(0),
    sourceCounts: json("source_counts").$type<Record<string, number>>().default({}).notNull(),
    coverage: varchar("coverage", { length: 20 }).notNull().default("UNKNOWN"),
    dataQuality: varchar("data_quality", { length: 20 }).notNull().default("UNKNOWN"),
    freshness: timestamp("freshness", { withTimezone: true }),
    policy: json("policy").$type<Record<string, unknown>>().default({}).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("attendance_calculation_window_day").on(t.projectId, t.windowId, t.operationalDate),
    index("attendance_calculations_project_date_idx").on(t.projectId, t.operationalDate),
  ],
);

export const attendanceDataQuality = pgTable(
  "attendance_data_quality",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    source: varchar("source", { length: 30 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    coverage: varchar("coverage", { length: 20 }).notNull().default("UNKNOWN"),
    freshness: timestamp("freshness", { withTimezone: true }),
    duplicateRate: real("duplicate_rate"),
    invalidCount: integer("invalid_count").notNull().default(0),
    unmatchedCount: integer("unmatched_count").notNull().default(0),
    health: varchar("health", { length: 20 }).notNull().default("UNKNOWN"),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attendance_dq_project_source_idx").on(t.projectId, t.source, t.periodEnd)],
);

export const attendanceAnomalyGroups = pgTable("attendance_anomaly_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  populationId: uuid("population_id").references(() => attendancePopulations.id),
  anomalyType: varchar("anomaly_type", { length: 40 }).notNull(),
  state: varchar("state", { length: 20 }).notNull().default("NEW"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const attendanceAnomalies = pgTable(
  "attendance_anomalies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    populationId: uuid("population_id").references(() => attendancePopulations.id),
    windowId: uuid("window_id").references(() => attendanceWindows.id),
    operationalDate: varchar("operational_date", { length: 10 }),
    observationStart: timestamp("observation_start", { withTimezone: true }).notNull(),
    observationEnd: timestamp("observation_end", { withTimezone: true }).notNull(),
    anomalyType: varchar("anomaly_type", { length: 40 }).notNull(),
    score: real("score").notNull(),
    severity: varchar("severity", { length: 20 }).notNull(),
    confidence: real("confidence").notNull(),
    dataQuality: varchar("data_quality", { length: 20 }).notNull().default("UNKNOWN"),
    detectorVersion: varchar("detector_version", { length: 50 }).notNull(),
    supportingSignals: json("supporting_signals")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    state: varchar("state", { length: 20 }).notNull().default("NEW"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    groupId: uuid("group_id").references(() => attendanceAnomalyGroups.id),
    linkedInspectionId: uuid("linked_inspection_id").references(() => inspections.id),
    linkedComplaintId: uuid("linked_complaint_id").references(() => complaints.id),
    sourceData: json("source_data").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("attendance_anomalies_project_state_idx").on(t.projectId, t.state),
    index("attendance_anomalies_group_idx").on(t.groupId),
  ],
);

export const attendanceReviewActions = pgTable(
  "attendance_review_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anomalyId: uuid("anomaly_id")
      .notNull()
      .references(() => attendanceAnomalies.id),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    action: varchar("action", { length: 30 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attendance_review_anomaly_idx").on(t.anomalyId)],
);

export const attendanceCorrections = pgTable(
  "attendance_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetId: uuid("target_id").notNull(),
    field: varchar("field", { length: 100 }).notNull(),
    originalValue: json("original_value").$type<Record<string, unknown>>().notNull(),
    newValue: json("new_value").$type<Record<string, unknown>>().notNull(),
    reason: text("reason").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attendance_corrections_project_idx").on(t.projectId, t.status)],
);

export const attendanceExports = pgTable(
  "attendance_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    scope: json("scope").$type<Record<string, unknown>>().default({}).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("REQUESTED"),
    format: varchar("format", { length: 10 }).notNull().default("csv"),
    artifactKey: varchar("artifact_key", { length: 300 }),
    recordCount: integer("record_count"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [index("attendance_exports_project_status_idx").on(t.projectId, t.status)],
);
