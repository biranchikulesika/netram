"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCctvCamera } from "@netram/types";

/**
 * HLS wall tile (Phase 5 PART 8) - the wall/thumbnail playback mode.
 *
 * Wall grids must not open one WebRTC session per visible card (bounded
 * viewers, PART 7), so wall tiles use HLS via the same-origin authorized
 * proxy (/api/cctv/media/hls). The tile manages one real NETRAM session:
 *
 *   mount   → POST /api/cctv/:id/streams  (authorized playback contract)
 *           → /api/cctv/media/hls/<mediaPath>/index.m3u8?token=…
 *   unmount → DELETE session (viewer_stop + correlated reader kick)
 *
 * The wall mounts a tile only while it is in view, so scrolling out of the
 * grid tears the session down. The tile's own button is not play/pause: it
 * opens the full-screen WebRTC viewer, as it did before auto-play.
 *
 * Every playlist/segment request re-presents the token and MediaMTX's
 * external auth hook validates it - HLS is under exactly the same
 * authorization model as WHEP. Native HLS (Safari) plays directly;
 * elsewhere hls.js drives MSE (lazy-imported). Latency is higher than
 * WebRTC - acceptable for wall monitoring (target §1.2); the interactive
 * live viewer stays WebRTC.
 */

interface HlsContract {
  streamId: string;
  mediaPath: string;
  token: string;
}

export interface HlsWallTileProps {
  camera: PublicCctvCamera;
  /** Open the camera detail / live viewer (WebRTC, PART 10). */
  onOpen: (camera: PublicCctvCamera) => void;
}

export function HlsWallTile({ camera, onOpen }: HlsWallTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [contract, setContract] = useState<HlsContract | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [message, setMessage] = useState("");
  const generationRef = useRef(0);

  useEffect(() => {
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
      // Hold a visible state until the first fragment decodes. Minting the
      // session is fast; the on-demand RTSP source takes several seconds to
      // come up, and clearing the message here left a blank black tile with
      // no explanation in between.
      setMessage("Connecting to camera…");
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
  }, [camera.id]);

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
        .then(() => {
          setStatus("playing");
          setMessage("");
        })
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
      // Wall tiles are a many-up low-fidelity overview, so the client is tuned
      // for cost, not latency:
      //  - lowLatencyMode off: no 200ms PART polling, full 1s segments only.
      //    This is the single biggest saving - LL-HLS reloads every playlist
      //    ~5x/s per tile, which is 35 proxied requests/s for a 7-tile wall.
      //  - backBufferLength 0: a wall tile is live-only and never scrubbed, so
      //    hls.js's 90s default back buffer is pure wasted decoded memory.
      // ponytail: buffers are capped for a 7-tile overview; raise
      // maxBufferLength if the wall is ever used for slow-motion review.
      const client = new Hls({
        lowLatencyMode: false,
        backBufferLength: 0,
        maxBufferLength: 6,
        maxMaxBufferLength: 10,
      });
      hlsClient = client;
      client.on(Hls.Events.FRAG_LOADED, () => {
        setStatus((s) => (s === "playing" ? s : "playing"));
        setMessage("");
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

  const handleOpen = useCallback(() => {
    onOpen(camera);
  }, [camera, onOpen]);

  const [facility, place] = splitFacilityPlace(camera.name);

  return (
    <div className="camera-card camera-card-compact" data-camera-id={camera.id}>
      <div className="cc-viewport">
        <video ref={videoRef} autoPlay playsInline muted className="cc-video" />
        <div className="cc-vp-osd cc-vp-osd-tl">
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#ffffff",
              textShadow: "0 1px 2px rgba(0,36,73, 0.9)",
            }}
          >
            {facility}
          </span>
          {place && (
            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--color-border-strong)",
                textShadow: "0 1px 2px rgba(0,36,73, 0.9)",
              }}
            >
              {place}
            </span>
          )}
        </div>
        {status === "playing" && (
          <span className="cc-live-badge" role="status">
            HLS
          </span>
        )}
        {status !== "playing" && message && (
          <div className="cc-center" aria-live="polite">
            <span className="cc-status-text">{message}</span>
          </div>
        )}
        {/* A real button, not a div with onClick: the whole tile is the hit
            area so no visible control covers the footage, while Enter/Space and
            screen readers still work. The global `button` reset is undone in
            .cc-tile-hit because it is a hit area, not a visual control. */}
        <button
          type="button"
          onClick={handleOpen}
          className="cc-tile-hit"
          aria-label={`Open full screen live view: ${camera.name}`}
        />
      </div>
    </div>
  );
}

// "Vani Vihar - Dormitory Block" -> ["Vani Vihar", "Dormitory Block"]
// "Main Gate" -> ["Main Gate", ""]
function splitFacilityPlace(name: string): [string, string] {
  const idx = name.indexOf(" - ");
  if (idx === -1) return [name, ""];
  return [name.slice(0, idx), name.slice(idx + 3)];
}
