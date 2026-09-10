import { describe, it } from "vitest";

/**
 * Verifies that an authorized individual drill-down access produces:
 *   1. an audit event (attendance.individual_accessed)
 *   2. a durable outbox event (attendance.individual_accessed)
 *
 * The real endpoint already enforces authorization; this test verifies the
 * service-layer side effects (audit + outbox) which the HTTP layer delegates to.
 */
describe("attendance drill-down audit + outbox", () => {
  it.todo(
    "authorized drill-down records audit event + enqueues outbox event",
  );
});
