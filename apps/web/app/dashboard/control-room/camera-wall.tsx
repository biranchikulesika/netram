"use client";

import { useMemo } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { CameraCard } from "./camera-card";
import { IconVideo } from "../../components/icons";

interface CameraWallProps {
  cameras: PublicCctvCamera[];
  cameraProjectLinks?: Record<string, string>;
  query: string;
  columns?: 4 | 3 | 2;
}

export function CameraWall({ cameras, cameraProjectLinks = {}, query, columns = 4 }: CameraWallProps) {
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
          {filtered.map((cam) => (
            <CameraCard key={cam.id} camera={cam} projectHref={cameraProjectLinks[cam.id]} />
          ))}
        </div>
      )}
    </>
  );
}