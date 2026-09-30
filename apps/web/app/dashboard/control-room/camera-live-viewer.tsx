"use client";

import { useEffect } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { useCctvLiveStream } from "../../../lib/use-cctv-live-stream";
import { IconX } from "../../components/icons";

/**
 * Camera detail / live viewer (Phase 5 PART 10) - an in-Control-Room modal
 * following the existing lightbox pattern (ai-anomaly-modal), so the user
 * watches a camera without navigating to a separate CCTV administration
 * page. WebRTC (interactive live view) is primary; the HLS wall tile is the
 * passive mode.
 *
 * The viewer owns one stream session: created on open, heartbeat while
 * open, ended (viewer_stop + correlated reader kick) on close - including
 * Escape and backdrop click (PART 6 cleanup).
 */
export function CameraLiveViewer({
  camera,
  onClose,
}: {
  camera: PublicCctvCamera;
  onClose: () => void;
}) {
  const live = useCctvLiveStream(camera.id);

  // Open = start; close = stop (which ends the session and kicks the reader).
  useEffect(() => {
    void live.start();
    return () => {
      void live.stop();
    };
    // Intentionally keyed on camera.id only: mount/unmount of the modal is
    // the session lifecycle boundary.
  }, [camera.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const connecting = live.phase === "creating-session" || live.phase === "connecting";
  const liveNow = live.phase === "live";

  return (
    <div
      className="lightbox-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Thinner than the shared .modal-content 1.5rem: the 16:9 viewport is the
          point of this modal, and every rem of chrome steals video pixels. */}
      <div className="modal-content" style={{ maxWidth: 960, padding: "0.7rem" }}>
        <div className="cc-viewport" style={{ borderRadius: 8 }}>
          <video
            ref={live.videoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            muted
            controls={liveNow}
            className="cc-video"
            aria-label={`Live stream: ${camera.name}`}
          />

          {/* Identity sits on the video, not above it: no wasted chrome, and
              it stays readable over whatever the camera is showing. */}
          <div className="cc-vp-osd cc-vp-osd-tl">
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#ffffff",
                textShadow: "0 1px 2px rgba(0,36,73, 0.9)",
              }}
            >
              {camera.name}
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--color-border-strong)",
                textShadow: "0 1px 2px rgba(0,36,73, 0.9)",
              }}
            >
              {camera.status === "active" ? "Online" : "Offline"}
              {liveNow && live.stats ? ` · ${live.stats.framesDecoded} frames` : ""}
            </span>
          </div>

          {/* cc-live-badge sits at right:2.6rem, clearing the 26px close button. */}
          {liveNow && <span className="cc-live-badge" role="status">LIVE</span>}

          <button
            type="button"
            className="cc-vp-close"
            onClick={onClose}
            aria-label="Close live viewer"
            title="Close live viewer"
          >
            <IconX style={{ width: 15, height: 15 }} />
          </button>

          {!liveNow && (
            <div className="cc-center" aria-live="polite">
              <span className="cc-status-text">
                {connecting
                  ? "Connecting to camera…"
                  : live.phase === "error"
                    ? live.message || "Unable to connect to camera"
                    : live.phase === "ended"
                      ? "Stream session ended."
                      : ""}
              </span>
              {(live.phase === "error" || live.phase === "ended") && (
                <button type="button" className="btn-primary" onClick={() => void live.start()}>
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* Machine-readable lifecycle status (verification + a11y live region). */}
        <span id="cctv-viewer-status" aria-live="polite" style={{ display: "none" }}>
          {live.phase === "live" ? "playing" : live.phase}: {live.message}
        </span>
      </div>
    </div>
  );
}
