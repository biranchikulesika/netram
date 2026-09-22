"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicCctvCamera } from "@netram/types";
import { IconPlay, IconPause, IconFullscreen, IconFullscreenExit } from "../components/icons";

const FRAME_REFRESH_MS = 10_000;

// "Vani Vihar - Dormitory Block" -> ["Vani Vihar", "Dormitory Block"]
// "Main Gate" -> ["Main Gate", ""]
function splitFacilityPlace(name: string): [string, string] {
  const idx = name.indexOf(" - ");
  if (idx === -1) return [name, ""];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

export interface CameraCardProps {
  camera: PublicCctvCamera;
  projectHref?: string;
}

export function CameraCard({ camera, projectHref }: CameraCardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [frameTs, setFrameTs] = useState(Date.now());

  const offline = camera.status !== "active";

  // Refresh the snapshot frame so the tile behaves like a live feed
  useEffect(() => {
    const id = setInterval(() => setFrameTs(Date.now()), FRAME_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Track fullscreen state of the tile viewport
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === viewportRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleToggle = async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (offline) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/cctv/${camera.id}/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 300 }),
      });
      if (!res.ok) {
        throw new Error(`Failed to initiate stream (${res.status})`);
      }
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFullscreen = useCallback(async () => {
    const el = viewportRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // fullscreen denied by browser; ignore
    }
  }, []);

  const [facility, place] = splitFacilityPlace(camera.name);

  const showCenterButton = !playing || hover || loading;

  const facilityNode = projectHref ? (
    <Link
      href={projectHref}
      className="cc-osd-facility cc-osd-facility-link"
      onClick={(e) => e.stopPropagation()}
    >
      {facility}
    </Link>
  ) : (
    <span className="cc-osd-facility">{facility}</span>
  );

  return (
    <div
      className="camera-card camera-card-compact"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="cc-viewport" ref={viewportRef}>
        <img
          src={`/api/cctv/${camera.id}/snapshot?t=${frameTs}`}
          alt={camera.name}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
        <div className="cc-vp-osd cc-vp-osd-tl">
          {facilityNode}
          {place && <span className="cc-osd-place">{place}</span>}
        </div>

        <div className="cc-center">
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading || offline}
            title={offline ? "Camera offline" : playing ? "Pause" : "Play live stream"}
            className={`cc-play-btn ${showCenterButton ? "cc-play-btn-visible" : ""} ${playing ? "cc-play-btn-playing" : ""}`}
          >
            {loading ? (
              "Connecting…"
            ) : offline ? (
              "Offline"
            ) : playing ? (
              <>
                <IconPause style={{ width: 15, height: 15 }} />
                Pause
              </>
            ) : (
              <>
                <IconPlay style={{ width: 15, height: 15 }} />
                Live
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleToggleFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Open fullscreen"}
          aria-label={fullscreen ? "Exit fullscreen" : "Open fullscreen"}
          className="cc-fullscreen-btn"
        >
          {fullscreen ? (
            <IconFullscreenExit style={{ width: 14, height: 14 }} />
          ) : (
            <IconFullscreen style={{ width: 14, height: 14 }} />
          )}
        </button>
      </div>
    </div>
  );
}