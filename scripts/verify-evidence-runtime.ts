import { createHash } from "node:crypto";
import { NetramApiClient } from "@netram/api-client";
import { loadServerEnv } from "@netram/config";

const env = loadServerEnv();
const API_URL = env.NETRAM_API_URL;
const WS_URL = env.NETRAM_REALTIME_URL.replace(/^http/, "ws");

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  console.log("=== Netram Evidence Runtime Verification ===");

  // 1. Login as inspector
  console.log("1. Authenticating as inspector.two@dev.netram.in...");
  let currentToken: string | null = null;
  const client = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => currentToken,
  });

  const loginRes = await client.devLogin("inspector.two@dev.netram.in");
  currentToken = loginRes.token;
  console.log(`✓ Logged in as ${loginRes.user.email} (userId: ${loginRes.user.id})`);

  // 2. Connect to Realtime WebSocket
  console.log(`2. Connecting to WebSocket at ${WS_URL}...`);
  const wsUrl = `${WS_URL}/?token=${currentToken}&topics=evidence.*`;
  const ws = new WebSocket(wsUrl);

  const receivedEvents: Array<{
    type: string;
    resourceId: string;
    payload: any;
  }> = [];

  const wsConnected = new Promise<void>((resolve, reject) => {
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      console.log(
        `  [WS MESSAGE] event=${msg.event}`,
        JSON.stringify(msg.data ?? {}).slice(0, 140),
      );
      if (msg.event === "netram.authorized") {
        assert(msg.data.allowedTopics.includes("evidence.*"), "evidence.* topic not allowed");
        resolve();
      } else if (msg.event === "netram.event") {
        receivedEvents.push(msg.data);
      }
    };
    ws.onerror = (err) => {
      console.error("WS error:", err);
      reject(err);
    };
  });

  await wsConnected;
  console.log("✓ Realtime WebSocket authorized for evidence.*");

  // 3. Find in_progress inspection
  console.log("3. Finding active in-progress inspection...");
  const inspections = await client.listInspections({ status: "in_progress" });
  assert(inspections.items.length > 0, "No in-progress inspections found in seed data");
  const targetInspection = inspections.items[0]!;
  console.log(`✓ Using inspection: ${targetInspection.id} (status: ${targetInspection.status})`);

  // 4. Test MATCHING evidence upload
  console.log("4. Testing MATCHING evidence upload...");
  const fileBytes1 = Buffer.from("NETRAM-EVIDENCE-PHOTOGRAPH-VALID-SAMPLE-2026-09-09");
  const sha256_1 = `sha256:${createHash("sha256").update(fileBytes1).digest("hex")}`;

  const captured1 = await client.captureEvidence(targetInspection.id, {
    capturedAt: new Date().toISOString(),
    evidenceType: "photo",
    fileName: "site-photo-1.jpg",
    mimeType: "image/jpeg",
    sizeBytes: fileBytes1.byteLength,
    contentHash: sha256_1,
  });
  console.log(`✓ Captured evidence metadata: ${captured1.id}`);
  assert(
    captured1.uploadState === "pending",
    `Expected uploadState=pending, got ${captured1.uploadState}`,
  );
  assert(
    captured1.integrityState === "unknown",
    `Expected integrityState=unknown, got ${captured1.integrityState}`,
  );

  // Upload matching file
  const uploaded1 = await client.uploadEvidence(
    captured1.id,
    new Blob([fileBytes1], { type: "image/jpeg" }),
    "site-photo-1.jpg",
  );
  console.log(
    `✓ Uploaded evidence 1: uploadState=${uploaded1.uploadState}, integrityState=${uploaded1.integrityState}`,
  );
  assert(
    uploaded1.uploadState === "uploaded",
    `Expected uploadState=uploaded, got ${uploaded1.uploadState}`,
  );
  assert(
    uploaded1.integrityState === "verified",
    `Expected integrityState=verified, got ${uploaded1.integrityState}`,
  );
  assert(
    typeof uploaded1.storageKey === "string" && uploaded1.storageKey.length > 0,
    "storageKey not populated",
  );

  // Download content and verify bit-for-bit match
  console.log("5. Downloading uploaded evidence content from MinIO...");
  const blob1 = await client.getEvidenceContent(captured1.id);
  const downloadedBuf1 = Buffer.from(await blob1.arrayBuffer());
  assert(
    downloadedBuf1.equals(fileBytes1),
    `Downloaded bytes (${downloadedBuf1.byteLength}) do not match uploaded bytes (${fileBytes1.byteLength})!`,
  );
  console.log(`✓ Downloaded ${downloadedBuf1.byteLength} bytes matching original content exactly`);

  // 6. Test MISMATCH evidence upload
  console.log("6. Testing MISMATCH evidence upload (tamper/mismatch path)...");
  const originalBytes2 = Buffer.from("ORIGINAL-UNMODIFIED-CONTENT-THAT-WAS-HASHED");
  const declaredSha256_2 = `sha256:${createHash("sha256").update(originalBytes2).digest("hex")}`;

  const captured2 = await client.captureEvidence(targetInspection.id, {
    capturedAt: new Date().toISOString(),
    evidenceType: "photo",
    fileName: "site-photo-2.jpg",
    mimeType: "image/jpeg",
    contentHash: declaredSha256_2,
  });
  console.log(
    `✓ Captured evidence 2 metadata: ${captured2.id} with declared hash ${declaredSha256_2}`,
  );

  // Upload DIFFERENT bytes than declared
  const tamperedBytes = Buffer.from("COMPLETELY-DIFFERENT-OR-CORRUPTED-CONTENT");
  const uploaded2 = await client.uploadEvidence(
    captured2.id,
    new Blob([tamperedBytes], { type: "image/jpeg" }),
    "site-photo-2.jpg",
  );
  console.log(
    `✓ Uploaded mismatched evidence 2: uploadState=${uploaded2.uploadState}, integrityState=${uploaded2.integrityState}`,
  );
  assert(
    uploaded2.uploadState === "uploaded",
    `Expected uploadState=uploaded, got ${uploaded2.uploadState}`,
  );
  assert(
    uploaded2.integrityState === "mismatch",
    `Expected integrityState=mismatch, got ${uploaded2.integrityState}`,
  );

  // 7. Test manual integrity check endpoint (recovering from mismatch -> verified)
  console.log("7. Testing explicit integrity check endpoint...");
  const verified2 = await client.verifyEvidenceIntegrity(captured2.id, declaredSha256_2);
  console.log(
    `✓ Re-verified evidence 2 with declared hash: integrityState=${verified2.integrityState}`,
  );
  assert(
    verified2.integrityState === "verified",
    `Expected integrityState=verified, got ${verified2.integrityState}`,
  );

  // 8. Allow realtime poller to deliver events
  console.log("8. Waiting for Realtime outbox poller to deliver events...");
  const maxWaitMs = 10000;
  const pollIntervalMs = 250;
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const hasCaptured = receivedEvents.some((e) => e.type === "evidence.captured");
    const hasVerified = receivedEvents.some((e) => e.type === "evidence.verified");
    const hasFailed = receivedEvents.some((e) => e.type === "evidence.integrity_failed");
    if (hasCaptured && hasVerified && hasFailed) break;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  console.log(`✓ Received ${receivedEvents.length} realtime events total:`);
  for (const ev of receivedEvents) {
    console.log(`   - type: ${ev.type}, resourceId: ${ev.resourceId}`);
  }

  const hasCapturedEvent = receivedEvents.some((e) => e.type === "evidence.captured");
  const hasVerifiedEvent = receivedEvents.some((e) => e.type === "evidence.verified");
  const hasIntegrityFailedEvent = receivedEvents.some(
    (e) => e.type === "evidence.integrity_failed",
  );

  assert(hasCapturedEvent, "Realtime did not deliver evidence.captured event");
  assert(hasVerifiedEvent, "Realtime did not deliver evidence.verified event");
  assert(hasIntegrityFailedEvent, "Realtime did not deliver evidence.integrity_failed event");
  console.log("✓ Realtime delivery verified for all evidence lifecycle events!");

  // 9. Verify Audit trail
  console.log("9. Verifying Audit Trail (logging in as authority officer)...");
  const officerLogin = await client.devLogin("officer.cuttack@dev.netram.in");
  currentToken = officerLogin.token;

  const auditEvents = await client.listAuditEvents({
    resourceType: "evidence",
  });
  console.log(`✓ Fetched ${auditEvents.items.length} evidence audit events.`);
  const auditActions = auditEvents.items.map((a) => a.action);
  assert(auditActions.includes("evidence.captured"), "Audit log missing evidence.captured");
  assert(auditActions.includes("evidence.verified"), "Audit log missing evidence.verified");
  assert(
    auditActions.includes("evidence.integrity_failed"),
    "Audit log missing evidence.integrity_failed",
  );
  console.log(
    "✓ Audit trail verified: evidence.captured, evidence.verified, evidence.integrity_failed are logged!",
  );

  ws.close();
  console.log("\n==========================================");
  console.log("🎉 ALL RUNTIME VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Runtime verification failed:", err);
  process.exit(1);
});
