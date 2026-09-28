import {
  getDb,
  ProjectRepository,
  ProjectPhotoRepository,
  InspectionRepository,
  FindingRepository,
  CorrectiveActionRepository,
  ObservationRepository,
  EvidenceRepository,
  ComplaintRepository,
  AiAnomalyRepository,
  InspectionAssignmentRepository,
  NotificationRepository,
  AuditRepository,
  OutboxRepository,
  UserRepository,
  UserAdminRepository,
  RegistryRepository,
  AuthorizationRepository,
  InspectionSyncRepository,
  CctvRepository,
  VcSessionRepository,
  AttendanceRepository,
  FundRepository,
  ExpenseRepository,
  FinancialDocumentRepository,
  FinancialRiskRepository,
  InspectionFlagRepository,
  ProjectRiskRepository,
  CallRepository,
} from "@netram/data";
import type { AppConfig } from "../config.js";
import { AppError } from "./errors.js";
import { AuthService } from "../modules/auth/application/auth-service.js";
import { CallService } from "../modules/calls/application/call-service.js";
import { DevAuthProvider } from "../modules/auth/infrastructure/providers/dev-auth-provider.js";
import { SupabaseAuthProvider } from "../modules/auth/infrastructure/providers/supabase-auth-provider.js";
import { AuthorizationService } from "../modules/authorization/application/authorization-service.js";
import { ProjectService } from "../modules/projects/application/project-service.js";
import { ProjectPhotoService } from "../modules/projects/application/project-photo-service.js";
import { InspectionService } from "../modules/inspections/application/inspection-service.js";
import { InspectionSyncService } from "../modules/inspections/application/inspection-sync-service.js";
import { FindingService } from "../modules/findings/application/finding-service.js";
import { CorrectiveActionService } from "../modules/corrective-actions/application/corrective-action-service.js";
import { ObservationService } from "../modules/observations/application/observation-service.js";
import { EvidenceService } from "../modules/evidence/application/evidence-service.js";
import { ComplaintService } from "../modules/complaints/application/complaint-service.js";
import { AuditService } from "../modules/audit/application/audit-service.js";
import { AiAnomalyService } from "../modules/ai-anomalies/application/ai-anomaly-service.js";
import { InspectionAssignmentService } from "../modules/assignments/application/inspection-assignment-service.js";
import { NotificationService } from "../modules/notifications/application/notification-service.js";
import { UserAdminService } from "../modules/user-admin/application/user-admin-service.js";
import { RegistryService } from "../modules/registry/application/registry-service.js";
import { CctvService } from "../modules/cctv/application/cctv-service.js";
import { VcService } from "../modules/vc/application/vc-service.js";
import { WebRtcMeshProvider } from "../modules/vc/infrastructure/providers/webrtc-mesh-provider.js";
import { AttendanceService } from "../modules/attendance/application/attendance-service.js";
import { BiometricSimulatorProvider } from "../modules/attendance/infrastructure/providers/biometric-simulator.js";
import { BullAttendanceExportJobQueue } from "../modules/attendance/infrastructure/bull-attendance-export-job-queue.js";
import { MinioObjectStorage } from "./object-storage.js";
import { NotificationProviderRegistry } from "../modules/notifications/infrastructure/providers/notification-provider-registry.js";
import type { AuthProvider } from "../modules/auth/application/auth-provider-port.js";
import { FundService } from "../modules/funds/application/fund-service.js";
import { ExpenseService } from "../modules/funds/application/expense-service.js";
import { FinancialDocumentService } from "../modules/funds/application/document-service.js";
import { FinancialRiskService } from "../modules/financial-risk/application/financial-risk-service.js";
import { ProjectRiskService } from "../modules/project-risk/application/project-risk-service.js";
import { ActionInboxService } from "../modules/action-inbox/application/action-inbox-service.js";
import { ProjectRiskContextBuilder } from "../modules/project-risk/application/project-risk-context-builder.js";
import { CompositeRiskScorer } from "../modules/project-risk/domain/composite-risk-scorer.js";
import { InspectionScheduler } from "../modules/project-risk/application/inspection-scheduler.js";

export interface Container {
  config: AppConfig;
  db: ReturnType<typeof getDb>;
  authService: AuthService;
  devAuthProvider: DevAuthProvider | null;
  authorizationService: AuthorizationService;
  projectService: ProjectService;
  projectPhotoService: ProjectPhotoService;
  inspectionService: InspectionService;
  inspectionSyncService: InspectionSyncService;
  findingService: FindingService;
  correctiveActionService: CorrectiveActionService;
  observationService: ObservationService;
  evidenceService: EvidenceService;
  complaintService: ComplaintService;
  auditService: AuditService;
  aiAnomalyService: AiAnomalyService;
  inspectionAssignmentService: InspectionAssignmentService;
  notificationService: NotificationService;
  userAdminService: UserAdminService;
  registryService: RegistryService;
  cctvService: CctvService;
  cctvRepo: CctvRepository;
  vcService: VcService;
  vcRepo: VcSessionRepository;
  auditRepo: AuditRepository;
  outboxRepo: OutboxRepository;
  attendanceService: AttendanceService;
  fundService: FundService;
  expenseService: ExpenseService;
  financialDocumentService: FinancialDocumentService;
  financialRiskService: FinancialRiskService;
  fundRepo: FundRepository;
  expenseRepo: ExpenseRepository;
  docRepo: FinancialDocumentRepository;
  riskRepo: FinancialRiskRepository;
  flagRepo: InspectionFlagRepository;
  projectRiskService: ProjectRiskService;
  projectRiskRepo: ProjectRiskRepository;
  actionInboxService: ActionInboxService;
  callService: CallService;
  callRepo: CallRepository;
}

export function buildContainer(config: AppConfig): Container {
  const db = getDb(config.DATABASE_URL);

  const callRepo = new CallRepository(db);
  const callService = new CallService(callRepo);
  const userRepo = new UserRepository(db);
  const authzRepo = new AuthorizationRepository(db);
  const auditRepo = new AuditRepository(db);
  const outboxRepo = new OutboxRepository(db);
  const projectRepo = new ProjectRepository(db);
  const projectPhotoRepo = new ProjectPhotoRepository(db);
  const inspectionRepo = new InspectionRepository(db);
  const findingRepo = new FindingRepository(db);
  const correctiveActionRepo = new CorrectiveActionRepository(db);
  const observationRepo = new ObservationRepository(db);
  const evidenceRepo = new EvidenceRepository(db);
  const objectStorage = new MinioObjectStorage({
    endpoint: config.NETRAM_OBJECT_STORAGE_ENDPOINT,
    accessKey: config.NETRAM_OBJECT_STORAGE_ACCESS_KEY,
    secretKey: config.NETRAM_OBJECT_STORAGE_SECRET_KEY,
    bucket: config.NETRAM_OBJECT_STORAGE_BUCKET,
    useSSL: config.NETRAM_OBJECT_STORAGE_USE_SSL,
  });
  const complaintRepo = new ComplaintRepository(db);
  const aiAnomalyRepo = new AiAnomalyRepository(db);
  const inspectionAssignmentRepo = new InspectionAssignmentRepository(db);
  const notificationRepo = new NotificationRepository(db);

  const syncRepo = new InspectionSyncRepository(db);

  const authorizationService = new AuthorizationService();
  const projectService = new ProjectService(authorizationService, projectRepo);
  const projectPhotoService = new ProjectPhotoService(
    authorizationService,
    projectService,
    projectPhotoRepo,
    objectStorage,
  );
  const inspectionService = new InspectionService(
    authorizationService,
    projectRepo,
    inspectionRepo,
    outboxRepo,
  );
  const inspectionSyncService = new InspectionSyncService(
    authorizationService,
    inspectionRepo,
    syncRepo,
    observationRepo,
    evidenceRepo,
    findingRepo,
  );
  const findingService = new FindingService(
    authorizationService,
    inspectionService,
    projectRepo,
    findingRepo,
  );
  const correctiveActionService = new CorrectiveActionService(
    authorizationService,
    inspectionService,
    findingRepo,
    correctiveActionRepo,
    objectStorage,
  );
  const observationService = new ObservationService(
    authorizationService,
    inspectionService,
    observationRepo,
  );
  const evidenceService = new EvidenceService(
    authorizationService,
    inspectionService,
    evidenceRepo,
    objectStorage,
  );
  const complaintService = new ComplaintService(
    authorizationService,
    projectRepo,
    complaintRepo,
    objectStorage,
  );
  const auditService = new AuditService(authorizationService, auditRepo);
  const aiAnomalyService = new AiAnomalyService(
    authorizationService,
    aiAnomalyRepo,
    // Resolves the anomaly's project for follow-up inspection creation on
    // escalation to `investigated` (§36 → §32).
    inspectionRepo,
  );
  const inspectionAssignmentService = new InspectionAssignmentService(
    authorizationService,
    inspectionService,
    inspectionAssignmentRepo,
  );
  const notificationRegistry = new NotificationProviderRegistry({
    notificationRepo,
    nodeEnv: config.NODE_ENV,
  });
  const notificationService = new NotificationService({
    repository: notificationRepo,
    authz: authorizationService,
    providers: [notificationRegistry.get("in_app")],
  });
  const userAdminRepo = new UserAdminRepository(db);
  const userAdminService = new UserAdminService(authorizationService, userAdminRepo);
  const registryRepo = new RegistryRepository(db);
  const registryService = new RegistryService(authorizationService, registryRepo);
  const cctvRepo = new CctvRepository(db);
  const cctvService = new CctvService(
    authorizationService,
    cctvRepo,
    config.NETRAM_CCTV_GATEWAY_URL,
    config.NETRAM_CCTV_SERVICE_SECRET,
  );
  const vcRepo = new VcSessionRepository(db);
  const vcProvider = new WebRtcMeshProvider({
    signingSecret:
      config.NETRAM_DEV_AUTH_SECRET ??
      config.NETRAM_SUPABASE_JWT_SECRET ??
      "netram-vc-mesh-signing-secret-key-32char",
  });
  const vcService = new VcService(authorizationService, vcRepo, vcProvider);

  const attendanceRepo = new AttendanceRepository(db);
  const attendanceProvider = new BiometricSimulatorProvider();
  const attendanceExportJobs = new BullAttendanceExportJobQueue(config.REDIS_URL);
  const attendanceService = new AttendanceService({
    authz: authorizationService,
    repo: attendanceRepo,
    provider: attendanceProvider,
    storage: objectStorage,
    exportJobs: attendanceExportJobs,
  });

  const fundRepo = new FundRepository(db);
  const expenseRepo = new ExpenseRepository(db);
  const docRepo = new FinancialDocumentRepository(db);
  const riskRepo = new FinancialRiskRepository(db);
  const flagRepo = new InspectionFlagRepository(db);

  const fundService = new FundService(
    authorizationService,
    projectRepo,
    fundRepo,
    expenseRepo,
    riskRepo,
    flagRepo,
  );
  const expenseService = new ExpenseService(
    authorizationService,
    projectRepo,
    expenseRepo,
    fundRepo,
  );
  const financialDocumentService = new FinancialDocumentService(
    authorizationService,
    projectRepo,
    expenseRepo,
    docRepo,
    objectStorage,
  );
  const financialRiskService = new FinancialRiskService(
    authorizationService,
    projectRepo,
    inspectionRepo,
    inspectionService,
    fundRepo,
    expenseRepo,
    docRepo,
    riskRepo,
    flagRepo,
  );

  const projectRiskRepo = new ProjectRiskRepository(db);
  const projectRiskContextBuilder = new ProjectRiskContextBuilder(
    projectRepo,
    inspectionRepo,
    findingRepo,
    correctiveActionRepo,
    attendanceRepo,
    complaintRepo,
    aiAnomalyRepo,
    riskRepo,
    fundRepo,
    expenseRepo,
    financialRiskService,
  );
  const compositeRiskScorer = new CompositeRiskScorer();
  const inspectionScheduler = new InspectionScheduler(
    projectRiskRepo,
    flagRepo,
    inspectionService,
  );
  const projectRiskService = new ProjectRiskService(
    authorizationService,
    projectRiskContextBuilder,
    compositeRiskScorer,
    inspectionScheduler,
    projectRiskRepo,
    auditRepo,
  );

  // Action Inbox aggregates each module's pending-decision queue (§32). It
  // depends only on the application services (never repositories directly) and
  // enforces its own permission gating before each section fetch.
  const actionInboxService = new ActionInboxService({
    authz: authorizationService,
    projectService,
    findingService,
    correctiveActionService,
    complaintService,
    aiAnomalyService,
    attendanceService,
    expenseService,
    financialDocumentService,
    financialRiskService,
  });

  let provider: AuthProvider;
  let devAuthProvider: DevAuthProvider | null = null;

  if (config.NETRAM_AUTH_PROVIDER === "supabase") {
    if (!config.NETRAM_SUPABASE_JWT_SECRET) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "NETRAM_SUPABASE_JWT_SECRET is required when NETRAM_AUTH_PROVIDER=supabase",
      );
    }
    provider = new SupabaseAuthProvider(config.NETRAM_SUPABASE_JWT_SECRET);
  } else {
    const devSecret = config.NETRAM_DEV_AUTH_SECRET;
    if (!devSecret) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "NETRAM_DEV_AUTH_SECRET is required when NETRAM_AUTH_PROVIDER=dev",
      );
    }
    const devProvider = new DevAuthProvider(devSecret);
    devAuthProvider = devProvider;
    provider = devProvider;
  }

  const authService = new AuthService(provider, userRepo, authzRepo);

  return {
    config,
    db,
    authService,
    devAuthProvider,
    authorizationService,
    projectService,
    projectPhotoService,
    inspectionService,
    inspectionSyncService,
    findingService,
    correctiveActionService,
    observationService,
    evidenceService,
    complaintService,
    auditService,
    aiAnomalyService,
    inspectionAssignmentService,
    notificationService,
    userAdminService,
    registryService,
    cctvService,
    cctvRepo,
    vcService,
    vcRepo,
    auditRepo,
    outboxRepo,
    attendanceService,
    fundService,
    expenseService,
    financialDocumentService,
    financialRiskService,
    fundRepo,
    expenseRepo,
    docRepo,
    riskRepo,
    flagRepo,
    projectRiskService,
    projectRiskRepo,
    actionInboxService,
    callService,
    callRepo,
  };
}
