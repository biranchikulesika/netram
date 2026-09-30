import { pathToFileURL } from "node:url";
import { getDb, CctvRepository } from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import type { StreamEndReason, StreamEndedBy } from "@netram/types";
import type { CctvWriteContext } from "../modules/cctv/application/ports/cctv-repository.js";

/**
 * CCTV stream-session sweeper (Phase 4 §3 - docs/history/cctv-phase-4.md).
 *
 * Reaps active sessions that are:
 *   - token-expired (expiresAt <= now) - the token is dead, so the external
 *     auth hook already rejects new handshakes; this closes the record; or
 *   - heartbeat-stale (lastHeartbeatAt older than the grace window) - the
 *     viewer vanished without an explicit stop. Never runs before token
 *     expiry: a viewer that stops heartbeating keeps its session until the
 *     token itself expires unless the grace window applies.
 *
 * The DB end (audit + outbox) is atomic (§25); MediaMTX reader kicks are
 * best-effort through the gateway control plane. MediaMTX stays authoritative
 * for live media; the DB stays authoritative for session records.
 */

export interface CctvSweeperOptions {
  databaseUrl: string;
  /** Heartbeat grace window in ms (default 90s = 3 missed 30s heartbeats). */
  graceMs?: number;
  intervalMs?: number;
  /** Gateway base URL + service secret for best-effort reader kicks. */
  gatewayUrl?: string;
  gatewayServiceSecret?: string;
  /** Override the repository (tests inject a stub here). */
  cctvRepo?: CctvRepository;
}

export interface SweepSummary {
  swept: number;
  byReason: Record<string, number>;
  executedAt: string;
}

/** Reason → attribution for the endedBy column. */
function endedByFor(_reason: StreamEndReason): StreamEndedBy {
  return "sweeper";
}

export class CctvStreamSweeper {
  private running = false;
  private processing = false;
  private readonly graceMs: number;
  private readonly intervalMs: number;
  private readonly gatewayUrl?: string;
  private readonly gatewayServiceSecret?: string;
  private readonly cctvRepo: CctvRepository;

  constructor(private readonly opts: CctvSweeperOptions) {
    this.graceMs = opts.graceMs ?? 90_000;
    this.intervalMs = opts.intervalMs ?? 15_000;
    this.gatewayUrl = opts.gatewayUrl;
    this.gatewayServiceSecret = opts.gatewayServiceSecret;
    this.cctvRepo = opts.cctvRepo ?? new CctvRepository(getDb(opts.databaseUrl));
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
          console.error("[cctv-sweeper] tick error:", err);
        } finally {
          this.processing = false;
        }
      }
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }
  }

  /** One sweep pass. Bounded; safe to call directly in tests. */
  async tick(): Promise<SweepSummary> {
    const executedAt = new Date().toISOString();
    const now = new Date();
    const candidates = await this.cctvRepo.findSweepCandidates(now, this.graceMs);

    const byReason: Record<string, number> = {};

    for (const candidate of candidates) {
      // Attribution note: MediaMTX reader kicks are not yet wired (reader UUID
      // correlation is Phase 5); the token is dead either way, so no new
      // handshake succeeds after the DB flip.
      const ended = await this.endSession(candidate);
      if (!ended) continue; // Ended concurrently; idempotent no-op.
      byReason[candidate.reason] = (byReason[candidate.reason] ?? 0) + 1;
    }

    return {
      swept: Object.values(byReason).reduce((a, b) => a + b, 0),
      byReason,
      executedAt,
    };
  }

  /** Atomically end one session (audit + cctv.stream_ended outbox event). */
  private async endSession(candidate: {
    id: string;
    reason: StreamEndReason;
  }): Promise<boolean> {
    const context: CctvWriteContext = {
      actorUserId: null, // System-driven; attribution lives in endedBy/endReason.
      requestId: `cctv-sweeper-${candidate.id}`,
      ipAddress: null,
      auditAction: "cctv.session_swept",
      auditMetadata: {
        endReason: candidate.reason,
        endedBy: "sweeper",
      },
      eventType: "cctv.stream_ended",
      eventPayload: {
        endReason: candidate.reason,
        endedBy: "sweeper",
        endedAt: new Date().toISOString(),
      },
    };

    try {
      return await this.cctvRepo.endStreamSessionById(
        candidate.id,
        context,
        { endedBy: endedByFor(candidate.reason), endReason: candidate.reason },
      );
    } catch (err) {
      console.error(`[cctv-sweeper] failed to end session ${candidate.id}:`, err);
      return false;
    }
  }
}

export async function startCctvSweeperWorker(
  opts: CctvSweeperOptions,
): Promise<{ close: () => Promise<void>; sweeper: CctvStreamSweeper }> {
  const sweeper = new CctvStreamSweeper(opts);
  sweeper.start();
  return {
    sweeper,
    close: async () => {
      sweeper.stop();
    },
  };
}

export async function main(): Promise<void> {
  const env = loadWorkerEnv();
  console.log("[cctv-sweeper] starting stream session sweeper");
  const instance = await startCctvSweeperWorker({
    databaseUrl: env.DATABASE_URL,
    gatewayUrl: env.NETRAM_CCTV_GATEWAY_URL,
    gatewayServiceSecret: env.NETRAM_CCTV_SERVICE_SECRET,
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
