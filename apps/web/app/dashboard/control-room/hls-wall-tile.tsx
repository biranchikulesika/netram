"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCctvCamera } from "@netram/types";

/**
 * HLS wall tile (Phase 5 PART 8) — the wall/thumbnail playback mode.
 *
 * Wall grids must not open one WebRTC session per visible card (bounded
 * viewers, PART 7), so wall tiles use HLS via the same-origin authorized
 * proxy (/api/cctv/media/hls). The tile manages one real NETRAM session:
 *
 *   enable  → POST /api/cctv/:id/streams  (authorized playback contract)
 *           → /api/cctv/media/hls/<mediaPath>/index.m3u8?token=…
 *   disable → DELETE session (viewer_stop + correlated reader kick)
 *
 * Every playlist/segment request re-presents the token and MediaMTX's
 * external auth hook validates it — HLS is under exactly the same
 * authorization model as WHEP. Native HLS (Safari) plays directly;
 * elsewhere hls.js drives MSE (lazy-imported). Latency is higher than
 * WebRTC — acceptable for wall monitoring (target §1.2); the interactive
 * live viewer stays WebRTC.
 */

interface HlsContract {
  streamId: string;
  mediaPath: string;
  token: string;
}

export interface HlsWallTileProps {
  camera: PublicCctvCamera;
  /** Explicit user intent — never enabled merely because the tile is visible. */
  enabled: boolean;
  onToggle: (cameraId: string) => void;
  projectHref?: string;
}

export function HlsWallTile({ camera, enabled, onToggle, projectHref }: HlsWallTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [contract, setContract] = useState<HlsContract | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [message, setMessage] = useState("");
  const generationRef = useRef(0);

  const online = camera.status === "active";

  useEffect(() => {
    if (!enabled) return;
    const gen = ++generationRef.current;
    let current: HlsContract | null = null;

    const endSession = (streamId: string): void => {
      void fetch(`/api/cctv/${camera.id}/streams/${streamId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endReason: "viewer_stop" }),
        keepalive: true,
      }).catch(() => {
        // sweeper is the safety net
      });
    };

    const create = async (): Promise<void> => {
      setStatus("loading");
      setMessage("Requesting authorized stream…");
      const res = await fetch(`/api/cctv/${camera.id}/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 300 }),
      });
      if (!res.ok) throw new Error(`Stream request failed (${res.status})`);
      const data = (await res.json()) as {
        streamId?: string;
        playback?: { mediaPath?: string; token?: string };
      };
      if (!data.streamId || !data.playback?.mediaPath || !data.playback.token) {
        throw new Error("Playback contract missing.");
      }
      current = {
        streamId: data.streamId,
        mediaPath: data.playback.mediaPath,
        token: data.playback.token,
      };
      if (gen !== generationRef.current) {
        void endSession(current.streamId);
        return;
      }
      setContract(current);
      setMessage("");
    };

    void create().catch((err: unknown) => {
      if (gen !== generationRef.current) return;
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unable to open stream session.");
    });

    return () => {
      generationRef.current += 1;
      if (current) endSession(current.streamId);
      setContract(null);
      setStatus("idle");
      setMessage("");
    };
  }, [enabled, camera.id]);

  // Attach HLS playback whenever a contract exists.
  useEffect(() => {
    const video = videoRef.current;
    if (!contract || !video) return;

    const playlistUrl = `/api/cctv/media/hls/${contract.mediaPath}/index.m3u8?token=${encodeURIComponent(contract.token)}`;
    let destroyed = false;
    let hlsClient: { destroy: () => void } | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl") !== "") {
      video.src = playlistUrl;
      void video
        .play()
        .then(() => setStatus("playing"))
        .catch(() => undefined);
      return () => {
        video.removeAttribute("src");
      };
    }

    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) {
        setStatus("error");
        setMessage("HLS is not supported in this browser.");
        return;
      }
      const client = new Hls({ lowLatencyMode: true, backBufferLength: 15 });
      hlsClient = client;
      client.on(Hls.Events.FRAG_LOADED, () => {
        setStatus((s) => (s === "playing" ? s : "playing"));
      });
      client.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        setStatus("error");
        setMessage("HLS playback failed.");
      });
      client.loadSource(playlistUrl);
      client.attachMedia(video);
      void video.play().catch(() => undefined);
    });

    return () => {
      destroyed = true;
      hlsClient?.destroy();
      video.removeAttribute("src");
    };
  }, [contract]);

  const handleToggle = useCallback(() => {
    onToggle(camera.id);
  }, [camera.id, onToggle]);

  const [facility, place] = splitFacilityPlace(camera.name);
  const busy = status === "loading";

  return (
    <div className="camera-card camera-card-compact">
      <div className="cc-viewport">
        <video ref={videoRef} autoPlay playsInline muted className="cc-video" />
        <div className="cc-vp-osd cc-vp-osd-tl">
          {projectHref ? (
            <a href={projectHref} className="cc-osd-facility cc-osd-facility-link">
              {facility}
            </a>
          ) : (
            <span className="cc-osd-facility">{facility}</span>
          )}
          {place && <span className="cc-osd-place">{place}</span>}
        </div>
        {!enabled && (
          <div className="cc-idle-placeholder" aria-hidden="true">
            <span className="cc-idle-label">{online ? "Camera available" : "Camera offline"}</span>
          </div>
        )}
        {status === "playing" && (
          <span className="cc-live-badge" role="status">
            HLS
          </span>
        )}
        {status !== "playing" && (message || (enabled && busy)) && (
          <div className="cc-center" aria-live="polite">
            <span className="cc-status-text">{message || "Loading HLS stream…"}</span>
          </div>
        )}
        <div className="cc-center">
          <button
            type="button"
            onClick={handleToggle}
            disabled={!online || busy}
            title={!online ? "Camera offline" : enabled ? "Stop HLS stream" : "Play HLS stream"}
            className={`cc-play-btn cc-play-btn-visible ${status === "playing" ? "cc-play-btn-playing" : ""}`}
          >
            {busy ? "Connecting…" : status === "playing" ? "Stop" : "HLS"}
          </button>
        </div>
      </div>
    </div>
  );
}

// "Vani Vihar - Dormitory Block" -> ["Vani Vihar", "Dormitory Block"]
function splitFacilityPlace(name: string): [string, string] {
  const idx = name.indexOf(" - ");
  if (idx === -1) return [name, ""];
  return [name.slice(0, idx), name.slice(idx + 3)];
}
