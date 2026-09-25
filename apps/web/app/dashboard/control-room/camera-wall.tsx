"use client";

import { useMemo } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { CameraCard } from "./camera-card";
import { HlsWallTile } from "./hls-wall-tile";
import { IconVideo } from "../../components/icons";

interface CameraWallProps {
  cameras: PublicCctvCamera[];
  cameraProjectLinks?: Record<string, string>;
  query: string;
  columns?: 4 | 3 | 2;
  /** Camera ids switched to HLS wall playback by the user (PART 8). */
  hlsEnabled: Set<string>;
  onToggleHls: (cameraId: string) => void;
  /** Open the camera detail / live viewer (WebRTC, PART 10). */
  onOpenCamera: (camera: PublicCctvCamera) => void;
}

export function CameraWall({
  cameras,
  cameraProjectLinks = {},
  query,
  columns = 4,
  hlsEnabled,
  onToggleHls,
  onOpenCamera,
}: CameraWallProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cameras;
    return cameras.filter((c) => c.name.toLowerCase().includes(q));
  }, [cameras, query]);

  return (
    <>
      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: "3rem", textAlign: "center", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <IconVideo style={{ width: 36, height: 36, color: "var(--text-subtle)", margin: "0 auto 0.75rem auto" }} />
          <h3>{query ? "No matching cameras" : "No Cameras Available"}</h3>
          <p className="muted">
            {query
              ? `No cameras match "${query}".`
              : "No CCTV cameras are configured for your authorized jurisdiction."}
          </p>
        </div>
      ) : (
        <div className={`camera-wall camera-wall-${columns}`}>
          {filtered.map((cam) =>
            hlsEnabled.has(cam.id) ? (
              <HlsWallTile
                key={cam.id}
                camera={cam}
                enabled
                onToggle={onToggleHls}
                projectHref={cameraProjectLinks[cam.id]}
              />
            ) : (
              <CameraCard
                key={cam.id}
                camera={cam}
                projectHref={cameraProjectLinks[cam.id]}
                onOpen={onOpenCamera}
                onToggleHls={onToggleHls}
              />
            ),
          )}
        </div>
      )}
    </>
  );
}
