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
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
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
  const flattened = StyleSheet.flatten(style);
  const containerHeight = flattened?.height || 230;

  if (!src) {
    return (
      <View style={[styles.container, { height: containerHeight }, style, styles.emptyBox]}>
        <Icon name="videocam" size={36} color={colors.textMuted} />
        <Text style={styles.emptyText}>No Video Source</Text>
      </View>
    );
  }

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [nativeTrackWidth, setNativeTrackWidth] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeVideoRef = useRef<Video | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const isReplayingRef = useRef(false);

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
      isReplayingRef.current = false;
    };
    const onPause = () => {
      if (!isReplayingRef.current) {
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setIsEnded(true);
      isReplayingRef.current = false;
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

  // Synchronize autoPlay when src or autoPlay prop changes
  useEffect(() => {
    setCurrentTime(0);
    setIsEnded(false);
    if (autoPlay) {
      setIsPlaying(true);
      if (Platform.OS === "web" && videoRef.current) {
        const p = videoRef.current.play();
        if (p !== undefined) {
          p.catch(() => {
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().catch(() => {});
            }
          });
        }
      } else if (nativeVideoRef.current) {
        nativeVideoRef.current.playAsync().catch(() => {});
      }
    } else {
      setIsPlaying(false);
    }
  }, [src, autoPlay]);

  const seekToRatio = useCallback(
    async (ratio: number, autoResume = true) => {
      const dur = duration > 0 ? duration : (videoRef.current?.duration || 0);
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const targetSec = clampedRatio * dur;
      setCurrentTime(targetSec);
      setIsEnded(false);

      if (Platform.OS === "web" && videoRef.current) {
        videoRef.current.currentTime = targetSec;
        if (autoResume) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      } else if (nativeVideoRef.current) {
        await nativeVideoRef.current.setPositionAsync(targetSec * 1000).catch(() => {});
        if (autoResume) {
          await nativeVideoRef.current.playAsync().catch(() => {});
          setIsPlaying(true);
        }
      }
    },
    [duration]
  );

  const replay = useCallback(async () => {
    isReplayingRef.current = true;
    setCurrentTime(0);
    setIsEnded(false);
    setIsPlaying(true);

    if (Platform.OS === "web" && videoRef.current) {
      videoRef.current.currentTime = 0;
      try {
        await videoRef.current.play();
      } catch {
        // browser autoplay catch
      }
      setTimeout(() => {
        isReplayingRef.current = false;
      }, 350);
    } else if (nativeVideoRef.current) {
      try {
        await nativeVideoRef.current.setStatusAsync({
          shouldPlay: true,
          positionMillis: 0,
        });
      } catch {
        try {
          await nativeVideoRef.current.replayAsync();
        } catch {
          await nativeVideoRef.current.setPositionAsync(0).catch(() => {});
          await nativeVideoRef.current.playAsync().catch(() => {});
        }
      }
      setTimeout(() => {
        isReplayingRef.current = false;
      }, 500);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (Platform.OS === "web" && videoRef.current) {
      if (isEnded) {
        await replay();
        return;
      }
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else if (nativeVideoRef.current) {
      if (isEnded) {
        await replay();
        return;
      }
      if (isPlaying) {
        await nativeVideoRef.current.pauseAsync().catch(() => {});
        setIsPlaying(false);
      } else {
        await nativeVideoRef.current.playAsync().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [isPlaying, isEnded, replay]);

  const skipSeconds = useCallback(
    async (delta: number) => {
      setIsEnded(false);
      if (Platform.OS === "web" && videoRef.current) {
        const dur = videoRef.current.duration || duration || 0;
        const next = Math.max(0, Math.min(dur, (videoRef.current.currentTime || currentTime) + delta));
        videoRef.current.currentTime = next;
        setCurrentTime(next);
        // Automatically run video after skipping without requiring manual play
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else if (nativeVideoRef.current) {
        const next = Math.max(0, Math.min(duration || 0, currentTime + delta));
        await nativeVideoRef.current.setPositionAsync(next * 1000).catch(() => {});
        setCurrentTime(next);
        // Automatically run video after skipping without requiring manual play
        await nativeVideoRef.current.playAsync().catch(() => {});
        setIsPlaying(true);
      }
    },
    [currentTime, duration]
  );

  const toggleMute = useCallback(async () => {
    if (Platform.OS === "web" && videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    } else if (nativeVideoRef.current) {
      const nextMuted = !isMuted;
      await nativeVideoRef.current.setIsMutedAsync(nextMuted).catch(() => {});
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  }, [isMuted]);

  const cyclePlaybackRate = useCallback(async () => {
    const rates = [0.5, 1.0, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1.0;
    setPlaybackRate(nextRate);
    if (Platform.OS === "web" && videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    } else if (nativeVideoRef.current) {
      await nativeVideoRef.current.setRateAsync(nextRate, true).catch(() => {});
    }
  }, [playbackRate]);

  // Web scrubber drag support
  const handleWebScrub = useCallback(
    (clientX: number, isRelease: boolean) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      seekToRatio(ratio, isRelease);
    },
    [seekToRatio]
  );

  const handleWebMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      handleWebScrub(e.clientX, true);
      const onMouseMove = (moveEvent: MouseEvent) => {
        handleWebScrub(moveEvent.clientX, false);
      };
      const onMouseUp = (upEvent: MouseEvent) => {
        handleWebScrub(upEvent.clientX, true);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [handleWebScrub]
  );

  // Native scrubber touch & drag support
  const handleNativeTouch = useCallback(
    (locationX: number, isRelease: boolean) => {
      if (nativeTrackWidth <= 0 || duration <= 0) return;
      const ratio = Math.max(0, Math.min(1, locationX / nativeTrackWidth));
      if (isRelease) {
        seekToRatio(ratio, true);
      } else {
        setCurrentTime(ratio * duration);
      }
    },
    [nativeTrackWidth, duration, seekToRatio]
  );

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
            minHeight: full ? "80vh" : 120,
          }}
        >
          <video
            ref={videoRef}
            src={src}
            playsInline
            controls
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
          {/* Seekable Scrubber Track with Drag & Touch Support */}
          <div
            ref={progressBarRef}
            onMouseDown={handleWebMouseDown}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) handleWebScrub(t.clientX, false);
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (t) handleWebScrub(t.clientX, false);
            }}
            onTouchEnd={(e) => {
              const t = e.changedTouches[0];
              if (t) handleWebScrub(t.clientX, true);
            }}
            style={{
              width: "100%",
              height: 20,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              position: "relative",
              touchAction: "none",
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
                  transition: "width 0.05s linear",
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
                transition: "left 0.05s linear",
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

  // Render on Native (Android / iOS) via expo-av hardware-accelerated video player
  const renderNativePlayer = (full: boolean) => {
    return (
      <View style={[styles.nativeWrap, full ? styles.nativeWrapFull : null]}>
        {/* Top Watermark & HUD */}
        <View style={styles.nativeHeaderHud}>
          <View style={styles.nativeBadgeRow}>
            <View style={styles.nativeDot} />
            <Text style={styles.nativeBadgeText}>{title || watermarkText}</Text>
          </View>
          <View style={styles.nativeSpeedRow}>
            <Pressable onPress={cyclePlaybackRate} style={styles.nativeSpeedBtn} hitSlop={6}>
              <Text style={styles.nativeSpeedText}>{playbackRate}x</Text>
            </Pressable>
            <Pressable onPress={() => setIsFullscreen(!full)} style={styles.nativeSpeedBtn} hitSlop={6}>
              <Text style={styles.nativeSpeedText}>{full ? "✕ Exit" : "⛶ Full"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Native Video Surface */}
        <Pressable
          style={styles.nativeVideoArea}
          onPress={() => {
            if (isEnded) {
              replay();
            } else {
              togglePlay();
            }
          }}
        >
          <Video
            ref={nativeVideoRef}
            source={{ uri: src }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            isMuted={isMuted}
            rate={playbackRate}
            shouldCorrectPitch
            useNativeControls={false}
            progressUpdateIntervalMillis={200}
            onLoad={(status: AVPlaybackStatus) => {
              if (status.isLoaded && status.durationMillis && !isNaN(status.durationMillis)) {
                setDuration(status.durationMillis / 1000);
              }
              if (autoPlay && status.isLoaded) {
                setIsPlaying(true);
                setIsEnded(false);
                nativeVideoRef.current?.playAsync().catch(() => {});
              }
            }}
            onError={(error) => {
              console.warn("Video load error:", error);
            }}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (!status.isLoaded) return;
              setCurrentTime(status.positionMillis / 1000);
              if (status.durationMillis && !isNaN(status.durationMillis)) {
                setDuration(status.durationMillis / 1000);
              }
              if (status.didJustFinish) {
                setIsEnded(true);
                setIsPlaying(false);
                isReplayingRef.current = false;
              } else if (!isReplayingRef.current) {
                if (status.isPlaying) {
                  setIsPlaying(true);
                  setIsEnded(false);
                } else if (!status.isBuffering && !status.shouldPlay) {
                  setIsPlaying(false);
                }
              }
            }}
          />
          {(!isPlaying || isEnded) && (
            <View style={styles.nativeBigPlayOverlay}>
              <Pressable
                style={styles.nativeBigPlayCircle}
                onPress={(e) => {
                  e.stopPropagation();
                  if (isEnded) {
                    replay();
                  } else {
                    togglePlay();
                  }
                }}
              >
                <Icon name={isEnded ? "reload" : "play"} size={26} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* Native Controls Bar */}
        <View style={styles.nativeControlsBar}>
          {/* Progress Bar / Draggable Scrubber */}
          <View
            style={styles.nativeScrubberTouchArea}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setNativeTrackWidth(w);
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => handleNativeTouch(e.nativeEvent.locationX, false)}
            onResponderMove={(e) => handleNativeTouch(e.nativeEvent.locationX, false)}
            onResponderRelease={(e) => handleNativeTouch(e.nativeEvent.locationX, true)}
          >
            <View style={styles.nativeProgressBarTrack}>
              <View style={[styles.nativeProgressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <View
              style={[
                styles.nativeScrubberThumb,
                { left: `${progressPercent}%` },
              ]}
            />
          </View>
          <View style={styles.nativeActionsRow}>
            <View style={styles.nativeBtnGroup}>
              <Pressable
                style={styles.nativePlayBtn}
                onPress={() => {
                  if (isEnded) {
                    replay();
                  } else {
                    togglePlay();
                  }
                }}
              >
                <Icon name={isPlaying ? "pause" : isEnded ? "reload" : "play"} size={16} color="#FFFFFF" />
              </Pressable>
              <Pressable style={styles.nativeSkipBtn} onPress={() => skipSeconds(-10)}>
                <Text style={styles.nativeSkipText}>-10s</Text>
              </Pressable>
              <Pressable style={styles.nativeSkipBtn} onPress={() => skipSeconds(10)}>
                <Text style={styles.nativeSkipText}>+10s</Text>
              </Pressable>
              <Text style={styles.nativeTimeText}>
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </Text>
            </View>
            <Pressable style={styles.nativeMuteBtn} onPress={toggleMute} hitSlop={8}>
              <Icon name={isMuted ? "volume-mute" : "volume-high"} size={18} color={isMuted ? "#EF4444" : "#94A3B8"} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { height: containerHeight },
        style,
      ]}
    >
      {!isFullscreen && (Platform.OS === "web" ? renderWebPlayer(false) : renderNativePlayer(false))}

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
  nativeHeaderHud: {
    height: 38,
    backgroundColor: "rgba(3, 11, 23, 0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    zIndex: 10,
  },
  nativeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nativeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  nativeBadgeText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nativeSpeedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nativeSpeedBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nativeSpeedText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  nativeVideoArea: {
    flex: 1,
    backgroundColor: "#030B17",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  nativeBigPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  nativeBigPlayCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0, 36, 73, 0.85)",
    borderWidth: 1.5,
    borderColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  nativeControlsBar: {
    backgroundColor: "rgba(3, 11, 23, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    zIndex: 10,
  },
  nativeScrubberTouchArea: {
    width: "100%",
    height: 22,
    justifyContent: "center",
    position: "relative",
  },
  nativeProgressBarTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "#334155",
    borderRadius: 2,
    overflow: "hidden",
  },
  nativeProgressBarFill: {
    height: "100%",
    backgroundColor: "#0284C7",
    borderRadius: 2,
  },
  nativeScrubberThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#0284C7",
    transform: [{ translateX: -6 }],
  },
  nativeActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nativeBtnGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nativePlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#002449",
    borderWidth: 1,
    borderColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  nativeSkipBtn: {
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  nativeSkipText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
  },
  nativeTimeText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    marginLeft: 4,
  },
  nativeMuteBtn: {
    padding: 4,
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
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});
