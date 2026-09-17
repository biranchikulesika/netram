import type {
  AIAnomaly,
  AIAnomalyListQuery,
  AnomalyStatus,
  AssignRoleInput,
  AssignmentListQuery,
  AssignmentRole,
  AttendanceAnomaly,
  AttendanceAnomalySeverity,
  AttendanceAnomalyState,
  AttendanceAnomalyType,
  AttendanceCalculation,
  AttendanceDrillDownRow,
  AttendanceOverviewItem,
  AttendanceReviewAction,
  AuthenticatedUser,
  AuditEvent,
  AuditListQuery,
  Complaint,
  ComplaintListQuery,
  ComplaintStatus,
  PublicComplaintTracking,
  CorrectiveAction,
  CorrectiveActionListQuery,
  CorrectiveActionStatus,
  Evidence,
  EvidenceType,
  Finding,
  FindingStatus,
  Inspection,
  InspectionAssignment,
  InspectionListQuery,
  InspectionStatus,
  JurisdictionView,
  Notification,
  NotificationListQuery,
  NotificationListResponse,
  Observation,
  OutboxRecord,
  Project,
  ProjectListQuery,
  ProjectStatus,
  Report,
  ReportFormat,
  ReportListQuery,
  ReportListResponse,
  RoleAssignmentView,
  RoleView,
  UpdateUserInput,
  UserAdminView,
  UserListQuery,
  UserListResponse,
  SyncBatchRequest,
  SyncBatchResponse,
  AuthorizedStream,
  CameraHealthStatus,
  ListCamerasFilter,
  PublicCctvCamera,
  CreateVcSessionInput,
  ListVcSessionsFilter,
  VcJoinDetails,
  VcSessionWithParticipants,
  VcParticipantRole,
} from "@netram/types";
import { HttpClient } from "./http.js";
import type { HttpOptions } from "./http.js";

export { ApiError } from "./http.js";
export type { ApiErrorBody, TokenSupplier } from "./http.js";
export { HttpClient };
export type { HttpOptions };

export type ApiClientOptions = HttpOptions;

export interface ProjectPage {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InspectionPage {
  items: Inspection[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CorrectiveActionPage {
  items: CorrectiveAction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ComplaintPage {
  items: Complaint[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AiAnomalyPage {
  items: AIAnomaly[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CctvCameraPage {
  items: PublicCctvCamera[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AssignmentPage {
  items: InspectionAssignment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VcSessionPage {
  items: VcSessionWithParticipants[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Typed, contract-aligned client for the Netram REST API.
 *
 * Web (Next.js) uses it server-side with cookie/SSR tokens; inspector-mobile
 * uses it with a bearer token. URLs and payload shapes mirror the OpenAPI
 * contract — do not diverge here without updating the contract first.
 */
export class NetramApiClient extends HttpClient {
  constructor(opts: ApiClientOptions) {
    super(opts);
  }

  // auth
  async devLogin(email: string): Promise<{ token: string; user: AuthenticatedUser }> {
    return this.post("/api/v1/auth/dev-login", { email });
  }

  async me(): Promise<{ user: AuthenticatedUser; permissions: string[] }> {
    return this.get("/api/v1/auth/me");
  }

  // projects
  async listProjects(query: ProjectListQuery = {}): Promise<ProjectPage> {
    return this.get(`/api/v1/projects${queryString(query)}`);
  }

  async getProject(id: string): Promise<Project> {
    return this.get(`/api/v1/projects/${id}`);
  }

  async createProject(input: {
    name: string;
    type?: Project["type"];
    description?: string | null;
    organisationId?: string | null;
    districtId?: string | null;
    programmeIds?: string[];
  }): Promise<Project> {
    return this.post("/api/v1/projects", input);
  }

  async transitionProject(id: string, to: ProjectStatus, note?: string): Promise<Project> {
    return this.post(`/api/v1/projects/${id}/transitions`, { to, note });
  }

  // inspections
  async listInspections(query: InspectionListQuery = {}): Promise<InspectionPage> {
    return this.get(`/api/v1/inspections${queryString(query)}`);
  }

  async getInspection(id: string): Promise<Inspection> {
    return this.get(`/api/v1/inspections/${id}`);
  }

  async listInspectionEvents(id: string): Promise<OutboxRecord[]> {
    return this.get(`/api/v1/inspections/${id}/events`);
  }

  async createInspection(input: {
    projectId: string;
    type: Inspection["type"];
    trigger?: "officer" | "risk_engine" | "automatic";
    templateId?: string | null;
    disclosurePolicyId?: string | null;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    assigneeUserIds?: string[];
  }): Promise<Inspection> {
    return this.post("/api/v1/inspections", input);
  }

  async transitionInspection(id: string, to: InspectionStatus, note?: string): Promise<Inspection> {
    return this.post(`/api/v1/inspections/${id}/transitions`, { to, note });
  }

  async syncOfflineOperations(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    return this.post("/api/v1/inspections/sync", batch);
  }

  // findings
  async listFindings(inspectionId: string): Promise<Finding[]> {
    return this.get(`/api/v1/inspections/${inspectionId}/findings`);
  }

  async createFinding(
    inspectionId: string,
    input: {
      severity: Finding["severity"];
      description: string;
      remediation?: string | null;
    },
  ): Promise<Finding> {
    return this.post(`/api/v1/inspections/${inspectionId}/findings`, input);
  }

  async transitionFinding(id: string, to: FindingStatus, note?: string): Promise<Finding> {
    return this.post(`/api/v1/findings/${id}/transitions`, { to, note });
  }

  // corrective actions
  async listCorrectiveActions(
    query: CorrectiveActionListQuery = {},
  ): Promise<CorrectiveActionPage> {
    return this.get(`/api/v1/corrective-actions${queryString(query)}`);
  }

  async getCorrectiveAction(id: string): Promise<CorrectiveAction> {
    return this.get(`/api/v1/corrective-actions/${id}`);
  }

  async createCorrectiveAction(input: {
    findingId: string;
    organisationId?: string | null;
    deadline?: string | null;
  }): Promise<CorrectiveAction> {
    return this.post("/api/v1/corrective-actions", input);
  }

  async transitionCorrectiveAction(
    id: string,
    to: CorrectiveActionStatus,
    note?: string,
  ): Promise<CorrectiveAction> {
    return this.post(`/api/v1/corrective-actions/${id}/transitions`, {
      to,
      note,
    });
  }

  // observations
  async listObservations(inspectionId: string): Promise<Observation[]> {
    return this.get(`/api/v1/inspections/${inspectionId}/observations`);
  }

  async createObservation(inspectionId: string, input: { text: string }): Promise<Observation> {
    return this.post(`/api/v1/inspections/${inspectionId}/observations`, input);
  }

  // evidence
  async listEvidence(inspectionId: string): Promise<Evidence[]> {
    return this.get(`/api/v1/inspections/${inspectionId}/evidence`);
  }

  async captureEvidence(
    inspectionId: string,
    input: {
      capturedAt: string;
      latitude?: number;
      longitude?: number;
      evidenceType: EvidenceType;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      contentHash?: string | null;
      deviceId?: string;
      findingId?: string | null;
    },
  ): Promise<Evidence> {
    return this.post(`/api/v1/inspections/${inspectionId}/evidence`, input);
  }

  async uploadEvidence(id: string, file: Blob | File, fileName?: string): Promise<Evidence> {
    const form = new FormData();
    form.append("file", file as Blob, fileName ?? (file as File).name ?? "evidence");
    return this.post(`/api/v1/evidence/${id}/uploads`, form);
  }

  async getEvidenceContent(id: string): Promise<Blob> {
    return this.getBlob(`/api/v1/evidence/${id}/content`);
  }

  async verifyEvidenceIntegrity(id: string, contentHash: string): Promise<Evidence> {
    return this.post(`/api/v1/evidence/${id}/integrity-check`, { contentHash });
  }

  // realtime authorization (server-issued topic grant, see AGENTS.md §28)
  async authorizeRealtimeTopics(topics: string[]): Promise<{ allowedTopics: string[] }> {
    return this.post("/api/v1/realtime/authorize", { topics });
  }

  // attendance monitoring (aggregate-first, §36)
  async listAttendanceOverview(query: {
    projectId?: string;
    districtId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: AttendanceOverviewItem[]; total: number; page: number; pageSize: number }> {
    return this.get(`/api/v1/attendance/overview${queryString(query)}`);
  }

  async drillDownIndividualAttendance(query: {
    projectId: string;
    personExternalId: string;
    windowId?: string;
    operationalDate?: string;
    from?: string;
    to?: string;
  }): Promise<AttendanceDrillDownRow[]> {
    return this.get<AttendanceDrillDownRow[]>(
      `/api/v1/attendance/individual${queryString(query)}`,
    );
  }

  async listAttendanceAnomalies(query: {
    projectId?: string;
    type?: AttendanceAnomalyType;
    severity?: AttendanceAnomalySeverity;
    state?: AttendanceAnomalyState;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: AttendanceAnomaly[]; total: number; page: number; pageSize: number }> {
    return this.get(`/api/v1/attendance/anomalies${queryString(query)}`);
  }

  async reviewAttendanceAnomaly(
    id: string,
    input: { action: AttendanceReviewAction; note?: string | null; linkedInspectionId?: string | null; linkedComplaintId?: string | null },
  ): Promise<{ items: AttendanceAnomaly[]; total: number; page: number; pageSize: number }> {
    return this.post(`/api/v1/attendance/anomalies/${id}/review`, input);
  }

  async listAttendanceCalculations(query: {
    projectId?: string;
    windowId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: AttendanceCalculation[]; total: number; page: number; pageSize: number }> {
    return this.get(`/api/v1/attendance/calculations${queryString(query)}`);
  }

  async listComplaints(query: ComplaintListQuery = {}): Promise<ComplaintPage> {
    return this.get(`/api/v1/complaints${queryString(query)}`);
  }

  async getComplaint(id: string): Promise<Complaint> {
    return this.get(`/api/v1/complaints/${id}`);
  }

  async createComplaint(input: {
    projectId: string;
    description: string;
    complainantName?: string;
    contactInfo?: string;
  }): Promise<Complaint> {
    return this.post("/api/v1/complaints", input);
  }

  async transitionComplaint(
    id: string,
    to: ComplaintStatus,
    resolutionText?: string,
  ): Promise<Complaint> {
    return this.post(`/api/v1/complaints/${id}/transitions`, {
      to,
      resolutionText,
    });
  }

  async trackComplaint(trackingCode: string): Promise<PublicComplaintTracking> {
    return this.get(`/api/v1/complaints/track/${encodeURIComponent(trackingCode)}`);
  }

  async listAuditEvents(query: AuditListQuery = {}): Promise<AuditPage> {
    return this.get(`/api/v1/audit-events${queryString(query)}`);
  }

  async listAiAnomalies(query: AIAnomalyListQuery = {}): Promise<AiAnomalyPage> {
    return this.get(`/api/v1/ai-anomalies${queryString(query)}`);
  }

  async getAiAnomaly(id: string): Promise<AIAnomaly> {
    return this.get(`/api/v1/ai-anomalies/${id}`);
  }

  async transitionAiAnomaly(id: string, to: AnomalyStatus, note?: string): Promise<AIAnomaly> {
    return this.post(`/api/v1/ai-anomalies/${id}/transitions`, { to, note });
  }

  async listInspectionAssignments(inspectionId: string): Promise<InspectionAssignment[]> {
    return this.get(`/api/v1/inspections/${inspectionId}/assignments`);
  }

  async assignInspector(
    inspectionId: string,
    userId: string,
    role: AssignmentRole = "member",
  ): Promise<InspectionAssignment> {
    return this.post(`/api/v1/inspections/${inspectionId}/assignments`, {
      userId,
      role,
    });
  }

  async listMyAssignments(query: AssignmentListQuery = {}): Promise<AssignmentPage> {
    return this.get(`/api/v1/assignments/mine${queryString(query)}`);
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    return this.delete(`/api/v1/assignments/${assignmentId}`);
  }

  async listNotifications(query: NotificationListQuery = {}): Promise<NotificationListResponse> {
    return this.get(`/api/v1/notifications${queryString(query)}`);
  }

  async markNotificationRead(id: string): Promise<Notification> {
    return this.post(`/api/v1/notifications/${id}/read`, {});
  }

  async markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.post("/api/v1/notifications/read-all", {});
  }

  async listReports(query: ReportListQuery = {}): Promise<ReportListResponse> {
    return this.get(`/api/v1/reports${queryString(query)}`);
  }

  async getReport(id: string): Promise<Report> {
    return this.get(`/api/v1/reports/${id}`);
  }

  async createReport(inspectionId: string, format: ReportFormat = "json"): Promise<Report> {
    return this.post("/api/v1/reports", { inspectionId, format });
  }

  async finalizeReport(id: string): Promise<Report> {
    return this.post(`/api/v1/reports/${id}/finalize`, {});
  }

  async listUsers(query: UserListQuery = {}): Promise<UserListResponse> {
    return this.get(`/api/v1/users${queryString(query)}`);
  }

  async getUser(id: string): Promise<UserAdminView> {
    return this.get(`/api/v1/users/${id}`);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<UserAdminView> {
    return this.patch(`/api/v1/users/${id}`, input);
  }

  async assignRole(userId: string, input: AssignRoleInput): Promise<RoleAssignmentView> {
    return this.post(`/api/v1/users/${userId}/role-assignments`, input);
  }

  async removeRoleAssignment(assignmentId: string): Promise<null> {
    return this.delete(`/api/v1/role-assignments/${assignmentId}`);
  }

  async listRoles(): Promise<RoleView[]> {
    return this.get("/api/v1/roles");
  }

  async updateRolePermissions(roleCode: string, permissions: string[]): Promise<RoleView> {
    return this.put(`/api/v1/roles/${roleCode}/permissions`, { permissions });
  }

  async listJurisdictions(): Promise<JurisdictionView[]> {
    return this.get("/api/v1/jurisdictions");
  }

  async listCameras(query: ListCamerasFilter = {}): Promise<CctvCameraPage> {
    return this.get(`/api/v1/cctv/cameras${queryString(query)}`);
  }

  async getCamera(id: string): Promise<PublicCctvCamera> {
    return this.get(`/api/v1/cctv/cameras/${id}`);
  }

  async getCameraHealth(id: string): Promise<CameraHealthStatus> {
    return this.get(`/api/v1/cctv/cameras/${id}/health`);
  }

  async requestCameraStream(
    id: string,
    input: { ttlSeconds?: number } = {},
  ): Promise<AuthorizedStream> {
    return this.post(`/api/v1/cctv/cameras/${id}/streams`, input);
  }

  async getCameraSnapshot(id: string): Promise<Blob> {
    return this.getBlob(`/api/v1/cctv/cameras/${id}/snapshot`);
  }

  // video conferencing
  async createVcSession(input: CreateVcSessionInput): Promise<VcSessionWithParticipants> {
    return this.post("/api/v1/vc/sessions", input);
  }

  async listVcSessions(filter: ListVcSessionsFilter = {}): Promise<VcSessionPage> {
    return this.get(`/api/v1/vc/sessions${queryString(filter)}`);
  }

  async getVcSession(id: string): Promise<VcSessionWithParticipants> {
    return this.get(`/api/v1/vc/sessions/${id}`);
  }

  async startVcSession(id: string): Promise<VcSessionWithParticipants> {
    return this.post(`/api/v1/vc/sessions/${id}/start`, {});
  }

  async endVcSession(id: string): Promise<VcSessionWithParticipants> {
    return this.post(`/api/v1/vc/sessions/${id}/end`, {});
  }

  async joinVcSession(id: string, role?: VcParticipantRole): Promise<VcJoinDetails> {
    return this.post(`/api/v1/vc/sessions/${id}/join`, { role });
  }

  async leaveVcSession(id: string): Promise<void> {
    return this.post(`/api/v1/vc/sessions/${id}/leave`, {});
  }
}

function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
