import { pathToFileURL } from "node:url";
import {
  getDb,
  CorrectiveActionRepository,
  InspectionRepository,
  auditEvents,
} from "@netram/data";
import { loadWorkerEnv } from "@netram/config";

export interface ScheduledJobsOptions {
  databaseUrl: string;
  intervalMs?: number;
}

export interface ScheduledJobsSummary {
  overdueActionsMarked: number;
  overdueActionIds: string[];
  overdueInspectionsMarked: number;
  overdueInspectionIds: string[];
  executedAt: string;
}

export class ScheduledJobsRunner {
  private running = false;
  private processing = false;
  private readonly intervalMs: number;

  private readonly correctiveActionRepo: CorrectiveActionRepository;
  private readonly inspectionRepo: InspectionRepository;
  private readonly db: ReturnType<typeof getDb>;

  constructor(
    correctiveActionRepo: CorrectiveActionRepository,
    inspectionRepoOrDb: InspectionRepository | ReturnType<typeof getDb>,
    dbOrOpts?: ReturnType<typeof getDb> | { intervalMs?: number },
    opts?: { intervalMs?: number },
  ) {
    this.correctiveActionRepo = correctiveActionRepo;
    if (dbOrOpts && typeof (dbOrOpts as Record<string, unknown>).insert === "function") {
      this.inspectionRepo = inspectionRepoOrDb as InspectionRepository;
      this.db = dbOrOpts as ReturnType<typeof getDb>;
      this.intervalMs = opts?.intervalMs ?? 5000;
    } else {
      this.db = inspectionRepoOrDb as ReturnType<typeof getDb>;
      this.inspectionRepo = new InspectionRepository(this.db);
      this.intervalMs = (dbOrOpts as { intervalMs?: number } | undefined)?.intervalMs ?? 5000;
    }
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
   * 1. Mark corrective actions past their deadline as 'overdue'.
   * 2. Detect inspections past their scheduledEnd and emit InspectionOverdue events.
   * Can be called directly for programmatic or test execution.
   */
  async tick(): Promise<ScheduledJobsSummary> {
    const executedAt = new Date().toISOString();

    // 1. SLA Check: Mark overdue corrective actions
    const overdueCAResult = await this.correctiveActionRepo.markOverdueActions();

    if (overdueCAResult.count > 0) {
      console.log(
        `[scheduled-jobs] SLA Escalation: Marked ${overdueCAResult.count} corrective action(s) as overdue: ${overdueCAResult.actionIds.join(", ")}`,
      );

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
            overdueCount: overdueCAResult.count,
            actionIds: overdueCAResult.actionIds,
            executedAt,
          },
        });
      } catch (auditErr) {
        console.warn("[scheduled-jobs] Failed to record audit log for CA overdue job:", auditErr);
      }
    }

    // 2. SLA Check: Detect overdue inspections and emit domain events
    const overdueInspResult = await this.inspectionRepo.markOverdueInspections();

    if (overdueInspResult.count > 0) {
      console.log(
        `[scheduled-jobs] SLA Escalation: Detected ${overdueInspResult.count} overdue inspection(s): ${overdueInspResult.inspectionIds.join(", ")}`,
      );

      try {
        await this.db.insert(auditEvents).values({
          action: "scheduled_job.executed",
          actorUserId: null,
          resourceType: "scheduled_job",
          resourceId: "sla-inspections-overdue",
          requestId: null,
          ipAddress: null,
          metadata: {
            jobName: "evaluate_overdue_inspections",
            overdueCount: overdueInspResult.count,
            inspectionIds: overdueInspResult.inspectionIds,
            executedAt,
          },
        });
      } catch (auditErr) {
        console.warn(
          "[scheduled-jobs] Failed to record audit log for inspection overdue job:",
          auditErr,
        );
      }
    }

    return {
      overdueActionsMarked: overdueCAResult.count,
      overdueActionIds: overdueCAResult.actionIds,
      overdueInspectionsMarked: overdueInspResult.count,
      overdueInspectionIds: overdueInspResult.inspectionIds,
      executedAt,
    };
  }
}

export async function startScheduledJobsWorker(
  opts: ScheduledJobsOptions,
): Promise<{ close: () => Promise<void>; runner: ScheduledJobsRunner }> {
  const db = getDb(opts.databaseUrl);
  const correctiveActionRepo = new CorrectiveActionRepository(db);
  const inspectionRepo = new InspectionRepository(db);
  const runner = new ScheduledJobsRunner(correctiveActionRepo, inspectionRepo, db, {
    intervalMs: opts.intervalMs,
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
