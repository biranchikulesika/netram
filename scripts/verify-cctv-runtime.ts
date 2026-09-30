import { NetramApiClient, ApiError } from "@netram/api-client";
import { loadCctvEnv, loadServerEnv } from "@netram/config";

const env = loadServerEnv();
const cctvEnv = loadCctvEnv();
const API_URL = env.NETRAM_API_URL || "http://localhost:3001";
const GATEWAY_URL = env.NETRAM_CCTV_GATEWAY_URL || "http://localhost:3003";
// Media-plane mode: with a running rig (docker compose --profile facility)
// this script verifies the full path including the WHEP handshake and token
// rejection at MediaMTX. Where the rig is absent (CI), the configured
// NETRAM_CCTV_VERIFY_NO_RIG flag limits verification to the control plane;
// health must still reflect REAL media state (never "online" from a DB row
// alone).
const NO_MEDIA_RIG = cctvEnv.NETRAM_CCTV_VERIFY_NO_RIG;

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
  console.log("\n1. Authenticating as Khordha District Officer: officer@netram.dev...");
  let currentToken: string | null = null;
  const khordhaClient = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => currentToken,
  });

  const khordhaLogin = await khordhaClient.devLogin("officer@netram.dev");
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
  const validHealthStates = ["online", "offline", "degraded", "unknown"];
  assert(validHealthStates.includes(health.status), `Invalid health status: ${health.status}`);
  if (health.status === "online") {
    console.log(
      `✓ Camera health verified: online (media flowing, latency: ${health.latencyMs ?? 0}ms)`,
    );
  } else if (NO_MEDIA_RIG) {
    console.log(
      `✓ Camera health reflects REAL media state without a rig: ${health.status} (a DB row alone must never read "online")`,
    );
  } else {
    assert(false, `Expected online status with media rig attached, got: ${health.status}`);
  }

  // 5. Request an authorized stream session.
  // Without a rig the gateway must fail CLOSED: MediaMTX is unreachable, so no
  // playback contract may be minted and the API surfaces SERVICE_UNAVAILABLE.
  // With a rig a full contract is returned and verified below.
  console.log(`\n5. Requesting authorized stream session from API...`);
  let stream: Awaited<ReturnType<typeof khordhaClient.requestCameraStream>> | null = null;
  if (NO_MEDIA_RIG) {
    try {
      await khordhaClient.requestCameraStream(vaniGate!.id, { ttlSeconds: 180 });
      assert(false, "Stream request unexpectedly succeeded without a media rig (must fail closed)");
    } catch (err) {
      assert(
        err instanceof ApiError && err.code === "SERVICE_UNAVAILABLE",
        `Expected SERVICE_UNAVAILABLE without a media rig, got: ${err}`,
      );
      console.log("✓ Stream request fails CLOSED without MediaMTX (SERVICE_UNAVAILABLE, no contract minted)");
    }
  } else {
    stream = await khordhaClient.requestCameraStream(vaniGate!.id, { ttlSeconds: 180 });
  }

  if (stream) {
    assert(Boolean(stream.streamId), "Stream session ID missing");
    assert(Boolean(stream.streamUrl), "Stream relay URL missing");
    assert(Boolean(stream.token), "Stream authorization token missing");
    assert(
      !stream.streamUrl.startsWith("rtsp://"),
      "Security violation: returned raw RTSP URL instead of playback contract",
    );
    assert(
      !JSON.stringify(stream).includes("rtsp://"),
      "Security violation: RTSP endpoint leaked inside the stream payload",
    );
    assert(Boolean(stream.playback), "Playback contract missing (Phase 4/5 WHEP)");
    assert(stream.playback?.protocol === "webrtc", "Playback protocol must be webrtc");
    assert(Boolean(stream.playback?.whepUrl), "WHEP URL missing from playback contract");
    assert(Boolean(stream.playback?.token), "Playback token missing from playback contract");
    assert(Boolean(stream.playback?.mediaPath), "Media path missing from playback contract");
    console.log(`✓ Authorized playback contract established:`);
    console.log(`   - Stream ID:   ${stream.streamId}`);
    console.log(`   - Playback:    ${stream.playback?.protocol} via ${stream.playback?.whepUrl}`);
    console.log(`   - Media path:  ${stream.playback?.mediaPath}`);
    console.log(`   - Expires At:  ${stream.expiresAt}`);
  }  // 6/7. Media-plane verification with a rig only; without one the fail-closed
  // behaviour was already verified in step 5 (the gateway no longer relays
  // bytes - MediaMTX owns the data plane, so token enforcement happens at the
  // WHEP auth hook).
  if (stream) {
    console.log(`\n6. WHEP handshake against the media rig with the issued token...`);
    const whepRes = await fetch(stream.playback!.whepUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${stream.playback!.token}`,
      },
      body: "v=0",
    });
    assert(
      whepRes.status !== 401 && whepRes.status !== 403,
      `Valid token rejected at media plane: ${whepRes.status}`,
    );
    console.log(`✓ Media plane accepted the authorized token (SDP-level status ${whepRes.status})`);

    console.log(`\n7. Testing media-plane rejection of unauthorized access...`);
    const garbageRes = await fetch(stream.playback!.whepUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: "Bearer tampered.invalid.token",
      },
      body: "v=0",
    });
    assert(garbageRes.status === 401, `Expected 401 for tampered token, got ${garbageRes.status}`);
    console.log("✓ Tampered token rejected with 401 Unauthorized");
  } else {
    console.log("\n6/7. Skipped: media plane not attached (fail-closed path already verified).\n");
  }

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

  // 10. Verify the append-only audit trail (§37). With a rig, an accepted
  // stream session must produce a cctv.accessed audit record attributed to the
  // requesting officer. Without a rig, no session can be accepted, so the
  // integrity property is the inverse: no cctv.accessed records may be
  // fabricated for fail-closed attempts.
  console.log(`\n10. Verifying append-only audit trail for cctv.accessed (§37)...`);
  let adminToken: string | null = null;
  const adminClient = new NetramApiClient({
    baseUrl: API_URL,
    getToken: () => adminToken,
  });
  const adminLogin = await adminClient.devLogin("admin@netram.dev");
  adminToken = adminLogin.token;

  const auditEvents = await adminClient.listAuditEvents({ action: "cctv.accessed" });
  if (NO_MEDIA_RIG) {
    assert(
      auditEvents.items.length === 0,
      "cctv.accessed audit records exist although every stream request failed closed",
    );
    const allEvents = await adminClient.listAuditEvents({});
    assert(allEvents.items.length > 0, "Audit system returned no events at all");
    console.log(
      `✓ Audit integrity: no cctv.accessed records fabricated for fail-closed attempts (${allEvents.items.length} other audit events queryable)`,
    );
  } else {
    assert(auditEvents.items.length > 0, "No cctv.accessed audit events found");
    const recentAudit = auditEvents.items.find((e) => e.resourceId === vaniGate!.id);
    assert(Boolean(recentAudit), `Audit event for camera ${vaniGate!.id} not found`);
    assert(recentAudit!.actorUserId === khordhaLogin.user.id, "Audit actor mismatch");
    console.log(`✓ Audit event recorded:`);
    console.log(`   - Action:    ${recentAudit!.action}`);
    console.log(`   - Actor:     ${recentAudit!.actorUserId}`);
    console.log(`   - Resource:  ${recentAudit!.resourceType}:${recentAudit!.resourceId}`);
  }

  console.log("\n==================================================================");
  console.log("🎉 ALL CCTV GATEWAY & STREAM ABSTRACTION VERIFICATIONS PASSED!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
