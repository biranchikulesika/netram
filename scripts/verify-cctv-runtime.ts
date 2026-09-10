import { NetramApiClient, ApiError } from "@netram/api-client";
import { loadServerEnv } from "@netram/config";

const env = loadServerEnv();
const API_URL = env.NETRAM_API_URL || "http://localhost:3001";
const GATEWAY_URL = env.NETRAM_CCTV_GATEWAY_URL || "http://localhost:3003";

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  console.log("==================================================================");
  console.log("📹 Netram CCTV Gateway & Stream Abstraction Runtime Verification");
  console.log("==================================================================");

  // 1. Authenticate as Khordha District Officer
  console.log("\n1. Authenticating as Khordha District Officer: officer.khordha@dev.netram.in...");
  let currentToken: string | null = null;
  const khordhaClient = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => currentToken,
  });

  const khordhaLogin = await khordhaClient.devLogin("officer.khordha@dev.netram.in");
  currentToken = khordhaLogin.token;
  console.log(`✓ Logged in as ${khordhaLogin.user.displayName} (id: ${khordhaLogin.user.id})`);

  // 2. List cameras - verifies jurisdiction filtering and endpoint sanitization
  console.log("\n2. Listing cameras in authorized jurisdiction...");
  const cameraPage = await khordhaClient.listCameras();
  console.log(`✓ Received ${cameraPage.items.length} cameras (total: ${cameraPage.total})`);

  assert(cameraPage.items.length > 0, "No cameras returned for Khordha officer");

  // Find Vani Vihar Gate camera
  const vaniGate = cameraPage.items.find((c) => c.name.includes("Vani Vihar"));
  assert(Boolean(vaniGate), "Could not find Vani Vihar camera in Khordha jurisdiction");
  console.log(
    `✓ Found camera: ${vaniGate!.name} (id: ${vaniGate!.id}, provider: ${vaniGate!.provider})`,
  );

  // CRITICAL ARCHITECTURAL CHECK (§7, §42):
  // Raw endpoints and camera credentials must NEVER be disclosed to clients
  for (const cam of cameraPage.items) {
    assert(
      (cam as Record<string, unknown>).endpoint === undefined,
      `Security violation: camera ${cam.id} exposed raw endpoint to client!`,
    );
  }
  console.log(
    "✓ Verified: raw RTSP endpoint and credentials strictly omitted from all public cameras (§7, §42)",
  );

  // 3. Get single camera details
  console.log(`\n3. Fetching single camera details for ${vaniGate!.id}...`);
  const cameraDetail = await khordhaClient.getCamera(vaniGate!.id);
  assert(cameraDetail.id === vaniGate!.id, "Camera ID mismatch");
  assert(
    (cameraDetail as Record<string, unknown>).endpoint === undefined,
    "Security violation: raw endpoint exposed",
  );
  console.log(`✓ Camera details fetched successfully without raw endpoint`);

  // 4. Live camera health check via CCTV Gateway
  console.log(`\n4. Checking live camera health via CCTV Gateway...`);
  const health = await khordhaClient.getCameraHealth(vaniGate!.id);
  assert(health.cameraId === vaniGate!.id, "Health check camera ID mismatch");
  assert(health.status === "online", `Expected online status, got: ${health.status}`);
  console.log(`✓ Camera health verified: ${health.status} (latency: ${health.latencyMs ?? 0}ms)`);

  // 5. Request authorized stream relay URL and token
  console.log(`\n5. Requesting authorized stream session from API...`);
  const stream = await khordhaClient.requestCameraStream(vaniGate!.id, { ttlSeconds: 180 });
  assert(Boolean(stream.streamId), "Stream session ID missing");
  assert(Boolean(stream.streamUrl), "Stream relay URL missing");
  assert(Boolean(stream.token), "Stream authorization token missing");
  assert(
    !stream.streamUrl.startsWith("rtsp://"),
    "Security violation: returned raw RTSP URL instead of relay",
  );
  console.log(`✓ Authorized stream relay established:`);
  console.log(`   - Stream ID:  ${stream.streamId}`);
  console.log(`   - Relay URL:  ${stream.streamUrl}`);
  console.log(`   - Expires At: ${stream.expiresAt}`);

  // 6. Connect to CCTV Gateway stream relay endpoint with valid token
  console.log(`\n6. Accessing stream relay with valid signed token...`);
  const streamRes = await fetch(stream.streamUrl);
  assert(streamRes.ok, `Stream relay request failed with status: ${streamRes.status}`);
  const contentType = streamRes.headers.get("content-type");
  assert(contentType?.includes("video/mp2t"), `Unexpected content-type: ${contentType}`);

  const chunk = Buffer.from(await streamRes.arrayBuffer());
  assert(chunk.length === 188, `Expected 188-byte MPEG-TS packet, got ${chunk.length}`);
  assert(chunk[0] === 0x47, `MPEG-TS sync byte 0x47 missing, got 0x${chunk[0]?.toString(16)}`);
  console.log(
    `✓ Successfully received video stream data (188-byte MPEG-TS chunk with 0x47 sync byte)`,
  );

  // 7. Security: Tampered & missing token verification
  console.log(`\n7. Testing security guards against unauthorized stream relay access...`);
  const tamperedUrl = stream.streamUrl.replace(/token=.*$/, "token=tampered.invalid.token");
  const tamperedRes = await fetch(tamperedUrl);
  assert(
    tamperedRes.status === 401,
    `Expected 401 Unauthorized for tampered token, got ${tamperedRes.status}`,
  );
  console.log("✓ Tampered token rejected with 401 Unauthorized");

  const noTokenUrl = stream.streamUrl.split("?")[0];
  const noTokenRes = await fetch(noTokenUrl);
  assert(
    noTokenRes.status === 401,
    `Expected 401 Unauthorized without token, got ${noTokenRes.status}`,
  );
  console.log("✓ Missing token request rejected with 401 Unauthorized");

  // 8. Capture snapshot frame for advisory AI inference
  console.log(`\n8. Capturing snapshot frame from camera feed for AI pipeline (§7, §36)...`);
  const snapshotBlob = await khordhaClient.getCameraSnapshot(vaniGate!.id);
  assert(snapshotBlob.size > 0, "Snapshot blob is empty");
  assert(
    snapshotBlob.type.includes("image/jpeg"),
    `Unexpected snapshot type: ${snapshotBlob.type}`,
  );

  const snapshotBuf = Buffer.from(await snapshotBlob.arrayBuffer());
  assert(
    snapshotBuf[0] === 0xff && snapshotBuf[1] === 0xd8,
    "Snapshot missing JPEG Start of Image (SOI) marker",
  );
  assert(
    snapshotBuf[snapshotBuf.length - 2] === 0xff && snapshotBuf[snapshotBuf.length - 1] === 0xd9,
    "Snapshot missing JPEG End of Image (EOI) marker",
  );
  console.log(
    `✓ Snapshot captured: ${snapshotBuf.length} bytes valid JPEG with correct SOI/EOI markers`,
  );

  // 9. Jurisdiction Enforcement: Khordha officer attempting to stream Cuttack camera
  console.log(`\n9. Testing jurisdiction boundary enforcement (§16, §17)...`);
  // Login as Cuttack officer to discover Cuttack camera ID
  let cuttackToken: string | null = null;
  const cuttackClient = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => cuttackToken,
  });
  const cuttackLogin = await cuttackClient.devLogin("officer.cuttack@dev.netram.in");
  cuttackToken = cuttackLogin.token;

  const cuttackCameras = await cuttackClient.listCameras();
  const cuttackHostelCam = cuttackCameras.items.find((c) => c.name.includes("Cuttack"));
  assert(Boolean(cuttackHostelCam), "Could not find Cuttack camera");
  console.log(`✓ Cuttack officer can access: ${cuttackHostelCam!.name} (${cuttackHostelCam!.id})`);

  // Now verify Khordha officer is REJECTED when attempting to access Cuttack camera
  try {
    await khordhaClient.getCamera(cuttackHostelCam!.id);
    assert(false, "Khordha officer was able to get details of Cuttack camera!");
  } catch (err) {
    assert(err instanceof ApiError && err.status === 403, `Expected 403 Forbidden, got ${err}`);
    console.log("✓ Khordha officer blocked from accessing Cuttack camera details (403 Forbidden)");
  }

  try {
    await khordhaClient.requestCameraStream(cuttackHostelCam!.id, { ttlSeconds: 120 });
    assert(false, "Khordha officer was able to request stream for Cuttack camera!");
  } catch (err) {
    assert(err instanceof ApiError && err.status === 403, `Expected 403 Forbidden, got ${err}`);
    console.log(
      "✓ Khordha officer blocked from requesting stream for Cuttack camera (403 Forbidden)",
    );
  }

  // 10. Verify Audit Trail contains cctv.accessed
  console.log(`\n10. Verifying append-only audit trail for cctv.accessed (§37)...`);
  let adminToken: string | null = null;
  const adminClient = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => adminToken,
  });
  const adminLogin = await adminClient.devLogin("admin.example-social@dev.netram.in");
  adminToken = adminLogin.token;

  const auditEvents = await adminClient.listAuditEvents({ action: "cctv.accessed" });
  assert(auditEvents.items.length > 0, "No cctv.accessed audit events found");
  const recentAudit = auditEvents.items.find((e) => e.resourceId === vaniGate!.id);
  assert(Boolean(recentAudit), `Audit event for camera ${vaniGate!.id} not found`);
  assert(recentAudit!.actorUserId === khordhaLogin.user.id, "Audit actor mismatch");
  console.log(`✓ Audit event recorded:`);
  console.log(`   - Action:    ${recentAudit!.action}`);
  console.log(`   - Actor:     ${recentAudit!.actorUserId}`);
  console.log(`   - Resource:  ${recentAudit!.resourceType}:${recentAudit!.resourceId}`);

  console.log("\n==================================================================");
  console.log("🎉 ALL CCTV GATEWAY & STREAM ABSTRACTION VERIFICATIONS PASSED!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
