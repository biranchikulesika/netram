"use client";

import { useCallback, useRef, useState } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { IconPlay } from "../../components/icons";

// "Vani Vihar - Dormitory Block" -> ["Vani Vihar", "Dormitory Block"]
// "Main Gate" -> ["Main Gate", ""]
function splitFacilityPlace(name: string): [string, string] {
  const idx = name.indexOf(" - ");
  if (idx === -1) return [name, ""];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

export interface CameraCardProps {
  camera: PublicCctvCamera;
  /** Open the camera detail / live viewer (real WebRTC session, PART 10). */
  onOpen: (camera: PublicCctvCamera) => void;
  /** Switch this tile to an HLS wall tile (PART 8 — explicit user intent). */
  onToggleHls: (cameraId: string) => void;
}

/**
 * Production CCTV camera card (Phase 5).
 *
 * The card itself holds NO stream session — a camera being online does NOT
 * mean this browser has an active WebRTC session (PART 7). Two explicit
 * user paths exist:
 *
 *   "Live"  → CameraLiveViewer modal (WebRTC/WHEP, one session, heartbeat,
 *             cleanup on close).
 *   "HLS"   → HlsWallTile (authorized HLS via the same-origin proxy) for
 *             wall-style monitoring.
 *
 * Honest states: the tile shows "Camera available" vs "Camera offline"
 * from the camera's real status; connection states surface inside the
 * live viewer ("Connecting to camera…", "LIVE", "Unable to connect…").
 */
export function CameraCard({ camera, onOpen, onToggleHls }: CameraCardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const online = camera.status === "active";

  const handleOpen = useCallback(() => {
    if (online) onOpen(camera);
  }, [camera, online, onOpen]);

  const [facility, place] = splitFacilityPlace(camera.name);

  return (
    <div
      className="camera-card camera-card-compact"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="cc-viewport" ref={viewportRef}>
        <div className="cc-idle-placeholder" aria-hidden="true">
          <span className="cc-idle-label">{online ? "Camera available" : "Camera offline"}</span>
        </div>
        <div className="cc-vp-osd cc-vp-osd-tl">
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#ffffff",
              textShadow: "0 1px 2px rgba(2, 6, 23, 0.9)",
            }}
          >
            {facility}
          </span>
          {place && (
            <span
              style={{
                fontSize: "0.68rem",
                color: "#cbd5e1",
                textShadow: "0 1px 2px rgba(2, 6, 23, 0.9)",
              }}
            >
              {place}
            </span>
          )}
        </div>

        <div className="cc-center">
          <button
            type="button"
            onClick={handleOpen}
            disabled={!online}
            title={online ? "Open live viewer" : "Camera offline"}
            className={`cc-play-btn ${hover || !online ? "cc-play-btn-visible" : ""}`}
          >
            <IconPlay style={{ width: 15, height: 15 }} />
            Live
          </button>
          {online && (
            <button
              type="button"
              onClick={() => onToggleHls(camera.id)}
              title="Play HLS wall stream (lower latency mode: WebRTC)"
              className={`cc-play-btn cc-hls-btn ${hover ? "cc-play-btn-visible" : ""}`}
            >
              HLS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
