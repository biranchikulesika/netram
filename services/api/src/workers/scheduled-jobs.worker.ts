import { pathToFileURL } from "node:url";
import { getDb, CorrectiveActionRepository, auditEvents } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import type { ProjectRiskService } from "../modules/project-risk/application/project-risk-service.js";
import type { FinancialRiskService } from "../modules/financial-risk/application/financial-risk-service.js";
import type { RequestUserContext } from "../infrastructure/request-context.js";

export interface ScheduledJobsOptions {
  databaseUrl: string;
  intervalMs?: number;
  projectRiskService?: Pick<ProjectRiskService, "sweepAllActiveProjects">;
  financialRiskService?: Pick<FinancialRiskService, "sweepAllActiveProjects">;
  projectRiskSweepIntervalMs?: number;
  financialRiskSweepIntervalMs?: number;
}

export interface ScheduledJobsSummary {
  overdueActionsMarked: number;
  overdueActionIds: string[];
  projectRiskSweep?: {
    evaluatedCount: number;
    scheduledCount: number;
    failedCount: number;
    failedProjectIds: string[];
  };
  financialRiskSweep?: { evaluatedCount: number };
  executedAt: string;
}

export function createWorkerSystemContext(): RequestUserContext {
  return {
    user: {
      id: "00000000-0000-0000-0000-000000000000",
      email: "system@netram.internal",
      displayName: "System Scheduled Worker",
      type: "netram",
    },
    userId: "00000000-0000-0000-0000-000000000000",
    assignments: [
      {
        assignmentId: "system-scheduled-worker",
        roleCode: "system",
        authorityId: null,
        jurisdictionId: null,
        scope: "national",
        permissions: new Set(["*"]),
        allowedDistrictIds: null,
      },
    ],
    permissions: new Set(["*"]),
    requestId: "scheduled-job-runner",
    ipAddress: "127.0.0.1",
  };
}

export class ScheduledJobsRunner {
  private running = false;
  private processing = false;
  private readonly intervalMs: number;
  private readonly projectRiskService?: Pick<ProjectRiskService, "sweepAllActiveProjects">;
  private readonly financialRiskService?: Pick<FinancialRiskService, "sweepAllActiveProjects">;
  private readonly projectRiskSweepIntervalMs: number;
  private readonly financialRiskSweepIntervalMs: number;
  private lastProjectRiskSweepAt = 0;
  private lastFinancialRiskSweepAt = 0;

  constructor(
    private readonly correctiveActionRepo: CorrectiveActionRepository,
    private readonly db: ReturnType<typeof getDb>,
    opts?: {
      intervalMs?: number;
      projectRiskService?: Pick<ProjectRiskService, "sweepAllActiveProjects">;
      financialRiskService?: Pick<FinancialRiskService, "sweepAllActiveProjects">;
      projectRiskSweepIntervalMs?: number;
      financialRiskSweepIntervalMs?: number;
    },
  ) {
    this.intervalMs = opts?.intervalMs ?? 5000;
    this.projectRiskService = opts?.projectRiskService;
    this.financialRiskService = opts?.financialRiskService;
    this.projectRiskSweepIntervalMs = opts?.projectRiskSweepIntervalMs ?? 60 * 60 * 1000;
    this.financialRiskSweepIntervalMs = opts?.financialRiskSweepIntervalMs ?? 60 * 60 * 1000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      if (!this.processing) {
        this.processing = true;
        try {
          await this.tick();
        } catch (err) {
          console.error("[scheduled-jobs] tick error:", err);
        } finally {
          this.processing = false;
        }
      }
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }
  }

  /**
   * Executes scheduled background SLA & maintenance checks (§26, §29).
   * Can be called directly for programmatic or test execution.
   */
  async tick(): Promise<ScheduledJobsSummary> {
    const executedAt = new Date().toISOString();

    // 1. SLA Check: Mark overdue corrective actions
    const overdueResult = await this.correctiveActionRepo.markOverdueActions();

    if (overdueResult.count > 0) {
      console.log(
        `[scheduled-jobs] SLA Escalation: Marked ${overdueResult.count} corrective action(s) as overdue: ${overdueResult.actionIds.join(", ")}`,
      );

      // Record audit event for scheduled job execution
      try {
        await this.db.insert(auditEvents).values({
          action: "scheduled_job.executed",
          actorUserId: null,
          resourceType: "scheduled_job",
          resourceId: "sla-corrective-actions-overdue",
          requestId: null,
          ipAddress: null,
          metadata: {
            jobName: "evaluate_overdue_corrective_actions",
            overdueCount: overdueResult.count,
            actionIds: overdueResult.actionIds,
            executedAt,
          },
        });
      } catch (auditErr) {
        console.warn("[scheduled-jobs] Failed to record audit log for scheduled job:", auditErr);
      }
    }

    // 2. Risk Engine Sweep: Automatically evaluate active projects and trigger inspections
    let projectRiskSweep:
      | {
          evaluatedCount: number;
          scheduledCount: number;
          failedCount: number;
          failedProjectIds: string[];
        }
      | undefined;
    const now = Date.now();
    if (
      this.projectRiskService &&
      now - this.lastProjectRiskSweepAt >= this.projectRiskSweepIntervalMs
    ) {
      try {
        const sysCtx = createWorkerSystemContext();
        projectRiskSweep = await this.projectRiskService.sweepAllActiveProjects(sysCtx);
        this.lastProjectRiskSweepAt = now;
        if (projectRiskSweep.evaluatedCount > 0) {
          console.log(
            `[scheduled-jobs] Project Risk Sweep: Evaluated ${projectRiskSweep.evaluatedCount} project(s), auto-scheduled ${projectRiskSweep.scheduledCount} inspection(s)`,
          );
        }
      } catch (riskErr) {
        console.warn("[scheduled-jobs] Error during project risk sweep:", riskErr);
      }
    }

    // 3. Financial Risk Engine Sweep: evaluate the 13-rule discrepancy engine across all active projects
    let financialRiskSweep: { evaluatedCount: number } | undefined;
    if (
      this.financialRiskService &&
      now - this.lastFinancialRiskSweepAt >= this.financialRiskSweepIntervalMs
    ) {
      try {
        const sysCtx = createWorkerSystemContext();
        financialRiskSweep = await this.financialRiskService.sweepAllActiveProjects(sysCtx);
        this.lastFinancialRiskSweepAt = now;
        if (financialRiskSweep.evaluatedCount > 0) {
          console.log(
            `[scheduled-jobs] Financial Risk Sweep: Evaluated ${financialRiskSweep.evaluatedCount} project(s) for financial discrepancies`,
          );
        }
      } catch (riskErr) {
        console.warn("[scheduled-jobs] Error during financial risk sweep:", riskErr);
      }
    }

    return {
      overdueActionsMarked: overdueResult.count,
      overdueActionIds: overdueResult.actionIds,
      projectRiskSweep,
      financialRiskSweep,
      executedAt,
    };
  }
}

export async function startScheduledJobsWorker(
  opts: ScheduledJobsOptions,
): Promise<{ close: () => Promise<void>; runner: ScheduledJobsRunner }> {
  const db = getDb(opts.databaseUrl);
  const correctiveActionRepo = new CorrectiveActionRepository(db);
  const runner = new ScheduledJobsRunner(correctiveActionRepo, db, {
    intervalMs: opts.intervalMs,
    projectRiskService: opts.projectRiskService,
    financialRiskService: opts.financialRiskService,
    projectRiskSweepIntervalMs: opts.projectRiskSweepIntervalMs,
    financialRiskSweepIntervalMs: opts.financialRiskSweepIntervalMs,
  });
  runner.start();
  return {
    runner,
    close: async () => {
      runner.stop();
    },
  };
}

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log(`[scheduled-jobs] starting SLA job runner`);
  const instance = await startScheduledJobsWorker({
    databaseUrl: env.DATABASE_URL,
  });
  const shutdown = async () => {
    await instance.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

// Run standalone without self-starting when imported by run-workers.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
