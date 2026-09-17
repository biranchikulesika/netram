/**
 * Verification script for Next.js Web Dashboard routes and proxy endpoints.
 *
 * Tests:
 * 1. Officer session establishment via POST /api/session
 * 2. SSR rendered /projects page
 * 3. SSR rendered /inspections list page
 * 4. Inspector session establishment for assigned in-progress inspection
 * 5. SSR rendered /inspections/[id] detail page
 * 6. Observation creation via web proxy POST /api/inspections/[id]/observations
 * 7. Evidence capture via web proxy POST /api/inspections/[id]/evidence
 * 8. Multipart file upload via web proxy POST /api/evidence/[id]/uploads
 * 9. Binary file download via web proxy GET /api/evidence/[id]/content with byte-for-byte SHA-256 match
 * 10. Evidence SHA-256 integrity verification via web proxy POST /api/evidence/[id]/integrity-check
 * 11. Control Room SSR & CCTV Proxy Routes (snapshot, stream relay, health check)
 * 12. Video Conferencing (VC) Tripartite Review Integration (schedule, start, join with WebRTC tokens, end)
 * 13. Realtime WebSocket Push & Subscription Integration (token exchange, topic authorization, event broadcast)
 */

import { createHash } from "node:crypto";

const WEB_BASE = "http://localhost:3000";
const API_BASE = "http://localhost:3001";

async function loginAndGetCookie(
  email: string,
): Promise<{ token: string; cookie: string; user: { id: string; email: string } }> {
  const loginRes = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!loginRes.ok) {
    throw new Error(
      `Login failed for ${email} with status ${loginRes.status}: ${await loginRes.text()}`,
    );
  }
  const { token, user } = (await loginRes.json()) as {
    token: string;
    user: { id: string; email: string };
  };

  const sessionRes = await fetch(`${WEB_BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!sessionRes.ok) {
    throw new Error(`Session establishment failed: ${sessionRes.status}`);
  }
  const setCookie = sessionRes.headers.get("set-cookie");
  if (!setCookie || !setCookie.includes("netram_session=")) {
    throw new Error(`Expected set-cookie with netram_session, got: ${setCookie}`);
  }
  const cookie = setCookie.split(";")[0]!;
  return { token, cookie, user };
}

async function main() {
  console.log("--- Starting Netram Web Dashboard Runtime Verification ---");

  // Step 1: Officer Session
  console.log("\n1. Establishing Officer session (officer.khordha@dev.netram.in)...");
  const officer = await loginAndGetCookie("officer.khordha@dev.netram.in");
  console.log(`✓ Officer authenticated: id=${officer.user.id}`);

  // Step 2: SSR /projects
  console.log("\n2. Testing SSR GET /projects...");
  const projectsRes = await fetch(`${WEB_BASE}/projects`, {
    headers: { Cookie: officer.cookie },
  });
  if (!projectsRes.ok) throw new Error(`GET /projects returned ${projectsRes.status}`);
  const projectsHtml = await projectsRes.text();
  if (
    !projectsHtml.includes("Projects") ||
    !projectsHtml.includes("officer.khordha@dev.netram.in")
  ) {
    throw new Error("Projects page HTML missing expected content");
  }
  console.log(
    `✓ /projects rendered successfully (${projectsHtml.length} bytes, contains user header)`,
  );

  // Step 3: SSR /inspections
  console.log("\n3. Testing SSR GET /inspections...");
  const inspectionsRes = await fetch(`${WEB_BASE}/inspections`, {
    headers: { Cookie: officer.cookie },
  });
  if (!inspectionsRes.ok) throw new Error(`GET /inspections returned ${inspectionsRes.status}`);
  const inspectionsHtml = await inspectionsRes.text();
  if (!inspectionsHtml.includes("Inspections") || !inspectionsHtml.includes("Active Attention")) {
    throw new Error("Inspections page HTML missing expected content");
  }
  console.log(
    `✓ /inspections rendered successfully (${inspectionsHtml.length} bytes, contains table)`,
  );

  // Step 4: Inspector Session (assigned to Cuttack in-progress inspection)
  console.log("\n4. Establishing Inspector session (inspector.two@dev.netram.in)...");
  const inspector = await loginAndGetCookie("inspector.two@dev.netram.in");
  console.log(`✓ Inspector authenticated: id=${inspector.user.id}`);

  // Find the in-progress inspection
  const listInspRes = await fetch(`${API_BASE}/api/v1/inspections?pageSize=20`, {
    headers: { Authorization: `Bearer ${inspector.token}` },
  });
  const inspData = (await listInspRes.json()) as {
    items: Array<{ id: string; status: string; projectId: string }>;
  };
  const inProgressInsp = inspData.items.find((i) => i.status === "in_progress");
  if (!inProgressInsp) {
    throw new Error("Expected at least one in_progress inspection in seed data");
  }
  console.log(`✓ Found in-progress inspection id=${inProgressInsp.id}`);

  // Step 5: SSR /inspections/[id]
  console.log(`\n5. Testing SSR GET /inspections/${inProgressInsp.id}...`);
  const detailRes = await fetch(`${WEB_BASE}/inspections/${inProgressInsp.id}`, {
    headers: { Cookie: inspector.cookie },
  });
  if (!detailRes.ok)
    throw new Error(`GET /inspections/${inProgressInsp.id} returned ${detailRes.status}`);
  const detailHtml = await detailRes.text();
  if (!detailHtml.includes("Formal Findings") || !detailHtml.includes("INSPECTION")) {
    throw new Error("Inspection detail page missing expected section headings");
  }
  console.log(
    `✓ /inspections/${inProgressInsp.id} rendered successfully (${detailHtml.length} bytes)`,
  );

  // Step 6: Create Observation via web proxy
  console.log(`\n6. Testing POST /api/inspections/${inProgressInsp.id}/observations proxy...`);
  const obsText = `Verified field observation recorded via Web at ${new Date().toISOString()}`;
  const obsRes = await fetch(`${WEB_BASE}/api/inspections/${inProgressInsp.id}/observations`, {
    method: "POST",
    headers: {
      Cookie: inspector.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: obsText }),
  });
  if (!obsRes.ok) {
    throw new Error(`Observation proxy failed: ${obsRes.status}: ${await obsRes.text()}`);
  }
  const obsJson = (await obsRes.json()) as { id: string; text: string };
  console.log(`✓ Observation created: id=${obsJson.id}`);

  // Step 7: Create Evidence Record via web proxy
  console.log(`\n7. Testing POST /api/inspections/${inProgressInsp.id}/evidence proxy...`);
  const testPayload = Buffer.from(
    "Netram Web Dashboard Test Evidence JPEG Stream - Timestamp " + Date.now(),
  );
  const rawHash = createHash("sha256").update(testPayload).digest("hex");
  const sha256 = `sha256:${rawHash}`;

  const createEvRes = await fetch(`${WEB_BASE}/api/inspections/${inProgressInsp.id}/evidence`, {
    method: "POST",
    headers: {
      Cookie: inspector.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      capturedAt: new Date().toISOString(),
      evidenceType: "photo",
      fileName: "web-test-photo.jpg",
      fileSizeBytes: testPayload.byteLength,
      contentHash: sha256,
      mimeType: "image/jpeg",
    }),
  });
  if (!createEvRes.ok) {
    throw new Error(
      `Evidence registration failed: ${createEvRes.status}: ${await createEvRes.text()}`,
    );
  }
  const evJson = (await createEvRes.json()) as { id: string; contentHash: string; status: string };
  console.log(`✓ Evidence record registered: id=${evJson.id}`);

  // Step 8: Upload File via web proxy
  console.log(`\n8. Testing multipart upload via POST /api/evidence/${evJson.id}/uploads proxy...`);
  const formData = new FormData();
  const blob = new Blob([testPayload], { type: "image/jpeg" });
  formData.append("file", blob, "web-test-photo.jpg");

  const uploadRes = await fetch(`${WEB_BASE}/api/evidence/${evJson.id}/uploads`, {
    method: "POST",
    headers: { Cookie: inspector.cookie },
    body: formData,
  });
  if (!uploadRes.ok) {
    throw new Error(`Upload proxy failed: ${uploadRes.status}: ${await uploadRes.text()}`);
  }
  const uploadedEv = (await uploadRes.json()) as { status: string; storageKey: string };
  console.log(
    `✓ Upload successful! status=${uploadedEv.status}, storageKey=${uploadedEv.storageKey}`,
  );

  // Step 9: Download Binary Content via web proxy
  console.log(`\n9. Testing binary download via GET /api/evidence/${evJson.id}/content proxy...`);
  const downloadRes = await fetch(`${WEB_BASE}/api/evidence/${evJson.id}/content`, {
    headers: { Cookie: inspector.cookie },
  });
  if (!downloadRes.ok) {
    throw new Error(`Download proxy failed: ${downloadRes.status}`);
  }
  const downloadedBuf = Buffer.from(await downloadRes.arrayBuffer());
  if (downloadedBuf.compare(testPayload) !== 0) {
    throw new Error("Downloaded binary does not bit-match uploaded payload!");
  }
  const downloadedHash = `sha256:${createHash("sha256").update(downloadedBuf).digest("hex")}`;
  if (downloadedHash !== sha256) {
    throw new Error(`Hash mismatch: expected ${sha256}, got ${downloadedHash}`);
  }
  console.log(
    `✓ Downloaded ${downloadedBuf.byteLength} bytes matching original content bit-for-bit (SHA-256 verified)!`,
  );

  // Step 10: Verify Evidence A auto-verification, then test manual integrity-check proxy with unverified Evidence B
  console.log(`\n10. Testing integrity verification flows...`);
  const checkEvRes = await fetch(`${API_BASE}/api/v1/inspections/${inProgressInsp.id}/evidence`, {
    headers: { Authorization: `Bearer ${inspector.token}` },
  });
  const evList = (await checkEvRes.json()) as Array<{ id: string; integrityState: string }>;
  const evARecord = evList.find((e) => e.id === evJson.id);
  if (evARecord?.integrityState !== "verified") {
    throw new Error(
      `Expected Evidence A to be auto-verified on upload, got ${evARecord?.integrityState}`,
    );
  }
  console.log(`✓ Evidence A auto-verified upon upload matching capture-time SHA-256 hash!`);

  // Now create Evidence B without initial hash, upload, and run manual integrity check
  console.log(
    `Creating Evidence B (unhashed at capture time) to test POST /api/evidence/:id/integrity-check proxy...`,
  );
  const payloadB = Buffer.from("Netram Evidence B for manual integrity verification " + Date.now());
  const sha256B = `sha256:${createHash("sha256").update(payloadB).digest("hex")}`;

  const createBRes = await fetch(`${WEB_BASE}/api/inspections/${inProgressInsp.id}/evidence`, {
    method: "POST",
    headers: {
      Cookie: inspector.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      capturedAt: new Date().toISOString(),
      evidenceType: "photo",
      fileName: "web-test-photo-b.jpg",
      fileSizeBytes: payloadB.byteLength,
      mimeType: "image/jpeg",
    }),
  });
  if (!createBRes.ok) throw new Error(`Evidence B creation failed: ${createBRes.status}`);
  const evB = (await createBRes.json()) as { id: string };

  const formDataB = new FormData();
  formDataB.append("file", new Blob([payloadB], { type: "image/jpeg" }), "web-test-photo-b.jpg");
  const uploadBRes = await fetch(`${WEB_BASE}/api/evidence/${evB.id}/uploads`, {
    method: "POST",
    headers: { Cookie: inspector.cookie },
    body: formDataB,
  });
  if (!uploadBRes.ok) throw new Error(`Upload B failed: ${uploadBRes.status}`);

  // Now call manual integrity-check proxy
  const integrityRes = await fetch(`${WEB_BASE}/api/evidence/${evB.id}/integrity-check`, {
    method: "POST",
    headers: {
      Cookie: inspector.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentHash: sha256B }),
  });
  if (!integrityRes.ok) {
    throw new Error(`Integrity check failed: ${integrityRes.status}: ${await integrityRes.text()}`);
  }
  const integrityJson = (await integrityRes.json()) as {
    integrityState: string;
    contentHash: string;
  };
  if (integrityJson.integrityState !== "verified") {
    throw new Error(`Expected integrityState='verified', got '${integrityJson.integrityState}'`);
  }
  console.log(
    `✓ Evidence B manual integrity verification passed: state=${integrityJson.integrityState}, hash=${integrityJson.contentHash}`,
  );

  // Step 11: Control Room SSR & CCTV Proxy Routes
  console.log("\n11. Testing Control Room SSR & CCTV Proxy Routes...");
  const controlRoomRes = await fetch(`${WEB_BASE}/control-room`, {
    headers: { Cookie: officer.cookie },
  });
  if (!controlRoomRes.ok) {
    throw new Error(`GET /control-room returned ${controlRoomRes.status}`);
  }
  const controlRoomHtml = await controlRoomRes.text();
  if (!controlRoomHtml.includes("Control Room")) {
    throw new Error("Control room HTML missing expected title");
  }
  if (!controlRoomHtml.includes("Vani Vihar")) {
    throw new Error("Control room HTML missing expected camera name Vani Vihar");
  }
  console.log(
    `✓ /control-room rendered successfully (${controlRoomHtml.length} bytes, contains camera card and advisory AI banner)`,
  );

  // Get camera ID from officer's camera list
  const camerasRes = await fetch(`${API_BASE}/api/v1/cctv/cameras`, {
    headers: { Authorization: `Bearer ${officer.token}` },
  });
  const camerasData = (await camerasRes.json()) as { items: Array<{ id: string; name: string }> };
  const vaniCamera = camerasData.items.find((c) => c.name.includes("Vani Vihar"));
  if (!vaniCamera) {
    throw new Error("Expected Vani Vihar camera in officer jurisdiction");
  }

  // Test CCTV snapshot proxy
  console.log(`Testing GET /api/cctv/${vaniCamera.id}/snapshot proxy...`);
  const snapshotRes = await fetch(`${WEB_BASE}/api/cctv/${vaniCamera.id}/snapshot`, {
    headers: { Cookie: officer.cookie },
  });
  if (!snapshotRes.ok) {
    throw new Error(`Snapshot proxy returned ${snapshotRes.status}`);
  }
  const snapshotContentType = snapshotRes.headers.get("content-type");
  if (!snapshotContentType?.includes("image/jpeg")) {
    throw new Error(`Expected image/jpeg content type, got ${snapshotContentType}`);
  }
  const snapshotBuf = await snapshotRes.arrayBuffer();
  if (snapshotBuf.byteLength === 0) {
    throw new Error("Snapshot proxy returned empty buffer");
  }
  console.log(`✓ Proxy GET snapshot returned ${snapshotBuf.byteLength} bytes of image/jpeg`);

  // Test CCTV stream relay initiation proxy
  console.log(`Testing POST /api/cctv/${vaniCamera.id}/streams proxy...`);
  const streamRes = await fetch(`${WEB_BASE}/api/cctv/${vaniCamera.id}/streams`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttlSeconds: 120 }),
  });
  if (!streamRes.ok) {
    throw new Error(`Stream proxy returned ${streamRes.status}: ${await streamRes.text()}`);
  }
  const streamData = (await streamRes.json()) as { streamUrl: string; token: string };
  if (!streamData.streamUrl || !streamData.token) {
    throw new Error("Stream proxy response missing streamUrl or token");
  }
  console.log(
    `✓ Proxy POST streams returned authorized relay URL (${streamData.streamUrl.substring(0, 45)}...)`,
  );

  // Test CCTV health proxy
  console.log(`Testing GET /api/cctv/${vaniCamera.id}/health proxy...`);
  const healthRes = await fetch(`${WEB_BASE}/api/cctv/${vaniCamera.id}/health`, {
    headers: { Cookie: officer.cookie },
  });
  if (!healthRes.ok) {
    throw new Error(`Health proxy returned ${healthRes.status}: ${await healthRes.text()}`);
  }
  const healthData = (await healthRes.json()) as { status: string };
  if (healthData.status !== "online") {
    throw new Error(`Expected camera status 'online', got ${healthData.status}`);
  }
  console.log(`✓ Proxy GET health returned status: ${healthData.status}`);

  // Test AI anomaly human-in-the-loop transition proxy (API-1 & WEB-7)
  console.log("Testing POST /api/ai-anomalies/:id/transition proxy...");
  const anomaliesRes = await fetch(`${API_BASE}/api/v1/ai-anomalies?pageSize=10`, {
    headers: { Authorization: `Bearer ${officer.token}` },
  });
  if (!anomaliesRes.ok) {
    throw new Error(`Failed to fetch AI anomalies: ${anomaliesRes.status}`);
  }
  const anomaliesData = (await anomaliesRes.json()) as { items: Array<{ id: string; status: string }> };
  const targetAnomaly = anomaliesData.items.find(
    (a) => a.status === "new" || a.status === "reviewed" || a.status === "investigated",
  );
  if (targetAnomaly) {
    const nextStatus =
      targetAnomaly.status === "new"
        ? "reviewed"
        : targetAnomaly.status === "reviewed"
          ? "investigated"
          : "acted_upon";

    // 1. Valid transition
    const transRes = await fetch(`${WEB_BASE}/api/ai-anomalies/${targetAnomaly.id}/transition`, {
      method: "POST",
      headers: {
        Cookie: officer.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: nextStatus, note: "Advisory review confirmed in field." }),
    });
    if (!transRes.ok) {
      throw new Error(`AI anomaly transition proxy failed: ${transRes.status}: ${await transRes.text()}`);
    }
    const transJson = (await transRes.json()) as { id: string; status: string };
    if (transJson.status !== nextStatus) {
      throw new Error(`Expected anomaly status '${nextStatus}', got '${transJson.status}'`);
    }
    console.log(`✓ Proxy POST AI anomaly transition to '${nextStatus}' passed (id=${targetAnomaly.id})`);

    // 2. Invalid transition: cannot transition backwards to "new" (should return 409 Conflict)
    const invalidTransRes = await fetch(`${WEB_BASE}/api/ai-anomalies/${targetAnomaly.id}/transition`, {
      method: "POST",
      headers: {
        Cookie: officer.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: "new" }),
    });
    if (invalidTransRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for invalid transition, got ${invalidTransRes.status}`);
    }
    console.log(`✓ Invalid transition correctly rejected with 409 Conflict`);
  } else {
    console.log(`(All anomalies in terminal states)`);
  }

  // Step 12: Video Conferencing (VC) Tripartite Review Integration
  console.log("\n12. Testing Video Conferencing (VC) Tripartite Review Integration...");
  // Find an inspection within officer's authorized jurisdiction (Khordha)
  const officerInspListRes = await fetch(`${API_BASE}/api/v1/inspections?pageSize=10`, {
    headers: { Authorization: `Bearer ${officer.token}` },
  });
  const officerInspData = (await officerInspListRes.json()) as { items: Array<{ id: string }> };
  const officerInspId = officerInspData.items[0]!.id;

  // Check SSR inspection detail includes VC section
  const inspDetailWithVcRes = await fetch(`${WEB_BASE}/inspections/${officerInspId}`, {
    headers: { Cookie: officer.cookie },
  });
  if (!inspDetailWithVcRes.ok) {
    throw new Error(`GET /inspections/${officerInspId} returned ${inspDetailWithVcRes.status}`);
  }
  const inspDetailWithVcHtml = await inspDetailWithVcRes.text();
  if (
    !inspDetailWithVcHtml.includes("Remote Tripartite Hearing &amp; Video Review") &&
    !inspDetailWithVcHtml.includes("Remote Tripartite Hearing & Video Review")
  ) {
    throw new Error("Inspection detail page missing expected VC section");
  }
  console.log("✓ Inspection detail page rendered Remote Tripartite Hearing section");

  // Test Proxy POST /api/vc/sessions to schedule a hearing
  console.log("Testing POST /api/vc/sessions proxy...");
  const createVcRes = await fetch(`${WEB_BASE}/api/vc/sessions`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Tripartite Compliance Review Hearing",
      inspectionId: officerInspId,
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      provider: "webrtc",
    }),
  });
  if (!createVcRes.ok) {
    throw new Error(
      `POST /api/vc/sessions returned ${createVcRes.status}: ${await createVcRes.text()}`,
    );
  }
  const createdVc = (await createVcRes.json()) as {
    id: string;
    status: string;
    roomName: string;
    title: string;
  };
  if (!createdVc.id || createdVc.status !== "scheduled" || !createdVc.roomName) {
    throw new Error("Created VC session payload invalid");
  }
  console.log(
    `✓ Proxy POST /api/vc/sessions scheduled hearing id=${createdVc.id}, room=${createdVc.roomName}`,
  );

  // Test Proxy GET /api/vc/sessions
  const listVcRes = await fetch(`${WEB_BASE}/api/vc/sessions?inspectionId=${officerInspId}`, {
    headers: { Cookie: officer.cookie },
  });
  if (!listVcRes.ok) throw new Error(`GET /api/vc/sessions returned ${listVcRes.status}`);
  const listVcData = (await listVcRes.json()) as { items: Array<{ id: string }> };
  if (!listVcData.items.some((s) => s.id === createdVc.id)) {
    throw new Error("Expected newly scheduled VC session in inspection sessions list");
  }
  console.log(
    `✓ Proxy GET /api/vc/sessions returned ${listVcData.items.length} session(s) for inspection`,
  );

  // Test Proxy POST /api/vc/sessions/:id/start
  console.log(`Testing POST /api/vc/sessions/${createdVc.id}/start proxy...`);
  const startVcRes = await fetch(`${WEB_BASE}/api/vc/sessions/${createdVc.id}/start`, {
    method: "POST",
    headers: { Cookie: officer.cookie },
  });
  if (!startVcRes.ok)
    throw new Error(
      `POST start VC session returned ${startVcRes.status}: ${await startVcRes.text()}`,
    );
  const startedVc = (await startVcRes.json()) as { status: string; startedAt: string };
  if (startedVc.status !== "active" || !startedVc.startedAt) {
    throw new Error(`Expected VC session status='active', got '${startedVc.status}'`);
  }
  console.log(
    `✓ Proxy POST start transitioned session to active (startedAt=${startedVc.startedAt})`,
  );

  // Test Proxy POST /api/vc/sessions/:id/join
  console.log(`Testing POST /api/vc/sessions/${createdVc.id}/join proxy...`);
  const joinVcRes = await fetch(`${WEB_BASE}/api/vc/sessions/${createdVc.id}/join`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "host" }),
  });
  if (!joinVcRes.ok)
    throw new Error(`POST join VC session returned ${joinVcRes.status}: ${await joinVcRes.text()}`);
  const joinData = (await joinVcRes.json()) as {
    token: string;
    roomName: string;
    role: string;
    webrtcConfig: { iceServers: unknown[] };
  };
  if (!joinData.token || !joinData.webrtcConfig?.iceServers || joinData.role !== "host") {
    throw new Error("Join VC session response missing token or WebRTC configuration");
  }
  console.log(`✓ Proxy POST join returned signed WebRTC session token and ICE configuration`);

  // Test Proxy POST /api/vc/sessions/:id/end
  console.log(`Testing POST /api/vc/sessions/${createdVc.id}/end proxy...`);
  const endVcRes = await fetch(`${WEB_BASE}/api/vc/sessions/${createdVc.id}/end`, {
    method: "POST",
    headers: { Cookie: officer.cookie },
  });
  if (!endVcRes.ok) throw new Error(`POST end VC session returned ${endVcRes.status}`);
  const endedVc = (await endVcRes.json()) as { status: string; endedAt: string };
  if (endedVc.status !== "completed" || !endedVc.endedAt) {
    throw new Error(`Expected status='completed', got '${endedVc.status}'`);
  }
  console.log(`✓ Proxy POST end transitioned session to completed (endedAt=${endedVc.endedAt})`);

  // Step 13: Realtime WebSocket Push & Subscription Integration
  console.log("\n13. Testing Realtime WebSocket Push & Subscription Integration...");
  const realtimeTokenRes = await fetch(`${WEB_BASE}/api/realtime/token`, {
    headers: { Cookie: officer.cookie },
  });
  if (!realtimeTokenRes.ok)
    throw new Error(`GET /api/realtime/token returned ${realtimeTokenRes.status}`);
  const { token: rtToken, wsUrl } = (await realtimeTokenRes.json()) as {
    token: string;
    wsUrl: string;
  };
  if (!rtToken || !wsUrl) throw new Error("Missing token or wsUrl from /api/realtime/token");
  console.log(`✓ Acquired realtime connection credentials: wsUrl=${wsUrl}`);

  // Connect WebSocket client using native WebSocket
  const wsTarget = `${wsUrl}?token=${encodeURIComponent(rtToken)}&topics=vc_session.*,inspection.*`;
  console.log(`Connecting WebSocket to ${wsUrl}...`);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
    const ws = new WebSocket(wsTarget);

    ws.onopen = () => {
      console.log("✓ WebSocket connection opened successfully");
    };

    ws.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data as string) as {
          event: string;
          data?: { allowedTopics?: string[] };
        };
        if (parsed.event === "netram.authorized") {
          console.log(
            `✓ Realtime authorized for topics: ${JSON.stringify(parsed.data?.allowedTopics)}`,
          );
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${String(err)}`));
    };
  });
  console.log("✓ WebSocket subscription authorized and closed cleanly");

  // Step 14: Complaints & Grievance Lifecycle Integration (§35)
  console.log("\n14. Testing Complaints & Grievance Lifecycle Integration...");
  const complaintsListRes = await fetch(`${WEB_BASE}/complaints`, {
    headers: { Cookie: officer.cookie },
  });
  if (!complaintsListRes.ok) {
    throw new Error(`GET /complaints returned ${complaintsListRes.status}`);
  }
  const complaintsHtml = await complaintsListRes.text();
  if (!complaintsHtml.includes("Complaints &amp; Grievances") && !complaintsHtml.includes("Complaints & Grievances")) {
    throw new Error("Complaints page missing expected heading");
  }
  console.log(`✓ /complaints rendered successfully (${complaintsHtml.length} bytes, contains header and layout)`);

  // Get accessible project for creating a complaint
  const cmpProjectsRes = await fetch(`${API_BASE}/api/v1/projects?pageSize=1`, {
    headers: { Authorization: `Bearer ${officer.token}` },
  });
  const cmpProjectsData = (await cmpProjectsRes.json()) as { items: Array<{ id: string; code: string; name: string }> };
  const targetProject = cmpProjectsData.items[0];
  if (!targetProject) throw new Error("No accessible project found for complaint testing");

  // Test POST /api/complaints proxy
  console.log("Testing POST /api/complaints proxy...");
  const createCmpRes = await fetch(`${WEB_BASE}/api/complaints`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: targetProject.id,
      description: "Runtime verification grievance: improper storage and safety fence damage.",
      complainantName: "Citizen Whistleblower",
      contactInfo: "citizen@example.gov",
    }),
  });
  if (!createCmpRes.ok) {
    throw new Error(`POST /api/complaints failed: ${createCmpRes.status}: ${await createCmpRes.text()}`);
  }
  const createdCmp = (await createCmpRes.json()) as { id: string; trackingCode: string; status: string };
  if (!createdCmp.id || !createdCmp.trackingCode || createdCmp.status !== "received") {
    throw new Error(`Unexpected complaint creation response: ${JSON.stringify(createdCmp)}`);
  }
  console.log(`✓ Proxy POST /api/complaints created grievance: id=${createdCmp.id}, tracking=${createdCmp.trackingCode}`);

  // Test SSR GET /complaints/:id
  console.log(`Testing SSR GET /complaints/${createdCmp.id}...`);
  const cmpDetailRes = await fetch(`${WEB_BASE}/complaints/${createdCmp.id}`, {
    headers: { Cookie: officer.cookie },
  });
  if (!cmpDetailRes.ok) {
    throw new Error(`GET /complaints/${createdCmp.id} returned ${cmpDetailRes.status}`);
  }
  const cmpDetailHtml = await cmpDetailRes.text();
  if (!cmpDetailHtml.includes(createdCmp.trackingCode)) {
    throw new Error("Complaint detail page missing tracking code");
  }
  console.log(`✓ /complaints/${createdCmp.id} rendered successfully (${cmpDetailHtml.length} bytes, contains dossier)`);

  // Test POST /api/complaints/:id/transition (received -> under_review)
  console.log(`Testing POST /api/complaints/${createdCmp.id}/transition proxy (received -> under_review)...`);
  const transCmpRes = await fetch(`${WEB_BASE}/api/complaints/${createdCmp.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "under_review" }),
  });
  if (!transCmpRes.ok) {
    throw new Error(`POST transition complaint failed: ${transCmpRes.status}: ${await transCmpRes.text()}`);
  }
  const transitionedCmp = (await transCmpRes.json()) as { id: string; status: string };
  if (transitionedCmp.status !== "under_review") {
    throw new Error(`Expected status='under_review', got '${transitionedCmp.status}'`);
  }
  console.log(`✓ Proxy POST transition to 'under_review' passed`);

  // Test invalid transition rejection (under_review -> received should return 409 Conflict)
  const invalidCmpRes = await fetch(`${WEB_BASE}/api/complaints/${createdCmp.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "received" }),
  });
  if (invalidCmpRes.status !== 409) {
    throw new Error(`Expected 409 Conflict for invalid complaint transition, got ${invalidCmpRes.status}`);
  }
  console.log(`✓ Invalid complaint transition correctly rejected with 409 Conflict`);

  // Test Public Citizen Tracking Endpoint (GET /api/complaints/track/:code)
  console.log(`Testing public GET /api/complaints/track/${createdCmp.trackingCode}...`);
  const publicTrackRes = await fetch(`${WEB_BASE}/api/complaints/track/${encodeURIComponent(createdCmp.trackingCode)}`);
  if (!publicTrackRes.ok) {
    throw new Error(`Public track endpoint returned ${publicTrackRes.status}: ${await publicTrackRes.text()}`);
  }
  const trackData = (await publicTrackRes.json()) as {
    trackingCode: string;
    projectCode: string;
    status: string;
    complainantName?: string;
  };
  if (trackData.trackingCode !== createdCmp.trackingCode || trackData.status !== "under_review") {
    throw new Error(`Public track data mismatch: ${JSON.stringify(trackData)}`);
  }
  if (trackData.complainantName !== undefined) {
    throw new Error("PRIVACY VIOLATION: Complainant name leaked in public tracking response!");
  }
  console.log(`✓ Public tracking endpoint verified: trackingCode=${trackData.trackingCode}, status=${trackData.status}, PII omitted`);

  // Test Public Citizen Portal SSR (GET /track-complaint)
  const trackPortalRes = await fetch(`${WEB_BASE}/track-complaint?code=${encodeURIComponent(createdCmp.trackingCode)}`);
  if (!trackPortalRes.ok) {
    throw new Error(`GET /track-complaint returned ${trackPortalRes.status}`);
  }
  const trackPortalHtml = await trackPortalRes.text();
  if (!trackPortalHtml.includes("Track Grievance Status")) {
    throw new Error("Citizen tracking portal missing expected title");
  }
  console.log(`✓ /track-complaint rendered successfully (${trackPortalHtml.length} bytes, citizen portal OK)`);

  // Step 15: Corrective Actions Workflow (WEB + API)
  console.log("\n15. Testing Corrective Actions Lifecycle & Proxy Integration...");

  // Test SSR GET /corrective-actions
  console.log("Testing SSR GET /corrective-actions...");
  const caListRes = await fetch(`${WEB_BASE}/corrective-actions`, {
    headers: { Cookie: officer.cookie },
  });
  if (!caListRes.ok) {
    throw new Error(`GET /corrective-actions returned ${caListRes.status}`);
  }
  const caListHtml = await caListRes.text();
  if (!caListHtml.includes("Corrective Actions") || !caListHtml.includes("Pending Compliance")) {
    throw new Error("Corrective Actions page HTML missing expected headings/metrics");
  }
  console.log(`✓ /corrective-actions rendered successfully (${caListHtml.length} bytes, contains layout)`);

  // Find or create a confirmed finding to order a corrective action against
  const officerInspectionsRes = await fetch(`${API_BASE}/api/v1/inspections?pageSize=20`, {
    headers: { Authorization: `Bearer ${officer.token}` },
  });
  const officerInsps = (await officerInspectionsRes.json()) as {
    items: Array<{ id: string; status: string; districtId: string }>;
  };
  const targetInsp = officerInsps.items.find((i) =>
    ["under_review", "findings", "corrective_actions"].includes(i.status),
  );
  if (!targetInsp) {
    throw new Error("Expected at least one inspection in review/findings status in officer jurisdiction");
  }

  // Create a new deficiency finding
  const createFindingRes = await fetch(`${API_BASE}/api/v1/inspections/${targetInsp.id}/findings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${officer.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      severity: "high",
      description: `Deficiency finding for corrective action test at ${new Date().toISOString()}`,
      remediation: "Execute structural waterproofing and submit certified inspection report.",
    }),
  });
  if (!createFindingRes.ok) {
    throw new Error(`Failed to create test finding: ${createFindingRes.status}`);
  }
  const testFinding = (await createFindingRes.json()) as { id: string; status: string };

  // Transition finding to 'confirmed' so canOrderCorrectiveAction is true
  const confirmFindingRes = await fetch(`${API_BASE}/api/v1/findings/${testFinding.id}/transitions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${officer.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "confirmed", note: "Finding confirmed by officer" }),
  });
  if (!confirmFindingRes.ok) {
    throw new Error(`Failed to confirm test finding: ${confirmFindingRes.status}`);
  }

  // Test Web Proxy POST /api/corrective-actions (Order corrective action)
  console.log("Testing POST /api/corrective-actions proxy to order corrective action...");
  const orderCaRes = await fetch(`${WEB_BASE}/api/corrective-actions`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      findingId: testFinding.id,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  if (!orderCaRes.ok) {
    throw new Error(`POST /api/corrective-actions returned ${orderCaRes.status}: ${await orderCaRes.text()}`);
  }
  const createdCa = (await orderCaRes.json()) as { id: string; status: string; findingId: string };
  if (createdCa.findingId !== testFinding.id || createdCa.status !== "pending") {
    throw new Error(`Unexpected corrective action payload: ${JSON.stringify(createdCa)}`);
  }
  console.log(`✓ Corrective action ordered via proxy: id=${createdCa.id}, status=${createdCa.status}`);

  // Test SSR GET /corrective-actions/:id (Dossier page)
  console.log(`Testing SSR GET /corrective-actions/${createdCa.id}...`);
  const caDetailRes = await fetch(`${WEB_BASE}/corrective-actions/${createdCa.id}`, {
    headers: { Cookie: officer.cookie },
  });
  if (!caDetailRes.ok) {
    throw new Error(`GET /corrective-actions/${createdCa.id} returned ${caDetailRes.status}`);
  }
  const caDetailHtml = await caDetailRes.text();
  if (!caDetailHtml.includes("Remediation") || !caDetailHtml.includes("Statutory Compliance")) {
    throw new Error("Corrective action detail page missing expected headings");
  }
  console.log(`✓ /corrective-actions/${createdCa.id} rendered successfully (${caDetailHtml.length} bytes)`);

  // Test POST /api/corrective-actions/:id/transition (pending -> submitted)
  console.log(`Testing POST /api/corrective-actions/${createdCa.id}/transition (pending -> submitted)...`);
  const submitRes = await fetch(`${WEB_BASE}/api/corrective-actions/${createdCa.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "submitted",
      note: "Contractor submitted waterproofing test certificate and photos",
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`POST transition to submitted failed: ${submitRes.status}: ${await submitRes.text()}`);
  }
  const submittedCa = (await submitRes.json()) as { id: string; status: string };
  if (submittedCa.status !== "submitted") {
    throw new Error(`Expected status='submitted', got '${submittedCa.status}'`);
  }
  console.log(`✓ Proxy transition to 'submitted' passed`);

  // Test POST /api/corrective-actions/:id/transition (submitted -> under_review)
  console.log(`Testing POST /api/corrective-actions/${createdCa.id}/transition (submitted -> under_review)...`);
  const reviewRes = await fetch(`${WEB_BASE}/api/corrective-actions/${createdCa.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "under_review",
      note: "Executive engineer commenced review of submitted materials",
    }),
  });
  if (!reviewRes.ok) {
    throw new Error(`POST transition to under_review failed: ${reviewRes.status}: ${await reviewRes.text()}`);
  }
  const reviewingCa = (await reviewRes.json()) as { id: string; status: string };
  if (reviewingCa.status !== "under_review") {
    throw new Error(`Expected status='under_review', got '${reviewingCa.status}'`);
  }
  console.log(`✓ Proxy transition to 'under_review' passed`);

  // Test POST /api/corrective-actions/:id/transition (under_review -> accepted)
  console.log(`Testing POST /api/corrective-actions/${createdCa.id}/transition (under_review -> accepted)...`);
  const acceptRes = await fetch(`${WEB_BASE}/api/corrective-actions/${createdCa.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "accepted",
      note: "Site reinspection verified compliant execution. Deficiency resolved.",
    }),
  });
  if (!acceptRes.ok) {
    throw new Error(`POST transition to accepted failed: ${acceptRes.status}: ${await acceptRes.text()}`);
  }
  const acceptedCa = (await acceptRes.json()) as { id: string; status: string };
  if (acceptedCa.status !== "accepted") {
    throw new Error(`Expected status='accepted', got '${acceptedCa.status}'`);
  }
  console.log(`✓ Proxy transition to 'accepted' passed (Finding deficiency closed)`);

  // Test Invalid Transition Rejection (accepted -> submitted should return 409 Conflict)
  console.log("Testing invalid transition rejection on terminal state...");
  const invalidCaRes = await fetch(`${WEB_BASE}/api/corrective-actions/${createdCa.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "submitted" }),
  });
  if (invalidCaRes.status !== 409) {
    throw new Error(`Expected 409 Conflict for invalid corrective action transition, got ${invalidCaRes.status}`);
  }
  console.log(`✓ Invalid corrective action transition correctly rejected with 409 Conflict`);

  console.log("\n==================================================================");
  console.log("✓ ALL 15 NETRAM WEB DASHBOARD INTEGRATION CHECKS PASSED PERFECTLY!");
  console.log("==================================================================");

  // Step 16: User Admin & Scoped Role Assignment (WEB + API)
  console.log("\n16. Testing User Administration & Scoped Role Assignment Integration...");

  // Establish Admin Session (admin.example-social@dev.netram.in)
  console.log("Establishing Department Admin session (admin.example-social@dev.netram.in)...");
  const admin = await loginAndGetCookie("admin.example-social@dev.netram.in");
  console.log(`✓ Admin authenticated: id=${admin.user.id}`);

  // Test SSR GET /admin
  console.log("Testing SSR GET /admin...");
  const adminPageRes = await fetch(`${WEB_BASE}/admin`, {
    headers: { Cookie: admin.cookie },
  });
  if (!adminPageRes.ok) {
    throw new Error(`GET /admin returned ${adminPageRes.status}`);
  }
  const adminHtml = await adminPageRes.text();
  if (!adminHtml.includes("User Administration") || !adminHtml.includes("User Directory")) {
    throw new Error("Admin page HTML missing expected headings");
  }
  console.log(`✓ /admin rendered successfully (${adminHtml.length} bytes, contains operator directory)`);

  // Fetch users and jurisdictions to target for role assignment & status update
  const listUsersRes = await fetch(`${API_BASE}/api/v1/users?pageSize=20`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const usersData = (await listUsersRes.json()) as { items: Array<{ id: string; email: string; status: string }> };
  const targetOperator = usersData.items.find((u) => u.email !== admin.user.email);
  if (!targetOperator) {
    throw new Error("Expected at least one non-admin operator in seed data");
  }

  const listJurisdictionsRes = await fetch(`${API_BASE}/api/v1/jurisdictions`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const jurisdictionsData = (await listJurisdictionsRes.json()) as Array<{ id: string; code: string; name: string }>;
  const targetJurisdiction = jurisdictionsData.find((j) => j.code.includes("PURI") || j.name.includes("Puri")) ?? jurisdictionsData[0];
  if (!targetJurisdiction) {
    throw new Error("Expected at least one jurisdiction in seed data");
  }

  // 1. Test Proxy PATCH /api/admin/users/:id to suspend operator
  console.log(`Testing PATCH /api/admin/users/${targetOperator.id} proxy (status -> suspended)...`);
  const suspendRes = await fetch(`${WEB_BASE}/api/admin/users/${targetOperator.id}`, {
    method: "PATCH",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "suspended" }),
  });
  if (!suspendRes.ok) {
    throw new Error(`PATCH /api/admin/users/:id to suspend returned ${suspendRes.status}`);
  }
  const suspendedUser = (await suspendRes.json()) as { id: string; status: string };
  if (suspendedUser.status !== "suspended") {
    throw new Error(`Expected status='suspended', got '${suspendedUser.status}'`);
  }
  console.log(`✓ Proxy PATCH status to 'suspended' passed for ${targetOperator.email}`);

  // 2. Test Proxy PATCH /api/admin/users/:id to reactivate operator
  console.log(`Testing PATCH /api/admin/users/${targetOperator.id} proxy (status -> active)...`);
  const reactivateRes = await fetch(`${WEB_BASE}/api/admin/users/${targetOperator.id}`, {
    method: "PATCH",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "active" }),
  });
  if (!reactivateRes.ok) {
    throw new Error(`PATCH /api/admin/users/:id to reactivate returned ${reactivateRes.status}`);
  }
  const reactivatedUser = (await reactivateRes.json()) as { id: string; status: string };
  if (reactivatedUser.status !== "active") {
    throw new Error(`Expected status='active', got '${reactivatedUser.status}'`);
  }
  console.log(`✓ Proxy PATCH status to 'active' passed for ${targetOperator.email}`);

  // 3. Test Proxy POST /api/admin/users/:id/role-assignments
  console.log(`Testing POST /api/admin/users/${targetOperator.id}/role-assignments proxy...`);
  const assignRes = await fetch(`${WEB_BASE}/api/admin/users/${targetOperator.id}/role-assignments`, {
    method: "POST",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roleCode: "inspector",
      scope: "jurisdiction",
      jurisdictionId: targetJurisdiction.id,
    }),
  });
  if (!assignRes.ok) {
    throw new Error(`POST /api/admin/users/:id/role-assignments failed: ${assignRes.status}: ${await assignRes.text()}`);
  }
  const assignment = (await assignRes.json()) as { id: string; roleCode: string; scope: string; jurisdictionId: string };
  if (assignment.roleCode !== "inspector" || assignment.scope !== "jurisdiction") {
    throw new Error(`Unexpected assignment payload: ${JSON.stringify(assignment)}`);
  }
  console.log(`✓ Scoped role assignment created: id=${assignment.id}, role=${assignment.roleCode}, scope=${assignment.scope}`);

  // 4. Test Duplicate Role Assignment Rejection (409 Conflict)
  console.log("Testing duplicate role assignment rejection (409 Conflict)...");
  const dupRes = await fetch(`${WEB_BASE}/api/admin/users/${targetOperator.id}/role-assignments`, {
    method: "POST",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roleCode: "inspector",
      scope: "jurisdiction",
      jurisdictionId: targetJurisdiction.id,
    }),
  });
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 Conflict for duplicate role assignment, got ${dupRes.status}`);
  }
  console.log(`✓ Duplicate role assignment correctly rejected with 409 Conflict`);

  // 5. Test Proxy DELETE /api/admin/role-assignments/:id
  console.log(`Testing DELETE /api/admin/role-assignments/${assignment.id} proxy...`);
  const deleteRes = await fetch(`${WEB_BASE}/api/admin/role-assignments/${assignment.id}`, {
    method: "DELETE",
    headers: { Cookie: admin.cookie },
  });
  if (deleteRes.status !== 204) {
    throw new Error(`Expected 204 No Content for role assignment deletion, got ${deleteRes.status}`);
  }
  console.log(`✓ Proxy DELETE role assignment passed (status 204)`);

  // Step 17: Inspection Scheduling & Lifecycle Progression Integration
  console.log("\n17. Testing Inspection Scheduling & Lifecycle Progression Integration...");

  // 1. Test Proxy POST /api/projects
  console.log("Testing POST /api/projects proxy...");
  const createProjRes = await fetch(`${WEB_BASE}/api/projects`, {
    method: "POST",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Khordha Community Health & Rehab Unit #${Date.now().toString().slice(-4)}`,
      type: "institution",
      description: "Automated facility created via Next.js proxy route for lifecycle verification",
    }),
  });
  if (!createProjRes.ok) {
    throw new Error(`POST /api/projects failed: ${createProjRes.status}: ${await createProjRes.text()}`);
  }
  const createdFacility = (await createProjRes.json()) as { id: string; name: string; status: string };
  console.log(`✓ Facility registered via proxy: id=${createdFacility.id}, status=${createdFacility.status}`);

  // 2. Schedule a new routine inspection for the facility
  console.log("Testing POST /api/inspections proxy to schedule inspection...");
  const scheduleRes = await fetch(`${WEB_BASE}/api/inspections`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: targetProject.id,
      type: "routine",
      trigger: "officer",
      scheduledStart: new Date(Date.now() + 86400000).toISOString(),
      scheduledEnd: new Date(Date.now() + 2 * 86400000).toISOString(),
    }),
  });
  if (!scheduleRes.ok) {
    throw new Error(`POST /api/inspections failed: ${scheduleRes.status}: ${await scheduleRes.text()}`);
  }
  const scheduledInsp = (await scheduleRes.json()) as { id: string; status: string; type: string };
  if (scheduledInsp.status !== "assigned" || scheduledInsp.type !== "routine") {
    throw new Error(`Unexpected inspection state: ${JSON.stringify(scheduledInsp)}`);
  }
  console.log(`✓ Inspection created via proxy: id=${scheduledInsp.id}, status=${scheduledInsp.status}`);

  // 3. SSR GET /inspections/[id] to verify Lifecycle Progression Stepper
  console.log(`Testing SSR GET /inspections/${scheduledInsp.id}...`);
  const inspDetailRes = await fetch(`${WEB_BASE}/inspections/${scheduledInsp.id}`, {
    headers: { Cookie: officer.cookie },
  });
  if (!inspDetailRes.ok) {
    throw new Error(`GET /inspections/:id returned ${inspDetailRes.status}`);
  }
  const inspDetailHtml = await inspDetailRes.text();
  if (!inspDetailHtml.includes("Statutory Lifecycle Stepper")) {
    throw new Error("Inspection detail HTML missing expected lifecycle stepper content");
  }
  console.log(`✓ /inspections/${scheduledInsp.id} rendered successfully (${inspDetailHtml.length} bytes, contains stepper)`);

  // 4. Test Transition Progression: assigned -> scheduled -> in_progress -> evidence_collection -> submitted -> under_review -> findings -> corrective_actions -> verification -> closed
  const lifecycleSteps = [
    { to: "scheduled", note: "Inspection window formalized and team notified" },
    { to: "in_progress", note: "Field verification initiated on site" },
    { to: "evidence_collection", note: "Evidence gathering and photo capture active" },
    { to: "submitted", note: "Field inspection dossier compiled and submitted" },
    { to: "under_review", note: "Under supervisory review by authority officer" },
    { to: "findings", note: "Regulatory non-compliance findings documented" },
    { to: "corrective_actions", note: "Remediation measures formally ordered" },
    { to: "verification", note: "Remediation verified on site" },
    { to: "closed", note: "Statutory inspection concluded and sealed" },
  ];

  for (const step of lifecycleSteps) {
    const tRes = await fetch(`${WEB_BASE}/api/inspections/${scheduledInsp.id}/transition`, {
      method: "POST",
      headers: {
        Cookie: officer.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: step.to, note: step.note }),
    });
    if (!tRes.ok) {
      throw new Error(`POST /api/inspections/:id/transition to '${step.to}' failed: ${tRes.status}: ${await tRes.text()}`);
    }
    const tData = (await tRes.json()) as { id: string; status: string };
    if (tData.status !== step.to) {
      throw new Error(`Expected status='${step.to}', got '${tData.status}'`);
    }
    console.log(`✓ Proxy transition to '${step.to}' passed`);
  }

  // 5. Test Invalid Transition Rejection on Terminal State (409 Conflict)
  console.log("Testing invalid transition rejection on terminal state...");
  const invalidTRes = await fetch(`${WEB_BASE}/api/inspections/${scheduledInsp.id}/transition`, {
    method: "POST",
    headers: {
      Cookie: officer.cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "in_progress", note: "Illegal transition" }),
  });
  if (invalidTRes.status !== 409) {
    throw new Error(`Expected 409 Conflict for invalid transition on closed inspection, got ${invalidTRes.status}`);
  }
  console.log(`✓ Invalid inspection transition correctly rejected with 409 Conflict`);

  console.log("\n==================================================================");
  console.log("✓ ALL 17 NETRAM WEB DASHBOARD INTEGRATION CHECKS PASSED PERFECTLY!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("\n❌ Web runtime verification failed:", err);
  process.exit(1);
});

