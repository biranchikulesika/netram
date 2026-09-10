import { pathToFileURL } from "node:url";
import { getDb, CorrectiveActionRepository, auditEvents } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";

export interface ScheduledJobsOptions {
  databaseUrl: string;
  intervalMs?: number;
}

export interface ScheduledJobsSummary {
  overdueActionsMarked: number;
  overdueActionIds: string[];
  executedAt: string;
}

export class ScheduledJobsRunner {
  private running = false;
  private processing = false;
  private readonly intervalMs: number;

  constructor(
    private readonly correctiveActionRepo: CorrectiveActionRepository,
    private readonly db: ReturnType<typeof getDb>,
    opts?: { intervalMs?: number },
  ) {
    this.intervalMs = opts?.intervalMs ?? 5000;
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

    return {
      overdueActionsMarked: overdueResult.count,
      overdueActionIds: overdueResult.actionIds,
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
