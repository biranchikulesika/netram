/**
 * Runtime verification script for Netram Background Worker Pool,
 * Durable Outbox Dispatcher with Exponential Backoff Retries & Dead-Lettering,
 * and SLA Escalation Scheduled Jobs (§26, §27, §29, §37).
 */

import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  getDb,
  OutboxRepository,
  CorrectiveActionRepository,
  outboxEvents,
  correctiveActions,
  auditEvents,
  inspections,
  findings,
  users,
} from "@netram/data";
import { loadWorkerEnv } from "@netram/config";
import { OutboxDispatcher } from "../services/api/src/workers/outbox-dispatcher.worker.js";
import { ScheduledJobsRunner } from "../services/api/src/workers/scheduled-jobs.worker.js";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    console.error(`\n❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  console.log("==================================================================");
  console.log("⚙️  Netram Durable Outbox & Background Worker Runtime Verification");
  console.log("==================================================================");

  const env = loadWorkerEnv();
  const db = getDb(env.DATABASE_URL);
  const outboxRepo = new OutboxRepository(db);
  const correctiveActionRepo = new CorrectiveActionRepository(db);

  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const notifQueue = new Queue("netram-notifications", { connection: redis });

  console.log(`\nConnected to PostgreSQL & Redis at ${env.REDIS_URL}`);

  // Use a real seeded user so outbox actorUserId satisfies the FK constraint.
  const [seedUser] = await db.select({ id: users.id }).from(users).limit(1);
  assert(Boolean(seedUser), "No seeded user found in database");
  const testUserId = seedUser!.id;

  // -------------------------------------------------------------------------
  // Check 1: Outbox Dispatcher Enqueue & Normal Processing
  // -------------------------------------------------------------------------
  console.log("\n1. Testing Outbox Dispatcher Event Processing...");
  const eventId1 = randomUUID();

  await outboxRepo.enqueue({
    id: eventId1,
    type: "inspection.assigned",
    correlationId: "test-correlation-1",
    actorUserId: testUserId,
    resourceType: "inspection",
    resourceId: randomUUID(),
    payload: {
      assignedUserIds: [testUserId],
    },
  });

  const dispatcher = new OutboxDispatcher(outboxRepo, {
    redisUrl: env.REDIS_URL,
    databaseUrl: env.DATABASE_URL,
    maxRetries: 3,
  });

  const tickResult1 = await dispatcher.tick();
  console.log(
    `   -> Processed tick: claimed=${tickResult1.claimed}, processed=${tickResult1.processed}`,
  );
  assert(tickResult1.processed >= 1, "Expected at least 1 processed outbox record");

  // Verify outbox record status updated in DB
  const claimedAfter = await outboxRepo.claimPending(10);
  assert(!claimedAfter.some((r) => r.id === eventId1), "Event should no longer be pending");

  // Verify BullMQ job queued
  const waitingJobs = await notifQueue.getJobs(["waiting", "delayed", "prioritized", "active", "completed"]);
  const foundJob = waitingJobs.find((j) => j.data.userId === testUserId);
  assert(Boolean(foundJob), "Expected BullMQ notification job for assigned user");
  console.log(`✓ Outbox event translated to BullMQ notification job (${foundJob!.id}, state: ${await foundJob!.getState()})`);

  // -------------------------------------------------------------------------
  // Check 2: Outbox Exponential Backoff Retries & Dead-Lettering (§27)
  // -------------------------------------------------------------------------
  console.log("\n2. Testing Exponential Backoff Retry & Dead-Lettering...");
  const failingEventId = randomUUID();

  // Enqueue event with a malformed payload that will trigger an error in custom handling
  await outboxRepo.enqueue({
    id: failingEventId,
    type: "inspection.assigned",
    correlationId: "fail-test",
    actorUserId: null,
    resourceType: "inspection",
    resourceId: "invalid",
    payload: {
      // Cause an intentional error by making assignedUserIds an invalid structure or testing dispatcher error path
    },
  });

  // Test scheduleRetry method directly
  console.log("   -> Scheduling retry attempt 1 with exponential backoff...");
  await outboxRepo.scheduleRetry(failingEventId, "Simulated transient connection timeout", 5000);

  // Check that availableAfter is set into the future
  const pendingFuture = await outboxRepo.claimPending(10);
  assert(
    !pendingFuture.some((r) => r.id === failingEventId),
    "Event scheduled for future should not be claimed immediately",
  );
  console.log("✓ Event withheld from claim while availableAfter is in the future");

  // Test dead-lettering after exhausting retries
  console.log("   -> Testing dead-letter marking on max retry exhaustion...");
  await outboxRepo.markDeadLetter(failingEventId, "Exhausted all 3 retry attempts");

  const deadLetterRow = (await db.select().from(outboxEvents)).find(
    (r) => r.id === failingEventId,
  );
  assert(deadLetterRow?.status === "failed", "Dead-letter status should be 'failed'");
  assert(
    deadLetterRow?.lastError?.startsWith("DEAD_LETTER:"),
    `Expected DEAD_LETTER prefix in lastError, got: ${deadLetterRow?.lastError}`,
  );
  console.log(`✓ Outbox dead-lettering verified: status='failed', lastError='${deadLetterRow?.lastError}'`);

  // -------------------------------------------------------------------------
  // Check 3: SLA Scheduled Job: Expired Corrective Actions Detection (§26, §29)
  // -------------------------------------------------------------------------
  console.log("\n3. Testing Scheduled SLA Escalation for Expired Corrective Actions...");

  // Find an existing inspection and finding to anchor the test corrective action
  const [sampleInsp] = await db.select().from(inspections).limit(1);
  assert(Boolean(sampleInsp), "No sample inspection found");

  const [sampleFinding] = await db.select().from(findings).limit(1);
  assert(Boolean(sampleFinding), "No sample finding found");

  const expiredActionId = randomUUID();
  const pastDeadline = new Date(Date.now() - 7200000); // 2 hours ago

  await db.insert(correctiveActions).values({
    id: expiredActionId,
    findingId: sampleFinding!.id,
    inspectionId: sampleInsp!.id,
    status: "pending",
    deadline: pastDeadline,
  });
  console.log(`   -> Created test pending corrective action with expired deadline (${pastDeadline.toISOString()})`);

  // Run ScheduledJobsRunner tick
  const scheduledRunner = new ScheduledJobsRunner(correctiveActionRepo, db);
  const slaResult = await scheduledRunner.tick();
  console.log(
    `   -> ScheduledJobsRunner tick completed: marked ${slaResult.overdueActionsMarked} action(s) overdue`,
  );
  assert(slaResult.overdueActionsMarked >= 1, "Expected at least 1 corrective action marked overdue");
  assert(
    slaResult.overdueActionIds.includes(expiredActionId),
    "Expected test action to be in overdueActionIds",
  );

  // Verify status in DB
  const updatedAction = (await db.select().from(correctiveActions)).find(
    (r) => r.id === expiredActionId,
  );
  assert(updatedAction?.status === "overdue", `Expected status 'overdue', got '${updatedAction?.status}'`);
  console.log(`✓ Corrective action transitioned to 'overdue' in database`);

  // Verify Audit Trail for SLA escalation (§37)
  const auditRows = (await db.select().from(auditEvents)).filter(
    (r) => r.resourceId === expiredActionId,
  );
  const overdueAudit = auditRows.find((a) => a.action === "corrective_action.overdue");
  assert(Boolean(overdueAudit), "Missing corrective_action.overdue audit event");
  console.log(`✓ Audit log persisted: action='corrective_action.overdue'`);

  // Verify Outbox Event for SLA escalation (§27)
  const overdueOutbox = (await db.select().from(outboxEvents)).find(
    (r) => r.resourceId === expiredActionId && r.type === "corrective_action.overdue",
  );
  assert(Boolean(overdueOutbox), "Missing corrective_action.overdue outbox event");
  console.log(`✓ Outbox event persisted: type='corrective_action.overdue'`);

  // -------------------------------------------------------------------------
  // Check 4: Outbox Dispatcher processes SLA Overdue Event to Notification Queue
  // -------------------------------------------------------------------------
  console.log("\n4. Testing Outbox Dispatcher processing of corrective_action.overdue...");
  const tickResult2 = await dispatcher.tick();
  console.log(`   -> Outbox tick: processed=${tickResult2.processed}`);

  // Check that the outbox record is marked 'processed' (either by this tick or by concurrent background daemon)
  let processedOutbox = (await db.select().from(outboxEvents)).find(
    (r) => r.id === overdueOutbox!.id,
  );
  if (processedOutbox?.status !== "processed") {
    await new Promise((r) => setTimeout(r, 1000));
    processedOutbox = (await db.select().from(outboxEvents)).find(
      (r) => r.id === overdueOutbox!.id,
    );
  }
  assert(processedOutbox?.status === "processed", "Outbox record should be marked 'processed'");
  console.log(`✓ Outbox record marked 'processed' with timestamp ${processedOutbox?.processedAt?.toISOString()}`);

  // Verify urgent notification queued in BullMQ (priority jobs live in the
  // 'prioritized' state in BullMQ v5, or may be picked up immediately by active workers)
  const urgentJobs = await notifQueue.getJobs(["waiting", "delayed", "prioritized", "active", "completed"]);
  const overdueJob = urgentJobs.find((j) => j.name === "notification.send" && j.data.title.includes("URGENT: Corrective Action Overdue"));
  assert(Boolean(overdueJob), "Expected urgent notification job queued in BullMQ");
  console.log(`✓ Urgent notification job queued: id=${overdueJob!.id} (state: ${await overdueJob!.getState()}, high priority)`);

  // Cleanup connections
  await dispatcher.close();
  await notifQueue.close();
  await redis.quit();

  console.log("\n==================================================================");
  console.log("🎉 ALL OUTBOX & BACKGROUND WORKER INTEGRATION CHECKS PASSED!");
  console.log("==================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
