import { describe, expect, it, vi, beforeEach } from "vitest";
import { CctvStreamSweeper } from "./cctv-sweeper.worker.js";
import type { CctvRepository } from "@netram/data";
import type { SweepCandidate } from "../modules/cctv/application/ports/cctv-repository.js";

function candidate(overrides: Partial<SweepCandidate> = {}): SweepCandidate {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    sessionId: "stream-001",
    cameraId: "22222222-2222-3333-4444-555555555555",
    mediaPath: "facility-vani/cam-gate",
    reason: "token_expired",
    ...overrides,
  };
}

describe("CctvStreamSweeper", () => {
  let repo: CctvRepository;

  beforeEach(() => {
    repo = {
      findSweepCandidates: vi.fn().mockResolvedValue([]),
      endStreamSessionById: vi.fn().mockResolvedValue(true),
    } as unknown as CctvRepository;
  });

  it("sweeps nothing when there are no candidates", async () => {
    const sweeper = new CctvStreamSweeper({ databaseUrl: "postgres://unused", cctvRepo: repo });
    const summary = await sweeper.tick();

    expect(summary.swept).toBe(0);
    expect(repo.findSweepCandidates).toHaveBeenCalledOnce();
    expect(repo.endStreamSessionById).not.toHaveBeenCalled();
  });

  it("ends expired-token sessions with sweeper attribution and stream_ended events", async () => {
    (repo.findSweepCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([
      candidate({ reason: "token_expired" }),
    ]);

    const sweeper = new CctvStreamSweeper({ databaseUrl: "postgres://unused", cctvRepo: repo });
    const summary = await sweeper.tick();

    expect(summary.swept).toBe(1);
    expect(summary.byReason.token_expired).toBe(1);
    expect(repo.endStreamSessionById).toHaveBeenCalledWith(
      "11111111-2222-3333-4444-555555555555",
      expect.objectContaining({
        auditAction: "cctv.session_swept",
        eventType: "cctv.stream_ended",
        actorUserId: null,
      }),
      { endedBy: "sweeper", endReason: "token_expired" },
    );
  });

  it("ends heartbeat-stale sessions with the heartbeat_timeout reason", async () => {
    (repo.findSweepCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([
      candidate({ reason: "heartbeat_timeout" }),
    ]);

    const sweeper = new CctvStreamSweeper({ databaseUrl: "postgres://unused", cctvRepo: repo });
    const summary = await sweeper.tick();

    expect(summary.byReason.heartbeat_timeout).toBe(1);
    expect(repo.endStreamSessionById).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auditAction: "cctv.session_swept" }),
      { endedBy: "sweeper", endReason: "heartbeat_timeout" },
    );
  });

  it("continues past a session that fails to end (no abort of the batch)", async () => {
    (repo.findSweepCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([
      candidate({ id: "11111111-2222-3333-4444-555555555555" }),
      candidate({ id: "22222222-2222-3333-4444-555555555555", sessionId: "stream-002" }),
    ]);
    (repo.endStreamSessionById as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("db hiccup"))
      .mockResolvedValueOnce(true);

    const sweeper = new CctvStreamSweeper({ databaseUrl: "postgres://unused", cctvRepo: repo });
    const summary = await sweeper.tick();

    expect(summary.swept).toBe(1);
    expect(repo.endStreamSessionById).toHaveBeenCalledTimes(2);
  });

  it("is idempotent when a session was ended concurrently (already-ended rows return false)", async () => {
    (repo.findSweepCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([candidate()]);
    (repo.endStreamSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const sweeper = new CctvStreamSweeper({ databaseUrl: "postgres://unused", cctvRepo: repo });
    const summary = await sweeper.tick();

    expect(summary.swept).toBe(0);
  });
});
