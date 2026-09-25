"use client";

/**
 * DEVELOPMENT-ONLY WHEP (WebRTC-HTTP Egress Protocol) client for the CCTV
 * media rig — Phase 2 of docs/history/cctv-target-architecture.md.
 *
 * Proves the media pipeline: RTSP -> MediaMTX -> WebRTC -> browser <video>.
 * Not part of the CCTV API contract; must not be consumed by any production
 * feature (that is Phase 3+ gateway/API work).
 *
 * WHEP flow (RFC 9725-style, as implemented by MediaMTX):
 *   1. RTCPeerConnection with recvonly transceivers
 *   2. createOffer (no ICE gathering — MediaMTX answers non-trickle)
 *   3. POST SDP offer -> /api/dev/cctv/whep?path=<path> (same-origin proxy)
 *   4. apply answer, ICE runs in-band, media flows
 */

export interface WhepStartOptions {
  /** MediaMTX path name, e.g. "facility-vani/cam-gate". */
  path: string;
  /** Same-origin WHEP proxy route. */
  proxyUrl?: string;
  /**
   * NETRAM playback token (Phase 4). When present, the proxy forwards it as
   * `Authorization: Bearer` and the MediaMTX external auth hook validates it
   * against the live session record. Omitted = dev-open Basic credential.
   */
  token?: string;
  /**
   * NETRAM stream session id (Phase 5 correlation). MediaMTX echoes the WHEP
   * request's query string into its WebRTC session record (`query` field),
   * letting the control plane match reader UUIDs to cctv_streams sessions.
   */
  netramSession?: string;
}

export interface WhepSession {
  pc: RTCPeerConnection;
  /** Close the session and stop the remote stream. */
  stop: () => void;
}

/**
 * Start a WHEP playback session, attaching the remote media stream to
 * `videoEl` when it arrives.
 *
 * Throws on handshake failure (non-201 upstream, invalid answer).
 */
export async function startWhep(
  videoEl: HTMLVideoElement,
  options: WhepStartOptions,
): Promise<WhepSession> {
  const proxyUrl = options.proxyUrl ?? "/api/dev/cctv/whep";
  const pc = new RTCPeerConnection();
  // Testability hook: verification probes read the live session off the
  // video element (dev rig only).
  (videoEl as HTMLVideoElement & { __whepSession?: unknown }).__whepSession = { pc };

  const stop = (): void => {
    try {
      pc.getSenders().forEach((s) => s.track?.stop());
    } catch {
      // receiver-only session — nothing to stop
    }
    pc.close();
    videoEl.srcObject = null;
  };

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (event) => {
    videoEl.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const params = new URLSearchParams({ path: options.path });
  if (options.token) params.set("token", options.token);
  if (options.netramSession) params.set("netramSession", options.netramSession);
  const res = await fetch(`${proxyUrl}?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription?.sdp ?? "",
  });

  if (res.status !== 201) {
    stop();
    const detail = await res.text().catch(() => "");
    throw new Error(`WHEP handshake failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/sdp")) {
    stop();
    throw new Error(`WHEP answer has unexpected content type: ${contentType || "none"}`);
  }

  const answerSdp = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return { pc, stop };
}
