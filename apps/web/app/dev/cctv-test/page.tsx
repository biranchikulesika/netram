"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startWhep, type WhepSession } from "@/lib/dev-cctv-whep";

/**
 * DEVELOPMENT-ONLY CCTV Phase 2 test page (throwaway rig).
 *
 * Proves the media pipeline end-to-end: RTSP -> MediaMTX -> WebRTC/WHEP ->
 * browser <video>. NOT part of the product; Phase 3+ replaces this with the
 * gateway-driven control-room player. See
 * docs/history/cctv-phase-1-2.md.
 *
 * Deliberately OUTSIDE the dashboard layout: no auth, no navigation, no
 * production surface - Phase 3 deletes it.
 */

const DEFAULT_PATH = "facility-vani/cam-gate";

type Phase = "idle" | "connecting" | "playing" | "error";

interface PlaybackStats {
  currentTime: string;
  framesDecoded: string;
  latencyMs: string | null;
}

const EMPTY_STATS: PlaybackStats = { currentTime: "0.00", framesDecoded: "0", latencyMs: null };

export default function DevCctvTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WhepSession>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const searchParams = useRef<URLSearchParams>(
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search),
  );
  const [path, setPath] = useState(() => {
    // Verify harness and manual tests select the MediaMTX path via ?path=.
    return searchParams.current.get("path") ?? DEFAULT_PATH;
  });
  // Phase 4: optional NETRAM playback token (?token=...) - forwarded by the
  // proxy as Bearer and validated by the MediaMTX external auth hook.
  const token = searchParams.current.get("token") ?? undefined;
  const [stats, setStats] = useState<PlaybackStats>(EMPTY_STATS);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionGenRef = useRef(0);

  const stopStatsPolling = useCallback(() => {
    if (statsTimerRef.current !== null) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  const startStatsPolling = useCallback((pc: RTCPeerConnection) => {
    stopStatsPolling();
    statsTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      void (async () => {
        const report = await pc.getStats();
        let framesDecoded = 0;
        let jitterDelaySec = 0;
        let jitterEmitted = 0;
        report.forEach((s) => {
          if (s.type === "inbound-rtp" && s.kind === "video") {
            framesDecoded = s.framesDecoded ?? 0;
            // jitterBufferDelay/-EmittedCount live on inbound-rtp (Chrome).
            jitterDelaySec += s.jitterBufferDelay ?? 0;
            jitterEmitted += s.jitterBufferEmittedCount ?? 0;
          }
        });
        const latencyMs =
          jitterEmitted > 0 ? ((jitterDelaySec / jitterEmitted) * 1000).toFixed(0) : null;
        setStats({
          currentTime: (video?.currentTime ?? 0).toFixed(2),
          framesDecoded: String(framesDecoded),
          latencyMs,
        });
      })();
    }, 2_000);
  }, [stopStatsPolling]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    stopStatsPolling();
    setStats(EMPTY_STATS);
    setPhase("idle");
    setMessage("stopped");
  }, [stopStatsPolling]);

  const start = useCallback(async () => {
    const gen = ++sessionGenRef.current;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPhase("connecting");
    setMessage("WHEP handshake…");
    try {
      const video = videoRef.current;
      if (!video) throw new Error("video element not mounted");
      const session = await startWhep(video, { path, token });
      // A newer start() superseded this one (e.g. React StrictMode's
      // double-mount firing start twice) - discard the orphaned session.
      if (gen !== sessionGenRef.current) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      session.pc.addEventListener("connectionstatechange", () => {
        // Only the current generation may drive UI state.
        if (gen !== sessionGenRef.current) return;
        const s = session.pc.connectionState;
        if (s === "connected") {
          setPhase("playing");
          setMessage("WebRTC connected - live stream playing");
          startStatsPolling(session.pc);
        } else if (s === "failed" || s === "closed") {
          setPhase("error");
          setMessage(`connection ${s}`);
          stopStatsPolling();
        }
      });
      setPhase("connecting");
      setMessage("ICE in progress…");
    } catch (err) {
      if (gen !== sessionGenRef.current) return;
      setPhase("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, [path, token, startStatsPolling, stopStatsPolling]);

  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    // Verification harness support: ?autostart=1 begins playback on mount.
    if (new URLSearchParams(window.location.search).has("autostart")) {
      void startRef.current();
    }
  }, []);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
      stopStatsPolling();
    },
    [stopStatsPolling],
  );

  const busy = phase === "connecting";

  return (
    <main
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1.5rem",
      }}
    >
      <header>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-subtle)", margin: 0 }}>
          Development only - throwaway rig
        </p>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--text-primary)", margin: "0.25rem 0" }}>CCTV Phase 2: WHEP playback test</h1>
        <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "var(--text-subtle)", margin: 0 }}>
          RTSP → MediaMTX → WebRTC. Proves the media plane; the production control-room player is
          Phase 3. This page is deleted in Phase 3.
        </p>
      </header>

      <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
        <label htmlFor="whep-path" style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginRight: "0.25rem" }}>
          MediaMTX path
        </label>
        <input
          id="whep-path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          disabled={busy}
          suppressHydrationWarning
          className="rounded"
          style={{ width: "16rem", border: "1px solid var(--color-border-strong)", background: "#ffffff", color: "var(--text-primary)", fontSize: "0.875rem", padding: "0.25rem 0.5rem" }}
        />
        <button
          type="button"
          onClick={start}
          disabled={busy || path.trim().length === 0}
          className="rounded disabled:opacity-50"
          style={{ background: "var(--action-green)", color: "#ffffff", fontSize: "0.875rem", fontWeight: 500, padding: "0.375rem 0.75rem" }}
        >
          Play
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={busy}
          className="rounded disabled:opacity-50"
          style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--color-border-strong)", fontSize: "0.875rem", fontWeight: 500, padding: "0.375rem 0.75rem" }}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="rounded disabled:opacity-50"
          style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--color-border-strong)", fontSize: "0.875rem", fontWeight: 500, padding: "0.375rem 0.75rem" }}
        >
          Restart
        </button>
      </section>

      <section style={{ overflow: "hidden", borderRadius: "0.5rem", border: "1px solid var(--color-border-subtle)", background: "#002449" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ aspectRatio: "16 / 9", width: "100%" }}
          aria-label="Live simulated camera stream"
        />
      </section>

      <section aria-live="polite" style={{ fontSize: "0.875rem" }}>
        <span
          id="cctv-status"
          style={{
            color:
              phase === "error"
                ? "var(--color-error)"
                : phase === "playing"
                  ? "var(--action-green)"
                  : "var(--text-subtle)",
          }}
        >
          {phase}: {message || "-"}
        </span>
      </section>

      <section
        style={{
          borderRadius: "0.25rem",
          padding: "0.75rem",
          fontSize: "0.75rem",
          border: "1px solid var(--color-border-subtle)",
          background: "var(--bg-subtle)",
          color: "var(--text-muted)",
        }}
      >
        <div id="cctv-stats">
          currentTime={stats.currentTime}s framesDecoded={stats.framesDecoded}
          {stats.latencyMs !== null ? ` jitterBufferLatencyMs=${stats.latencyMs}` : ""}
        </div>
        <p style={{ marginTop: "0.25rem", color: "var(--text-subtle)", margin: 0 }}>
          Latency is the receiver jitter-buffer contribution only. Glass-to-glass measurement uses
          the burned-in clock source (CAMERA_SOURCE=clock) - see the phase doc.
        </p>
      </section>
    </main>
  );
}
