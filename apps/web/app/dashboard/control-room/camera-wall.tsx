"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { CameraCard } from "./camera-card";
import { HlsWallTile } from "./hls-wall-tile";
import { IconVideo } from "../../components/icons";

/**
 * Bounded concurrent wall viewers (PART 7): each HLS tile is one authorized
 * MediaMTX session, so the wall never opens more than this many. A 4-column
 * viewport shows ~12 tiles, so a few are always held back.
 */
const MAX_WALL_TILES = 9;

interface CameraWallProps {
  cameras: PublicCctvCamera[];
  query: string;
  columns?: 4 | 3 | 2;
  /** Open the camera detail / live viewer (WebRTC, PART 10). */
  onOpenCamera: (camera: PublicCctvCamera) => void;
  /**
   * Hold every tile while a single feed is open full screen. The user gets the
   * best-quality stream for the one camera they chose, and the wall stops
   * feeding so the browser is not decoding nine streams behind a modal.
   * Tiles restart when the viewer closes.
   */
  suspended?: boolean;
}

export function CameraWall({
  cameras,
  query,
  columns = 3,
  onOpenCamera,
  suspended = false,
}: CameraWallProps) {
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const wallRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cameras;
    return cameras.filter((c) => c.name.toLowerCase().includes(q));
  }, [cameras, query]);

  // Visible tiles auto-play; out-of-view tiles are torn down. Only active
  // cameras can play, so the observer still tracks the rest (an inactive
  // camera entering view must evict an auto-playing one, not sit in the list).
  const wanted = (
    suspended
      ? []
      : filtered
          .filter((c) => visible.has(c.id) && c.status === "active")
          .slice(0, MAX_WALL_TILES)
          .map((c) => c.id)
  );
  const playing = useMemo(() => new Set(wanted), [wanted.join(",")]);
  const visibleActive = filtered.filter(
    (c) => visible.has(c.id) && c.status === "active",
  ).length;

  // Tile roots are the grid children, so they are observed in place rather
  // than wrapped (a wrapper div would become the grid item and break layout).
  // Re-observing on this signature covers both mount and CameraCard <-> HLS
  // swaps, which replace the DOM node.
  const signature = filtered.map((c) => c.id).join(",");
  useEffect(() => {
    const root = wallRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset.cameraId;
            if (!id) continue;
            if (e.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next.size === prev.size && [...next].every((id) => prev.has(id))
            ? prev
            : next;
        });
      },
      // Start a little before the tile is fully on screen so it is already
      // playing when the user looks at it, and release it once it is well
      // out of view rather than at the exact pixel it leaves.
      { rootMargin: "300px 0px", threshold: 0 },
    );
    for (const el of root.querySelectorAll("[data-camera-id]")) observer.observe(el);
    return () => observer.disconnect();
  }, [signature, wanted.join(",")]);

  return (
    <>
      {filtered.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <IconVideo
            style={{
              width: 36,
              height: 36,
              color: "var(--text-subtle)",
              margin: "0 auto 0.75rem auto",
            }}
          />
          <h3>{query ? "No matching cameras" : "No Cameras Available"}</h3>
          <p className="muted">
            {query
              ? `No cameras match "${query}".`
              : "No CCTV cameras are configured for your authorized jurisdiction."}
          </p>
        </div>
      ) : (
        <>
          {visibleActive > MAX_WALL_TILES && (
            <p className="muted" role="status" style={{ margin: "0 0 0.5rem 0" }}>
              {visibleActive} cameras in view — playing the first {MAX_WALL_TILES}.
            </p>
          )}
          <div className={`camera-wall camera-wall-${columns}`} ref={wallRef}>
            {filtered.map((cam) =>
              playing.has(cam.id) ? (
                <HlsWallTile key={cam.id} camera={cam} onOpen={onOpenCamera} />
              ) : (
                <CameraCard
                  key={cam.id}
                  camera={cam}
                  onOpen={onOpenCamera}
                />
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}
