"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIDEO_ID = "Jnd6kRrwh4U";
const AUTOPLAY_FALLBACK_MS = 1800;

type PlayerState = number;

type YouTubePlayerInstance = {
  playVideo: () => void;
  mute: () => void;
  destroy: () => void;
  getPlayerState: () => PlayerState;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: PlayerState }) => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error("youtube-api-missing"));
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("youtube-api-failed"));
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

function YouTubeEmbed() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setStatus("loading");
    let disposed = false;
    let player: YouTubePlayerInstance | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const readyTimer = setTimeout(() => {
      if (!disposed) setStatus("error");
    }, 10000);

    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        const mount = document.createElement("div");
        host.appendChild(mount);

        player = new YT.Player(mount, {
          videoId: VIDEO_ID,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (disposed) return;
              clearTimeout(readyTimer);
              // The player is usable now, so drop the loader. Autoplay may
              // still be blocked; the visitor then gets the native controls
              // rather than an overlay stuck on "Loading".
              setStatus("ready");
              try {
                player?.playVideo();
              } catch {
                /* blocked autoplay; fallback below */
              }
              // Browsers block autoplay with sound. If playback has not
              // started shortly after ready, retry muted so the visitor sees
              // the video playing and can unmute with the native controls.
              timer = setTimeout(() => {
                if (disposed) return;
                const state = player?.getPlayerState();
                if (state !== 1 && state !== 3) {
                  try {
                    player?.mute();
                    player?.playVideo();
                  } catch {
                    /* leave native controls for manual playback */
                  }
                }
              }, AUTOPLAY_FALLBACK_MS);
            },
            onStateChange: (event) => {
              if (event.data === 1 || event.data === 3) {
                if (timer) clearTimeout(timer);
                setStatus("ready");
              }
            },
            onError: () => {
              if (!disposed) setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      clearTimeout(readyTimer);
      if (timer) clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        /* player may not have been created */
      }
      host.replaceChildren();
    };
  }, [attempt]);

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
      <style>{`
        .netram-video-host iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
      `}</style>
      {status === "loading" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.72)",
            fontSize: "0.9rem",
            letterSpacing: "0.02em",
          }}
        >
          Loading video…
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.9rem",
            padding: "1.5rem",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.95rem", color: "rgba(255,255,255,0.85)" }}>
            The demo video could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            style={{
              padding: "0.6rem 1.4rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#fff",
              background: "#137e3a",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default function DemoVideoModal() {
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, iframe, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(0.75rem, 3vw, 2.5rem)",
        background: "rgba(2, 8, 20, 0.9)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Netram demonstration video"
        style={{
          width: "min(1100px, 100%, calc((100vh - 9rem) * 16 / 9))",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close video and explore Netram"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2.75rem",
              height: "2.75rem",
              padding: 0,
              color: "#fff",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              borderRadius: "999px",
              cursor: "pointer",
              transition: "background .15s ease, border-color .15s ease",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div
          className="netram-video-host"
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 30px 80px -20px rgba(0, 0, 0, 0.85)",
          }}
        >
          <YouTubeEmbed />
        </div>
      </div>
    </div>
  );
}
