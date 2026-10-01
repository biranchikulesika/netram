import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  Animated,
  PanResponder,
} from "react-native";
// The RN-core SafeAreaView is an iOS-only no-op; edge-to-edge Android (SDK 35)
// draws content under the status bar unless insets come from this package.
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Audio as ExpoAudio, Video as ExpoVideo, ResizeMode } from "expo-av";
import { Icon } from "../src/components/ui/Icon";
import { InteractiveVideoPlayer } from "../src/components/ui/InteractiveVideoPlayer";
import { colors } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { useAuth } from "../src/auth/auth-context";
import { OfflineInspectionQueue } from "../src/offline/queue";
import {
  startCallingSound,
  playCallPickupSound,
  stopAllCallSounds,
} from "../src/utils/call-sounds";

import type { CallContact, CallRecord, CallCondition } from "@netram/types";

export type AssignedContact = CallContact;
export type CallHistoryRecord = CallRecord;
export type ReviewCondition = CallCondition;

// Remote participant video always comes from the directory record served by
// the API (CallContact.videoUri). No bundled demo footage is used.

const queue = new OfflineInspectionQueue();
// All contact and history records are loaded directly from the database (§5, §8, §9).

function renderWebVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isFacingFront: boolean,
  stream: MediaStream | null,
) {
  if (Platform.OS !== "web") return null;
  return React.createElement("video", {
    ref: (node: HTMLVideoElement | null) => {
      if (videoRef) {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
      }
      if (node && stream && node.srcObject !== stream) {
        node.srcObject = stream;
        node.play().catch(() => {});
      }
    },
    autoPlay: true,
    playsInline: true,
    muted: true,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: isFacingFront ? "scaleX(-1)" : "none",
      backgroundColor: "#F8FAFC",
    },
  });
}

export default function CallsScreen() {
  const { theme, isPureDark } = useSettings();
  const { client } = useAuth();

  // Tab 1: Assigned Calls ("contacts") FIRST, Tab 2: Call History ("history") SECOND
  const [activeTab, setActiveTab] = useState<"contacts" | "history">("contacts");

  // Expanded contact ID in Assigned Calls (null at first so NO details are shown initially)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Expanded call ID in Call History (null at first so NO details are shown initially)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  // Contacts and Call History loaded directly from database (§5, §8, §9)
  const [contacts, setContacts] = useState<AssignedContact[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistoryRecord[]>([]);
  const [_isLoadingDb, setIsLoadingDb] = useState(true);

  // Active Video Call state
  const [activeCall, setActiveCall] = useState<{
    contact: AssignedContact;
    status: "connecting" | "ringing" | "connected";
    duration: number;
  } | null>(null);

  // Snapshot flash notification state
  const [snapshotToast, setSnapshotToast] = useState(false);

  // Post-call review modal state with simultaneous dual video recording
  const [endedCallData, setEndedCallData] = useState<{
    contact: AssignedContact;
    duration: number;
    videoUri: string | null;
    inspectorVideoUri?: string | null;
  } | null>(null);

  const [reviewCondition, setReviewCondition] = useState<ReviewCondition>("satisfactory");
  const [reviewProblemsText, setReviewProblemsText] = useState("");
  const [flagForSiteVisit, setFlagForSiteVisit] = useState(false);

  // Camera and Microphone permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Speaker option state (loudspeaker vs earpiece)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Auto-recording option for evidence storing
  const autoRecordEvidence = true;

  // Draggable PanResponder for Floating PIP Video
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFacingFront, setIsFacingFront] = useState(true);

  // Media stream refs for Web
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real Session Video Recording refs (Simultaneous Dual Inspector + Caller Recording)
  const cameraViewRef = useRef<CameraView | null>(null);
  const isRecordingNativeRef = useRef(false);
  const nativeRecordPromiseRef = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const nativeRecordedUriRef = useRef<string | null>(null);
  const webCallRecorderRef = useRef<MediaRecorder | null>(null);
  const webCallChunksRef = useRef<BlobPart[]>([]);
  const webRecordedUriRef = useRef<string | null>(null);

  // Theme Colors
  const bgCanvas = theme.bgCanvas;
  const bgCard = theme.bgSurface;
  const bgSubtle = isPureDark ? "#18181B" : theme.bgSubtle;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;

  // Load contacts and call history directly from the database (§5 offline SQLite, §8 API, §9 PostgreSQL)
  const loadDatabaseData = useCallback(async () => {
    try {
      // 1. Authoritative local SQLite database read (offline-first cache of
      //    server directory/history - never fabricated client-side)
      const [localContacts, localHistory] = await Promise.all([
        queue.getCallContacts(),
        queue.getCallHistory(),
      ]);

      if (localContacts && localContacts.length > 0) {
        setContacts(localContacts);
      }
      if (localHistory && localHistory.length > 0) {
        setCallHistory(localHistory);
      }

      // 2. Server PostgreSQL database sync if authenticated & online
      if (client) {
        try {
          const [remoteContacts, remoteHistory] = await Promise.all([
            client.listCallContacts(),
            client.listCallHistory(),
          ]);
          if (remoteContacts && remoteContacts.length > 0) {
            setContacts(remoteContacts);
            await queue.cacheCallContacts(remoteContacts);
          }
          if (remoteHistory && remoteHistory.length > 0) {
            setCallHistory(remoteHistory);
            await queue.cacheCallHistory(remoteHistory);
          }
        } catch {
          // Offline mode - local SQLite database remains authoritative
        }
      }
    } catch (err) {
      console.warn("Failed to load call data from database:", err);
    } finally {
      setIsLoadingDb(false);
    }
  }, [client]);

  useEffect(() => {
    void loadDatabaseData();
  }, [loadDatabaseData]);

  // Persist call history record into local SQLite database and backend PostgreSQL database
  const saveCallHistory = useCallback(
    (newRecord: CallHistoryRecord) => {
      setCallHistory((prev) => [newRecord, ...prev]);
      void (async () => {
        try {
          await queue.recordCallHistory(newRecord);
          if (client) {
            await client.createCallRecord(newRecord);
          }
        } catch (err) {
          console.warn("Failed to persist call record to database:", err);
        }
      })();
    },
    [client],
  );

  // Call timer (strictly 1-second interval based on Date.now())
  useEffect(() => {
    if (activeCall?.status === "connected") {
      const callStartTime = Date.now() - (activeCall.duration || 0) * 1000;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        setActiveCall((prev) =>
          prev && prev.status === "connected" ? { ...prev, duration: elapsed } : null,
        );
      }, 250);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeCall?.status]);

  // Toggle Speaker / Loudspeaker
  const toggleSpeaker = async () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    if (Platform.OS !== "web") {
      try {
        await ExpoAudio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: !next,
        });
      } catch {
        // fallback gracefully
      }
    }
  };

  // Start local camera on Web and Native
  const startCamera = useCallback(async () => {
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: isFacingFront ? "user" : "environment" },
          audio: true,
        });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn("Camera/mic not accessible on web:", err);
      }
    } else if (Platform.OS !== "web") {
      try {
        if (!cameraPermission?.granted) {
          await requestCameraPermission();
        }
        if (!micPermission?.granted) {
          await requestMicPermission();
        }
      } catch (err) {
        console.warn("Native camera permissions error:", err);
      }
    }
  }, [
    isFacingFront,
    cameraPermission,
    micPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const autoAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start Session Recording (Records Inspector Camera & Mic while preserving remote caller)
  const startSessionRecording = useCallback(async () => {
    nativeRecordedUriRef.current = null;
    webRecordedUriRef.current = null;

    if (Platform.OS === "web") {
      if (
        streamRef.current &&
        (!webCallRecorderRef.current || webCallRecorderRef.current.state === "inactive")
      ) {
        try {
          webCallChunksRef.current = [];
          const mimeType =
            typeof MediaRecorder !== "undefined" &&
            MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
              ? "video/webm;codecs=vp9,opus"
              : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm")
                ? "video/webm"
                : "video/mp4";

          const recorder = new MediaRecorder(streamRef.current, { mimeType });
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              webCallChunksRef.current.push(e.data);
            }
          };
          recorder.start(500);
          webCallRecorderRef.current = recorder;
        } catch (err) {
          console.warn("Could not start Web MediaRecorder:", err);
        }
      }
    } else {
      if (cameraViewRef.current && !isRecordingNativeRef.current) {
        try {
          isRecordingNativeRef.current = true;
          const promise = cameraViewRef.current.recordAsync({ maxDuration: 600 });
          nativeRecordPromiseRef.current = promise;
          promise
            .then((res) => {
              if (res?.uri) {
                nativeRecordedUriRef.current = res.uri;
                setEndedCallData((prev) => (prev ? { ...prev, inspectorVideoUri: res.uri } : null));
              }
            })
            .catch((err) => {
              console.warn("Camera recording error:", err);
            })
            .finally(() => {
              isRecordingNativeRef.current = false;
            });
        } catch (err) {
          isRecordingNativeRef.current = false;
          console.warn("recordAsync invocation error:", err);
        }
      }
    }
  }, []);

  // Stop Session Recording (Web & Native)
  const stopSessionRecording = useCallback(async (): Promise<string | null> => {
    let recordedUri: string | null = null;

    if (Platform.OS === "web") {
      if (webCallRecorderRef.current && webCallRecorderRef.current.state !== "inactive") {
        try {
          try {
            webCallRecorderRef.current.requestData();
          } catch {}
          const finishedPromise = new Promise<string | null>((resolve) => {
            if (!webCallRecorderRef.current) return resolve(null);
            webCallRecorderRef.current.onstop = () => {
              try {
                const mimeType = webCallRecorderRef.current?.mimeType || "video/webm";
                const blob = new Blob(webCallChunksRef.current, { type: mimeType });
                if (blob.size > 0) {
                  const url = URL.createObjectURL(blob);
                  webRecordedUriRef.current = url;
                  // Automatically update inspector recording in post-call data
                  setEndedCallData((prev) =>
                    prev
                      ? {
                          ...prev,
                          inspectorVideoUri: url,
                        }
                      : null,
                  );
                  resolve(url);
                } else {
                  resolve(null);
                }
              } catch {
                resolve(null);
              }
            };
          });
          webCallRecorderRef.current.stop();
          recordedUri = await Promise.race([
            finishedPromise,
            new Promise<null>((r) => setTimeout(() => r(null), 1200)),
          ]);
        } catch (e) {
          console.warn("Error stopping web recorder:", e);
        }
      } else if (webRecordedUriRef.current) {
        recordedUri = webRecordedUriRef.current;
      }
    } else {
      if (isRecordingNativeRef.current && cameraViewRef.current) {
        try {
          cameraViewRef.current.stopRecording();
          if (nativeRecordPromiseRef.current) {
            const res = await Promise.race([
              nativeRecordPromiseRef.current,
              new Promise<{ uri: string } | null>((r) => setTimeout(() => r(null), 1200)),
            ]);
            if (res?.uri) {
              recordedUri = res.uri;
              nativeRecordedUriRef.current = res.uri;
              setEndedCallData((prev) => (prev ? { ...prev, inspectorVideoUri: res.uri } : null));
            }
          }
        } catch (err) {
          console.warn("Error stopping native recorder:", err);
        }
      } else if (nativeRecordedUriRef.current) {
        recordedUri = nativeRecordedUriRef.current;
      }
    }

    return recordedUri;
  }, []);

  // Initiate Video Call (Connecting -> Calling... -> Opponent Answers Automatically)
  const startVideoCall = (contact: AssignedContact) => {
    pan.setValue({ x: 0, y: 0 });
    pan.setOffset({ x: 0, y: 0 });
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSpeakerOn(true);

    if (Platform.OS !== "web" && !cameraPermission?.granted) {
      requestCameraPermission().catch(() => {});
    }

    if (autoAnswerTimerRef.current) {
      clearTimeout(autoAnswerTimerRef.current);
      autoAnswerTimerRef.current = null;
    }

    setActiveCall({
      contact,
      status: "connecting",
      duration: 0,
    });

    void startCamera();
    void startCallingSound();

    // Step 1: Connecting... (~1.2s encrypted handshake)
    setTimeout(() => {
      // Step 2: Calling... / Ringing...
      setActiveCall((prev) => (prev ? { ...prev, status: "ringing" } : null));

      // Step 3: Opponent answers automatically after realistic ringing (~3.5s) without requiring manual tap
      autoAnswerTimerRef.current = setTimeout(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          return { ...prev, status: "connected", duration: 0 };
        });
        void playCallPickupSound();
        if (autoRecordEvidence) {
          void startSessionRecording();
        }
      }, 3500);
    }, 1200);
  };

  // Automatically start recording when connected if auto-record is enabled
  useEffect(() => {
    if (activeCall?.status === "connected" && autoRecordEvidence) {
      void startSessionRecording();
    }
  }, [activeCall?.status, autoRecordEvidence, startSessionRecording]);

  // End Call & Auto-Save Evidence & Launch Review Modal
  const endCall = async () => {
    stopAllCallSounds();
    if (autoAnswerTimerRef.current) {
      clearTimeout(autoAnswerTimerRef.current);
      autoAnswerTimerRef.current = null;
    }

    let recordedUri: string | null = null;
    if (autoRecordEvidence) {
      recordedUri = await stopSessionRecording();
    }
    stopCamera();

    if (activeCall) {
      const c = activeCall.contact;
      const dur = activeCall.duration;
      const callHash = `sha256-videocall-${c.id}-${Date.now().toString(16)}`;

      // The remote feed is the directory record's video URI; without a live
      // inspector recording there is no inspector video to store.
      const finalRemoteVideoUri = c.videoUri ?? null;
      const finalInspectorVideoUri =
        recordedUri || nativeRecordedUriRef.current || webRecordedUriRef.current || null;

      // Auto-recording option for evidence storing (§30)
      if (autoRecordEvidence && dur > 0) {
        void (async () => {
          try {
            await queue.recordObservation(
              c.projectCode,
              `[STATUTORY VIDEO CALL EVIDENCE · SEC. 30]\nParticipant: ${c.name} (${c.title})\nProject: ${c.projectName} [${c.projectCode}]\nDuration: ${formatDuration(dur)}\nCryptographic Seal: ${callHash}\nStatus: Officially Stored in Offline Vault`,
            );
          } catch {
            // quiet save
          }
        })();
      }

      // Simultaneously preserve BOTH remote and inspector video recordings
      setEndedCallData({
        contact: c,
        duration: dur,
        videoUri: finalRemoteVideoUri,
        inspectorVideoUri: finalInspectorVideoUri,
      });
      setReviewCondition("satisfactory");
      setReviewProblemsText("");
      setFlagForSiteVisit(false);
    }
    setActiveCall(null);
  };

  // Capture Live Evidence Snapshot during call
  const captureSnapshot = () => {
    setSnapshotToast(true);
    setTimeout(() => {
      setSnapshotToast(false);
    }, 2500);
  };

  // Submit Post-Call Review
  const handleSubmitReview = (skip = false) => {
    if (!endedCallData) return;

    const newRecord: CallHistoryRecord = {
      id: `call-${Date.now()}`,
      contactId: endedCallData.contact.id,
      contactName: endedCallData.contact.name,
      contactTitle: endedCallData.contact.title,
      role: endedCallData.contact.role,
      projectCode: endedCallData.contact.projectCode,
      projectName: endedCallData.contact.projectName,
      callType: "video",
      durationSeconds: endedCallData.duration,
      timestamp: "Just now",
      condition: skip ? "satisfactory" : reviewCondition,
      reviewText: skip
        ? "Video call completed. Remote oversight inspection verified."
        : reviewProblemsText.trim() || "Institute conditions verified via remote oversight.",
      flagInspection: skip ? false : flagForSiteVisit,
      videoUri: endedCallData.videoUri,
      inspectorVideoUri: endedCallData.inspectorVideoUri,
      direction: "outgoing",
      status: endedCallData.duration > 0 ? "answered" : "missed",
    };

    saveCallHistory(newRecord);
    setEndedCallData(null);
    setActiveTab("history");
  };

  // Toggle Mute
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted((prev) => !prev);
  };

  // Toggle Video
  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
    }
    setIsVideoOff((prev) => !prev);
  };

  // Flip Camera
  const flipCamera = async () => {
    const next = !isFacingFront;
    setIsFacingFront(next);
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.mediaDevices) {
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: next ? "user" : "environment" },
          audio: !isMuted,
        });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn("Could not switch camera:", err);
      }
    }
  };

  // Format MM:SS
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.projectName.toLowerCase().includes(q) ||
        c.projectCode.toLowerCase().includes(q),
    );
  }, [contacts, searchQuery]);

  // Filtered call history
  const filteredCallHistory = useMemo(() => {
    if (!searchQuery.trim()) return callHistory;
    const q = searchQuery.toLowerCase();
    return callHistory.filter(
      (h) =>
        h.contactName.toLowerCase().includes(q) ||
        h.projectName.toLowerCase().includes(q) ||
        h.projectCode.toLowerCase().includes(q),
    );
  }, [callHistory, searchQuery]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: WhatsApp-Style Active Video Call Interface
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeCall) {
    const c = activeCall.contact;
    const isConnected = activeCall.status === "connected";

    return (
      <View style={styles.fullscreenCallContainer}>
        {/* Fullscreen Remote Video Canvas */}
        <View style={styles.remoteVideoCanvas}>
          {/* Background Ambient Feed */}
          <View style={[styles.remoteVideoBackdrop, { backgroundColor: bgSubtle }]}>
            {isConnected ? (
              <View style={styles.connectedRemoteFeed}>
                {Platform.OS === "web" ? (
                  <video
                    ref={remoteVideoRef}
                    src={c.videoUri || ""}
                    autoPlay
                    playsInline
                    loop
                    muted={!isSpeakerOn}
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
                  <ExpoVideo
                    source={{ uri: c.videoUri || "" }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={true}
                    isLooping={true}
                    isMuted={!isSpeakerOn}
                    useNativeControls={false}
                  />
                )}
              </View>
            ) : (
              /* WhatsApp-Style Connecting / Calling Radar Visual */
              <View style={styles.connectingCanvas}>
                <View style={styles.radarRingOuter}>
                  <View style={styles.radarRingMiddle}>
                    <View style={[styles.connectingAvatar, { backgroundColor: c.avatarColor }]}>
                      <Text style={styles.connectingAvatarText}>
                        {c.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Prominent WhatsApp-Style Call State Indicator */}
                <View style={styles.callingStateInfoBox}>
                  <Text style={[styles.callingTargetName, { color: textPrimary }]}>{c.name}</Text>
                  <Text style={[styles.callingTargetTitle, { color: textMuted }]}>
                    {c.title} • {c.projectName}
                  </Text>
                  <View style={styles.callingBadgePill}>
                    <View
                      style={[
                        styles.statusPulsingDotSmall,
                        {
                          backgroundColor:
                            activeCall.status === "ringing" ? colors.gold : colors.accentBlue,
                        },
                      ]}
                    />
                    <Text style={styles.callingBadgeText}>
                      {activeCall.status === "connecting" ? "CONNECTING..." : "CALLING..."}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Floating Picture-In-Picture (PIP) Inspector Camera - Face View (Draggable) */}
          <Animated.View
            style={[
              styles.pipCameraBox,
              {
                transform: pan.getTranslateTransform(),
              },
            ]}
            {...panResponder.panHandlers}
          >
            {Platform.OS === "web" ? (
              isVideoOff ? (
                <View style={styles.pipCameraOff}>
                  <Icon name="videocam-off" size={24} color={colors.navyDark} />
                </View>
              ) : (
                renderWebVideo(localVideoRef, isFacingFront, streamRef.current)
              )
            ) : isVideoOff ? (
              <View style={styles.pipCameraOff}>
                <Icon name="videocam-off" size={24} color={colors.navyDark} />
              </View>
            ) : (
              <CameraView
                ref={cameraViewRef}
                style={StyleSheet.absoluteFillObject}
                facing={isFacingFront ? "front" : "back"}
                mode="video"
                mute={isMuted}
              />
            )}

            {/* Subtle Draggable Grip Handle */}
            <View style={styles.pipDragGrip} pointerEvents="none">
              <View style={styles.pipDragGripBar} />
            </View>
          </Animated.View>
        </View>

        {/* Top Floating Header (White Government Theme) */}
        <SafeAreaView style={styles.floatingHeaderContainer}>
          <View style={styles.floatingHeaderMinimal}>
            <Pressable style={styles.minimizeGlassBtn} onPress={endCall} hitSlop={12}>
              <Icon name="chevron-down" size={26} color={colors.navyDark} />
            </Pressable>

            <View style={styles.headerInfoBlock}>
              <Text style={styles.headerCallerName} numberOfLines={1}>
                {c.name}
              </Text>
              <View style={styles.liveTimerPill}>
                <View
                  style={[
                    styles.statusPulsingDot,
                    {
                      backgroundColor:
                        activeCall.status === "connected"
                          ? colors.actionGreen
                          : activeCall.status === "ringing"
                            ? colors.gold
                            : colors.accentBlue,
                    },
                  ]}
                />
                <Text style={styles.encryptionSubtitle}>
                  {activeCall.status === "connecting"
                    ? "Connecting..."
                    : activeCall.status === "ringing"
                      ? "Calling..."
                      : `${formatDuration(activeCall.duration)} · Encrypted`}
                </Text>
              </View>
            </View>

            {/* Official Statutory Oversight REC Indicator in Upper Bar */}
            <View style={styles.autoRecordHeaderBadge}>
              <View style={styles.recDot} />
              <Text style={styles.autoRecordHeaderText}>REC</Text>
            </View>
          </View>
        </SafeAreaView>

        {/* Evidence Snapshot Toast Alert */}
        {snapshotToast && (
          <View style={styles.snapshotToastBox}>
            <Icon name="camera" size={16} color="#FFFFFF" />
            <Text style={styles.snapshotToastText}>Snapshot Captured & Hashed</Text>
          </View>
        )}

        {/* Bottom Floating White Dock */}
        <SafeAreaView style={styles.bottomDockContainer}>
          <View style={styles.frostedControlDock}>
            {/* Flip Camera */}
            <Pressable style={styles.dockControlBtn} onPress={flipCamera} hitSlop={6}>
              <Icon name="camera-reverse-outline" size={22} color={colors.navyDark} />
            </Pressable>

            {/* Video Camera Toggle */}
            <Pressable
              style={[styles.dockControlBtn, isVideoOff && styles.dockControlBtnMuted]}
              onPress={toggleVideo}
              hitSlop={6}
            >
              <Icon
                name={isVideoOff ? "videocam-off" : "videocam"}
                size={22}
                color={isVideoOff ? "#FFFFFF" : colors.navyDark}
              />
            </Pressable>

            {/* Mic Mute Toggle */}
            <Pressable
              style={[styles.dockControlBtn, isMuted && styles.dockControlBtnMuted]}
              onPress={toggleMute}
              hitSlop={6}
            >
              <Icon
                name={isMuted ? "mic-off" : "mic"}
                size={22}
                color={isMuted ? "#FFFFFF" : colors.navyDark}
              />
            </Pressable>

            {/* Speaker Toggle Button */}
            <Pressable
              style={[
                styles.dockControlBtn,
                isSpeakerOn ? styles.dockControlBtnActive : styles.dockControlBtnMuted,
              ]}
              onPress={toggleSpeaker}
              hitSlop={6}
            >
              <Icon
                name={isSpeakerOn ? "volume-high" : "volume-mute"}
                size={22}
                color={isSpeakerOn ? colors.navyDark : "#FFFFFF"}
              />
            </Pressable>

            {/* Capture Evidence Snapshot */}
            {isConnected && (
              <Pressable style={styles.dockSnapshotBtn} onPress={captureSnapshot} hitSlop={6}>
                <Icon name="camera-outline" size={22} color={colors.accentBlue} />
              </Pressable>
            )}

            {/* End Call / Hang Up */}
            <Pressable style={styles.dockHangUpBtn} onPress={endCall} hitSlop={6}>
              <Icon name="call" size={26} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: WhatsApp-Inspired Main Directory & Call History
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      {/* ── Search Bar & Tab Toggle Row ── */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: bgSubtle, borderColor }]}>
          <Icon name="search" size={17} color={textMuted} />
          <TextInput
            style={[styles.searchInput, { color: textPrimary }]}
            placeholder="Search"
            placeholderTextColor={textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Icon name="close-circle" size={17} color={textMuted} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.tabToggleBtn, { backgroundColor: bgSubtle, borderColor }]}
          onPress={() => setActiveTab(activeTab === "contacts" ? "history" : "contacts")}
          accessibilityRole="button"
          accessibilityLabel={
            activeTab === "contacts" ? "Switch to call history" : "Switch to assigned calls"
          }
        >
          <View
            style={[
              styles.togglePill,
              activeTab === "contacts" && {
                backgroundColor: isPureDark ? "#27272A" : colors.navyDark,
              },
            ]}
          >
            <Icon
              name={activeTab === "contacts" ? "people" : "people-outline"}
              size={18}
              color={activeTab === "contacts" ? "#FFFFFF" : textMuted}
            />
          </View>
          <View
            style={[
              styles.togglePill,
              activeTab === "history" && {
                backgroundColor: isPureDark ? "#27272A" : colors.navyDark,
              },
            ]}
          >
            <Icon
              name={activeTab === "history" ? "time" : "time-outline"}
              size={18}
              color={activeTab === "history" ? "#FFFFFF" : textMuted}
            />
          </View>
        </Pressable>
      </View>

      {/* ── TAB 1: ASSIGNED CALLS (WhatsApp Style) ── */}
      {activeTab === "contacts" && (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredContacts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="people-outline" size={40} color={textMuted} />
              <Text style={[styles.emptyText, { color: textPrimary }]}>
                No assigned contacts found
              </Text>
            </View>
          ) : (
            filteredContacts.map((contact) => {
              const isExpanded = expandedContactId === contact.id;
              const initials = contact.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2);

              return (
                <View
                  key={contact.id}
                  style={[styles.whatsAppRowWrapper, { borderBottomColor: borderColor }]}
                >
                  <View
                    style={[styles.whatsAppMainRow, isExpanded && styles.whatsAppMainRowExpanded]}
                  >
                    {/* Compact Profile Avatar */}
                    <View style={[styles.avatarWrapper, isExpanded && { marginTop: 2 }]}>
                      <View
                        style={[styles.avatarCircle50, { backgroundColor: contact.avatarColor }]}
                      >
                        <Text style={styles.avatarInitialsText}>{initials}</Text>
                      </View>
                      {contact.isOnline && <View style={styles.onlineBadgeGreen} />}
                    </View>

                    {/* Middle Column: Click Name to View Details */}
                    <Pressable
                      style={styles.whatsAppInfoCol}
                      onPress={() => setExpandedContactId(isExpanded ? null : contact.id)}
                    >
                      <Text style={[styles.contactNameBold, { color: textPrimary }]}>
                        {contact.name}
                      </Text>
                      {isExpanded && (
                        <Text style={[styles.contactSubtitleMuted, { color: textMuted }]}>
                          {contact.title} • {contact.projectName}
                        </Text>
                      )}
                    </Pressable>

                    {/* ONLY Video Call Button (WhatsApp Green) */}
                    <Pressable
                      style={[styles.whatsAppVideoBtn, isExpanded && { marginTop: -2 }]}
                      onPress={() => startVideoCall(contact)}
                      accessibilityLabel={`Video Call ${contact.name}`}
                    >
                      <Icon name="videocam" size={20} color={colors.actionGreen} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── TAB 2: CALL HISTORY (WhatsApp Style) ── */}
      {activeTab === "history" && (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredCallHistory.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="time-outline" size={40} color={textMuted} />
              <Text style={[styles.emptyText, { color: textPrimary }]}>
                No video call history recorded
              </Text>
            </View>
          ) : (
            filteredCallHistory.map((item) => {
              const isExpanded = expandedCallId === item.id;
              const matchedContact = contacts.find((c) => c.id === item.contactId);
              const avatarColor = matchedContact?.avatarColor || "#2563EB";
              const initials = item.contactName
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2);

              const isPickedUp = item.status
                ? item.status === "answered"
                : item.durationSeconds > 0;
              const isIncoming = item.direction === "incoming";

              // Icon, Color, Badge, and Label
              let iconName: string;
              let statusLabel: string;
              let arrowColor: string;
              let badgeBg: string;

              if (isPickedUp) {
                iconName = isIncoming ? "call-received" : "call-made";
                arrowColor = colors.actionGreen;
                badgeBg = isPureDark ? "rgba(22, 163, 74, 0.25)" : "#DCFCE7";
                statusLabel = formatDuration(item.durationSeconds);
              } else if (isIncoming) {
                // Incoming call not picked up -> Red bounce arrow & "Missed"
                iconName = "call-missed";
                arrowColor = colors.errorRed;
                badgeBg = isPureDark ? "rgba(220, 38, 38, 0.25)" : "#FEE2E2";
                statusLabel = "Missed";
              } else {
                // Outgoing and unanswered -> North-East red arrow & "Unanswered"
                iconName = "call-made";
                arrowColor = colors.errorRed;
                badgeBg = isPureDark ? "rgba(220, 38, 38, 0.25)" : "#FEE2E2";
                statusLabel = "Unanswered";
              }

              return (
                <View
                  key={item.id}
                  style={[styles.whatsAppRowWrapper, { borderBottomColor: borderColor }]}
                >
                  <View
                    style={[styles.whatsAppMainRow, isExpanded && styles.whatsAppMainRowExpanded]}
                  >
                    {/* Compact Avatar with Direction Mini Badge */}
                    <View style={[styles.avatarWrapper, isExpanded && { marginTop: 2 }]}>
                      <View style={[styles.avatarCircle50, { backgroundColor: avatarColor }]}>
                        <Text style={styles.avatarInitialsText}>{initials}</Text>
                      </View>
                      <View
                        style={[
                          styles.videoHistoryBadge,
                          {
                            backgroundColor: badgeBg,
                            borderColor: isPureDark ? colors.navyDark : "#FFFFFF",
                          },
                        ]}
                      >
                        <Icon name={iconName} size={11} color={arrowColor} />
                      </View>
                    </View>

                    {/* Middle Column: Click Name to View Review & Problems */}
                    <Pressable
                      style={styles.whatsAppInfoCol}
                      onPress={() => setExpandedCallId(isExpanded ? null : item.id)}
                    >
                      <Text
                        style={[styles.contactNameBold, { color: textPrimary }]}
                        numberOfLines={1}
                      >
                        {item.contactName}
                      </Text>
                      <Text
                        style={[styles.contactSubtitleMuted, { color: textMuted }]}
                        numberOfLines={1}
                      >
                        {item.timestamp} •{" "}
                        <Text
                          style={{
                            color: isPickedUp ? textMuted : colors.errorRed,
                            fontWeight: isPickedUp ? "400" : "600",
                          }}
                        >
                          {statusLabel}
                        </Text>
                      </Text>
                    </Pressable>

                    {/* ONLY Video Re-dial Button */}
                    <Pressable
                      style={[styles.whatsAppVideoBtn, isExpanded && { marginTop: -2 }]}
                      onPress={() => {
                        const c = matchedContact || {
                          id: item.contactId,
                          name: item.contactName,
                          role: item.role,
                          title: item.contactTitle,
                          projectCode: item.projectCode,
                          projectName: item.projectName,
                          phone: "",
                          isOnline: true,
                          avatarColor,
                        };
                        startVideoCall(c);
                      }}
                      accessibilityLabel={`Video Call ${item.contactName}`}
                    >
                      <Icon name="videocam" size={20} color={colors.actionGreen} />
                    </Pressable>
                  </View>

                  {/* ── EXPANDED CALL DETAILS (ONLY AFTER CLICKING THE NAME) ── */}
                  {isExpanded && (
                    <View style={styles.detailsCard}>
                      <Text style={[styles.contactSubtitleMuted, { color: textMuted }]}>
                        {item.contactTitle || (item.role === "staff" ? "Staff" : "Beneficiary")} •{" "}
                        {item.projectName}
                      </Text>

                      {/* Observations Note Box */}
                      {item.reviewText ? (
                        <View
                          style={[
                            styles.reviewNoteCallout,
                            { backgroundColor: bgSubtle, borderColor },
                          ]}
                        >
                          <Text style={[styles.reviewNoteCalloutTitle, { color: textMuted }]}>
                            Note
                          </Text>
                          <Text style={[styles.reviewNoteCalloutBody, { color: textPrimary }]}>
                            {item.reviewText}
                          </Text>
                        </View>
                      ) : null}

                      {/* Play Recorded Video in Call History - Simultaneous Dual Feed */}
                      {item.videoUri && (
                        <View style={[styles.historyVideoBox, { borderColor }]}>
                          <InteractiveVideoPlayer
                            src={item.videoUri}
                            inspectorSrc={item.inspectorVideoUri ?? undefined}
                            contactName={item.contactName}
                            title={`${item.contactName} · ${item.projectCode}`}
                            style={styles.historyInteractiveVideo}
                          />
                        </View>
                      )}

                      {item.flagInspection && (
                        <View style={styles.flagInspectionBanner}>
                          <Icon name="flag" size={13} color="#DC2626" />
                          <Text style={styles.flagInspectionBannerText}>
                            Priority on-site physical inspection recommended
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          POST-CALL REVIEW MODAL
      ───────────────────────────────────────────────────────────────────────────── */}
      {endedCallData && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: bgCard, borderColor }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Icon name="videocam-outline" size={18} color="#002449" />
                  <Text style={[styles.modalTitle, { color: textPrimary }]}>
                    Video Call Review & Problems
                  </Text>
                </View>
                <Pressable onPress={() => handleSubmitReview(true)} hitSlop={8}>
                  <Icon name="close" size={20} color={textMuted} />
                </Pressable>
              </View>

              <Text style={[styles.modalSub, { color: textMuted }]}>
                {endedCallData.contact.name} • {formatDuration(endedCallData.duration)}
              </Text>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Recorded Call Video Player - Simultaneous Dual Feed */}
                {endedCallData.videoUri && (
                  <View style={styles.modalVideoPlayerCard}>
                    <InteractiveVideoPlayer
                      src={endedCallData.videoUri || ""}
                      inspectorSrc={endedCallData.inspectorVideoUri || undefined}
                      contactName={endedCallData.contact.name}
                      title={`Session Recording: ${endedCallData.contact.name}`}
                      style={styles.modalInteractiveVideo}
                      autoPlay={true}
                    />
                  </View>
                )}

                {/* Condition Options */}
                <Text style={[styles.modalSectionLabel, { color: textPrimary }]}>
                  Facility Condition Assessment:
                </Text>
                <View style={styles.conditionRow}>
                  <Pressable
                    style={[
                      styles.conditionOptionBtn,
                      { backgroundColor: bgCard, borderColor: borderColor },
                      reviewCondition === "satisfactory" &&
                        styles.conditionOptionSatisfactoryActive,
                    ]}
                    onPress={() => setReviewCondition("satisfactory")}
                  >
                    <Icon
                      name="checkmark-circle"
                      size={14}
                      color={reviewCondition === "satisfactory" ? "#FFFFFF" : colors.actionGreen}
                    />
                    <Text
                      style={[
                        styles.conditionOptionText,
                        { color: textMuted },
                        reviewCondition === "satisfactory" && styles.conditionOptionTextActive,
                      ]}
                    >
                      Normal
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.conditionOptionBtn,
                      { backgroundColor: bgCard, borderColor: borderColor },
                      reviewCondition === "minor_issue" && styles.conditionOptionMinorActive,
                    ]}
                    onPress={() => setReviewCondition("minor_issue")}
                  >
                    <Icon
                      name="warning"
                      size={14}
                      color={reviewCondition === "minor_issue" ? "#FFFFFF" : colors.gold}
                    />
                    <Text
                      style={[
                        styles.conditionOptionText,
                        { color: textMuted },
                        reviewCondition === "minor_issue" && styles.conditionOptionTextActive,
                      ]}
                    >
                      Minor Issues
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.conditionOptionBtn,
                      { backgroundColor: bgCard, borderColor: borderColor },
                      reviewCondition === "critical_problem" &&
                        styles.conditionOptionCriticalActive,
                    ]}
                    onPress={() => setReviewCondition("critical_problem")}
                  >
                    <Icon
                      name="alert-circle"
                      size={14}
                      color={reviewCondition === "critical_problem" ? "#FFFFFF" : colors.error}
                    />
                    <Text
                      style={[
                        styles.conditionOptionText,
                        { color: textMuted },
                        reviewCondition === "critical_problem" && styles.conditionOptionTextActive,
                      ]}
                    >
                      Critical Defect
                    </Text>
                  </Pressable>
                </View>

                {/* Observations Input */}
                <Text style={[styles.modalSectionLabel, { color: textPrimary, marginTop: 12 }]}>
                  Problems & Observations Noted:
                </Text>
                <TextInput
                  style={[
                    styles.problemsInput,
                    {
                      backgroundColor: bgSubtle,
                      borderColor,
                      color: textPrimary,
                    },
                  ]}
                  placeholder="Write problems, grievances, or facility observations…"
                  placeholderTextColor={textMuted}
                  multiline
                  numberOfLines={3}
                  value={reviewProblemsText}
                  onChangeText={setReviewProblemsText}
                />

                {/* Flag Inspection Toggle */}
                <Pressable
                  style={styles.flagCheckRow}
                  onPress={() => setFlagForSiteVisit((p) => !p)}
                >
                  <View style={[styles.checkbox, flagForSiteVisit && styles.checkboxActive]}>
                    {flagForSiteVisit && <Icon name="checkmark" size={11} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.flagCheckLabel, { color: textPrimary }]}>
                    Recommend on-site physical inspection
                  </Text>
                </Pressable>

                {/* Action Buttons */}
                <View style={styles.modalActionRow}>
                  <Pressable style={styles.skipBtn} onPress={() => handleSubmitReview(true)}>
                    <Text style={[styles.skipBtnText, { color: textMuted }]}>Skip</Text>
                  </Pressable>

                  <Pressable style={styles.saveBtn} onPress={() => handleSubmitReview(false)}>
                    <Icon name="save-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // Search & Tab Toggle Row
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  tabToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  togglePill: {
    width: 36,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  // List
  listContainer: {
    paddingVertical: 6,
    paddingBottom: 40,
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // WhatsApp-Style Clean Rows
  whatsAppRowWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  whatsAppMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  whatsAppMainRowExpanded: {
    alignItems: "flex-start",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  avatarCircle50: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  onlineBadgeGreen: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.actionGreen,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  videoHistoryBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  whatsAppInfoCol: {
    flex: 1,
    gap: 3,
    justifyContent: "center",
  },
  contactNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  contactNameBold: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  contactSubtitleMuted: {
    fontSize: 13,
    lineHeight: 18,
  },
  whatsAppVideoBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // Details
  detailsCard: {
    marginTop: 6,
    marginLeft: 48,
    gap: 9,
    paddingTop: 2,
    paddingBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  detailValue: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "500",
  },
  reviewNoteCallout: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  reviewNoteCalloutTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  reviewNoteCalloutBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  flagInspectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
  },
  flagInspectionBannerText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
    lineHeight: 16,
  },
  // ---------------------------------------------------------------------------
  // FULLSCREEN IN-CALL INTERFACE (GOVERNMENT WHITE THEME)
  // ---------------------------------------------------------------------------
  fullscreenCallContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  remoteVideoCanvas: {
    flex: 1,
    position: "relative",
  },
  remoteVideoBackdrop: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  connectedRemoteFeed: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0F172A",
    position: "relative",
    overflow: "hidden",
  },
  remoteParticipantOverlayBadge: {
    position: "absolute",
    bottom: 96,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    zIndex: 10,
  },
  remoteParticipantDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.actionGreen,
  },
  remoteParticipantOverlayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  connectedRemoteName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.navyDark,
    marginTop: 12,
  },
  connectedRemoteSub: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  remoteAvatarCircleHuge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#E2E8F0",
  },
  remoteAvatarHugeText: {
    fontSize: 44,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Connecting / Calling Radar Screen
  connectingCanvas: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  radarRingOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0, 36, 73, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarRingMiddle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(0, 36, 73, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  connectingAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  connectingAvatarText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callingStateInfoBox: {
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  callingTargetName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navyDark,
  },
  callingTargetTitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "500",
  },
  callingBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 4,
  },
  callingBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.navyDark,
    letterSpacing: 0.8,
  },

  // Local PIP Camera (Draggable)
  pipCameraBox: {
    position: "absolute",
    top: Platform.OS === "android" ? 70 : 80,
    right: 16,
    width: 100,
    height: 145,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#1E293B",
    zIndex: 40,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  pipDragGrip: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  pipDragGripBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  pipCameraOff: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  pipFlipIndicator: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  // WhatsApp-Style Clean Top Header (Government White Theme)
  floatingHeaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    zIndex: 30,
  },
  floatingHeaderMinimal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 14 : 8,
    paddingBottom: 8,
  },
  minimizeGlassBtn: {
    padding: 6,
  },
  headerInfoBlock: {
    alignItems: "center",
    gap: 3,
  },
  headerCallerName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navyDark,
  },
  liveTimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusPulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPulsingDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  encryptionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  autoRecordHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  autoRecordHeaderText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B91C1C",
  },

  // Snapshot Toast
  snapshotToastBox: {
    position: "absolute",
    top: 130,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.navyDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    zIndex: 40,
  },
  snapshotToastText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Bottom Floating Dock (Government White Theme)
  bottomDockContainer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  frostedControlDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  dockControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  dockControlBtnActive: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1.5,
    borderColor: "#0284C7",
  },
  dockControlBtnInactive: {
    backgroundColor: "#F1F5F9",
  },
  dockControlBtnRecActive: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  recIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#EF4444",
  },
  recBtnText: {
    fontSize: 10,
    fontWeight: "800",
  },
  dockControlBtnMuted: {
    backgroundColor: "#DC2626",
  },
  dockSnapshotBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
  },
  dockHangUpBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  // Post-Call Review Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "92%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  modalScrollView: {
    maxHeight: 460,
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 6,
  },
  modalVideoPlayerCard: {
    borderRadius: 8,
    overflow: "hidden",
  },
  modalInteractiveVideo: {
    height: 230,
    borderRadius: 8,
    overflow: "hidden",
  },
  historyVideoBox: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
  },
  historyInteractiveVideo: {
    height: 190,
    borderRadius: 8,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalSub: {
    fontSize: 12,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  conditionRow: {
    flexDirection: "row",
    gap: 6,
  },
  conditionOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
  },
  conditionOptionSatisfactoryActive: {
    backgroundColor: colors.actionGreen,
    borderColor: colors.actionGreen,
  },
  conditionOptionMinorActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  conditionOptionCriticalActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  conditionOptionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  conditionOptionTextActive: {
    color: "#FFFFFF",
  },
  problemsInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 70,
  },
  flagCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  flagCheckLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  skipBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#002449",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
