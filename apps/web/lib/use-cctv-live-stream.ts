"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readPlaybackStats, startCctvPlayback, type PlaybackStats } from "./cctv-player";

/**
 * Production CCTV live-view hook (Phase 5): binds the real NETRAM stream
 * lifecycle to a <video> element.
 *
 *   create session (POST /api/cctv/:id/streams, cookie-authenticated)
 *     → WHEP playback (lib/cctv-player, correlation via netramSession)
 *     → heartbeat while active (POST …/streams/:streamId/heartbeat)
 *     → cleanup: DELETE session (best-effort) + RTCPeerConnection close
 *       + heartbeat timer stop, on unmount/camera switch/error.
 *
 * Heartbeat cadence: the server sweeper (Phase 4) reaps sessions whose
 * last_heartbeat_at is older than 90 s (3 missed 30 s heartbeats), so the
 * viewer beats every 30 s - comfortably inside the grace window.
 *
 * StrictMode safety: every async transition is generation-guarded exactly
 * like the Phase 2 dev page - an orphaned session (double-mount or camera
 * switch) is stopped and never drives state.
 */

const HEARTBEAT_INTERVAL_MS = 30_000;
const STATS_INTERVAL_MS = 2_000;

export type CctvStreamPhase =
  "idle" | "creating-session" | "connecting" | "live" | "error" | "ended";

export interface CctvLiveStreamState {
  phase: CctvStreamPhase;
  /** Human-oriented message for the current phase (UX surfaces it verbatim). */
  message: string;
  streamId: string | null;
  stats: PlaybackStats | null;
}

export interface CctvLiveStreamApi extends CctvLiveStreamState {
  /** True while a session exists and cleanup has not finished. */
  active: boolean;
  /** Attach to a <video> element before calling start(). */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface StartStreamResponse {
  streamId?: string;
  playback?: {
    protocol?: string;
    mediaPath?: string;
    token?: string;
  };
}

const IDLE: CctvLiveStreamState = {
  phase: "idle",
  message: "",
  streamId: null,
  stats: null,
};

export function useCctvLiveStream(cameraId: string): CctvLiveStreamApi {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<{ pc: RTCPeerConnection; stop: () => void } | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  const [state, setState] = useState<CctvLiveStreamState>(IDLE);

  const clearTimers = useCallback((): void => {
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (statsTimerRef.current !== null) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  /** Best-effort session end - fire-and-forget DELETE (also on page hide). */
  const endSession = useCallback(
    (streamId: string): void => {
      void fetch(`/api/cctv/${cameraId}/streams/${streamId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: "viewer_stop" }),
        // keepalive so in-flight survives page unload in supporting browsers
        keepalive: true,
      }).catch(() => {
        // Best-effort: the server-side sweeper is the safety net (Phase 4).
      });
    },
    [cameraId],
  );

  const stop = useCallback(async (): Promise<void> => {
    generationRef.current += 1;
    clearTimers();
    sessionRef.current?.stop();
    sessionRef.current = null;
    const streamId = streamIdRef.current;
    streamIdRef.current = null;
    endedRef.current = true;
    if (streamId) endSession(streamId);
    setState(IDLE);
  }, [clearTimers, endSession]);

  const start = useCallback(async (): Promise<void> => {
    const gen = ++generationRef.current;
    endedRef.current = false;

    // Tear down any previous session first (camera switch / restart).
    clearTimers();
    sessionRef.current?.stop();
    sessionRef.current = null;
    const previousStreamId = streamIdRef.current;
    streamIdRef.current = null;
    if (previousStreamId) endSession(previousStreamId);

    const video = videoRef.current;
    if (!video) {
      setState({ ...IDLE, phase: "error", message: "Video element is not mounted." });
      return;
    }

    setState({
      phase: "creating-session",
      message: "Requesting authorized stream…",
      streamId: null,
      stats: null,
    });

    let created: StartStreamResponse;
    try {
      const res = await fetch(`/api/cctv/${cameraId}/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 300 }),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "Not authorized to view this camera."
            : `Stream request failed (${res.status}).`,
        );
      }
      created = (await res.json()) as StartStreamResponse;
    } catch (err) {
      if (gen !== generationRef.current) return;
      setState({
        ...IDLE,
        phase: "error",
        message: err instanceof Error ? err.message : "Unable to open a stream session.",
      });
      return;
    }

    const playback = created.playback;
    const streamId = created.streamId ?? null;
    if (playback?.protocol !== "webrtc" || !playback.mediaPath || !playback.token || !streamId) {
      if (gen !== generationRef.current) return;
      setState({ ...IDLE, phase: "error", message: "Playback contract missing or unsupported." });
      return;
    }

    if (gen !== generationRef.current) {
      // Superseded while creating - release the session we just made.
      endSession(streamId);
      return;
    }

    streamIdRef.current = streamId;
    setState((s) => ({ ...s, phase: "connecting", message: "Connecting to camera…", streamId }));

    try {
      const session = await startCctvPlayback(video, {
        mediaPath: playback.mediaPath,
        token: playback.token,
        netramSession: streamId,
        onStateChange: (pcState) => {
          if (gen !== generationRef.current) return;
          if (pcState === "connected") {
            setState((s) => ({ ...s, phase: "live", message: "LIVE" }));
          } else if (pcState === "connecting" || pcState === "new") {
            setState((s) => ({ ...s, phase: "connecting", message: "Connecting to camera…" }));
          }
        },
        onEnded: (reason) => {
          if (gen !== generationRef.current || endedRef.current) return;
          clearTimers();
          setState((s) => ({
            ...s,
            phase: "error",
            message: reason === "failed" ? "Unable to connect to camera" : "Stream ended.",
          }));
        },
      });

      if (gen !== generationRef.current) {
        session.stop();
        endSession(streamId);
        return;
      }
      sessionRef.current = session;

      // Heartbeat: keep the session alive against the sweeper (30 s cadence
      // vs the server's 90 s grace). Stops on cleanup/unmount.
      heartbeatTimerRef.current = setInterval(() => {
        void fetch(`/api/cctv/${cameraId}/streams/${streamId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
          .then((res) => {
            if (res.status === 404 && gen === generationRef.current) {
              // Session ended server-side (admin revoke / sweeper). Stop
              // cleanly - the token is dead, playback will fail next.
              clearTimers();
              setState((s) => ({ ...s, phase: "ended", message: "Stream session ended." }));
            }
          })
          .catch(() => {
            // transient heartbeat failure: sweeper grace window absorbs it
          });
      }, HEARTBEAT_INTERVAL_MS);

      // Playback stats for diagnostics/UX (frames advancing = truly playing).
      statsTimerRef.current = setInterval(() => {
        void readPlaybackStats(session.pc).then((stats) => {
          if (gen !== generationRef.current) return;
          setState((s) => ({ ...s, stats }));
        });
      }, STATS_INTERVAL_MS);
    } catch (err) {
      if (gen !== generationRef.current) return;
      clearTimers();
      setState({
        ...IDLE,
        phase: "error",
        message: err instanceof Error ? err.message : "Unable to connect to camera",
      });
    }
  }, [cameraId, clearTimers, endSession]);

  // Cleanup on unmount AND on camera switch (cameraId change re-runs this).
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      clearTimers();
      sessionRef.current?.stop();
      sessionRef.current = null;
      const streamId = streamIdRef.current;
      streamIdRef.current = null;
      if (streamId) endSession(streamId);
      setState(IDLE);
    };
  }, [cameraId, clearTimers, endSession]);

  // Best-effort cleanup when the tab/page goes away (beforeunload path).
  useEffect(() => {
    const onHide = (): void => {
      const streamId = streamIdRef.current;
      if (streamId) endSession(streamId);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [endSession]);

  return {
    ...state,
    active:
      state.phase === "live" || state.phase === "connecting" || state.phase === "creating-session",
    videoRef,
    start,
    stop,
  };
}
