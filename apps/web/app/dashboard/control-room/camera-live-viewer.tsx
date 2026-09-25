"use client";

import { useEffect } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { useCctvLiveStream } from "../../../lib/use-cctv-live-stream";

/**
 * Camera detail / live viewer (Phase 5 PART 10) — an in-Control-Room modal
 * following the existing lightbox pattern (ai-anomaly-modal), so the user
 * watches a camera without navigating to a separate CCTV administration
 * page. WebRTC (interactive live view) is primary; the HLS wall tile is the
 * passive mode.
 *
 * The viewer owns one stream session: created on open, heartbeat while
 * open, ended (viewer_stop + correlated reader kick) on close — including
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

  const [facility, place] = splitFacilityPlace(camera.name);
  const connecting = live.phase === "creating-session" || live.phase === "connecting";
  const liveNow = live.phase === "live";

  return (
    <div
      className="lightbox-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: 960 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>{camera.name}</h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              {facility}
              {place ? ` — ${place}` : ""} · {camera.status === "active" ? "Online" : "Offline"}
              {liveNow && live.stats ? ` · ${live.stats.framesDecoded} frames` : ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {liveNow && <span className="cc-live-badge" role="status">LIVE</span>}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="cc-viewport" style={{ borderRadius: 8, marginTop: "0.75rem" }}>
          <video
            ref={live.videoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            muted
            controls={liveNow}
            className="cc-video"
            aria-label={`Live stream: ${camera.name}`}
          />
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

        <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.75rem" }}>
          Session {live.streamId ?? "—"} · heartbeat every 30 s · closing this viewer ends the
          stream and disconnects the MediaMTX reader.
        </p>
        {/* Machine-readable lifecycle status (verification + a11y live region). */}
        <span id="cctv-viewer-status" aria-live="polite" style={{ display: "none" }}>
          {live.phase === "live" ? "playing" : live.phase}: {live.message}
        </span>
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
