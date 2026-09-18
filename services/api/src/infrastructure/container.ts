import {
  getDb,
  ProjectRepository,
  InspectionRepository,
  FindingRepository,
  CorrectiveActionRepository,
  ObservationRepository,
  EvidenceRepository,
  ComplaintRepository,
  AiAnomalyRepository,
  InspectionAssignmentRepository,
  NotificationRepository,
  ReportRepository,
  AuditRepository,
  OutboxRepository,
  UserRepository,
  UserAdminRepository,
  AuthorizationRepository,
  InspectionSyncRepository,
  CctvRepository,
  VcSessionRepository,
  AttendanceRepository,
  AnalyticsRepository,
} from "@netram/data";
import type { AppConfig } from "../config.js";
import { AppError } from "./errors.js";
import { AuthService } from "../modules/auth/application/auth-service.js";
import { DevAuthProvider } from "../modules/auth/infrastructure/providers/dev-auth-provider.js";
import { SupabaseAuthProvider } from "../modules/auth/infrastructure/providers/supabase-auth-provider.js";
import { AuthorizationService } from "../modules/authorization/application/authorization-service.js";
import { AnalyticsService } from "../modules/analytics/application/analytics-service.js";
import { ProjectService } from "../modules/projects/application/project-service.js";
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
import { ReportService } from "../modules/reports/application/report-service.js";
import { UserAdminService } from "../modules/user-admin/application/user-admin-service.js";
import { CctvService } from "../modules/cctv/application/cctv-service.js";
import { VcService } from "../modules/vc/application/vc-service.js";
import { WebRtcMeshProvider } from "../modules/vc/infrastructure/providers/webrtc-mesh-provider.js";
import { BullReportJobQueue } from "../modules/reports/infrastructure/bull-report-job-queue.js";
import { AttendanceService } from "../modules/attendance/application/attendance-service.js";
import { BiometricSimulatorProvider } from "../modules/attendance/infrastructure/providers/biometric-simulator.js";
import { BullAttendanceExportJobQueue } from "../modules/attendance/infrastructure/bull-attendance-export-job-queue.js";
import { MinioObjectStorage } from "./object-storage.js";
import { NotificationProviderRegistry } from "../modules/notifications/infrastructure/providers/notification-provider-registry.js";
import type { AuthProvider } from "../modules/auth/application/auth-provider-port.js";

export interface Container {
  config: AppConfig;
  db: ReturnType<typeof getDb>;
  authService: AuthService;
  devAuthProvider: DevAuthProvider | null;
  authorizationService: AuthorizationService;
  projectService: ProjectService;
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
  reportService: ReportService;
  userAdminService: UserAdminService;
  cctvService: CctvService;
  cctvRepo: CctvRepository;
  vcService: VcService;
  vcRepo: VcSessionRepository;
  auditRepo: AuditRepository;
  outboxRepo: OutboxRepository;
  attendanceService: AttendanceService;
  analyticsService: AnalyticsService;
}

export function buildContainer(config: AppConfig): Container {
  const db = getDb(config.DATABASE_URL);

  const userRepo = new UserRepository(db);
  const authzRepo = new AuthorizationRepository(db);
  const auditRepo = new AuditRepository(db);
  const outboxRepo = new OutboxRepository(db);
  const projectRepo = new ProjectRepository(db);
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
  const reportRepo = new ReportRepository(db);

  const syncRepo = new InspectionSyncRepository(db);

  const authorizationService = new AuthorizationService();
  const projectService = new ProjectService(authorizationService, projectRepo);
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
  );
  const findingService = new FindingService(authorizationService, inspectionService, findingRepo);
  const correctiveActionService = new CorrectiveActionService(
    authorizationService,
    inspectionService,
    findingRepo,
    correctiveActionRepo,
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
  const complaintService = new ComplaintService(authorizationService, projectRepo, complaintRepo);
  const auditService = new AuditService(authorizationService, auditRepo);
  const aiAnomalyService = new AiAnomalyService(authorizationService, aiAnomalyRepo);
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
  const reportJobs = new BullReportJobQueue(config.REDIS_URL);
  const reportService = new ReportService(
    authorizationService,
    inspectionService,
    reportRepo,
    reportJobs,
  );
  const userAdminRepo = new UserAdminRepository(db);
  const userAdminService = new UserAdminService(authorizationService, userAdminRepo);
  const cctvRepo = new CctvRepository(db);
  const cctvService = new CctvService(
    authorizationService,
    cctvRepo,
    config.NETRAM_CCTV_GATEWAY_URL,
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

  const analyticsRepo = new AnalyticsRepository(db);
  const analyticsService = new AnalyticsService(authorizationService, analyticsRepo);

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
    reportService,
    userAdminService,
    cctvService,
    cctvRepo,
    vcService,
    vcRepo,
    auditRepo,
    outboxRepo,
    attendanceService,
    analyticsService,
  };
}
