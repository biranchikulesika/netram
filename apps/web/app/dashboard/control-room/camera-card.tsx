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
}

/**
 * Production CCTV camera card (Phase 5).
 *
 * The card itself holds NO stream session - a camera being online does NOT
 * mean this browser has an active WebRTC session (PART 7). This component
 * renders only for cameras the wall is NOT currently playing: once a camera
 * scrolls into view the wall swaps it for an HlsWallTile, which takes over
 * that camera's session lifecycle. So the only action here is the
 * full-screen WebRTC viewer.
 *
 * Honest states: "Idle" vs "Camera offline" reflects the camera's
 * administrative status, not stream health - see the note on `online`
 * below. Connection states surface inside the live viewer
 * ("Connecting to camera…", "LIVE", "Unable to connect…").
 */
export function CameraCard({ camera, onOpen }: CameraCardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);

  const online = camera.status === "active";

  // Deliberately NOT the gateway health value. Sources are on-demand, so a
  // camera nobody is watching reports `offline` - gating the button on that
  // would hide it on every idle camera and make it impossible to ever start
  // a stream. `active` is the administrative state: may this camera be used?
  // The tile label below is what carries honest stream state.
  const idleLabel = camera.status === "maintenance" ? "Camera under maintenance" : "Camera offline";

  const handleOpen = useCallback(() => {
    if (online) onOpen(camera);
  }, [camera, online, onOpen]);

  const [facility, place] = splitFacilityPlace(camera.name);

  return (
    <div
      className="camera-card camera-card-compact"
      data-camera-id={camera.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="cc-viewport" ref={viewportRef}>
        <div className="cc-idle-placeholder" aria-hidden="true">
          <span className="cc-idle-label">{online ? "Idle" : idleLabel}</span>
        </div>
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

        <div className="cc-center">
          {online && (
            <button
              type="button"
              onClick={handleOpen}
              title="Open live viewer"
              className={`cc-play-btn ${hover ? "cc-play-btn-visible" : ""}`}
            >
              <IconPlay style={{ width: 15, height: 15 }} />
              Live
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
