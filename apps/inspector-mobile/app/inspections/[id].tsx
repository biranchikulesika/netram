import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Location from "expo-location";
import { Audio as ExpoAudio } from "expo-av";
import { colors, typography } from "../../src/theme/colors";
import { useSettings } from "../../src/theme/settings-context";
import { requestInspectionPermissions } from "../../src/utils/permissions";
import {
  Icon,
  NetramBadge,
  NetramButton,
  InteractiveVideoPlayer,
  InAppCameraModal,
  type CapturedEvidenceResult,
} from "../../src/components/ui";
import {
  OfflineInspectionQueue,
  type CachedEvidenceRecord,
  type CachedFindingDraftRecord,
  type CachedInspectionRecord,
  type CachedObservationRecord,
  type OfflineOperationRecord,
} from "../../src/offline/queue";
import { captureEvidenceOffline } from "../../src/offline/evidence";
import { useSyncStatus } from "../../src/offline/sync-context";
import { useAuth } from "../../src/auth/auth-context";
import { formatCurrencyString } from "../../src/utils/currency";
import type {
  InspectionFlag,
  OrganisationView,
  ProgrammeView,
  Project,
  ProjectFundOverview,
  ProjectGeofence,
} from "@netram/types";

function PlayableVideo({
  src,
  style,
  autoPlay = false,
  title,
}: {
  src: string;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  title?: string;
}) {
  return (
    <InteractiveVideoPlayer
      src={src}
      style={style}
      autoPlay={autoPlay}
      title={title}
    />
  );
}

function playSyntheticTone(onEnd?: () => void) {
  try {
    if (typeof window !== "undefined") {
      const windowWithAudio = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioCtx = windowWithAudio.AudioContext || windowWithAudio.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        setTimeout(() => {
          onEnd?.();
          ctx.close().catch(() => {});
        }, 600);
        return;
      }
    }
  } catch {
    // Ignore audio context errors
  }
  setTimeout(() => onEnd?.(), 1200);
}

type SegmentTab = "FACILITY" | "NOTES" | "REMARKS";

export default function InspectionDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);
  const { refreshPendingCount } = useSyncStatus();
  const { client } = useAuth();
  const { theme, isPureDark } = useSettings();

  const [inspection, setInspection] = useState<CachedInspectionRecord | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [organisation, setOrganisation] = useState<OrganisationView | null>(null);
  const [programme, setProgramme] = useState<ProgrammeView | null>(null);
  const [geofence, setGeofence] = useState<ProjectGeofence | null>(null);
  const [fundOverview, setFundOverview] = useState<ProjectFundOverview | null>(null);
  const [inspectionFlags, setInspectionFlags] = useState<InspectionFlag[]>([]);

  const [operations, setOperations] = useState<OfflineOperationRecord[]>([]);
  const [observations, setObservations] = useState<CachedObservationRecord[]>([]);
  const [evidenceList, setEvidenceList] = useState<CachedEvidenceRecord[]>([]);
  const [findings, setFindings] = useState<CachedFindingDraftRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SegmentTab>("FACILITY");
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Evidence preview modal state
  const [previewMedia, setPreviewMedia] = useState<
    | (CachedEvidenceRecord & {
        caption?: string | null;
        voiceEvidenceId?: string | null;
        voiceUri?: string | null;
      })
    | null
  >(null);

  // Officer Remarks Textpad state
  const [remarkText, setRemarkText] = useState("");

  // Media Capture Observation Note Modal state
  const [pendingMedia, setPendingMedia] = useState<{
    uri: string;
    fileName: string;
    evidenceType: "photo" | "video";
    mimeType: string;
    fileBytes?: Uint8Array;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");

  // In-App Camera and Video Modal state (No external mobile apps)
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState<"photo" | "video">("photo");

  // Voice note capture state (attached alongside photo/video)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [pendingVoiceUri, setPendingVoiceUri] = useState<string | null>(null);
  const [pendingVoiceBytes, setPendingVoiceBytes] = useState<Uint8Array | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playingObsVoiceId, setPlayingObsVoiceId] = useState<string | null>(null);

  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceAudioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceStartTimeRef = useRef<number>(0);
  const activeAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mobileRecordingRef = useRef<ExpoAudio.Recording | null>(null);
  const mobileSoundRef = useRef<ExpoAudio.Sound | null>(null);

  // Request Android runtime permissions on screen entry
  useEffect(() => {
    void requestInspectionPermissions();
  }, []);

  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cached, ops, obs, ev, drafts] = await Promise.all([
        queue.getCachedInspection(id),
        queue.getAllOperations(id),
        queue.getCachedObservations(id),
        queue.getCachedEvidence(id),
        queue.getCachedFindingDrafts(id),
      ]);
      setInspection(cached);
      setOperations(ops);
      setObservations(obs);
      setEvidenceList(ev);
      setFindings(drafts);
      void refreshPendingCount();

      // Pre-fill remarks textpad from existing observation if any
      const existingRemark = obs.find((o) => o.text.startsWith("[remark"));
      if (existingRemark) {
        const cleaned = existingRemark.text
          .replace(/^\[remark(?::[^\]]+)?\]\s*/, "")
          .replace(/\s*\[rec:[\s\S]*$/, "");
        setRemarkText((prev) => (prev ? prev : cleaned));
      }

      // Graceful server enrichment if online
      if (client && cached?.project_id) {
        try {
          const prj = await client.getProject(cached.project_id);
          setProject(prj);

          if (prj.organisationId) {
            try {
              const orgs = await client.listOrganisations();
              const foundOrg = orgs.find((o) => o.id === prj.organisationId);
              if (foundOrg) setOrganisation(foundOrg);
            } catch {
              // Proceed gracefully
            }
          }

          if (prj.programmeIds && prj.programmeIds.length > 0) {
            try {
              const progs = await client.listProgrammes();
              const foundProg = progs.find((p) => p.id === prj.programmeIds[0]);
              if (foundProg) setProgramme(foundProg);
            } catch {
              // Proceed gracefully
            }
          }
        } catch {
          // Proceed gracefully
        }

        try {
          const geo = await client.getProjectGeofence(cached.project_id);
          setGeofence(geo);
        } catch {
          // Proceed gracefully
        }

        try {
          const funds = await client.getProjectFundOverview(cached.project_id);
          setFundOverview(funds);
        } catch {
          // Proceed gracefully
        }

        try {
          const flagsRes = await client.listInspectionFlags({
            projectId: cached.project_id,
            pageSize: 20,
          });
          setInspectionFlags(flagsRes.items);
        } catch {
          // Proceed gracefully
        }
      }
    } catch (err) {
      console.warn("Failed to load inspection detail:", err);
    } finally {
      setLoading(false);
    }
  }, [id, queue, refreshPendingCount, client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab && !hasSetInitialTab) {
      const upper = tab.toUpperCase();
      if (
        upper === "NOTES" ||
        upper === "MEDIA" ||
        upper === "FINDINGS" ||
        upper === "REMARKS" ||
        upper === "FACILITY"
      ) {
        if (upper === "MEDIA") {
          setActiveTab("NOTES");
        } else if (upper === "FINDINGS" || upper === "REMARKS") {
          setActiveTab("REMARKS");
        } else {
          setActiveTab(upper as SegmentTab);
        }
        setHasSetInitialTab(true);
      }
    } else if (inspection?.status === "in_progress" && !hasSetInitialTab) {
      setActiveTab("NOTES");
      setHasSetInitialTab(true);
    }
  }, [tab, inspection?.status, hasSetInitialTab]);

  // Status computation
  const status = inspection?.status ?? "assigned";
  const canStart = status === "assigned";
  const isFieldStage = status === "in_progress";

  // Geofence gate: facility detail is unlocked once the inspector has
  // recorded a check-in (or started the inspection) for this assignment.
  const hasCheckedIn = useMemo(
    () =>
      status === "in_progress" ||
      status === "submitted" ||
      status === "closed" ||
      operations.some(
        (o) => o.operation_type === "check_in" || o.operation_type === "start_inspection",
      ),
    [operations, status],
  );

  // Workflow Action: Start Inspection
  const handleStartInspection = async () => {
    if (!id) return;

    // Check if task is assigned with location
    const hasAssignedLocation = Boolean(
      (geofence?.centerLat != null && geofence?.centerLng != null) ||
      (geofence?.radiusMeters != null && geofence.radiusMeters > 0) ||
      hasCheckedIn
    );

    if (!hasAssignedLocation) {
      Alert.alert("Location Warning", "Location not assigned.");
      return;
    }

    const targetFacility = hasCheckedIn
      ? (inspection?.project_name || "this facility")
      : "this assigned facility";
    Alert.alert(
      "Start Inspection",
      `Begin field inspection for ${targetFacility}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: async () => {
            setActionBusy(true);
            try {
              await queue.startInspection(id);
              await loadData();
              setActiveTab("NOTES");
              Alert.alert(
                "Inspection Started",
                "Status updated to In Progress.",
              );
            } catch (err: unknown) {
              Alert.alert("Error", String(err));
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  };

  // Workflow Action: Submit Inspection (§2.6)
  const handleSubmitInspection = () => {
    if (!id) return;
    if (!canSubmitInspection) {
      if (observations.length === 0 && findings.length === 0 && evidenceList.length === 0) {
        Alert.alert(
          "Submission Blocked",
          "Statutory inspection protocol requires at least 1 field observation note, media evidence, or finding before sign-off.",
        );
        return;
      }
      Alert.alert(
        "Submission Blocked",
        "This inspection does not currently satisfy mandatory pre-submission conditions.",
      );
      return;
    }
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      if (remarkText.trim().length > 0) {
        await queue.recordObservation(id, `[remark] ${remarkText.trim()}`);
      }
      await queue.submitInspection(id);
      setShowSubmitModal(false);
      await loadData();
      Alert.alert(
        "Inspection Submitted",
        "The inspection record has been officially signed and queued in the offline outbox for server reconciliation.",
      );
    } catch (err: unknown) {
      Alert.alert("Submission Error", String(err));
    } finally {
      setActionBusy(false);
    }
  };

  // Remark Action: Auto-save on blur
  const handleAutoSaveRemark = async () => {
    if (!id || remarkText.trim().length === 0) return;
    try {
      await queue.recordObservation(id, `[remark] ${remarkText.trim()}`);
    } catch {
      // Quiet background save
    }
  };

  // Helper to acquire location at evidence capture time (§2.5)
  const getCaptureLocation = async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
      }
    } catch {
      // Store null/undefined if unavailable per Rule 2.5
    }
    return {};
  };

  // Evidence Action: In-App Camera Photo (§2.5, §30 - No external apps)
  const handleCaptureCameraPhoto = async () => {
    if (!id) return;
    try {
      const perms = await requestInspectionPermissions();
      if (!perms.camera) {
        Alert.alert("Permission Needed", "Camera access is required to capture site photos.");
        return;
      }
      setCameraModalMode("photo");
      setCameraModalVisible(true);
    } catch (err: unknown) {
      Alert.alert("Capture Error", err instanceof Error ? err.message : String(err));
    }
  };

  // Evidence Action: In-App Camera Video (§2.5, §30 - No external apps)
  const handleCaptureCameraVideo = async () => {
    if (!id) return;
    try {
      const perms = await requestInspectionPermissions();
      if (!perms.camera) {
        Alert.alert("Permission Needed", "Camera and microphone access are required to record site video.");
        return;
      }
      setCameraModalMode("video");
      setCameraModalVisible(true);
    } catch (err: unknown) {
      Alert.alert("Video Capture Error", err instanceof Error ? err.message : String(err));
    }
  };

  const handleInAppPhotoCaptured = async (result: CapturedEvidenceResult) => {
    const loc = await getCaptureLocation();
    setPendingMedia({
      uri: result.uri,
      fileName: result.fileName,
      evidenceType: "photo",
      mimeType: "image/jpeg",
      fileBytes: result.fileBytes,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    setPendingCaption("");
    deleteVoiceRecording();
  };

  const handleInAppVideoCaptured = async (result: CapturedEvidenceResult) => {
    const loc = await getCaptureLocation();
    setPendingMedia({
      uri: result.uri,
      fileName: result.fileName,
      evidenceType: "video",
      mimeType: "video/mp4",
      fileBytes: result.fileBytes,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    setPendingCaption("");
    deleteVoiceRecording();
  };

  // Voice Note Recording Handlers
  const startVoiceRecording = async () => {
    try {
      const perms = await requestInspectionPermissions();
      if (!perms.audio) {
        Alert.alert("Permission Needed", "Microphone access is required to record voice notes.");
        return;
      }

      deleteVoiceRecording();
      setIsRecordingVoice(true);
      setVoiceDuration(0);

      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            voiceMediaRecorderRef.current = mediaRecorder;
            voiceAudioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                voiceAudioChunksRef.current.push(e.data);
              }
            };

            mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(voiceAudioChunksRef.current, { type: "audio/webm" });
              const directUrl = URL.createObjectURL(audioBlob);
              setPendingVoiceUri(directUrl);

              const arrayBuffer = await audioBlob.arrayBuffer();
              const uint8 = new Uint8Array(arrayBuffer);
              setPendingVoiceBytes(uint8);

              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === "string") {
                  setPendingVoiceUri(reader.result);
                }
              };
              reader.readAsDataURL(audioBlob);

              stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start(250);
          } catch (mediaErr) {
            console.warn("Web audio recording error:", mediaErr);
          }
        }
      } else {
        // Native mobile audio recording via expo-av
        try {
          await ExpoAudio.requestPermissionsAsync();
          await ExpoAudio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          const recording = new ExpoAudio.Recording();
          await recording.prepareToRecordAsync(ExpoAudio.RecordingOptionsPresets.HIGH_QUALITY);
          await recording.startAsync();
          mobileRecordingRef.current = recording;
        } catch (mobileErr) {
          console.warn("Mobile audio recording error:", mobileErr);
        }
      }

      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      voiceStartTimeRef.current = Date.now();
      setVoiceDuration(0);

      voiceTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - voiceStartTimeRef.current) / 1000);
        setVoiceDuration(elapsed);
      }, 250);
    } catch (err: unknown) {
      setIsRecordingVoice(false);
      Alert.alert("Microphone Error", err instanceof Error ? err.message : String(err));
    }
  };

  const stopVoiceRecording = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setIsRecordingVoice(false);

    if (Platform.OS === "web") {
      if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state !== "inactive") {
        voiceMediaRecorderRef.current.stop();
      } else {
        const fallbackBytes = new TextEncoder().encode(`voice-note-${Date.now()}`);
        setPendingVoiceBytes(fallbackBytes);
        setPendingVoiceUri(`voice://local-${Date.now()}`);
      }
    } else {
      if (mobileRecordingRef.current) {
        const rec = mobileRecordingRef.current;
        mobileRecordingRef.current = null;
        void (async () => {
          try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            if (uri) {
              setPendingVoiceUri(uri);
              try {
                const resp = await fetch(uri);
                const buf = await resp.arrayBuffer();
                setPendingVoiceBytes(new Uint8Array(buf));
              } catch {
                setPendingVoiceBytes(new TextEncoder().encode(`voice-note-${Date.now()}`));
              }
            }
          } catch (err) {
            console.warn("Error stopping mobile audio recording:", err);
          }
        })();
      }
    }
  };

  const deleteVoiceRecording = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (voiceMediaRecorderRef.current && voiceMediaRecorderRef.current.state !== "inactive") {
      voiceMediaRecorderRef.current.stop();
    }
    if (activeAudioPlayerRef.current) {
      activeAudioPlayerRef.current.pause();
      activeAudioPlayerRef.current = null;
    }
    if (mobileRecordingRef.current) {
      mobileRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      mobileRecordingRef.current = null;
    }
    if (mobileSoundRef.current) {
      mobileSoundRef.current.unloadAsync().catch(() => {});
      mobileSoundRef.current = null;
    }
    setIsRecordingVoice(false);
    setIsPlayingVoice(false);
    setPendingVoiceUri(null);
    setPendingVoiceBytes(null);
    setVoiceDuration(0);
  };

  const playAudioUri = (
    uri: string | null,
    onStart: () => void,
    onEnd: () => void,
  ) => {
    onStart();

    if (Platform.OS === "web") {
      if (typeof Audio !== "undefined" && uri) {
        try {
          const audio = new Audio(uri);
          activeAudioPlayerRef.current = audio;
          audio.onended = () => {
            activeAudioPlayerRef.current = null;
            onEnd();
          };
          audio.onerror = () => {
            playSyntheticTone(() => {
              activeAudioPlayerRef.current = null;
              onEnd();
            });
          };
          audio.play().catch(() => {
            playSyntheticTone(() => {
              activeAudioPlayerRef.current = null;
              onEnd();
            });
          });
          return;
        } catch {
          // Fallback tone below
        }
      }
      playSyntheticTone(() => {
        activeAudioPlayerRef.current = null;
        onEnd();
      });
      return;
    }

    // Native mobile audio playback via expo-av
    if (uri) {
      void (async () => {
        try {
          if (mobileSoundRef.current) {
            await mobileSoundRef.current.unloadAsync().catch(() => {});
            mobileSoundRef.current = null;
          }
          await ExpoAudio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });
          const { sound } = await ExpoAudio.Sound.createAsync(
            { uri },
            { shouldPlay: true }
          );
          mobileSoundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              onEnd();
              sound.unloadAsync().catch(() => {});
              mobileSoundRef.current = null;
            }
          });
          await sound.playAsync();
        } catch (err) {
          console.warn("Mobile audio playback error:", err);
          onEnd();
        }
      })();
    } else {
      onEnd();
    }
  };

  const togglePlayPreviewVoice = () => {
    if (isPlayingVoice) {
      if (activeAudioPlayerRef.current) {
        activeAudioPlayerRef.current.pause();
        activeAudioPlayerRef.current = null;
      }
      if (mobileSoundRef.current) {
        mobileSoundRef.current.pauseAsync().catch(() => {});
        mobileSoundRef.current.unloadAsync().catch(() => {});
        mobileSoundRef.current = null;
      }
      setIsPlayingVoice(false);
    } else {
      playAudioUri(
        pendingVoiceUri,
        () => setIsPlayingVoice(true),
        () => setIsPlayingVoice(false),
      );
    }
  };

  const togglePlayCardVoice = (itemId: string, uri: string | null) => {
    if (playingObsVoiceId === itemId) {
      if (activeAudioPlayerRef.current) {
        activeAudioPlayerRef.current.pause();
        activeAudioPlayerRef.current = null;
      }
      if (mobileSoundRef.current) {
        mobileSoundRef.current.pauseAsync().catch(() => {});
        mobileSoundRef.current.unloadAsync().catch(() => {});
        mobileSoundRef.current = null;
      }
      setPlayingObsVoiceId(null);
    } else {
      if (activeAudioPlayerRef.current) {
        activeAudioPlayerRef.current.pause();
        activeAudioPlayerRef.current = null;
      }
      if (mobileSoundRef.current) {
        mobileSoundRef.current.pauseAsync().catch(() => {});
        mobileSoundRef.current.unloadAsync().catch(() => {});
        mobileSoundRef.current = null;
      }
      playAudioUri(
        uri,
        () => setPlayingObsVoiceId(itemId),
        () => setPlayingObsVoiceId(null),
      );
    }
  };

  // Media + Observation Note confirmation (opened immediately after taking photo/video)
  const handleConfirmSendMedia = async () => {
    if (!id || !pendingMedia) return;
    setActionBusy(true);
    try {
      // 1. Capture Photo or Video Evidence
      const mediaResult = await captureEvidenceOffline(queue, {
        inspectionId: id,
        evidenceType: pendingMedia.evidenceType,
        fileName: pendingMedia.fileName,
        fileBytes: pendingMedia.fileBytes,
        localFileUri: pendingMedia.uri,
        mimeType: pendingMedia.mimeType,
        latitude: pendingMedia.latitude,
        longitude: pendingMedia.longitude,
      });

      // 2. Capture Voice Note as Audio Evidence if recorded
      let voiceEvidenceId: string | null = null;
      if (pendingVoiceBytes || pendingVoiceUri) {
        const audioResult = await captureEvidenceOffline(queue, {
          inspectionId: id,
          evidenceType: "audio",
          fileName: `voice-note-${Date.now()}.m4a`,
          fileBytes: pendingVoiceBytes || new TextEncoder().encode(`voice-${Date.now()}`),
          localFileUri: pendingVoiceUri || undefined,
          mimeType: "audio/m4a",
          latitude: pendingMedia.latitude,
          longitude: pendingMedia.longitude,
        });
        voiceEvidenceId = audioResult.evidenceId;
      }

      // 3. Record Observation with linked Media and Voice Note
      const caption = pendingCaption.trim();
      let obsPayload = `[media:${mediaResult.evidenceId}]`;
      if (voiceEvidenceId) {
        obsPayload += ` [voice:${voiceEvidenceId}]`;
      }
      if (caption.length > 0) {
        obsPayload += ` ${caption}`;
      }
      await queue.recordObservation(id, obsPayload);

      deleteVoiceRecording();
      setPendingMedia(null);
      setPendingCaption("");
      await loadData();
    } catch (err: unknown) {
      Alert.alert("Save Error", err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const canSubmitInspection = useMemo(() => {
    if (status !== "in_progress") return false;
    return observations.length > 0 || findings.length > 0 || evidenceList.length > 0;
  }, [status, observations.length, findings.length, evidenceList.length]);

  // Derived Officer Remarks from observations
  const officerRemarks = useMemo(() => {
    const list: Array<{
      id: string;
      tag: string;
      text: string;
      recommendations?: string | null;
      created_at: string;
      is_local: number;
    }> = [];
    for (const obs of observations) {
      const remarkMatch = obs.text.match(/^\[remark(?::([^\]]+))?\]\s*([\s\S]*)$/);
      if (remarkMatch) {
        const fullContent = remarkMatch[2] || "";
        let mainText = fullContent;
        let recText: string | undefined;
        if (fullContent.includes("[rec:")) {
          const recParts = fullContent.split("[rec:");
          mainText = (recParts[0] ?? "").trim();
          recText = recParts[1]?.replace(/\]$/, "").trim();
        }
        list.push({
          id: obs.id,
          tag: remarkMatch[1] || "General Assessment",
          text: mainText,
          recommendations: recText || null,
          created_at: obs.created_at,
          is_local: obs.is_local,
        });
      }
    }
    return list;
  }, [observations]);

  // Derived media observations (Photo & Video evidence linked with their observation note & voice note)
  const mediaObservations = useMemo(() => {
    const captionMap: Record<string, string> = {};
    const voiceMap: Record<string, string> = {};

    for (const obs of observations) {
      const mediaMatch = obs.text.match(/\[media:([^\]]+)\]/);
      const voiceMatch = obs.text.match(/\[voice:([^\]]+)\]/);
      if (mediaMatch && mediaMatch[1]) {
        const mediaId = mediaMatch[1];
        if (voiceMatch && voiceMatch[1]) {
          voiceMap[mediaId] = voiceMatch[1];
        }
        const cleanCaption = obs.text
          .replace(/\[media:[^\]]+\]/g, "")
          .replace(/\[voice:[^\]]+\]/g, "")
          .trim();
        if (cleanCaption) {
          captionMap[mediaId] = cleanCaption;
        }
      }
    }

    const audioMap: Record<string, (typeof evidenceList)[0]> = {};
    for (const ev of evidenceList) {
      if (ev.evidence_type === "audio") {
        audioMap[ev.id] = ev;
      }
    }

    return evidenceList
      .filter((ev) => ev.evidence_type === "photo" || ev.evidence_type === "video")
      .map((ev) => {
        const voiceId = voiceMap[ev.id];
        const voiceEv = voiceId ? audioMap[voiceId] : undefined;
        return {
          ...ev,
          caption: captionMap[ev.id] || null,
          voiceEvidenceId: voiceId || null,
          voiceUri: voiceEv?.local_file_uri || null,
        };
      });
  }, [evidenceList, observations]);

  // Color theme tokens — follows user's dark/light mode preference
  const bgCanvas    = theme.bgCanvas;
  const bgSurface   = theme.bgSurface;
  const bgSubtle    = isPureDark ? "#18181B" : theme.bgSubtle;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted   = theme.textMuted;
  const accentBlue  = theme.accentBlue;
  const navyDark    = theme.navyDark;

  if (loading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: bgCanvas }]}>
        <ActivityIndicator size="large" color={accentBlue} />
      </SafeAreaView>
    );
  }

  // Helper row component for Facility specs
  const MetaRow = ({
    label,
    value,
    mono,
    bold,
    badge,
  }: {
    label: string;
    value?: string;
    mono?: boolean;
    bold?: boolean;
    badge?: React.ReactNode;
  }) => (
    <View style={[styles.metaRow, { borderBottomColor: borderColor }]}>
      <Text style={[styles.metaLabel, { color: textMuted }]}>{label}</Text>
      {badge ? (
        badge
      ) : (
        <Text
          style={[
            styles.metaValue,
            { color: textPrimary },
            bold && { fontWeight: "700" },
            mono && { fontFamily: typography.mono, color: accentBlue },
          ]}
        >
          {value ?? "—"}
        </Text>
      )}
    </View>
  );

  const tabs: {
    key: SegmentTab;
    label: string;
    icon: string;
    count?: number | string;
  }[] = [
    {
      key: "FACILITY",
      label: "Dossier",
      icon: "business-outline",
    },
    {
      key: "NOTES",
      label: "Observation",
      icon: "camera-outline",
      count: mediaObservations.length > 0 ? mediaObservations.length : undefined,
    },
    {
      key: "REMARKS",
      label: "Remarks",
      icon: "document-text-outline",
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      <View style={[styles.container, { backgroundColor: bgCanvas }]}>

        {/* ── TOP BAR (video-call style) ── */}
        <View style={[styles.inspTopBar, { backgroundColor: bgSurface, borderBottomColor: borderColor }]}>
          <View style={styles.navRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Icon name="arrow-back" size={20} color={textPrimary} />
            </Pressable>

            <View style={styles.inspTitleGroup}>
              <Text style={[styles.inspTitle, { color: textPrimary }]} numberOfLines={1}>
                {hasCheckedIn
                  ? (project?.name || inspection?.project_name || "Inspection")
                  : "Assigned Facility"}
              </Text>
              <Text style={[styles.inspSubtitle, { color: textMuted }]} numberOfLines={1}>
                {inspection?.project_code || ""}{inspection?.district_id ? ` · ${inspection.district_id}` : ""}
              </Text>
            </View>

            {status === "in_progress" ? (
              <Pressable
                style={[
                  styles.headerSubmitBtn,
                  { backgroundColor: canSubmitInspection ? theme.actionGreen : theme.textMuted },
                ]}
                onPress={handleSubmitInspection}
                disabled={actionBusy}
                hitSlop={8}
              >
                <Icon name="checkmark-circle" size={15} color="#FFFFFF" />
                <Text style={styles.headerSubmitBtnText}>Submit</Text>
              </Pressable>
            ) : canStart ? (
              <Pressable
                style={[styles.headerSubmitBtn, { backgroundColor: accentBlue }]}
                onPress={handleStartInspection}
                disabled={actionBusy}
                hitSlop={8}
              >
                <Icon name="play" size={13} color="#FFFFFF" />
                <Text style={styles.headerSubmitBtnText}>Start</Text>
              </Pressable>
            ) : status === "submitted" || status === "closed" ? (
              <View
                style={[
                  styles.headerSubmittedPill,
                  { backgroundColor: "rgba(22,163,74,0.12)", borderColor: "rgba(22,163,74,0.3)" },
                ]}
              >
                <Icon name="checkmark-done" size={13} color={theme.actionGreen} />
                <Text style={[styles.headerSubmittedText, { color: theme.actionGreen }]}>
                  Submitted
                </Text>
              </View>
            ) : (
              <View style={[styles.headerSubmittedPill, { backgroundColor: bgSubtle, borderColor }]}>
                <Text style={[styles.headerSubmittedText, { color: textMuted }]}>
                  {status.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── TAB BAR ── */}
        <View style={[styles.inspTabsTrack, { backgroundColor: bgSubtle, borderBottomColor: borderColor, paddingHorizontal: 12, paddingVertical: 6 }]}>
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <Pressable
                key={t.key}
                style={[
                  styles.inspTabItem,
                  {
                    backgroundColor: isActive ? navyDark : "transparent",
                    borderRadius: 6,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                  },
                ]}
                onPress={() => setActiveTab(t.key)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={[
                    styles.inspTabText,
                    { color: isActive ? "#FFFFFF" : textMuted },
                    isActive && { fontWeight: "800" },
                  ]}>
                    {t.label}
                  </Text>
                  {t.count !== undefined && (
                    <View style={[styles.inspTabBubble, {
                      backgroundColor: isActive ? "rgba(255,255,255,0.2)" : (isPureDark ? "#27272A" : theme.borderSubtle),
                    }]}>
                      <Text style={[styles.inspTabBubbleText, {
                        color: isActive ? "#FFFFFF" : textMuted,
                      }]}>
                        {t.count}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── TAB CONTENT ── */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ──────────────── TAB 1: FACILITY DOSSIER ──────────────── */}
          {activeTab === "FACILITY" && (
            <View style={styles.tabContentContainer}>
              {!hasCheckedIn ? (
                <View style={[styles.locationLockCard, { backgroundColor: bgSurface, borderColor }]}>
                  <View style={[styles.lockIconCircle, { backgroundColor: bgSubtle }]}>
                    <Icon name="lock-closed" size={32} color={accentBlue} />
                  </View>
                  <Text style={[styles.lockTitle, { color: textPrimary }]}>Location Locked</Text>
                  <Text style={[styles.lockSubtitle, { color: textMuted }]}>
                    Facility details unlock automatically when you reach the assigned 1 km area.
                  </Text>
                  <Pressable
                    style={[styles.lockMapBtn, { backgroundColor: accentBlue }]}
                    onPress={() =>
                      router.push({
                        pathname: "/check-in",
                        params: { inspectionId: id },
                      })
                    }
                  >
                    <Icon name="navigate-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.lockMapBtnText}>Open Map & Check In</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {/* FACILITY IDENTITY */}
                  <View style={styles.cleanSection}>
                    <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>
                      FACILITY IDENTITY
                    </Text>
                    <MetaRow label="Project Code" value={project?.code || inspection?.project_code || "PRJ"} mono />
                    <MetaRow label="Facility Name" value={project?.name || inspection?.project_name || "Facility"} bold />
                    <MetaRow label="Type" value={(project?.type || inspection?.type || "Standard").replace(/_/g, " ").toUpperCase()} />
                    <MetaRow label="DARPAN ID" value={organisation?.code || "Available on sync"} mono />
                    <MetaRow
                      label="Status"
                      badge={
                        <NetramBadge
                          label={(project?.status || inspection?.status || "active").replace(/_/g, " ").toUpperCase()}
                          variant="status"
                          status={project?.status || inspection?.status}
                          size="sm"
                        />
                      }
                    />
                  </View>

                  {/* OPERATING AGENCY */}
                  <View style={styles.cleanSection}>
                    <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>
                      OPERATING AGENCY
                    </Text>
                    <MetaRow label="Agency Name" value={organisation?.name || "Operating Agency"} />
                    <MetaRow label="Category" value={organisation?.category || "Registered Society / Trust"} />
                  </View>

                  {/* SCHEME & PROGRAMME */}
                  <View style={styles.cleanSection}>
                    <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>
                      SCHEME & PROGRAMME
                    </Text>
                    <MetaRow label="Programme" value={programme?.name || "National Welfare Programme"} />
                    <MetaRow label="Scope" value={(programme?.scopeLevel || "NATIONAL").toUpperCase()} />
                  </View>

                  {/* LOCATION & RADIUS */}
                  <View style={styles.cleanSection}>
                    <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>
                      LOCATION & RADIUS
                    </Text>
                    <MetaRow label="District" value={inspection?.district_id || "District Authority"} mono />
                    <MetaRow label="Area Radius" value={geofence?.radiusMeters ? `${geofence.radiusMeters} meters` : "1,000 meters"} />
                    <Pressable
                      style={[styles.cleanMapLink, { borderBottomColor: borderColor }]}
                      onPress={() =>
                        router.push({
                          pathname: "/check-in",
                          params: { inspectionId: id },
                        })
                      }
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Icon name="location-outline" size={15} color={accentBlue} />
                        <Text style={[styles.cleanMapLinkText, { color: accentBlue }]}>
                          View Site on Map
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={14} color={accentBlue} />
                    </Pressable>
                  </View>

                  {/* FUNDS & SANCTIONS */}
                  {fundOverview && (
                    <View style={styles.cleanSection}>
                      <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>
                        FUNDS & SANCTIONS
                      </Text>
                      <MetaRow label="Total Sanctioned" value={formatCurrencyString(fundOverview.summary.totalAllocated)} bold />
                      <MetaRow label="Total Released" value={formatCurrencyString(fundOverview.summary.totalReleased)} />
                      <MetaRow label="Total Expended" value={formatCurrencyString(fundOverview.summary.totalExpenditure)} />
                      <MetaRow label="Utilisation" value={`${fundOverview.summary.utilizationRate.toFixed(1)}%`} mono />
                    </View>
                  )}

                  {/* ADVISORY FLAGS */}
                  {inspectionFlags.length > 0 && (
                    <View style={styles.cleanSection}>
                      <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>
                        {`ADVISORY FLAGS (${inspectionFlags.length})`}
                      </Text>
                      <View style={{ gap: 8, marginTop: 4 }}>
                        {inspectionFlags.map((flag) => (
                          <View
                            key={flag.id}
                            style={[
                              styles.cleanFlagRow,
                              {
                                backgroundColor: bgSubtle,
                                borderLeftColor:
                                  flag.riskLevel === "high" || flag.riskLevel === "critical"
                                    ? "#EF4444"
                                    : accentBlue,
                              },
                            ]}
                          >
                            <View style={styles.flagTopRow}>
                              <NetramBadge
                                label={flag.riskLevel.toUpperCase()}
                                variant="severity"
                                severity={flag.riskLevel}
                                size="sm"
                              />
                            </View>
                            <Text style={[styles.flagText, { color: textPrimary }]}>{flag.explanation}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* ──────────────── TAB 2: OBSERVATIONS (PHOTOS & VIDEOS ONLY) ──────────────── */}
          {activeTab === "NOTES" && (
            <View style={styles.obsPageContainer}>
              {/* Media Capture Action Row */}
              {isFieldStage && (
                <View style={styles.obsActionRow}>
                  <Pressable
                    style={[styles.obsCaptureBtn, { backgroundColor: accentBlue }]}
                    onPress={handleCaptureCameraPhoto}
                  >
                    <Icon name="camera" size={18} color="#FFFFFF" />
                    <Text style={styles.obsCaptureBtnText}>Take Photo</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.obsCaptureBtn, { backgroundColor: navyDark }]}
                    onPress={handleCaptureCameraVideo}
                  >
                    <Icon name="videocam" size={18} color="#FFFFFF" />
                    <Text style={styles.obsCaptureBtnText}>Record Video</Text>
                  </Pressable>
                </View>
              )}

              {/* Media Observation Cards */}
              <View style={styles.obsCardsList}>
                {mediaObservations.length > 0 ? (
                  mediaObservations.map((item) => {
                    const isVideo =
                      item.evidence_type === "video" ||
                      (item.file_name?.toLowerCase().endsWith(".mp4") ?? false) ||
                      (item.file_name?.toLowerCase().endsWith(".mov") ?? false);

                    return (
                      <View
                        key={item.id}
                        style={[styles.obsCard, { backgroundColor: bgSurface, borderColor }]}
                      >
                        {/* 1. Media Section (Playable Video or Full Photo) */}
                        {isVideo && item.local_file_uri ? (
                          <View style={styles.obsVideoPlayerWrap}>
                            <PlayableVideo
                              src={item.local_file_uri}
                              style={styles.obsVideoPlayer}
                            />
                            <View
                              style={[
                                styles.obsTypeBadge,
                                { backgroundColor: navyDark },
                              ]}
                            >
                              <Text style={styles.obsTypeBadgeText}>VIDEO</Text>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            style={[styles.obsMediaBox, { backgroundColor: bgSubtle }]}
                            onPress={() => setPreviewMedia(item)}
                          >
                            {!isVideo && item.local_file_uri ? (
                              <Image
                                source={{ uri: item.local_file_uri }}
                                style={styles.obsImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.obsVideoPlaceholder}>
                                <Icon
                                  name={isVideo ? "videocam" : "camera"}
                                  size={44}
                                  color={isVideo ? navyDark : accentBlue}
                                />
                              </View>
                            )}

                            <View
                              style={[
                                styles.obsTypeBadge,
                                { backgroundColor: isVideo ? navyDark : accentBlue },
                              ]}
                            >
                              <Text style={styles.obsTypeBadgeText}>
                                {isVideo ? "VIDEO" : "PHOTO"}
                              </Text>
                            </View>
                          </Pressable>
                        )}

                        {/* 2. Text Note Section (Prominent, High-Contrast Clear Text) */}
                        {item.caption ? (
                          <View style={[styles.obsTextNoteBox, { backgroundColor: bgSubtle, borderColor }]}>
                            <View style={styles.obsSectionHeader}>
                              <Icon name="document-text" size={14} color={accentBlue} />
                              <Text style={[styles.obsSectionTitle, { color: accentBlue }]}>
                                FIELD OBSERVATION NOTE
                              </Text>
                            </View>
                            <Text style={[styles.obsTextNoteContent, { color: textPrimary }]}>
                              {item.caption}
                            </Text>
                          </View>
                        ) : null}

                        {/* 3. Voice Note Player Bar */}
                        {(item.voiceEvidenceId || item.voiceUri) && (
                          <View style={[styles.obsVoicePlayerBar, { backgroundColor: bgSubtle, borderColor }]}>
                            <Pressable
                              style={[
                                styles.obsVoicePlayBtn,
                                { backgroundColor: playingObsVoiceId === item.id ? theme.error : navyDark },
                              ]}
                              onPress={() => togglePlayCardVoice(item.id, item.voiceUri)}
                            >
                              <Icon
                                name={playingObsVoiceId === item.id ? "pause" : "play"}
                                size={14}
                                color="#FFFFFF"
                              />
                            </Pressable>

                            <View style={styles.obsVoiceInfoCol}>
                              <View style={styles.obsVoiceInfoRow}>
                                <Text style={[styles.obsVoiceTitle, { color: textPrimary }]}>
                                  Voice Note
                                </Text>
                                {playingObsVoiceId === item.id && (
                                  <View style={styles.obsPlayingPill}>
                                    <View style={styles.obsPlayingDot} />
                                    <Text style={styles.obsPlayingPillText}>Playing</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.obsVoiceSubtext, { color: textMuted }]}>
                                {playingObsVoiceId === item.id
                                  ? "Audio playback in progress..."
                                  : "Tap to listen to recorded audio note"}
                              </Text>
                            </View>

                            <Pressable
                              style={[
                                styles.obsVoiceListenBtn,
                                { borderColor: playingObsVoiceId === item.id ? theme.error : navyDark },
                              ]}
                              onPress={() => togglePlayCardVoice(item.id, item.voiceUri)}
                            >
                              <Icon
                                name={playingObsVoiceId === item.id ? "pause" : "play"}
                                size={11}
                                color={playingObsVoiceId === item.id ? theme.error : navyDark}
                              />
                              <Text
                                style={[
                                  styles.obsVoiceListenBtnText,
                                  { color: playingObsVoiceId === item.id ? theme.error : navyDark },
                                ]}
                              >
                                {playingObsVoiceId === item.id ? "Pause" : "Play"}
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        {/* 4. Simple Clean Footer (NO sha256, NO shield-checkmark/verified) */}
                        <View style={[styles.obsCardFooter, { borderTopColor: borderColor }]}>
                          <View style={styles.obsTimeRow}>
                            <Icon name="time-outline" size={13} color={textMuted} />
                            <Text style={[styles.obsTimeText, { color: textMuted }]}>
                              {new Date(item.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </View>

                          <View style={styles.obsSyncBadge}>
                            <Icon
                              name={item.upload_state === "uploaded" ? "checkmark-done" : "checkmark"}
                              size={14}
                              color={item.upload_state === "uploaded" ? theme.actionGreen : textMuted}
                            />
                            <Text style={[styles.obsSyncText, { color: textMuted }]}>
                              {item.upload_state === "uploaded" ? "Synced" : "Local"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={[styles.obsEmptyCard, { backgroundColor: bgSurface, borderColor }]}>
                    <Icon name="camera-outline" size={44} color={accentBlue} />
                    <Text style={[styles.obsEmptyTitle, { color: textPrimary }]}>
                      No observations recorded
                    </Text>
                    <Text style={[styles.obsEmptySubtitle, { color: textMuted }]}>
                      Tap Take Photo or Record Video above to capture on-site evidence and add notes.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ──────────────── TAB 3: OFFICER REMARKS TEXTPAD ──────────────── */}
          {activeTab === "REMARKS" && (
            <View style={styles.textpadContainer}>
              <View style={[styles.textpadCard, { backgroundColor: bgSurface, borderColor }]}>
                <TextInput
                  style={[
                    styles.textpadInput,
                    {
                      color: textPrimary,
                    },
                  ]}
                  value={remarkText}
                  onChangeText={setRemarkText}
                  onBlur={handleAutoSaveRemark}
                  placeholder="Type inspection remarks here..."
                  placeholderTextColor={textMuted}
                  multiline
                  editable={isFieldStage}
                  textAlignVertical="top"
                />
              </View>

              {(status === "submitted" || status === "closed") && (
                <View style={{ marginTop: 12, alignItems: "center" }}>
                  <NetramBadge
                    label="SEALED REMARKS"
                    variant="status"
                    status="completed"
                    size="md"
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* ── MODAL: Observation Note Box (Opened after taking photo/video) ── */}
        <Modal
          visible={pendingMedia !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            deleteVoiceRecording();
            setPendingMedia(null);
            setPendingCaption("");
          }}
        >
          <View style={styles.captionModalOverlay}>
            <View style={[styles.captionModalBox, { backgroundColor: bgSurface, borderColor }]}>
              <View style={styles.captionModalHeader}>
                <Text style={[styles.captionModalTitle, { color: navyDark }]}>
                  {pendingMedia?.evidenceType === "video" ? "Observation for Video" : "Observation for Photo"}
                </Text>
                <Pressable
                  onPress={() => {
                    deleteVoiceRecording();
                    setPendingMedia(null);
                    setPendingCaption("");
                  }}
                  hitSlop={12}
                >
                  <Icon name="close" size={22} color={textMuted} />
                </Pressable>
              </View>

              {/* Media Preview Box */}
              <View style={[styles.captionMediaPreview, { backgroundColor: bgSubtle, borderColor }]}>
                {pendingMedia?.evidenceType === "photo" && pendingMedia.uri ? (
                  <Image
                    source={{ uri: pendingMedia.uri }}
                    style={{ width: "100%", height: 180, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                ) : pendingMedia?.evidenceType === "video" && pendingMedia.uri ? (
                  <PlayableVideo
                    src={pendingMedia.uri}
                    style={{ width: "100%", height: 180, borderRadius: 10 }}
                  />
                ) : (
                  <View style={{ width: "100%", height: 140, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="videocam" size={40} color={navyDark} />
                    <Text style={{ marginTop: 6, fontSize: 12, color: textMuted }}>
                      {pendingMedia?.fileName || "video.mp4"}
                    </Text>
                  </View>
                )}
              </View>

              {/* 1. Text Observation Note */}
              <View>
                <View style={styles.modalSectionRow}>
                  <Icon name="create-outline" size={13} color={accentBlue} />
                  <Text style={[styles.modalSectionLabel, { color: accentBlue }]}>TEXT NOTE</Text>
                </View>
                <View style={[styles.captionInputWrap, { backgroundColor: bgSubtle, borderColor }]}>
                  <TextInput
                    style={[styles.captionInput, { color: textPrimary }]}
                    value={pendingCaption}
                    onChangeText={setPendingCaption}
                    placeholder="Enter observation note details..."
                    placeholderTextColor={textMuted}
                    multiline
                  />
                </View>
              </View>

              {/* 2. Voice Note Recording Section */}
              <View>
                <View style={styles.modalSectionRow}>
                  <Icon name="mic" size={13} color={accentBlue} />
                  <Text style={[styles.modalSectionLabel, { color: accentBlue }]}>VOICE NOTE</Text>
                </View>

                {!isRecordingVoice && !pendingVoiceBytes && !pendingVoiceUri && (
                  <Pressable
                    style={[styles.voiceRecordBtn, { backgroundColor: bgSubtle, borderColor }]}
                    onPress={startVoiceRecording}
                  >
                    <Icon name="mic-outline" size={16} color={accentBlue} />
                    <Text style={[styles.voiceRecordBtnText, { color: textPrimary }]}>
                      Record Voice Note
                    </Text>
                  </Pressable>
                )}

                {isRecordingVoice && (
                  <View style={[styles.voiceActiveBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                    <View style={styles.voiceActiveLeft}>
                      <View style={styles.voiceRedDot} />
                      <Text style={styles.voiceTimerText}>
                        Recording {Math.floor(voiceDuration / 60)}:{(voiceDuration % 60).toString().padStart(2, "0")}
                      </Text>
                    </View>
                    <Pressable style={styles.voiceStopBtn} onPress={stopVoiceRecording}>
                      <Icon name="square" size={12} color="#FFFFFF" />
                      <Text style={styles.voiceStopBtnText}>Stop</Text>
                    </Pressable>
                  </View>
                )}

                {!isRecordingVoice && (pendingVoiceBytes || pendingVoiceUri) && (
                  <View style={[styles.voicePlaybackBox, { backgroundColor: bgSubtle, borderColor }]}>
                    <View style={styles.voicePlaybackLeft}>
                      <Pressable
                        style={[styles.voicePlayIconBtn, { backgroundColor: accentBlue }]}
                        onPress={togglePlayPreviewVoice}
                      >
                        <Icon name={isPlayingVoice ? "pause" : "play"} size={13} color="#FFFFFF" />
                      </Pressable>
                      <Text style={[styles.voiceDurationText, { color: textPrimary }]}>
                        Voice Note ({Math.floor(voiceDuration / 60)}:{(voiceDuration % 60).toString().padStart(2, "0")})
                      </Text>
                    </View>
                    <Pressable style={styles.voiceDeleteBtn} onPress={deleteVoiceRecording}>
                      <Icon name="trash-outline" size={16} color="#DC2626" />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Action Buttons Row */}
              <View style={styles.captionBtnRow}>
                <Pressable
                  style={[styles.captionCancelBtn, { borderColor }]}
                  onPress={() => {
                    deleteVoiceRecording();
                    setPendingMedia(null);
                    setPendingCaption("");
                  }}
                >
                  <Text style={[styles.captionCancelText, { color: textMuted }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.captionSendBtn, { backgroundColor: theme.actionGreen }]}
                  onPress={handleConfirmSendMedia}
                  disabled={actionBusy}
                >
                  <Icon name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.captionSendText}>
                    {actionBusy ? "Saving..." : "Save Observation"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL: Media Full Preview ── */}
        <Modal
          visible={previewMedia !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewMedia(null)}
        >
          <View style={styles.previewModalOverlay}>
            <View style={[styles.previewModalBox, { backgroundColor: bgSurface, borderColor }]}>
              <View style={styles.previewModalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Icon
                    name={previewMedia?.evidence_type === "video" ? "videocam" : "image"}
                    size={20}
                    color={previewMedia?.evidence_type === "video" ? navyDark : accentBlue}
                  />
                  <Text style={[styles.previewModalTitle, { color: navyDark }]} numberOfLines={1}>
                    {previewMedia?.file_name || "Captured Evidence"}
                  </Text>
                </View>
                <Pressable onPress={() => setPreviewMedia(null)} hitSlop={12}>
                  <Icon name="close" size={22} color={textMuted} />
                </Pressable>
              </View>

              <View style={[styles.previewMediaContent, { backgroundColor: bgSubtle }]}>
                {previewMedia?.evidence_type === "photo" && previewMedia.local_file_uri ? (
                  <Image
                    source={{ uri: previewMedia.local_file_uri }}
                    style={{ width: "100%", height: 280, borderRadius: 8 }}
                    resizeMode="contain"
                  />
                ) : previewMedia?.evidence_type === "video" && previewMedia.local_file_uri ? (
                  <PlayableVideo
                    src={previewMedia.local_file_uri}
                    autoPlay
                    style={{ width: "100%", height: 280, borderRadius: 8 }}
                  />
                ) : (
                  <View style={{ height: 180, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="videocam" size={56} color={navyDark} />
                    <Text style={{ marginTop: 8, fontSize: 13, color: textMuted }}>
                      {previewMedia?.file_name || "Video Recording"}
                    </Text>
                  </View>
                )}
              </View>

              {previewMedia?.caption ? (
                <View style={[styles.previewCaptionBox, { backgroundColor: bgSubtle, borderColor }]}>
                  <Text style={[styles.previewCaptionLabel, { color: accentBlue }]}>FIELD OBSERVATION NOTE</Text>
                  <Text style={[styles.previewCaptionText, { color: textPrimary }]}>
                    {previewMedia.caption}
                  </Text>
                </View>
              ) : null}

              {(previewMedia?.voiceEvidenceId || previewMedia?.voiceUri) && (
                <View style={[styles.obsVoicePlayerBar, { backgroundColor: bgSubtle, borderColor, marginHorizontal: 0, marginTop: 10 }]}>
                  <Pressable
                    style={[
                      styles.obsVoicePlayBtn,
                      { backgroundColor: playingObsVoiceId === previewMedia.id ? theme.error : navyDark },
                    ]}
                    onPress={() => togglePlayCardVoice(previewMedia.id, previewMedia.voiceUri || null)}
                  >
                    <Icon
                      name={playingObsVoiceId === previewMedia.id ? "pause" : "play"}
                      size={14}
                      color="#FFFFFF"
                    />
                  </Pressable>

                  <View style={styles.obsVoiceInfoCol}>
                    <Text style={[styles.obsVoiceTitle, { color: textPrimary }]}>
                      Voice Note
                    </Text>
                    <Text style={[styles.obsVoiceSubtext, { color: textMuted }]}>
                      {playingObsVoiceId === previewMedia.id
                        ? "Audio playback in progress..."
                        : "Tap to listen to recorded audio note"}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.obsVoiceListenBtn,
                      { borderColor: playingObsVoiceId === previewMedia.id ? theme.error : navyDark },
                    ]}
                    onPress={() => togglePlayCardVoice(previewMedia.id, previewMedia.voiceUri || null)}
                  >
                    <Icon
                      name={playingObsVoiceId === previewMedia.id ? "pause" : "play"}
                      size={11}
                      color={playingObsVoiceId === previewMedia.id ? theme.error : navyDark}
                    />
                    <Text
                      style={[
                        styles.obsVoiceListenBtnText,
                        { color: playingObsVoiceId === previewMedia.id ? theme.error : navyDark },
                      ]}
                    >
                      {playingObsVoiceId === previewMedia.id ? "Pause" : "Play"}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={[styles.previewFooter, { borderTopColor: borderColor }]}>
                <View style={styles.obsTimeRow}>
                  <Icon name="time-outline" size={13} color={textMuted} />
                  <Text style={[styles.obsTimeText, { color: textMuted }]}>
                    {previewMedia?.created_at
                      ? new Date(previewMedia.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Captured"}
                  </Text>
                </View>
                <Pressable
                  style={[styles.previewCloseBtn, { borderColor }]}
                  onPress={() => setPreviewMedia(null)}
                >
                  <Text style={[styles.previewCloseText, { color: textPrimary }]}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL: Official Submission Confirmation ── */}
        <Modal
          visible={showSubmitModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSubmitModal(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: isPureDark ? "rgba(0,0,0,0.85)" : "rgba(0, 36, 73, 0.65)" }]}>
            <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                OFFICIAL FIELD SIGN-OFF
              </Text>
              <Text style={[styles.modalSubtitle, { color: textMuted }]}>
                Government of Odisha — Field Inspection Oversight Protocol
              </Text>

              {/* Project / Facility Summary */}
              <View style={[styles.declarationBox, { backgroundColor: bgSubtle, borderColor }]}>
                <Text style={[styles.declarationTitle, { color: accentBlue }]}>
                  FACILITY VERIFICATION
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: textPrimary }}>
                  {inspection?.project_name || project?.name || "Facility Site"}
                </Text>
                <Text style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                  {inspection?.project_code || "PRJ"} · {inspection?.district_id || "Khordha"} District
                </Text>
              </View>

              {/* Metric Summary Grid */}
              <View style={styles.submitSummaryGrid}>
                <View style={[styles.submitSummaryCell, { backgroundColor: bgSubtle, borderColor }]}>
                  <Text style={[styles.submitSummaryLabel, { color: textMuted }]}>Field Notes</Text>
                  <Text style={[styles.submitSummaryValue, { color: textPrimary }]}>
                    {observations.length - officerRemarks.length}
                  </Text>
                </View>
                <View style={[styles.submitSummaryCell, { backgroundColor: bgSubtle, borderColor }]}>
                  <Text style={[styles.submitSummaryLabel, { color: textMuted }]}>Media Evidence</Text>
                  <Text style={[styles.submitSummaryValue, { color: textPrimary }]}>
                    {evidenceList.length}
                  </Text>
                </View>
                <View style={[styles.submitSummaryCell, { backgroundColor: bgSubtle, borderColor }]}>
                  <Text style={[styles.submitSummaryLabel, { color: textMuted }]}>Remarks</Text>
                  <Text style={[styles.submitSummaryValue, { color: textPrimary }]}>
                    {officerRemarks.length}
                  </Text>
                </View>
              </View>

              {/* Formal Statutory Declaration */}
              <View style={[styles.declarationBox, { backgroundColor: isPureDark ? "#112211" : "#F0FDF4", borderColor: theme.actionGreen }]}>
                <Text style={[styles.declarationTitle, { color: theme.actionGreen }]}>
                  STATUTORY DECLARATION
                </Text>
                <Text style={[styles.declarationText, { color: textPrimary }]}>
                  "I hereby solemnly declare that this inspection was conducted in person within the designated geofence boundary, and the field notes, media evidence, and official remarks recorded herein represent an accurate on-site verification."
                </Text>
              </View>

              <View style={styles.modalBtnRow}>
                <NetramButton
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setShowSubmitModal(false)}
                  style={styles.modalActionBtn}
                />
                <NetramButton
                  label="Sign & Submit"
                  variant="primary"
                  loading={actionBusy}
                  disabled={actionBusy}
                  onPress={handleConfirmSubmit}
                  style={[styles.modalActionBtn, { backgroundColor: theme.actionGreen }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL: In-App Camera & Video Recorder (No External Apps) ── */}
        <InAppCameraModal
          visible={cameraModalVisible}
          initialMode={cameraModalMode}
          onClose={() => setCameraModalVisible(false)}
          onCapturePhoto={handleInAppPhotoCaptured}
          onCaptureVideo={handleInAppVideoCaptured}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Video-call-style top bar
  inspTopBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inspTitleGroup: {
    flex: 1,
    marginHorizontal: 10,
    gap: 1,
  },
  inspTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  inspSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  headerSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  headerSubmittedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerSubmittedText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  textpadContainer: {
    padding: 16,
    flex: 1,
  },
  textpadCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 380,
  },
  textpadInput: {
    flex: 1,
    minHeight: 360,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
  },

  // Underline tab bar (video-call style)
  inspTabsTrack: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  inspTabItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  inspTabItemActive: {},
  inspTabText: {
    fontSize: 11,
    fontWeight: "600",
  },
  inspTabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 6,
    right: 6,
    height: 2.5,
    borderRadius: 1.5,
  },
  inspTabBubble: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  inspTabBubbleText: {
    fontSize: 10,
    fontWeight: "700",
  },
  bottomTabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bottomTabBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bottomTabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  facilityInfo: {
    marginBottom: 6,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,

    marginBottom: 3,
  },
  schemeName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  districtLabel: {
    fontSize: 12,
  },
  mainActionButton: {
    marginTop: 6,
  },
  stepperContainer: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  stepperNodesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepperNodePressable: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  stepperCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperCircleNum: {
    fontSize: 11,
    fontWeight: "700",
  },
  stepperNodeLabel: {
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
  },
  stepperContextCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepperContextLeft: {
    flex: 1,
    gap: 2,
    marginRight: 8,
  },
  stepBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepNumPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  stepNumPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    fontFamily: typography.mono,
  },
  stepTitleHeading: {
    fontSize: 13,
    fontWeight: "700",
  },
  stepDescText: {
    fontSize: 11,
    lineHeight: 15,
  },
  stepProgressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepProgressText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.mono,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 6,
  },
  wizardFooter: {
    marginTop: 14,
    marginBottom: 6,
  },
  wizardNextButton: {
    width: "100%",
  },
  wizardFooterRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 6,
  },
  wizardPrevButton: {
    flex: 1,
  },
  wizardNextButtonHalf: {
    flex: 1.3,
  },
  manifestItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  manifestLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manifestTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  manifestValue: {
    fontSize: 12,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContentContainer: {
    gap: 12,
  },
  locationLockCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 44,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  lockIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  lockSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  lockMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 6,
  },
  lockMapBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cleanSection: {
    marginBottom: 22,
  },
  cleanSectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
    paddingBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    flex: 1,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  cleanMapLink: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cleanMapLinkText: {
    fontSize: 13,
    fontWeight: "600",
  },
  cleanFlagRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderRadius: 4,
    gap: 4,
  },
  flagCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  flagTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flagText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionAddButton: {
    marginBottom: 2,
  },
  itemCard: {
    padding: 14,
    borderRadius: 12,
  },
  obsItemText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  timestampMono: {
    fontSize: 11,
    fontFamily: typography.mono,
  },
  evidenceGrid: {
    gap: 10,
  },
  mediaActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  mediaActionBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  mediaActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  videoBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  videoPlayOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: 2,
  },
  evidenceCard: {
    padding: 12,
    borderRadius: 12,
  },
  evidenceRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  evidenceThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  evidenceDetails: {
    flex: 1,
    gap: 3,
  },
  evidenceTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evidenceFileName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    marginRight: 6,
  },
  stampPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginVertical: 2,
  },
  stampText: {
    fontSize: 10,
    fontFamily: typography.mono,
  },
  evidenceTime: {
    fontSize: 11,
  },
  findingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  findingDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  remediationBox: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  remediationLabel: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: "700",
    marginBottom: 2,
  },
  remediationText: {
    fontSize: 12,
    lineHeight: 16,
  },
  editPrompt: {
    fontSize: 12,
    fontWeight: "600",
  },

  subHeading: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  attendanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  attendanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  attendanceCountText: {
    fontSize: 12,
    fontWeight: "700",
  },
  attendanceNoteText: {
    fontSize: 12,
  },
  attendanceTimeText: {
    fontSize: 10,
    fontFamily: typography.mono,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalScrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  severityChip: {
    padding: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  obsLinkChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  obsLinkText: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalActionBtn: {
    flex: 1,
  },

  // ── In-progress banner styles ──────────────────────────────
  inProgressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  inProgressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  inProgressDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  inProgressText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Tab bar styles ─────────────────────────────────────────
  tabBarContainer: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tabCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabCountBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },


  submitSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 12,
  },
  submitSummaryCell: {
    flex: 1,
    minWidth: 90,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  submitSummaryLabel: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  submitSummaryValue: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  declarationBox: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: 10,
  },
  declarationTitle: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: typography.mono,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  declarationText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
  },

  // ── Preview Modal Styles ──────────────────────────────────
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 16,
  },
  previewModalBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    maxHeight: "90%",
  },
  previewModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewModalTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  previewMediaContent: {
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewCaptionBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  previewCaptionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  previewCaptionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  previewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  previewCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewCloseText: {
    fontSize: 12,
    fontWeight: "700",
  },
  obsPageContainer: {
    padding: 16,
    gap: 14,
  },
  obsActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  obsCaptureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  obsCaptureBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  obsCardsList: {
    gap: 14,
  },
  obsCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  obsMediaBox: {
    width: "100%",
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  obsImage: {
    width: "100%",
    height: "100%",
  },
  obsVideoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  obsPlayOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  obsTypeBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  obsTypeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  obsVideoPlayerWrap: {
    width: "100%",
    backgroundColor: "#000000",
    position: "relative",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  obsVideoPlayer: {
    width: "100%",
    height: 220,
    backgroundColor: "#000000",
  },
  obsTextNoteBox: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  obsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  obsSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  obsTextNoteContent: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  obsCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  obsTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  obsTimeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  obsSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  obsSyncText: {
    fontSize: 11,
    fontWeight: "500",
  },
  obsEmptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  obsEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  obsEmptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
  },
  captionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 16,
  },
  captionModalBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  captionModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  captionModalTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  captionMediaPreview: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  captionInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  captionInput: {
    flex: 1,
    fontSize: 13,
    minHeight: 38,
    maxHeight: 80,
  },
  captionBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  captionCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  captionCancelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  captionSendBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  captionSendText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  voiceRecordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  voiceRecordBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  voiceActiveBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  voiceActiveLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
  },
  voiceTimerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  voiceStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  voiceStopBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  voicePlaybackBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  voicePlaybackLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  voicePlayIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceDurationText: {
    fontSize: 12,
    fontWeight: "600",
  },
  voiceDeleteBtn: {
    padding: 4,
  },
  obsVoicePlayerBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  obsVoicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  obsVoiceInfoCol: {
    flex: 1,
    gap: 2,
  },
  obsVoiceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  obsVoiceTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  obsPlayingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  obsPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#DC2626",
  },
  obsPlayingPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#DC2626",
  },
  obsVoiceSubtext: {
    fontSize: 11,
    fontWeight: "400",
  },
  obsVoiceListenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  obsVoiceListenBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
