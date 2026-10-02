import { createHash } from "node:crypto";
import { NetramApiClient } from "@netram/api-client";
import { loadServerEnv } from "@netram/config";
import type { SyncBatchRequest } from "@netram/types";
import { OfflineInspectionQueue } from "../apps/inspector-mobile/src/offline/queue.js";
import { captureEvidenceOffline } from "../apps/inspector-mobile/src/offline/evidence.js";

const env = loadServerEnv();
const API_URL = env.NETRAM_API_URL || "http://localhost:3001";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  console.log("==================================================================");
  console.log("📱 Netram Inspector Mobile: Offline & Idempotent Sync Verification");
  console.log("==================================================================");

  // 1. Authenticate as assigned inspector (inspector.one)
  console.log("\n1. Authenticating as assigned inspector: inspector@netram.dev...");
  let currentToken: string | null = null;
  const client = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => currentToken,
  });

  const inspectorLogin = await client.devLogin("inspector@netram.dev");
  currentToken = inspectorLogin.token;
  console.log(`✓ Logged in as ${inspectorLogin.user.displayName} (id: ${inspectorLogin.user.id})`);

  // 2. Fetch assigned inspections
  console.log("\n2. Fetching assigned inspections from server...");
  const inspections = await client.listInspections();
  assert(inspections.items.length > 0, "No inspections found for inspector.one");

  // Find the assigned inspection (Rajdhani Boys' Hostel)
  const targetInspection = inspections.items.find(
    (i) => i.status === "assigned" && i.assignedUserIds.includes(inspectorLogin.user.id),
  );
  assert(
    Boolean(targetInspection),
    "Could not find an 'assigned' status inspection assigned to inspector.one",
  );
  console.log(
    `✓ Found assigned inspection: ${targetInspection!.id} (${targetInspection!.projectName}, code: ${targetInspection!.projectCode})`,
  );

  // 3. Initialize Inspector Mobile local SQLite queue and cache
  console.log("\n3. Initializing Inspector Mobile local SQLite queue and caching inspection...");
  const queue = new OfflineInspectionQueue();
  await queue.cacheInspections([targetInspection!]);
  const cached = await queue.getCachedInspection(targetInspection!.id);
  assert(Boolean(cached), "Inspection was not cached in local SQLite database");
  assert(
    cached!.status === "assigned",
    `Expected cached status 'assigned', got '${cached!.status}'`,
  );
  console.log("✓ Inspection cached locally in SQLite database");

  // 4. Simulate OFFLINE Field Operations (device has zero network connectivity)
  console.log("\n4. Simulating OFFLINE field operations (device disconnected from network)...");

  // 4a. Start inspection offline
  console.log("  a) Starting inspection offline...");
  const opStart = await queue.enqueueOperation(targetInspection!.id, "start_inspection", {});
  console.log(`     -> Enqueued operation ${opStart.operationId} (type: ${opStart.type})`);
  const cachedAfterStart = await queue.getCachedInspection(targetInspection!.id);
  assert(
    cachedAfterStart?.status === "in_progress",
    `Expected optimistic local status 'in_progress', got '${cachedAfterStart?.status}'`,
  );

  // 4b. Record field observation offline
  console.log("  b) Recording field observation offline...");
  const opObs = await queue.enqueueOperation(targetInspection!.id, "record_observation", {
    text: "Field observation: Fire extinguishers verified in wing B, fully charged.",
  });
  console.log(`     -> Enqueued operation ${opObs.operationId} (type: ${opObs.type})`);

  // 4c. Capture evidence offline with capture-time SHA-256 hash (§30, §31)
  console.log("  c) Capturing photographic evidence offline with SHA-256 hashing...");
  const mediaBytes = Buffer.from("NETRAM-OFFLINE-INSPECTION-PHOTO-SAMPLE-BYTES-2026-09-09");
  const expectedHash = `sha256:${createHash("sha256").update(mediaBytes).digest("hex")}`;

  const evidenceResult = await captureEvidenceOffline(queue, {
    inspectionId: targetInspection!.id,
    evidenceType: "photo",
    fileName: "fire-extinguishers-wing-b.jpg",
    mimeType: "image/jpeg",
    fileBytes: mediaBytes,
    latitude: 20.2961,
    longitude: 85.8245,
  });
  console.log(`     -> Captured evidence ID: ${evidenceResult.evidenceId}`);
  console.log(`     -> Capture-time hash: ${evidenceResult.contentHash}`);
  assert(
    evidenceResult.contentHash === expectedHash,
    `Hash mismatch: expected ${expectedHash}, got ${evidenceResult.contentHash}`,
  );

  // 4d. Submit inspection offline
  console.log("  d) Submitting inspection offline...");
  const opSubmit = await queue.enqueueOperation(targetInspection!.id, "submit_inspection", {
    notes: "Completed routine inspection of hostel facilities.",
  });
  console.log(`     -> Enqueued operation ${opSubmit.operationId} (type: ${opSubmit.type})`);
  const cachedAfterSubmit = await queue.getCachedInspection(targetInspection!.id);
  assert(
    cachedAfterSubmit?.status === "submitted",
    `Expected optimistic local status 'submitted', got '${cachedAfterSubmit?.status}'`,
  );

  // Verify pending local operations count
  const pendingOps = await queue.getPendingOperations(targetInspection!.id);
  assert(pendingOps.length === 4, `Expected 4 pending operations, found ${pendingOps.length}`);
  console.log(`✓ 4 field operations locally enqueued with client UUIDs in strict FIFO sequence`);

  // 5. Device reconnects to network and triggers sync against /api/v1/inspections/sync
  console.log(
    "\n5. Device reconnects: Synchronizing pending batch via POST /api/v1/inspections/sync...",
  );
  const syncResponse = await queue.syncPendingOperations(client);
  console.log(
    `✓ Server returned sync response with ${syncResponse.results.length} processed operations:`,
  );
  for (const res of syncResponse.results) {
    console.log(`   - Op ${res.operationId} (${res.type}): status=${res.status}, code=${res.code}`);
    assert(
      res.status === "accepted",
      `Expected op ${res.operationId} to be accepted, got ${res.status}`,
    );
  }

  // Verify all operations updated in local SQLite queue
  const pendingAfterSync = await queue.getPendingOperations(targetInspection!.id);
  assert(
    pendingAfterSync.length === 0,
    `Expected 0 pending operations after sync, got ${pendingAfterSync.length}`,
  );
  const allOps = await queue.getAllOperations(targetInspection!.id);
  assert(
    allOps.every((o) => o.status === "accepted"),
    "Not all operations marked 'accepted' locally",
  );
  console.log("✓ Local queue reconciled: all 4 operations marked 'accepted'");

  // 6. Verify Authoritative Server State
  console.log("\n6. Verifying Authoritative Server State...");
  const serverInspection = await client.getInspection(targetInspection!.id);
  console.log(`   - Server inspection status: ${serverInspection.status}`);
  assert(
    serverInspection.status === "submitted",
    `Expected server status 'submitted', got '${serverInspection.status}'`,
  );
  assert(serverInspection.startedAt !== null, "startedAt was not recorded on server");
  assert(serverInspection.submittedAt !== null, "submittedAt was not recorded on server");

  // Verify observations on server
  const serverObservations = await client.listObservations(targetInspection!.id);
  console.log(`   - Server observations count: ${serverObservations.length}`);
  const foundObs = serverObservations.find((o) => o.text.includes("Fire extinguishers verified"));
  assert(Boolean(foundObs), "Field observation not found on server");
  assert(
    foundObs!.userId === inspectorLogin.user.id,
    `Expected observation author ${inspectorLogin.user.id}, got ${foundObs!.userId}`,
  );
  console.log(`✓ Authoritative observation persisted correctly on server`);

  // Verify evidence metadata on server
  const serverEvidence = await client.listEvidence(targetInspection!.id);
  console.log(`   - Server evidence count: ${serverEvidence.length}`);
  const foundEvidence = serverEvidence.find((e) => e.id === evidenceResult.evidenceId);
  assert(Boolean(foundEvidence), "Captured evidence metadata not found on server");
  assert(
    foundEvidence!.contentHash === expectedHash,
    `Evidence contentHash mismatch: expected ${expectedHash}, got ${foundEvidence!.contentHash}`,
  );
  assert(
    foundEvidence!.uploadState === "pending",
    `Expected evidence uploadState=pending, got ${foundEvidence!.uploadState}`,
  );
  console.log(`✓ Authoritative evidence metadata persisted with matching SHA-256 hash`);

  // 7. Background Media Binary Upload (§30)
  console.log("\n7. Background media upload: uploading JPEG binary to /evidence/:id/uploads...");
  const uploaded = await client.uploadEvidence(
    evidenceResult.evidenceId,
    new Blob([mediaBytes], { type: "image/jpeg" }),
    "fire-extinguishers-wing-b.jpg",
  );
  console.log(
    `✓ Evidence uploaded: uploadState=${uploaded.uploadState}, integrityState=${uploaded.integrityState}, storageKey=${uploaded.storageKey}`,
  );
  assert(
    uploaded.uploadState === "uploaded",
    `Expected uploadState 'uploaded', got '${uploaded.uploadState}'`,
  );
  assert(
    uploaded.integrityState === "verified",
    `Expected integrityState 'verified', got '${uploaded.integrityState}'`,
  );

  // Download media from MinIO and verify bit-for-bit exact match
  console.log("   -> Downloading media content to verify bit-for-bit identity...");
  const downloadedBlob = await client.getEvidenceContent(evidenceResult.evidenceId);
  const downloadedBuf = Buffer.from(await downloadedBlob.arrayBuffer());
  assert(
    downloadedBuf.equals(mediaBytes),
    `Downloaded bytes (${downloadedBuf.byteLength}) do not match uploaded bytes (${mediaBytes.byteLength})!`,
  );
  console.log(`✓ Downloaded ${downloadedBuf.byteLength} bytes matching original photo bit-for-bit`);

  // 8. Idempotency Check (§5, §31)
  console.log("\n8. Idempotency Check: Re-submitting the exact same sync batch...");
  const batchToResend: SyncBatchRequest = {
    operations: [opStart, opObs, evidenceResult.operation, opSubmit],
  };
  const idempotencyResponse = await client.syncOfflineOperations(batchToResend);
  console.log(`✓ Re-sync completed. Results count: ${idempotencyResponse.results.length}`);
  assert(
    idempotencyResponse.results.length === 4,
    `Expected 4 results, got ${idempotencyResponse.results.length}`,
  );
  for (const res of idempotencyResponse.results) {
    assert(
      res.status === "accepted",
      `Expected idempotent op ${res.operationId} to return status 'accepted', got '${res.status}'`,
    );
  }

  // Ensure no duplicate observations were created
  const serverObservationsAfterResync = await client.listObservations(targetInspection!.id);
  assert(
    serverObservationsAfterResync.length === serverObservations.length,
    `Duplicate observations detected after re-sync! Before: ${serverObservations.length}, After: ${serverObservationsAfterResync.length}`,
  );
  console.log(
    "✓ Server idempotency verified: identical operations return cached result without duplication",
  );

  // 9. Conflict Handling (§5, §31)
  console.log("\n9. Conflict Handling: Submitting an operation against a submitted inspection...");
  const conflictOpId = "00000000-0000-4000-8000-000000000099";
  const conflictBatch: SyncBatchRequest = {
    operations: [
      {
        operationId: conflictOpId,
        inspectionId: targetInspection!.id,
        type: "record_observation",
        timestamp: new Date().toISOString(),
        payload: { text: "Late note after submission has already completed" },
      },
    ],
  };

  const conflictRes = await client.syncOfflineOperations(conflictBatch);
  console.log(
    `✓ Server returned conflict response: status=${conflictRes.results[0]?.status}, code=${conflictRes.results[0]?.code}`,
  );
  assert(
    conflictRes.results[0]?.status === "conflict",
    `Expected 'conflict', got '${conflictRes.results[0]?.status}'`,
  );
  assert(
    conflictRes.results[0]?.code === "INSPECTION_NOT_IN_FIELD_STAGE",
    `Expected code 'INSPECTION_NOT_IN_FIELD_STAGE', got '${conflictRes.results[0]?.code}'`,
  );

  // 10. Authorization & Jurisdiction Enforcement (§16, §17)
  console.log("\n10. Authorization Enforcement: Attempting operation by unassigned inspector...");
  const unauthLogin = await client.devLogin("inspector.two@dev.netram.in");
  currentToken = unauthLogin.token;

  const forbiddenOpId = "00000000-0000-4000-8000-000000000088";
  const forbiddenBatch: SyncBatchRequest = {
    operations: [
      {
        operationId: forbiddenOpId,
        inspectionId: targetInspection!.id,
        type: "record_observation",
        timestamp: new Date().toISOString(),
        payload: { text: "Unauthorized note by inspector.two" },
      },
    ],
  };

  const forbiddenRes = await client.syncOfflineOperations(forbiddenBatch);
  console.log(
    `✓ Server returned forbidden response: status=${forbiddenRes.results[0]?.status}, code=${forbiddenRes.results[0]?.code}`,
  );
  assert(
    forbiddenRes.results[0]?.status === "rejected",
    `Expected 'rejected', got '${forbiddenRes.results[0]?.status}'`,
  );
  assert(
    forbiddenRes.results[0]?.code === "FORBIDDEN",
    `Expected code 'FORBIDDEN', got '${forbiddenRes.results[0]?.code}'`,
  );

  // 11. Authoritative Audit Trail (§37)
  console.log("\n11. Verifying Authoritative Audit Trail...");
  const officerLogin = await client.devLogin("officer@netram.dev");
  currentToken = officerLogin.token;

  const auditEvents = await client.listAuditEvents({
    resourceType: "inspection_sync_operation",
  });
  console.log(`✓ Fetched ${auditEvents.items.length} inspection sync audit events.`);
  const auditActions = auditEvents.items.map((a) => a.action);

  assert(
    auditActions.includes("inspection.operation_accepted"),
    "Audit log missing inspection.operation_accepted",
  );
  assert(
    auditActions.includes("inspection.operation_conflict"),
    "Audit log missing inspection.operation_conflict",
  );
  assert(
    auditActions.includes("inspection.operation_rejected"),
    "Audit log missing inspection.operation_rejected",
  );
  console.log(
    "✓ Audit trail verified: operation_accepted, operation_conflict, operation_rejected are durable",
  );

  console.log("\n==================================================================");
  console.log("🎉 ALL MOBILE OFFLINE & IDEMPOTENT SYNC CHECKS PASSED!");
  console.log("==================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
