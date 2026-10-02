"use client";

/**
 * Production CCTV WHEP playback controller (Phase 5).
 *
 * Extracted from the Phase 1–2 dev client (lib/dev-cctv-whep.ts) - the
 * handshake mechanics are the proven ones (recvonly transceivers, non-trickle
 * answer, same-origin proxy) - with production lifecycle semantics added:
 *
 *  - Same-origin media proxy (`/api/cctv/media/whep`) instead of the dev route.
 *  - Correlation: the NETRAM stream session id rides the WHEP request as
 *    `netramSession=<streamId>`; MediaMTX echoes the query into its session
 *    record (`query` field, v1.21.1), which is how the control plane finds and
 *    kicks this reader when the session ends.
 *  - Explicit stop() that closes the RTCPeerConnection and detaches media.
 *
 * React integration (mount/unmount/StrictMode) lives in use-cctv-live-stream;
 * this module is deliberately framework-free so it is directly testable.
 */

export interface CctvPlaybackOptions {
  /** MediaMTX media path from the playback contract, e.g. "facility-vani/cam-gate". */
  mediaPath: string;
  /** NETRAM playback token from the playback contract (Bearer credential). */
  token: string;
  /** NETRAM stream session id - the correlation key carried in the WHEP query. */
  netramSession: string;
  /** Same-origin WHEP proxy route. Defaults to the production media proxy. */
  proxyUrl?: string;
  /** Invoked on every connection-state change (after the local one applies). */
  onStateChange?: (state: RTCPeerConnectionState) => void;
  /** Invoked when the peer connection reaches a terminal state. */
  onEnded?: (reason: "failed" | "closed") => void;
}

export interface CctvPlaybackSession {
  /** Current RTCPeerConnection (for stats/diagnostics). */
  readonly pc: RTCPeerConnection;
  /** Stop playback: close the connection, detach media. Idempotent. */
  stop: () => void;
}

/**
 * Start WHEP playback, attaching the remote MediaStream to `videoEl`.
 * Throws on handshake failure (non-201, non-SDP answer, unreachable proxy).
 */
export async function startCctvPlayback(
  videoEl: HTMLVideoElement,
  options: CctvPlaybackOptions,
): Promise<CctvPlaybackSession> {
  const proxyUrl = options.proxyUrl ?? "/api/cctv/media/whep";
  const pc = new RTCPeerConnection();
  // Testability hook (mirrors the Phase 2 dev client): verification probes
  // read the live session off the video element.
  (videoEl as HTMLVideoElement & { __whepSession?: unknown }).__whepSession = { pc };

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    // Receiver-only session: closing the connection tears down receivers
    // and detaches the remote stream.
    pc.close();
    videoEl.srcObject = null;
  };

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.ontrack = (event) => {
    videoEl.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  };

  if (options.onStateChange) {
    pc.addEventListener("connectionstatechange", () => {
      options.onStateChange?.(pc.connectionState);
    });
  }
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "failed") options.onEnded?.("failed");
    else if (pc.connectionState === "closed") options.onEnded?.("closed");
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // The token travels to the proxy; the proxy forwards it upstream as
  // Bearer (server-side only). netramSession travels end-to-end: MediaMTX
  // stores the query on the session record for reader correlation.
  const params = new URLSearchParams({
    path: options.mediaPath,
    netramSession: options.netramSession,
  });
  const res = await fetch(`${proxyUrl}?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Authorization: `Bearer ${options.token}`,
    },
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

/**
 * Receiver-side media statistics for diagnostics/UX (frames advancing =
 * genuinely playing, which connection state alone does not prove).
 */
export interface PlaybackStats {
  framesDecoded: number;
  framesDropped: number;
  /** Mean receiver jitter-buffer delay in ms (0 on loopback links). */
  jitterBufferMs: number | null;
  bytesReceived: number;
}

export async function readPlaybackStats(pc: RTCPeerConnection): Promise<PlaybackStats> {
  const report = await pc.getStats();
  let framesDecoded = 0;
  let framesDropped = 0;
  let jitterDelaySec = 0;
  let jitterEmitted = 0;
  let bytesReceived = 0;
  report.forEach((s) => {
    if (s.type === "inbound-rtp" && s.kind === "video") {
      framesDecoded = s.framesDecoded ?? framesDecoded;
      framesDropped = s.framesDropped ?? framesDropped;
      jitterDelaySec += s.jitterBufferDelay ?? 0;
      jitterEmitted += s.jitterBufferEmittedCount ?? 0;
      bytesReceived += s.bytesReceived ?? 0;
    }
  });
  return {
    framesDecoded,
    framesDropped,
    jitterBufferMs: jitterEmitted > 0 ? Math.round((jitterDelaySec / jitterEmitted) * 1000) : null,
    bytesReceived,
  };
}
