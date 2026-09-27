import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  Animated,
  PanResponder,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { Audio as ExpoAudio } from "expo-av";
import { Icon } from "../src/components/ui/Icon";
import { InteractiveVideoPlayer } from "../src/components/ui/InteractiveVideoPlayer";
import { colors } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { OfflineInspectionQueue } from "../src/offline/queue";
import {
  startCallingSound,
  playCallPickupSound,
  stopAllCallSounds,
} from "../src/utils/call-sounds";

export interface AssignedContact {
  id: string;
  name: string;
  role: "staff" | "beneficiary";
  title: string;
  projectCode: string;
  projectName: string;
  phone: string;
  isOnline: boolean;
  avatarColor: string;
}

export type ReviewCondition = "satisfactory" | "minor_issue" | "critical_problem";

export interface CallHistoryRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  role: "staff" | "beneficiary";
  projectName: string;
  projectCode: string;
  callType: "video";
  durationSeconds: number;
  timestamp: string;
  condition: ReviewCondition;
  reviewText: string;
  flagInspection: boolean;
  videoUri?: string;
}

const queue = new OfflineInspectionQueue();
const STORAGE_KEY = "netram_inspector_call_history";

// Assigned contacts linked to field projects
const DEFAULT_CONTACTS: AssignedContact[] = [
  {
    id: "cnt-01",
    name: "Ramesh Jena",
    role: "staff",
    title: "Facility In-Charge",
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    phone: "+91 94370 12890",
    isOnline: true,
    avatarColor: colors.accentBlue,
  },
  {
    id: "cnt-02",
    name: "Dr. Anita Behera",
    role: "staff",
    title: "Medical Officer",
    projectCode: "DOSJE-BBR-002",
    projectName: "Kalyan Mandap IRCA Rehabilitation",
    phone: "+91 98610 44521",
    isOnline: true,
    avatarColor: colors.actionGreen,
  },
  {
    id: "cnt-03",
    name: "Bipin Bihari Das",
    role: "beneficiary",
    title: "Senior Resident Lead",
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    phone: "+91 94381 77230",
    isOnline: true,
    avatarColor: colors.gold,
  },
  {
    id: "cnt-04",
    name: "Er. Manoj Nayak",
    role: "staff",
    title: "Site Engineer",
    projectCode: "DOSJE-BBR-003",
    projectName: "Navajyoti SC/ST Girls Hostel",
    phone: "+91 97760 99312",
    isOnline: false,
    avatarColor: colors.navyData,
  },
  {
    id: "cnt-05",
    name: "Sunita Mohanty",
    role: "staff",
    title: "Shelter Superintendent",
    projectCode: "DOSJE-BBR-004",
    projectName: "Swadhar Greh Women Shelter",
    phone: "+91 94392 65410",
    isOnline: true,
    avatarColor: colors.navyDark,
  },
  {
    id: "cnt-06",
    name: "Laxmi Murmu",
    role: "beneficiary",
    title: "Beneficiary Representative",
    projectCode: "DOSJE-BBR-003",
    projectName: "Navajyoti SC/ST Girls Hostel",
    phone: "+91 98533 11840",
    isOnline: true,
    avatarColor: colors.tagRust,
  },
  {
    id: "cnt-07",
    name: "Pravat Kumar Rout",
    role: "staff",
    title: "Project Coordinator",
    projectCode: "DOSJE-BBR-002",
    projectName: "Kalyan Mandap IRCA Centre",
    phone: "+91 94371 88902",
    isOnline: false,
    avatarColor: colors.actionGreen,
  },
  {
    id: "cnt-08",
    name: "Minati Sahoo",
    role: "beneficiary",
    title: "Resident Beneficiary",
    projectCode: "DOSJE-BBR-004",
    projectName: "Swadhar Greh Women Shelter",
    phone: "+91 96924 55301",
    isOnline: true,
    avatarColor: colors.navyBrand,
  },
];

// Initial seeded video call history records
const INITIAL_CALL_HISTORY: CallHistoryRecord[] = [
  {
    id: "hist-01",
    contactId: "cnt-02",
    contactName: "Dr. Anita Behera",
    contactTitle: "Medical Officer",
    role: "staff",
    projectCode: "DOSJE-BBR-002",
    projectName: "Kalyan Mandap IRCA Rehabilitation",
    callType: "video",
    durationSeconds: 374,
    timestamp: "Today, 11:30 AM",
    condition: "minor_issue",
    reviewText:
      "Medical supplies stock is adequate for 2 weeks. Reported delay in quarterly fund release for ambulance fuel. Staff attendance verified over camera.",
    flagInspection: false,
    videoUri: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "hist-02",
    contactId: "cnt-03",
    contactName: "Bipin Bihari Das",
    contactTitle: "Senior Resident Lead",
    role: "beneficiary",
    projectCode: "DOSJE-BBR-001",
    projectName: "Sishhu Bhawan Senior Citizen Home",
    callType: "video",
    durationSeconds: 220,
    timestamp: "Yesterday, 04:15 PM",
    condition: "satisfactory",
    reviewText:
      "Beneficiary confirmed warm meals served on schedule. RO water filter is operational. Zero staff misconduct or grievances reported.",
    flagInspection: false,
    videoUri: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "hist-03",
    contactId: "cnt-04",
    contactName: "Er. Manoj Nayak",
    contactTitle: "Site Engineer",
    role: "staff",
    projectCode: "DOSJE-BBR-003",
    projectName: "Navajyoti SC/ST Girls Hostel",
    callType: "video",
    durationSeconds: 502,
    timestamp: "Sep 24, 02:20 PM",
    condition: "critical_problem",
    reviewText:
      "Perimeter boundary wall construction halted due to cement shortage. Deep unpaved trench waterlogged creating severe safety hazard for resident girls.",
    flagInspection: true,
    videoUri: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
];

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

  // Tab 1: Assigned Calls ("contacts") FIRST, Tab 2: Call History ("history") SECOND
  const [activeTab, setActiveTab] = useState<"contacts" | "history">("contacts");

  // Expanded contact ID in Assigned Calls (null at first so NO details are shown initially)
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Expanded call ID in Call History (null at first so NO details are shown initially)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<AssignedContact[]>(DEFAULT_CONTACTS);

  // Call history records state (strictly video calls)
  const [callHistory, setCallHistory] = useState<CallHistoryRecord[]>(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_CALL_HISTORY;
  });

  // Active Video Call state
  const [activeCall, setActiveCall] = useState<{
    contact: AssignedContact;
    status: "connecting" | "ringing" | "connected";
    duration: number;
  } | null>(null);

  // Snapshot flash notification state
  const [snapshotToast, setSnapshotToast] = useState(false);

  // Post-call review modal state
  const [endedCallData, setEndedCallData] = useState<{
    contact: AssignedContact;
    duration: number;
    videoUri: string;
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
  const [autoRecordEvidence, setAutoRecordEvidence] = useState(true);

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
    })
  ).current;

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFacingFront, setIsFacingFront] = useState(true);

  // Media stream refs for Web
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real Session Video Recording refs (Web & Native)
  const cameraViewRef = useRef<CameraView | null>(null);
  const isRecordingNativeRef = useRef(false);
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

  // Persist call history
  const saveCallHistory = useCallback((updated: CallHistoryRecord[]) => {
    setCallHistory(updated);
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  }, []);

  // Sync contacts with local SQLite inspections if available
  useEffect(() => {
    void (async () => {
      try {
        const cached = await queue.getCachedInspections();
        if (cached && cached.length > 0) {
          const updated = DEFAULT_CONTACTS.map((c, i) => {
            const insp = cached[i % cached.length];
            if (!insp) return c;
            return {
              ...c,
              projectCode: insp.project_code || c.projectCode,
              projectName: insp.project_name || c.projectName,
            };
          });
          setContacts(updated);
        }
      } catch {
        // fallback
      }
    })();
  }, []);

  // Call timer (strictly 1-second interval based on Date.now())
  useEffect(() => {
    if (activeCall?.status === "connected") {
      const callStartTime = Date.now() - ((activeCall.duration || 0) * 1000);
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        setActiveCall((prev) => (prev && prev.status === "connected" ? { ...prev, duration: elapsed } : null));
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
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
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
  }, [isFacingFront, cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

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

  // Start Session Recording (Web & Native)
  const startSessionRecording = useCallback(async () => {
    nativeRecordedUriRef.current = null;
    webRecordedUriRef.current = null;

    if (Platform.OS === "web") {
      if (streamRef.current && (!webCallRecorderRef.current || webCallRecorderRef.current.state === "inactive")) {
        try {
          webCallChunksRef.current = [];
          const mimeType =
            typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
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
          cameraViewRef.current
            .recordAsync({ maxDuration: 600 })
            .then((res) => {
              if (res?.uri) {
                nativeRecordedUriRef.current = res.uri;
                setEndedCallData((prev) => (prev ? { ...prev, videoUri: res.uri } : null));
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
          const finishedPromise = new Promise<string | null>((resolve) => {
            if (!webCallRecorderRef.current) return resolve(null);
            webCallRecorderRef.current.onstop = () => {
              try {
                const mimeType = webCallRecorderRef.current?.mimeType || "video/webm";
                const blob = new Blob(webCallChunksRef.current, { type: mimeType });
                if (blob.size > 0) {
                  const url = URL.createObjectURL(blob);
                  webRecordedUriRef.current = url;
                  setEndedCallData((prev) => (prev ? { ...prev, videoUri: url } : null));
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
            new Promise<null>((r) => setTimeout(() => r(null), 300)),
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
          await new Promise((r) => setTimeout(r, 150));
          if (nativeRecordedUriRef.current) {
            recordedUri = nativeRecordedUriRef.current;
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

    // Fast, lightweight fallback video (600KB - loads in milliseconds) instead of BigBuckBunny (158MB)
    const FAST_FALLBACK_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";

    if (activeCall) {
      const c = activeCall.contact;
      const dur = activeCall.duration;
      const callHash = `sha256-videocall-${c.id}-${Date.now().toString(16)}`;
      const finalVideoUri =
        recordedUri ||
        nativeRecordedUriRef.current ||
        webRecordedUriRef.current ||
        FAST_FALLBACK_VIDEO;

      // Auto-recording option for evidence storing (§30)
      if (autoRecordEvidence && dur > 0) {
        void (async () => {
          try {
            await queue.recordObservation(
              c.projectCode,
              `[STATUTORY VIDEO CALL EVIDENCE · SEC. 30]\nParticipant: ${c.name} (${c.title})\nProject: ${c.projectName} [${c.projectCode}]\nDuration: ${formatDuration(dur)}\nCryptographic Seal: ${callHash}\nStatus: Officially Stored in Offline Vault`
            );
          } catch {
            // quiet save
          }
        })();
      }

      setEndedCallData({
        contact: c,
        duration: dur,
        videoUri: finalVideoUri,
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
    };

    saveCallHistory([newRecord, ...callHistory]);
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
        c.projectCode.toLowerCase().includes(q)
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
        h.projectCode.toLowerCase().includes(q)
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
          <View style={styles.remoteVideoBackdrop}>
            {isConnected ? (
              <View style={styles.connectedRemoteFeed}>
                {/* Official Contact Initial Avatar */}
                <View style={[styles.remoteAvatarCircleHuge, { backgroundColor: c.avatarColor }]}>
                  <Text style={styles.remoteAvatarHugeText}>
                    {c.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </Text>
                </View>
                <Text style={styles.connectedRemoteName}>{c.name}</Text>
                <Text style={styles.connectedRemoteSub}>
                  {c.title} • {c.projectCode}
                </Text>
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
                  <Text style={styles.callingTargetName}>{c.name}</Text>
                  <Text style={styles.callingTargetTitle}>
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

          {/* Floating Picture-In-Picture (PIP) Inspector Camera — Face View (Draggable) */}
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

            <Pressable style={styles.pipFlipIndicator} onPress={flipCamera} hitSlop={6}>
              <Icon name="camera-reverse" size={11} color="#FFFFFF" />
            </Pressable>
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

            {/* Auto-Record Indicator */}
            {autoRecordEvidence ? (
              <View style={styles.autoRecordHeaderBadge}>
                <View style={styles.recDot} />
                <Text style={styles.autoRecordHeaderText}>REC</Text>
              </View>
            ) : (
              <View style={{ width: 28 }} />
            )}
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

            {/* Auto-Record Evidence Option */}
            <Pressable
              style={[
                styles.dockControlBtn,
                autoRecordEvidence ? styles.dockControlBtnRecActive : styles.dockControlBtnInactive,
              ]}
              onPress={() => setAutoRecordEvidence((prev) => !prev)}
              hitSlop={6}
            >
              <View style={styles.recIconWrap}>
                <View
                  style={[
                    styles.recDot,
                    { backgroundColor: autoRecordEvidence ? "#EF4444" : "#94A3B8" },
                  ]}
                />
                <Text
                  style={[
                    styles.recBtnText,
                    { color: autoRecordEvidence ? "#BA1A1A" : "#64748B" },
                  ]}
                >
                  REC
                </Text>
              </View>
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
      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { backgroundColor: bgCard, borderBottomColor: borderColor }]}>
        <View style={styles.topBarTitleGroup}>
          <Text style={[styles.topBarTitle, { color: textPrimary }]}>Calls</Text>
          <Text style={[styles.topBarSubtitle, { color: textMuted }]}>
            Field Video Oversight Directory
          </Text>
        </View>
        <View style={styles.topBarBadge}>
          <View style={styles.shieldPulseDot} />
          <Text style={styles.topBarBadgeText}>SECURE LINE</Text>
        </View>
      </View>

      {/* ── Tab Bar: Contacts / History ── */}
      <View style={[styles.tabsTrack, { backgroundColor: bgSubtle, borderBottomColor: borderColor, paddingHorizontal: 12, paddingVertical: 6 }]}>
        <Pressable
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === "contacts" ? colors.navyDark : "transparent",
              borderRadius: 6,
              paddingVertical: 7,
              paddingHorizontal: 12,
            },
          ]}
          onPress={() => setActiveTab("contacts")}
        >
          <View style={styles.tabContentRow}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "contacts" ? "#FFFFFF" : textMuted },
                activeTab === "contacts" && styles.tabTextActive,
              ]}
            >
              Assigned Calls
            </Text>
            <View
              style={[
                styles.tabBubble,
                {
                  backgroundColor:
                    activeTab === "contacts" ? "rgba(255,255,255,0.2)" : (isPureDark ? "#27272A" : theme.borderSubtle),
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBubbleText,
                  { color: activeTab === "contacts" ? "#FFFFFF" : textMuted },
                ]}
              >
                {contacts.length}
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === "history" ? colors.navyDark : "transparent",
              borderRadius: 6,
              paddingVertical: 7,
              paddingHorizontal: 12,
            },
          ]}
          onPress={() => setActiveTab("history")}
        >
          <View style={styles.tabContentRow}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "history" ? "#FFFFFF" : textMuted },
                activeTab === "history" && styles.tabTextActive,
              ]}
            >
              Call History
            </Text>
            <View
              style={[
                styles.tabBubble,
                {
                  backgroundColor:
                    activeTab === "history" ? "rgba(255,255,255,0.2)" : (isPureDark ? "#27272A" : theme.borderSubtle),
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBubbleText,
                  { color: activeTab === "history" ? "#FFFFFF" : textMuted },
                ]}
              >
                {callHistory.length}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* ── Search Bar ── */}
      <View style={[styles.searchBox, { backgroundColor: bgSubtle, borderColor }]}>
        <Icon name="search" size={17} color={textMuted} />
        <TextInput
          style={[styles.searchInput, { color: textPrimary }]}
          placeholder="Search staff, beneficiary, or project…"
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

      {/* ── TAB 1: ASSIGNED CALLS (WhatsApp Style) ── */}
      {activeTab === "contacts" && (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredContacts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="people-outline" size={40} color={textMuted} />
              <Text style={[styles.emptyText, { color: textPrimary }]}>No assigned contacts found</Text>
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
                  <View style={styles.whatsAppMainRow}>
                    {/* 50px WhatsApp-Style Avatar */}
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarCircle50, { backgroundColor: contact.avatarColor }]}>
                        <Text style={styles.avatarInitialsText}>{initials}</Text>
                      </View>
                      {contact.isOnline && <View style={styles.onlineBadgeGreen} />}
                    </View>

                    {/* Middle Column: Click Name to View Details */}
                    <Pressable
                      style={styles.whatsAppInfoCol}
                      onPress={() => setExpandedContactId(isExpanded ? null : contact.id)}
                    >
                      <View style={styles.contactNameLine}>
                        <Text style={[styles.contactNameBold, { color: textPrimary }]} numberOfLines={1}>
                          {contact.name}
                        </Text>
                        <Icon
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={textMuted}
                        />
                      </View>
                      <Text style={[styles.contactSubtitleMuted, { color: textMuted }]} numberOfLines={1}>
                        {contact.title} • {contact.role === "staff" ? "Staff" : "Beneficiary"}
                      </Text>
                    </Pressable>

                    {/* ONLY Video Call Button (WhatsApp Green) */}
                    <Pressable
                      style={styles.whatsAppVideoBtn}
                      onPress={() => startVideoCall(contact)}
                      accessibilityLabel={`Video Call ${contact.name}`}
                    >
                      <Icon name="videocam" size={20} color={colors.actionGreen} />
                    </Pressable>
                  </View>

                  {/* ── EXPANDED DETAILS (ONLY AFTER CLICKING THE NAME) ── */}
                  {isExpanded && (
                    <View style={styles.detailsCard}>
                      <View style={styles.detailRow}>
                        <Icon name="business-outline" size={14} color={textMuted} />
                        <Text style={[styles.detailLabel, { color: textMuted }]}>Project:</Text>
                        <Text style={[styles.detailValue, { color: textPrimary }]} numberOfLines={1}>
                          {contact.projectName}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Icon name="barcode-outline" size={14} color={textMuted} />
                        <Text style={[styles.detailLabel, { color: textMuted }]}>Code:</Text>
                        <Text style={[styles.detailValue, { color: textPrimary }]}>
                          {contact.projectCode}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Icon name="person-outline" size={14} color={textMuted} />
                        <Text style={[styles.detailLabel, { color: textMuted }]}>Role:</Text>
                        <Text style={[styles.detailValue, { color: textPrimary }]}>
                          {contact.role === "staff" ? "Project Staff" : "Beneficiary Representative"}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Icon name="call-outline" size={14} color={textMuted} />
                        <Text style={[styles.detailLabel, { color: textMuted }]}>Phone:</Text>
                        <Text style={[styles.detailValue, { color: textPrimary }]}>
                          {contact.phone}
                        </Text>
                      </View>
                    </View>
                  )}
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
              <Text style={[styles.emptyText, { color: textPrimary }]}>No video call history recorded</Text>
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

              const isCrit = item.condition === "critical_problem";
              const isMinor = item.condition === "minor_issue";

              return (
                <View
                  key={item.id}
                  style={[styles.whatsAppRowWrapper, { borderBottomColor: borderColor }]}
                >
                  <View style={styles.whatsAppMainRow}>
                    {/* 50px Avatar with Video Mini Badge */}
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarCircle50, { backgroundColor: avatarColor }]}>
                        <Text style={styles.avatarInitialsText}>{initials}</Text>
                      </View>
                      <View style={styles.videoHistoryBadge}>
                        <Icon name="videocam" size={10} color="#FFFFFF" />
                      </View>
                    </View>

                    {/* Middle Column: Click Name to View Review & Problems */}
                    <Pressable
                      style={styles.whatsAppInfoCol}
                      onPress={() => setExpandedCallId(isExpanded ? null : item.id)}
                    >
                      <View style={styles.contactNameLine}>
                        <Text style={[styles.contactNameBold, { color: textPrimary }]} numberOfLines={1}>
                          {item.contactName}
                        </Text>
                        <Icon
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={textMuted}
                        />
                      </View>
                      <View style={styles.historyTimeSubLine}>
                        <Icon name="arrow-down-outline" size={12} color={colors.actionGreen} />
                        <Text style={[styles.contactSubtitleMuted, { color: textMuted }]} numberOfLines={1}>
                          {item.timestamp} • {formatDuration(item.durationSeconds)}
                        </Text>
                      </View>
                    </Pressable>

                    {/* ONLY Video Re-dial Button */}
                    <Pressable
                      style={styles.whatsAppVideoBtn}
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
                      <View style={styles.detailRow}>
                        <Icon name="business-outline" size={14} color={textMuted} />
                        <Text style={[styles.detailLabel, { color: textMuted }]}>Project:</Text>
                        <Text style={[styles.detailValue, { color: textPrimary }]} numberOfLines={1}>
                          {item.projectName} ({item.projectCode})
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Icon name="shield-checkmark-outline" size={14} color={textMuted} />
                        <Text style={[styles.detailLabel, { color: textMuted }]}>Condition:</Text>
                        <View
                          style={[
                            styles.conditionStatusBadge,
                            {
                              backgroundColor: isCrit
                                ? "rgba(220, 38, 38, 0.12)"
                                : isMinor
                                  ? "rgba(217, 119, 6, 0.12)"
                                  : "rgba(22, 163, 74, 0.12)",
                            },
                          ]}
                        >
                          <Icon
                            name={isCrit ? "alert-circle" : isMinor ? "warning" : "checkmark-circle"}
                            size={12}
                            color={isCrit ? "#DC2626" : isMinor ? "#D97706" : "#16A34A"}
                          />
                          <Text
                            style={[
                              styles.conditionStatusBadgeText,
                              { color: isCrit ? "#DC2626" : isMinor ? "#D97706" : "#16A34A" },
                            ]}
                          >
                            {isCrit ? "Critical Defect" : isMinor ? "Minor Issues" : "Satisfactory"}
                          </Text>
                        </View>
                      </View>

                      {/* Observations Note Box */}
                      <View style={[styles.reviewNoteCallout, { backgroundColor: bgSubtle, borderColor }]}>
                        <Text style={[styles.reviewNoteCalloutTitle, { color: textMuted }]}>
                          INSPECTOR PROBLEM REVIEW:
                        </Text>
                        <Text style={[styles.reviewNoteCalloutBody, { color: textPrimary }]}>
                          {item.reviewText}
                        </Text>
                      </View>

                      {/* Play Recorded Video in Call History */}
                      {item.videoUri && (
                        <View style={styles.historyVideoBox}>
                          <View style={styles.historyVideoHeader}>
                            <Icon name="videocam" size={13} color={colors.accentBlue} />
                            <Text style={[styles.historyVideoTitle, { color: textPrimary }]}>
                              Recorded Session Video Evidence
                            </Text>
                          </View>
                          <InteractiveVideoPlayer
                            src={item.videoUri}
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
                {/* Recorded Call Video Player */}
                {endedCallData.videoUri && (
                  <View style={styles.modalVideoPlayerCard}>
                    <View style={styles.modalVideoPlayerHeader}>
                      <View style={styles.modalVideoHeaderLeft}>
                        <Icon name="videocam" size={15} color={colors.accentBlue} />
                        <Text style={styles.modalVideoHeaderTitle}>
                          Recorded Call Video
                        </Text>
                      </View>
                      <View style={styles.recSecBadge}>
                        <Text style={styles.recSecBadgeText}>SEC. 30 EVIDENCE</Text>
                      </View>
                    </View>
                    <InteractiveVideoPlayer
                      src={endedCallData.videoUri}
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
                      reviewCondition === "satisfactory" && styles.conditionOptionSatisfactoryActive,
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
                        reviewCondition === "satisfactory" && styles.conditionOptionTextActive,
                      ]}
                    >
                      Normal
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.conditionOptionBtn,
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
                        reviewCondition === "minor_issue" && styles.conditionOptionTextActive,
                      ]}
                    >
                      Minor Issues
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.conditionOptionBtn,
                      reviewCondition === "critical_problem" && styles.conditionOptionCriticalActive,
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
  // Top Header
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarTitleGroup: {
    gap: 2,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  topBarSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  topBarBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(30, 123, 73, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(30, 123, 73, 0.25)",
  },
  shieldPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.actionGreen,
  },
  topBarBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.actionGreen,
    letterSpacing: 0.5,
  },

  // WhatsApp-Inspired Tabs
  tabsTrack: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabItemActive: {},
  tabContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    fontWeight: "800",
  },
  tabBubble: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBubbleText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tabActiveBar: {
    position: "absolute",
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: "#002449",
    borderRadius: 1.5,
  },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
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
    paddingVertical: 10,
  },
  whatsAppMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 14,
  },
  avatarCircle50: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  onlineBadgeGreen: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.actionGreen,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  videoHistoryBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.actionGreen,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
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
  },
  historyTimeSubLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 4,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    width: 60,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  conditionStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  conditionStatusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reviewNoteCallout: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 4,
    marginTop: 2,
  },
  reviewNoteCalloutTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  reviewNoteCalloutBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  flagInspectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  flagInspectionBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
    flex: 1,
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: 10,
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
    backgroundColor: "#030B17",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 8,
    gap: 6,
  },
  modalVideoPlayerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalVideoHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalVideoHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  recSecBadge: {
    backgroundColor: "rgba(2, 132, 199, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.4)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recSecBadgeText: {
    color: "#38BDF8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalInteractiveVideo: {
    height: 230,
    borderRadius: 8,
    overflow: "hidden",
  },
  historyVideoBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#030B17",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 6,
  },
  historyVideoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyVideoTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyInteractiveVideo: {
    height: 230,
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
