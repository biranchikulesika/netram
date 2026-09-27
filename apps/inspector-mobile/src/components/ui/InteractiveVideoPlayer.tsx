import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { Icon } from "./Icon";
import { colors } from "../../theme/colors";

export interface InteractiveVideoPlayerProps {
  src: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  watermarkText?: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

export function InteractiveVideoPlayer({
  src,
  title,
  style,
  autoPlay = false,
  watermarkText = "NETRAM VERIFIED EVIDENCE",
}: InteractiveVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Web native HTML5 controls
  useEffect(() => {
    if (Platform.OS !== "web" || !videoRef.current) return;
    const vid = videoRef.current;

    const onTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      if (vid.duration && !isNaN(vid.duration)) {
        setDuration(vid.duration);
      }
    };
    const onLoadedMetadata = () => {
      if (vid.duration && !isNaN(vid.duration)) {
        setDuration(vid.duration);
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      setIsEnded(false);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setIsEnded(true);
    };

    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("ended", onEnded);

    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    if (Platform.OS === "web" && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, []);

  const skipSeconds = useCallback((delta: number) => {
    if (Platform.OS === "web" && videoRef.current) {
      const next = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
      videoRef.current.currentTime = next;
      setCurrentTime(next);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (Platform.OS === "web" && videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.5, 1.0, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1.0;
    setPlaybackRate(nextRate);
    if (Platform.OS === "web" && videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  }, [playbackRate]);

  const replay = useCallback(() => {
    if (Platform.OS === "web" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsEnded(false);
    }
  }, []);

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !videoRef.current.duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = fraction * videoRef.current.duration;
    videoRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  }, []);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Render on Web platform
  const renderWebPlayer = (full: boolean) => {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: full ? "100%" : "100%",
          backgroundColor: "#030B17",
          borderRadius: full ? 0 : 8,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          userSelect: "none",
        }}
      >
        {/* Top Watermark & HUD */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "8px 12px",
            background: "linear-gradient(180deg, rgba(3,11,23,0.85) 0%, rgba(3,11,23,0) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "#10B981",
              }}
            />
            <span
              style={{
                color: "#E2E8F0",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              {title || watermarkText}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Speed toggle */}
            <button
              onClick={cyclePlaybackRate}
              type="button"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4,
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 6px",
                cursor: "pointer",
              }}
            >
              {playbackRate}x
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={() => setIsFullscreen(!full)}
              type="button"
              title={full ? "Exit Fullscreen" : "Fullscreen"}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4,
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                cursor: "pointer",
              }}
            >
              {full ? "✕ Exit" : "⛶ Full"}
            </button>
          </div>
        </div>

        {/* Video Element */}
        <div
          onClick={togglePlay}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            cursor: "pointer",
            minHeight: full ? "80vh" : 200,
          }}
        >
          <video
            ref={videoRef}
            src={src}
            playsInline
            muted={isMuted}
            autoPlay={autoPlay}
            preload="metadata"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: "#030B17",
            }}
          />

          {/* Center Play/Pause Indicator when paused */}
          {!isPlaying && !isEnded && (
            <div
              style={{
                position: "absolute",
                width: 52,
                height: 52,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 36, 73, 0.8)",
                border: "2px solid #0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 0 0 4px rgba(2, 132, 199, 0.2)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </div>
          )}

          {isEnded && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                replay();
              }}
              style={{
                position: "absolute",
                padding: "8px 16px",
                borderRadius: 6,
                backgroundColor: "#002449",
                border: "1px solid #0284C7",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <span>↺ Replay Inspection Video</span>
            </div>
          )}
        </div>

        {/* Bottom Interactive Controls Bar */}
        <div
          style={{
            backgroundColor: "rgba(3, 11, 23, 0.95)",
            borderTop: "1px solid #1E293B",
            padding: "8px 12px 10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 10,
          }}
        >
          {/* Seekable Scrubber Track */}
          <div
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            style={{
              width: "100%",
              height: 18,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "100%",
                height: 4,
                backgroundColor: "#334155",
                borderRadius: 2,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  backgroundColor: "#0284C7",
                  borderRadius: 2,
                  transition: "width 0.1s linear",
                }}
              />
            </div>
            {/* Scrubber thumb */}
            <div
              style={{
                position: "absolute",
                left: `calc(${progressPercent}% - 6px)`,
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "#FFFFFF",
                border: "2px solid #0284C7",
                pointerEvents: "none",
                transition: "left 0.1s linear",
              }}
            />
          </div>

          {/* Action Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Play / Pause Toggle */}
              <button
                onClick={togglePlay}
                type="button"
                style={{
                  background: "#002449",
                  border: "1px solid #0284C7",
                  borderRadius: 4,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>

              {/* Rewind -10s */}
              <button
                onClick={() => skipSeconds(-10)}
                type="button"
                title="Rewind 10 seconds"
                style={{
                  background: "transparent",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  width: 30,
                  height: 30,
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                -10s
              </button>

              {/* Forward +10s */}
              <button
                onClick={() => skipSeconds(10)}
                type="button"
                title="Forward 10 seconds"
                style={{
                  background: "transparent",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  width: 30,
                  height: 30,
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                +10s
              </button>

              {/* Current Time / Duration */}
              <span
                style={{
                  color: "#E2E8F0",
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
              >
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Audio Mute Button */}
              <button
                onClick={toggleMute}
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: isMuted ? "#EF4444" : "#94A3B8",
                  fontSize: 16,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                {isMuted ? "🔇" : "🔊"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render on Native (Android / iOS) via self-contained interactive HTML5 WebView
  const renderNativePlayer = (full: boolean) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
            body {
              background-color: #030B17;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              width: 100vw;
              height: 100vh;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .header {
              height: 36px;
              background: linear-gradient(180deg, rgba(3,11,23,0.9) 0%, rgba(3,11,23,0) 100%);
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0 12px;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              z-index: 20;
            }
            .badge {
              font-size: 11px;
              font-weight: 600;
              color: #E2E8F0;
              letter-spacing: 0.5px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .dot {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #10B981;
            }
            .viewport {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              background: #030B17;
            }
            video {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .controls {
              background: #030B17;
              border-top: 1px solid #1E293B;
              padding: 8px 12px 10px 12px;
              display: flex;
              flex-direction: column;
              gap: 6px;
              z-index: 20;
            }
            .track-wrap {
              width: 100%;
              height: 20px;
              display: flex;
              align-items: center;
              position: relative;
              touch-action: none;
            }
            .track-bg {
              width: 100%;
              height: 5px;
              background: #334155;
              border-radius: 3px;
              overflow: hidden;
            }
            .track-fill {
              width: 0%;
              height: 100%;
              background: #0284C7;
              border-radius: 3px;
            }
            .thumb {
              position: absolute;
              width: 14px;
              height: 14px;
              background: #FFFFFF;
              border: 2px solid #0284C7;
              border-radius: 50%;
              top: 3px;
              left: 0;
              margin-left: -7px;
              pointer-events: none;
            }
            .actions {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .btn-group {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .btn {
              background: #002449;
              border: 1px solid #0284C7;
              border-radius: 4px;
              color: #FFFFFF;
              height: 28px;
              min-width: 28px;
              padding: 0 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            }
            .btn-secondary {
              background: transparent;
              border: 1px solid #334155;
              color: #94A3B8;
              font-size: 10px;
            }
            .time-display {
              color: #E2E8F0;
              font-size: 12px;
              font-variant-numeric: tabular-nums;
              margin-left: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="badge">
              <span class="dot"></span>
              <span>${title || watermarkText}</span>
            </div>
            <button id="speedBtn" class="btn btn-secondary" style="height:22px; font-size:10px;">1.0x</button>
          </div>

          <div class="viewport" id="viewport">
            <video id="vid" src="${src}" playsinline ${autoPlay ? "autoplay" : ""}></video>
          </div>

          <div class="controls">
            <div class="track-wrap" id="trackWrap">
              <div class="track-bg">
                <div class="track-fill" id="trackFill"></div>
              </div>
              <div class="thumb" id="thumb"></div>
            </div>

            <div class="actions">
              <div class="btn-group">
                <button id="playBtn" class="btn">▶</button>
                <button id="rwBtn" class="btn btn-secondary">-10s</button>
                <button id="ffBtn" class="btn btn-secondary">+10s</button>
                <span class="time-display" id="timeTxt">00:00 / 00:00</span>
              </div>
              <div class="btn-group">
                <button id="muteBtn" class="btn btn-secondary" style="border:none; color:#94A3B8; font-size:14px;">🔊</button>
              </div>
            </div>
          </div>

          <script>
            const vid = document.getElementById('vid');
            const playBtn = document.getElementById('playBtn');
            const rwBtn = document.getElementById('rwBtn');
            const ffBtn = document.getElementById('ffBtn');
            const muteBtn = document.getElementById('muteBtn');
            const speedBtn = document.getElementById('speedBtn');
            const timeTxt = document.getElementById('timeTxt');
            const trackWrap = document.getElementById('trackWrap');
            const trackFill = document.getElementById('trackFill');
            const thumb = document.getElementById('thumb');
            const viewport = document.getElementById('viewport');

            function fmt(s) {
              if (!s || isNaN(s) || s < 0) return '00:00';
              const m = Math.floor(s / 60);
              const sec = Math.floor(s % 60);
              return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
            }

            function updateProgress() {
              const cur = vid.currentTime || 0;
              const dur = vid.duration || 0;
              timeTxt.innerText = fmt(cur) + ' / ' + fmt(dur);
              if (dur > 0) {
                const pct = Math.min(100, (cur / dur) * 100);
                trackFill.style.width = pct + '%';
                thumb.style.left = pct + '%';
              }
            }

            vid.addEventListener('timeupdate', updateProgress);
            vid.addEventListener('loadedmetadata', updateProgress);
            vid.addEventListener('play', () => { playBtn.innerText = '❚❚'; });
            vid.addEventListener('pause', () => { playBtn.innerText = '▶'; });
            vid.addEventListener('ended', () => { playBtn.innerText = '↺'; });

            playBtn.addEventListener('click', () => {
              if (vid.paused) vid.play();
              else vid.pause();
            });

            viewport.addEventListener('click', () => {
              if (vid.paused) vid.play();
              else vid.pause();
            });

            rwBtn.addEventListener('click', () => {
              vid.currentTime = Math.max(0, vid.currentTime - 10);
            });

            ffBtn.addEventListener('click', () => {
              vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10);
            });

            muteBtn.addEventListener('click', () => {
              vid.muted = !vid.muted;
              muteBtn.innerText = vid.muted ? '🔇' : '🔊';
            });

            const speeds = [0.5, 1.0, 1.5, 2.0];
            let spIdx = 1;
            speedBtn.addEventListener('click', () => {
              spIdx = (spIdx + 1) % speeds.length;
              vid.playbackRate = speeds[spIdx];
              speedBtn.innerText = speeds[spIdx] + 'x';
            });

            function seek(e) {
              const rect = trackWrap.getBoundingClientRect();
              const clientX = e.touches ? e.touches[0].clientX : e.clientX;
              const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
              if (vid.duration) {
                vid.currentTime = frac * vid.duration;
                updateProgress();
              }
            }

            trackWrap.addEventListener('click', seek);
            trackWrap.addEventListener('touchmove', seek);
          </script>
        </body>
      </html>
    `;

    return (
      <View style={[styles.nativeWrap, full ? styles.nativeWrapFull : null]}>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={!autoPlay}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webView}
        />
      </View>
    );
  };

  const flattened = StyleSheet.flatten(style);
  const containerHeight = flattened?.height || 230;

  return (
    <View
      style={[
        styles.container,
        { height: containerHeight },
        style,
      ]}
    >
      {Platform.OS === "web" ? renderWebPlayer(false) : renderNativePlayer(false)}

      {/* Fullscreen Expand Modal */}
      {isFullscreen && (
        <Modal
          visible={isFullscreen}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setIsFullscreen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.liveIndicator} />
                <Text style={styles.modalTitleText}>
                  {title || watermarkText}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsFullscreen(false)}
                style={styles.modalCloseBtn}
              >
                <Icon name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {Platform.OS === "web" ? renderWebPlayer(true) : renderNativePlayer(true)}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#030B17",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  nativeWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#030B17",
  },
  nativeWrapFull: {
    flex: 1,
    height: "100%",
  },
  webView: {
    width: "100%",
    height: "100%",
    backgroundColor: "#030B17",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#030B17",
    paddingTop: Platform.OS === "ios" ? 44 : 0,
  },
  modalHeader: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.navyDark,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.actionGreen,
  },
  modalTitleText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  modalBody: {
    flex: 1,
    backgroundColor: "#030B17",
  },
});
