import { loadWorkerEnv } from "@netram/config";
import {
  getDb,
  ProjectRepository,
  InspectionRepository,
  FundRepository,
  ExpenseRepository,
  FinancialDocumentRepository,
  FinancialRiskRepository,
  InspectionFlagRepository,
  FindingRepository,
  CorrectiveActionRepository,
  AttendanceRepository,
  ComplaintRepository,
  AiAnomalyRepository,
  ProjectRiskRepository,
  AuditRepository,
  OutboxRepository,
} from "@netram/data";
import { AuthorizationService } from "../modules/authorization/application/authorization-service.js";
import { FinancialRiskService } from "../modules/financial-risk/application/financial-risk-service.js";
import { InspectionService } from "../modules/inspections/application/inspection-service.js";
import { ProjectRiskService } from "../modules/project-risk/application/project-risk-service.js";
import { ProjectRiskContextBuilder } from "../modules/project-risk/application/project-risk-context-builder.js";
import { CompositeRiskScorer } from "../modules/project-risk/domain/composite-risk-scorer.js";
import { InspectionScheduler } from "../modules/project-risk/application/inspection-scheduler.js";
import { startNotificationWorker } from "./notification.worker.js";
import { startOutboxDispatcherWorker } from "./outbox-dispatcher.worker.js";
import { startScheduledJobsWorker } from "./scheduled-jobs.worker.js";
import { startCctvSweeperWorker } from "./cctv-sweeper.worker.js";
import { startAttendanceExportWorker } from "./attendance-export.worker.js";

export function buildFinancialRiskSweep(databaseUrl: string): FinancialRiskService {
  const db = getDb(databaseUrl);
  const authz = new AuthorizationService();
  // The worker only evaluates financial risk; it never launches inspections from flags.
  const noInspectionService = {
    createInspection: async () => {
      throw new Error("createInspection is not available in the worker pool");
    },
  };
  return new FinancialRiskService(
    authz,
    new ProjectRepository(db),
    new InspectionRepository(db),
    noInspectionService,
    new FundRepository(db),
    new ExpenseRepository(db),
    new FinancialDocumentRepository(db),
    new FinancialRiskRepository(db),
    new InspectionFlagRepository(db),
  );
}

export function buildProjectRiskSweep(
  databaseUrl: string,
  financialRiskService: FinancialRiskService,
): ProjectRiskService {
  const db = getDb(databaseUrl);
  const authz = new AuthorizationService();
  const projectRepo = new ProjectRepository(db);
  const inspectionRepo = new InspectionRepository(db);
  const flagRepo = new InspectionFlagRepository(db);
  const projectRiskRepo = new ProjectRiskRepository(db);

  const contextBuilder = new ProjectRiskContextBuilder(
    projectRepo,
    inspectionRepo,
    new FindingRepository(db),
    new CorrectiveActionRepository(db),
    new AttendanceRepository(db),
    new ComplaintRepository(db),
    new AiAnomalyRepository(db),
    new FinancialRiskRepository(db),
    new FundRepository(db),
    new ExpenseRepository(db),
    financialRiskService,
  );
  const inspectionService = new InspectionService(
    authz,
    projectRepo,
    inspectionRepo,
    new OutboxRepository(db),
  );
  const scheduler = new InspectionScheduler(projectRiskRepo, flagRepo, inspectionService);

  return new ProjectRiskService(
    authz,
    contextBuilder,
    new CompositeRiskScorer(),
    scheduler,
    projectRiskRepo,
    new AuditRepository(db),
  );
}

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log("==================================================================");
  console.log("🚀 Starting Netram Background Worker Pool");
  console.log(`   Redis:    ${env.REDIS_URL}`);
  console.log(`   Database: ${env.DATABASE_URL.replace(/:\/\/.*@/, "://***@")}`);
  console.log("==================================================================");

  const closers: Array<() => Promise<void>> = [];

  try {
    // 1. Notification Worker (BullMQ: netram-notifications)
    console.log("[workers] Initializing Notification Worker...");
    const notifWorker = await startNotificationWorker({
      redisUrl: env.REDIS_URL,
      databaseUrl: env.DATABASE_URL,
      smtpUrl: env.NETRAM_SMTP_URL,
      nodeEnv: env.NODE_ENV,
    });
    closers.push(notifWorker.close);
    console.log("✓ Notification Worker online");

    // 2. Durable Outbox Dispatcher (Polls DB -> BullMQ with exponential backoff)
    console.log("[workers] Initializing Durable Outbox Dispatcher...");
    const outboxDispatcher = await startOutboxDispatcherWorker({
      redisUrl: env.REDIS_URL,
      databaseUrl: env.DATABASE_URL,
      pollIntervalMs: 1000,
    });
    closers.push(outboxDispatcher.close);
    console.log("✓ Outbox Dispatcher online");

    // 3. Scheduled Jobs Runner (SLA evaluation & hourly risk engine sweeps)
    console.log("[workers] Initializing Scheduled Jobs Runner...");
    const financialRiskService = buildFinancialRiskSweep(env.DATABASE_URL);
    const scheduledJobs = await startScheduledJobsWorker({
      databaseUrl: env.DATABASE_URL,
      intervalMs: 5000,
      projectRiskService: buildProjectRiskSweep(env.DATABASE_URL, financialRiskService),
      financialRiskService,
    });
    closers.push(scheduledJobs.close);
    console.log("✓ Scheduled Jobs Runner online");

    // 4. CCTV Stream Session Sweeper (Phase 4 session lifecycle)
    console.log("[workers] Initializing CCTV Stream Session Sweeper...");
    const cctvSweeper = await startCctvSweeperWorker({
      databaseUrl: env.DATABASE_URL,
      gatewayUrl: env.NETRAM_CCTV_GATEWAY_URL,
      gatewayServiceSecret: env.NETRAM_CCTV_SERVICE_SECRET,
    });
    closers.push(cctvSweeper.close);
    console.log("✓ CCTV Stream Session Sweeper online");

    // 5. Attendance Export Worker (Background CSV generation)
    console.log("[workers] Initializing Attendance Export Worker...");
    const attendanceExportWorker = await startAttendanceExportWorker({
      redisUrl: env.REDIS_URL,
      databaseUrl: env.DATABASE_URL,
    });
    closers.push(attendanceExportWorker.close);
    console.log("✓ Attendance Export Worker online");

    console.log("\n⚡ Netram Worker Pool successfully running with all 5 workers active.");

    const shutdown = async (signal: string) => {
      console.log(`\n[workers] Received ${signal}. Gracefully stopping worker pool...`);
      for (const close of closers) {
        try {
          await close();
        } catch (err) {
          console.error("[workers] Error during shutdown:", err);
        }
      }
      console.log("[workers] All workers shut down cleanly.");
      process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start worker pool:", err);
    process.exit(1);
  }
}

void main();
