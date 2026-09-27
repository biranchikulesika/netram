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
  Evidence,
  EvidenceType,
  Finding,
  FindingAwaitingOrder,
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
  ProjectGeofence,
  ProjectPhoto,
  SealGeofenceCommand,
  ProjectListQuery,
  ProjectStatus,
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
  OrganisationView,
  ProgrammeView,
  RegistryUserView,
  CreateOrganisationInput,
  CreateProgrammeInput,
  RegisterInspectorInput,
  RegisterOfficialInput,
  StateView,
  DistrictView,
  FundAllocation,
  FundRelease,
  Expense,
  FinancialDocument,
  FinancialRiskRule,
  FinancialRiskEvent,
  InspectionFlag,
  FundSummary,
  ProjectFundOverview,
  AllocationListQuery,
  ExpenseListQuery,
  InspectionFlagListQuery,
  ProjectRiskSnapshot,
  ProjectRankEntry,
  ProjectRiskRankingQuery,
  ProjectRiskSnapshotQuery,
  ActionInboxResponse,
} from "@netram/types";
import type {
  CreateAllocationInput,
  UpdateAllocationInput,
  CreateReleaseInput,
  CreateExpenseInput,
  PatchExpenseInput,
  CreateRiskRuleInput,
  PatchRiskRuleInput,
} from "@netram/validation";
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

  /** Registrations awaiting an authority verification decision (project:approve). */
  async listVerificationQueue(): Promise<ProjectPage> {
    return this.get("/api/v1/projects/verification-queue");
  }

  async getProject(id: string): Promise<Project> {
    return this.get(`/api/v1/projects/${id}`);
  }

  /** Updates a facility's contact details (person in charge + contacts). */
  async updateProjectContact(
    id: string,
    body: { contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null },
  ): Promise<Project> {
    return this.patch(`/api/v1/projects/${id}/contact`, body);
  }

  async listProjectPhotos(id: string): Promise<ProjectPhoto[]> {
    return this.get(`/api/v1/projects/${id}/photos`);
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

  async updateProject(
    id: string,
    input: {
      name: string;
      type?: Project["type"];
      description?: string | null;
      organisationId?: string | null;
      districtId?: string | null;
      programmeIds?: string[];
    },
  ): Promise<Project> {
    return this.patch(`/api/v1/projects/${id}`, input);
  }

  async transitionProject(id: string, to: ProjectStatus, note?: string): Promise<Project> {
    return this.post(`/api/v1/projects/${id}/transitions`, { to, note });
  }

  async getProjectGeofence(id: string): Promise<ProjectGeofence | null> {
    return this.get(`/api/v1/projects/${id}/geofence`);
  }

  async listProjectGeofences(): Promise<ProjectGeofence[]> {
    return this.get("/api/v1/projects/geofences");
  }

  async sealProjectGeofence(id: string, input: SealGeofenceCommand): Promise<ProjectGeofence> {
    return this.post(`/api/v1/projects/${id}/geofence`, input);
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

  /** Confirmed findings awaiting a remediation order across the caller's jurisdiction. */
  async listFindingsAwaitingOrder(): Promise<FindingAwaitingOrder[]> {
    return this.get("/api/v1/findings/awaiting-order");
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

  async submitAtr(
    id: string,
    input: { actionSummary: string; files?: { data: Blob; name: string; type?: string }[] },
  ): Promise<CorrectiveAction> {
    const form = new FormData();
    form.append("actionSummary", input.actionSummary);
    for (const f of input.files ?? []) {
      form.append("files", f.data, f.name);
    }
    return this.post(`/api/v1/corrective-actions/${id}/submit-atr`, form);
  }

  async reviewCorrectiveAction(
    id: string,
    input: { outcome: "under_review" | "accepted" | "rejected"; note?: string },
  ): Promise<CorrectiveAction> {
    return this.post(`/api/v1/corrective-actions/${id}/review`, input);
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

  async listOrganisations(): Promise<OrganisationView[]> {
    return this.get("/api/v1/registry/organisations");
  }

  async createOrganisation(input: CreateOrganisationInput): Promise<OrganisationView> {
    return this.post("/api/v1/registry/organisations", input);
  }

  async listProgrammes(): Promise<ProgrammeView[]> {
    return this.get("/api/v1/registry/programmes");
  }

  async listStates(): Promise<StateView[]> {
    return this.get("/api/v1/registry/states");
  }

  async listRegistryDistricts(): Promise<DistrictView[]> {
    return this.get("/api/v1/registry/districts");
  }

  async createProgramme(input: CreateProgrammeInput): Promise<ProgrammeView> {
    return this.post("/api/v1/registry/programmes", input);
  }

  async registerInspector(input: RegisterInspectorInput): Promise<RegistryUserView> {
    return this.post("/api/v1/registry/inspectors", input);
  }

  async registerOfficial(input: RegisterOfficialInput): Promise<RegistryUserView> {
    return this.post("/api/v1/registry/officials", input);
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

  // action inbox (unified pending-decision queue, AGENTS.md §32)
  async listActionInbox(): Promise<ActionInboxResponse> {
    return this.get("/api/v1/action-inbox");
  }

  /** Keep a stream session alive against the sweeper (Phase 4). */
  async streamHeartbeat(cameraId: string, streamId: string): Promise<{ lastHeartbeatAt: string }> {
    return this.post(`/api/v1/cctv/cameras/${cameraId}/streams/${streamId}/heartbeat`, {});
  }

  /** End a stream session (viewer stop or admin revoke, Phase 4). */
  async endCameraStream(
    cameraId: string,
    streamId: string,
    input: { endReason?: "viewer_stop" | "admin_revoke" } = {},
  ): Promise<{ ended: true; endReason: string }> {
    return this.delete(`/api/v1/cctv/cameras/${cameraId}/streams/${streamId}`, input);
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

  // Funds & Allocations
  async listAllocations(
    query: AllocationListQuery = {},
  ): Promise<{ items: FundAllocation[]; total: number; page: number; pageSize: number }> {
    return this.get(`/api/v1/funds/allocations${queryString(query)}`);
  }

  async getAllocation(id: string): Promise<FundAllocation> {
    return this.get(`/api/v1/funds/allocations/${id}`);
  }

  async createAllocation(input: CreateAllocationInput): Promise<FundAllocation> {
    return this.post("/api/v1/funds/allocations", input);
  }

  async updateAllocation(id: string, input: UpdateAllocationInput): Promise<FundAllocation> {
    return this.patch(`/api/v1/funds/allocations/${id}`, input);
  }

  async listReleases(allocationId: string): Promise<FundRelease[]> {
    return this.get(`/api/v1/funds/allocations/${allocationId}/releases`);
  }

  async createRelease(input: CreateReleaseInput): Promise<FundRelease> {
    return this.post("/api/v1/funds/releases", input);
  }

  async reverseRelease(id: string, remarks?: string): Promise<FundRelease> {
    return this.post(`/api/v1/funds/releases/${id}/reverse`, { remarks });
  }

  async getProjectFundSummary(projectId: string): Promise<FundSummary> {
    return this.get(`/api/v1/funds/projects/${projectId}/summary`);
  }

  async getProjectFundOverview(projectId: string): Promise<ProjectFundOverview> {
    return this.get(`/api/v1/funds/projects/${projectId}/overview`);
  }

  // Expenses
  async listExpenses(
    query: ExpenseListQuery = {},
  ): Promise<{ items: Expense[]; total: number; page: number; pageSize: number }> {
    return this.get(`/api/v1/funds/expenses${queryString(query)}`);
  }

  async getExpense(id: string): Promise<Expense> {
    return this.get(`/api/v1/funds/expenses/${id}`);
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    return this.post("/api/v1/funds/expenses", input);
  }

  async updateExpense(id: string, input: PatchExpenseInput): Promise<Expense> {
    return this.patch(`/api/v1/funds/expenses/${id}`, input);
  }

  async submitExpense(id: string): Promise<Expense> {
    return this.post(`/api/v1/funds/expenses/${id}/submit`, {});
  }

  async verifyExpense(id: string): Promise<Expense> {
    return this.post(`/api/v1/funds/expenses/${id}/verify`, {});
  }

  async rejectExpense(id: string, reason: string): Promise<Expense> {
    return this.post(`/api/v1/funds/expenses/${id}/reject`, { reason });
  }

  async voidExpense(id: string, voidReason: string): Promise<Expense> {
    return this.post(`/api/v1/funds/expenses/${id}/void`, { voidReason });
  }

  // Financial Documents
  async getFinancialDocument(id: string): Promise<FinancialDocument> {
    return this.get(`/api/v1/funds/documents/${id}`);
  }

  async listExpenseDocuments(expenseId: string): Promise<FinancialDocument[]> {
    return this.get(`/api/v1/funds/expenses/${expenseId}/documents`);
  }

  async verifyFinancialDocument(
    id: string,
    input: { status: "verified" | "rejected" | "flagged"; rejectionReason?: string },
  ): Promise<FinancialDocument> {
    return this.post(`/api/v1/funds/documents/${id}/verify`, input);
  }

  // Financial Risk & Evaluation
  async evaluateProjectRisk(
    projectId: string,
  ): Promise<{ flag: InspectionFlag | null; events: FinancialRiskEvent[]; scoreOutput: Record<string, unknown> }> {
    return this.post(`/api/v1/financial-risk/evaluate/${projectId}`, {});
  }

  async listRiskRules(enabledOnly?: boolean): Promise<FinancialRiskRule[]> {
    return this.get(`/api/v1/financial-risk/rules${queryString({ enabledOnly })}`);
  }

  async getRiskRule(id: string): Promise<FinancialRiskRule> {
    return this.get(`/api/v1/financial-risk/rules/${id}`);
  }

  async createRiskRule(input: CreateRiskRuleInput): Promise<FinancialRiskRule> {
    return this.post("/api/v1/financial-risk/rules", input);
  }

  async updateRiskRule(id: string, input: PatchRiskRuleInput): Promise<FinancialRiskRule> {
    return this.patch(`/api/v1/financial-risk/rules/${id}`, input);
  }

  async listRiskEvents(projectId: string): Promise<FinancialRiskEvent[]> {
    return this.get(`/api/v1/financial-risk/events${queryString({ projectId })}`);
  }

  // Inspection Flags
  async listInspectionFlags(
    query: InspectionFlagListQuery = {},
  ): Promise<{ items: InspectionFlag[]; total: number; page: number; pageSize: number }> {
    return this.get(`/api/v1/inspection-flags${queryString(query)}`);
  }

  async getInspectionFlag(id: string): Promise<InspectionFlag> {
    return this.get(`/api/v1/inspection-flags/${id}`);
  }

  async assignInspectionFlag(id: string, assignedInspectorId: string): Promise<InspectionFlag> {
    return this.post(`/api/v1/inspection-flags/${id}/assign`, { assignedInspectorId });
  }

  async createInspectionFromFlag(
    id: string,
    opts: { templateId?: string; scheduledStart?: string; scheduledEnd?: string } = {},
  ): Promise<{ flag: InspectionFlag; inspection: Inspection }> {
    return this.post(`/api/v1/inspection-flags/${id}/create-inspection`, opts);
  }

  async reviewInspectionFlag(id: string, reviewNotes: string, status?: string): Promise<InspectionFlag> {
    return this.post(`/api/v1/inspection-flags/${id}/review`, { reviewNotes, status });
  }

  async resolveInspectionFlag(id: string, resolution: string): Promise<InspectionFlag> {
    return this.post(`/api/v1/inspection-flags/${id}/resolve`, { resolution });
  }

  async dismissInspectionFlag(id: string, dismissedReason: string): Promise<InspectionFlag> {
    return this.post(`/api/v1/inspection-flags/${id}/dismiss`, { dismissedReason });
  }

  // Project Risk & Priority Scheduling
  async listProjectRiskRankings(
    query: ProjectRiskRankingQuery = {},
  ): Promise<{ items: ProjectRankEntry[]; total: number }> {
    return this.get(`/api/v1/project-risk/rankings${queryString(query)}`);
  }

  async getProjectRiskSnapshots(query: ProjectRiskSnapshotQuery): Promise<ProjectRiskSnapshot[]> {
    return this.get(`/api/v1/project-risk/projects/${query.projectId}/snapshots${queryString(query)}`);
  }

  async getLatestProjectRiskSnapshot(projectId: string): Promise<ProjectRiskSnapshot | null> {
    return this.get(`/api/v1/project-risk/projects/${projectId}/latest`);
  }

  async evaluateProjectRiskScore(projectId: string): Promise<ProjectRiskSnapshot> {
    return this.post(`/api/v1/project-risk/evaluate/${projectId}`, {});
  }

  async sweepProjectRiskScores(): Promise<{ evaluatedCount: number; scheduledCount: number }> {
    return this.post("/api/v1/project-risk/sweep", {});
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
