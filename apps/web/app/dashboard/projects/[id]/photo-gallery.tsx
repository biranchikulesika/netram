"use client";

import { useEffect, useState } from "react";
import type { ProjectPhoto } from "@netram/types";

interface PhotoGalleryProps {
  photos: ProjectPhoto[];
}

/** 3×3 overview grid. */
const GRID_SLOTS = 9;

/**
 * Facility photo grid (overview). Photos are visual records of the facility,
 * not inspection evidence (§14). Any tile opens a lightbox over the full set,
 * navigable by arrow keys, buttons, or the backdrop.
 */
export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [index, setIndex] = useState<number | null>(null);

  // Past 9 the grid spends its last tile on "See all" rather than hiding the
  // overflow behind an unexplained gap.
  const overflow = photos.length > GRID_SLOTS;
  const tiles = overflow ? photos.slice(0, GRID_SLOTS - 1) : photos;
  const current = index === null ? null : photos[index];

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowRight") setIndex((i) => ((i ?? 0) + 1) % photos.length);
      else if (e.key === "ArrowLeft")
        setIndex((i) => ((i ?? 0) - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length]);

  if (photos.length === 0) {
    return (
      <div className="facility-panel">
        <div className="facility-panel-head">
          <span className="facility-panel-title">Photos</span>
        </div>
        <div className="attention-empty">No photos of this facility yet.</div>
      </div>
    );
  }

  return (
    <div className="facility-panel">
      <div className="facility-panel-head">
        <span className="facility-panel-title">Photos</span>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {photos.length}
        </span>
      </div>

      <div className="photo-grid">
        {tiles.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            className="photo-tile"
            onClick={() => setIndex(i)}
            aria-label={
              photo.caption ? `Open photo: ${photo.caption}` : `Open photo ${i + 1}`
            }
          >
            {/* Proxied binary content route, not a static asset - plain img. */}
            <img
              src={`/api/projects/photos/${photo.id}/content`}
              alt={photo.caption ?? "Facility photo"}
              loading="lazy"
            />
          </button>
        ))}

        {overflow && (
          <button
            type="button"
            className="photo-tile photo-tile-more"
            onClick={() => setIndex(0)}
            aria-label={`See all ${photos.length} photos`}
          >
            <span className="photo-tile-more-count">+{photos.length - (GRID_SLOTS - 1)}</span>
            <span className="photo-tile-more-label">See all</span>
          </button>
        )}
      </div>

      {current && (
        <div
          className="lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={current.caption ?? "Facility photo"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIndex(null);
          }}
        >
          <div className="lightbox-content">
            <button
              type="button"
              onClick={() => setIndex(null)}
              aria-label="Close photo"
              className="lightbox-close"
            >
              ✕
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav lightbox-nav-prev"
                  onClick={() =>
                    setIndex((i) => ((i ?? 0) - 1 + photos.length) % photos.length)
                  }
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lightbox-nav lightbox-nav-next"
                  onClick={() => setIndex((i) => ((i ?? 0) + 1) % photos.length)}
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            )}

            {/* Proxied binary content route, not a static asset - plain img. */}
            <img
              src={`/api/projects/photos/${current.id}/content`}
              alt={current.caption ?? "Facility photo"}
            />
            <div className="lightbox-meta">
              <span className="lightbox-caption">
                {current.caption ?? current.fileName ?? "Facility photo"}
              </span>
              {photos.length > 1 && (
                <span className="lightbox-counter">
                  {(index ?? 0) + 1} / {photos.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
