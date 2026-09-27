import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Image,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Video, ResizeMode, Audio as ExpoAudio, type AVPlaybackStatus } from "expo-av";
import { Icon } from "./Icon";
import { colors } from "../../theme/colors";

export interface InteractiveVideoPlayerProps {
  src: string | number;
  inspectorSrc?: string | number;
  title?: string;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  watermarkText?: string;
  contactName?: string;
  contactAvatarColor?: string;
}

export function InteractiveVideoPlayer({
  src,
  inspectorSrc,
  contactName: _contactName,
  style,
  autoPlay = false,
}: InteractiveVideoPlayerProps) {
  const flattened = StyleSheet.flatten(style);
  const containerHeight = flattened?.height || 220;

  const resolveUri = useCallback((source?: string | number): string => {
    if (!source) return "";
    if (typeof source === "string") return source;
    try {
      const resolved = Image.resolveAssetSource(source);
      if (resolved?.uri) return resolved.uri;
    } catch {}
    return "";
  }, []);

  const webSrc = typeof src === "string" ? src : resolveUri(src);
  const webInspectorSrc = typeof inspectorSrc === "string" ? inspectorSrc : resolveUri(inspectorSrc);
  const nativeSource = typeof src === "number" ? src : { uri: src };
  const nativeInspectorSource = typeof inspectorSrc === "number" ? inspectorSrc : inspectorSrc ? { uri: inspectorSrc } : undefined;

  if (!src) {
    return (
      <View style={[styles.container, { height: containerHeight }, style, styles.emptyBox]}>
        <Icon name="videocam" size={32} color={colors.textMuted} />
        <Text style={styles.emptyText}>No Video Source</Text>
      </View>
    );
  }

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isEnded, setIsEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inspectorVideoRef = useRef<HTMLVideoElement | null>(null);

  const nativeVideoRef = useRef<Video | null>(null);
  const nativeInspectorRef = useRef<Video | null>(null);
  const trackWidthRef = useRef<number>(200);

  // Configure native audio mode for dual simultaneous overlapping audio tracks
  useEffect(() => {
    if (Platform.OS !== "web") {
      void ExpoAudio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      }).catch(() => {});
    }
  }, []);

  // Replay from beginning in lockstep
  const replay = useCallback(async () => {
    setIsEnded(false);
    setCurrentTime(0);

    if (Platform.OS === "web") {
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
        } catch {}
        videoRef.current.muted = isMuted;
        videoRef.current.play().catch(() => {});
      }
      if (inspectorVideoRef.current) {
        try {
          inspectorVideoRef.current.currentTime = 0;
        } catch {}
        inspectorVideoRef.current.playbackRate = 1.0;
        inspectorVideoRef.current.muted = isMuted;
        inspectorVideoRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
    } else {
      if (nativeVideoRef.current) {
        await nativeVideoRef.current.setPositionAsync(0).catch(() => {});
        await nativeVideoRef.current.playAsync().catch(() => {});
      }
      if (nativeInspectorRef.current) {
        await nativeInspectorRef.current.setPositionAsync(0).catch(() => {});
        await nativeInspectorRef.current.playAsync().catch(() => {});
      }
      setIsPlaying(true);
    }
  }, [isMuted]);

  // Seek both videos in lockstep
  const seekTo = useCallback(
    async (targetTime: number) => {
      const clamped = Math.max(0, Math.min(targetTime, duration || 0));
      setCurrentTime(clamped);

      if (Platform.OS === "web") {
        const vid = videoRef.current;
        const insVid = inspectorVideoRef.current;
        if (vid) {
          try {
            vid.currentTime = clamped;
          } catch {}
        }
        if (insVid) {
          const insDur = insVid.duration;
          const hasValidInsDur = insDur && isFinite(insDur) && insDur > 0;
          const targetIns = hasValidInsDur ? clamped % insDur : clamped;
          try {
            insVid.currentTime = targetIns;
          } catch {}
          insVid.playbackRate = 1.0;
        }
      } else {
        if (nativeVideoRef.current) {
          await nativeVideoRef.current.setPositionAsync(clamped * 1000).catch(() => {});
        }
        if (nativeInspectorRef.current) {
          await nativeInspectorRef.current.setPositionAsync(clamped * 1000).catch(() => {});
        }
      }
    },
    [duration]
  );

  // Play / Pause Toggle with synchronization
  const togglePlay = useCallback(async () => {
    if (isEnded) {
      await replay();
      return;
    }

    if (Platform.OS === "web") {
      const vid = videoRef.current;
      const insVid = inspectorVideoRef.current;
      if (!vid) return;

      if (vid.paused) {
        vid.muted = isMuted;
        if (insVid) {
          insVid.muted = isMuted;
          const insDur = insVid.duration;
          const hasValidInsDur = insDur && isFinite(insDur) && insDur > 0;
          const targetIns = hasValidInsDur ? vid.currentTime % insDur : vid.currentTime;
          if (Math.abs(insVid.currentTime - targetIns) > 0.3) {
            try {
              insVid.currentTime = targetIns;
            } catch {}
          }
          insVid.playbackRate = 1.0;
          insVid.play().catch(() => {});
        }
        vid.play().catch(() => {});
        setIsPlaying(true);
      } else {
        vid.pause();
        insVid?.pause();
        setIsPlaying(false);
      }
    } else {
      const nativeVid = nativeVideoRef.current;
      const nativeIns = nativeInspectorRef.current;
      if (!nativeVid) return;

      if (isPlaying) {
        await nativeVid.pauseAsync().catch(() => {});
        await nativeIns?.pauseAsync().catch(() => {});
        setIsPlaying(false);
      } else {
        await nativeVid.playAsync().catch(() => {});
        await nativeIns?.playAsync().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, [isPlaying, isEnded, isMuted, replay]);

  // Toggle audio mute: overlaps both inspector and caller audio tracks
  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    setIsMuted(next);

    if (Platform.OS === "web") {
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      if (inspectorVideoRef.current) {
        inspectorVideoRef.current.muted = next;
      }
    } else {
      if (nativeVideoRef.current) {
        await nativeVideoRef.current.setIsMutedAsync(next).catch(() => {});
      }
      if (nativeInspectorRef.current) {
        await nativeInspectorRef.current.setIsMutedAsync(next).catch(() => {});
      }
    }
  }, [isMuted]);

  // Keep inspector muted state synchronized with player state
  useEffect(() => {
    if (Platform.OS === "web" && inspectorVideoRef.current) {
      inspectorVideoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Autoplay handler with audio policy fallback
  useEffect(() => {
    if (autoPlay && Platform.OS === "web") {
      const vid = videoRef.current;
      const insVid = inspectorVideoRef.current;
      if (vid) {
        vid.muted = isMuted;
        if (insVid) insVid.muted = isMuted;
        vid.play().catch(() => {
          // If browser blocks unmuted autoplay, start muted and update state
          if (vid) vid.muted = true;
          if (insVid) insVid.muted = true;
          setIsMuted(true);
          vid?.play().catch(() => {});
          insVid?.play().catch(() => {});
        });
      }
      if (insVid) {
        insVid.play().catch(() => {});
      }
    }
  }, [autoPlay, isMuted]);

  // Sync web video events with smooth micro-playback-rate drift correction
  useEffect(() => {
    if (Platform.OS !== "web" || !videoRef.current) return;
    const vid = videoRef.current;

    const syncInspector = (forceSeek = false) => {
      const insVid = inspectorVideoRef.current;
      if (!insVid) return;

      const insDur = insVid.duration;
      const hasValidInsDur = insDur && isFinite(insDur) && insDur > 0;
      const targetTime = hasValidInsDur ? vid.currentTime % insDur : vid.currentTime;
      const drift = insVid.currentTime - targetTime;

      // Loop restart detector: leader wrapped around back to start
      if (vid.currentTime < 0.25 && insVid.currentTime > 0.5) {
        try {
          insVid.currentTime = 0;
        } catch {}
        insVid.playbackRate = 1.0;
        return;
      }

      if (forceSeek || Math.abs(drift) > 1.0) {
        // Hard seek only on large drift, seeking events, or initial start
        try {
          insVid.currentTime = targetTime;
        } catch {}
        insVid.playbackRate = 1.0;
      } else if (drift < -0.12) {
        // Inspector is slightly behind: gently speed up by 7% (smooth, pitch preserved, zero audio muting)
        insVid.playbackRate = 1.07;
      } else if (drift > 0.12) {
        // Inspector is slightly ahead: gently slow down by 7% (smooth, pitch preserved, zero audio muting)
        insVid.playbackRate = 0.93;
      } else {
        if (insVid.playbackRate !== 1.0) {
          insVid.playbackRate = 1.0;
        }
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      setIsEnded(false);
      const insVid = inspectorVideoRef.current;
      if (insVid) {
        insVid.muted = isMuted;
        syncInspector(true);
        insVid.play().catch(() => {});
      }
    };

    const onPause = () => {
      if (!vid.ended) {
        setIsPlaying(false);
        inspectorVideoRef.current?.pause();
      }
    };

    const onSeeking = () => {
      syncInspector(true);
    };

    const onSeeked = () => {
      syncInspector(true);
    };

    const onTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      if (vid.duration && !isNaN(vid.duration)) {
        setDuration(vid.duration);
      }
      syncInspector(false);
    };

    const onLoadedMetadata = () => {
      if (vid.duration && !isNaN(vid.duration)) {
        setDuration(vid.duration);
      }
      syncInspector(true);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setIsEnded(true);
      inspectorVideoRef.current?.pause();
    };

    vid.addEventListener("play", onPlay);
    vid.addEventListener("pause", onPause);
    vid.addEventListener("seeking", onSeeking);
    vid.addEventListener("seeked", onSeeked);
    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    vid.addEventListener("ended", onEnded);

    return () => {
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("pause", onPause);
      vid.removeEventListener("seeking", onSeeking);
      vid.removeEventListener("seeked", onSeeked);
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      vid.removeEventListener("ended", onEnded);
    };
  }, [src, isMuted]);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <View style={[styles.container, { height: containerHeight }, style]}>
      {/* Main Video Canvas: Remote Participant Video */}
      <Pressable style={styles.videoCanvas} onPress={togglePlay} hitSlop={0}>
        {Platform.OS === "web" ? (
          <video
            ref={videoRef}
            src={webSrc}
            controls
            playsInline
            loop
            muted={isMuted}
            autoPlay={autoPlay}
            preload="metadata"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              backgroundColor: "#0F172A",
              display: "block",
              filter: "contrast(1.03) brightness(0.97)",
            }}
          />
        ) : (
          <Video
            ref={nativeVideoRef}
            source={nativeSource}
            style={styles.nativeVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={autoPlay}
            isMuted={isMuted}
            isLooping={true}
            useNativeControls={false}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded) {
                setIsPlaying(status.isPlaying);
                setCurrentTime(status.positionMillis / 1000);
                if (status.durationMillis) {
                  setDuration(status.durationMillis / 1000);
                }
                if (status.didJustFinish) {
                  setIsPlaying(false);
                  setIsEnded(true);
                  nativeInspectorRef.current?.pauseAsync().catch(() => {});
                }
              }
            }}
          />
        )}

        {/* Simultaneous Inspector Video (Corner PIP Overlay - Overlapped Audio Enabled) */}
        {Boolean(inspectorSrc) && (
          <View style={styles.inspectorPipOverlay} pointerEvents="none">
            {Platform.OS === "web" ? (
              <video
                ref={inspectorVideoRef}
                src={webInspectorSrc}
                playsInline
                loop
                muted={isMuted}
                autoPlay={autoPlay}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  backgroundColor: "#1E293B",
                  display: "block",
                }}
              />
            ) : (
              nativeInspectorSource && (
                <Video
                  ref={nativeInspectorRef}
                  source={nativeInspectorSource}
                  style={styles.nativeInspectorVideo}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={isPlaying}
                  isMuted={isMuted}
                  isLooping={true}
                  useNativeControls={false}
                />
              )
            )}
          </View>
        )}

        {/* Center Plain Play/Pause/Replay Toggle Button */}
        {(!isPlaying || isEnded) && (
          <View style={styles.centerToggleOverlay} pointerEvents="none">
            <View style={styles.centerToggleCircle}>
              <Icon
                name={isEnded ? "refresh" : isPlaying ? "pause" : "play"}
                size={26}
                color="#FFFFFF"
              />
            </View>
          </View>
        )}

        {/* Minimalist White Transparent Timeline Control with Icons Only (No Text) */}
        <View style={styles.transparentTimelineBar}>
          {/* Play / Pause Toggle Icon Button */}
          <Pressable
            style={styles.timelineIconBtn}
            onPress={togglePlay}
            hitSlop={8}
            accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
          >
            <Icon
              name={isEnded ? "refresh" : isPlaying ? "pause" : "play"}
              size={15}
              color="#FFFFFF"
            />
          </Pressable>

          {/* Interactive Progress Bar Track with Tap to Seek */}
          <Pressable
            style={styles.transparentProgressTrack}
            onPress={(e) => {
              if (duration > 0) {
                const { locationX } = e.nativeEvent;
                const width = trackWidthRef.current || 200;
                const ratio = Math.max(0, Math.min(1, locationX / width));
                void seekTo(ratio * duration);
              }
            }}
            onLayout={(e) => {
              trackWidthRef.current = e.nativeEvent.layout.width;
            }}
            hitSlop={6}
            accessibilityLabel="Seek video position"
          >
            <View
              style={[
                styles.transparentProgressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </Pressable>

          {/* Mute Toggle Icon Button */}
          <Pressable
            style={styles.timelineIconBtn}
            onPress={toggleMute}
            hitSlop={8}
            accessibilityLabel={isMuted ? "Unmute audio" : "Mute audio"}
          >
            <Icon
              name={isMuted ? "volume-mute" : "volume-high"}
              size={15}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#000000",
    borderRadius: 8,
    overflow: "hidden",
  },
  videoCanvas: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  nativeVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  contactTagBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  contactTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.actionGreen,
  },
  contactTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    maxWidth: 160,
  },
  inspectorPipOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 76,
    height: 102,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.8)",
    overflow: "hidden",
    backgroundColor: "#1E293B",
    zIndex: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  nativeInspectorVideo: {
    width: "100%",
    height: "100%",
  },
  inspectorPipLabelBox: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingVertical: 1.5,
    alignItems: "center",
  },
  inspectorPipLabelText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  centerToggleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    zIndex: 10,
  },
  centerToggleCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  transparentTimelineBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 15,
  },
  timelineIconBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  transparentProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: 2,
    overflow: "hidden",
  },
  transparentProgressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  transparentTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
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
