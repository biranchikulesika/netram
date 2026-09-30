import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { InteractiveVideoPlayer } from "./InteractiveVideoPlayer";
import { colors } from "../../theme/colors";

// Native caps recording through `recordAsync`; web has no such limit, so the
// same number is enforced from the clock tick there. Keep them in step.
const RECORD_MAX_SECONDS = 60;

export interface CapturedMediaItem {
  id: string;
  uri: string;
  fileName: string;
  evidenceType: "photo" | "video";
  mimeType: string;
  fileBytes?: Uint8Array;
  note: string;
}

export interface InAppCameraModalProps {
  visible: boolean;
  initialMode?: "photo" | "video";
  onClose: () => void;
  onSaveMedia: (items: CapturedMediaItem[]) => Promise<boolean>;
}

export function InAppCameraModal({
  visible,
  initialMode = "photo",
  onClose,
  onSaveMedia,
}: InAppCameraModalProps) {
  // Real device insets, so the header and shutter clear the notch and the
  // home indicator on every device instead of assuming one iPhone layout.
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"photo" | "video">(initialMode);
  const [torch, setTorch] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Captures made during this camera session, kept on the roll until the user
  // reviews and saves them. Nothing is queued until "Save" is tapped.
  const [captures, setCaptures] = useState<CapturedMediaItem[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  // Camera and Microphone permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webMediaStreamRef = useRef<MediaStream | null>(null);
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webRecordedChunksRef = useRef<Blob[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCaptures([]);
      setReviewIndex(null);
      setIsRecording(false);
      setRecordSeconds(0);
      setIsProcessing(false);
      setTorch(false);
      setMode(initialMode);
    }
  }, [visible, initialMode]);

  // Request permissions when modal opens
  useEffect(() => {
    if (visible) {
      if (!cameraPermission?.granted) {
        requestCameraPermission().catch(() => {});
      }
      if (mode === "video" && !micPermission?.granted) {
        requestMicPermission().catch(() => {});
      }
    }
  }, [
    visible,
    mode,
    cameraPermission,
    micPermission,
    requestCameraPermission,
    requestMicPermission,
  ]);

  // Web camera stream fallback with full audio support
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    let stream: MediaStream | null = null;
    const startWebCam = async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: mode === "video" ? { echoCancellation: true, noiseSuppression: true } : false,
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          webMediaStreamRef.current = stream;
          if (webVideoRef.current) {
            webVideoRef.current.srcObject = stream;
            webVideoRef.current.play().catch(() => {});
          }
        }
      } catch (e) {
        console.warn("Web camera stream init error:", e);
      }
    };

    startWebCam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (webMediaStreamRef.current) {
        webMediaStreamRef.current.getTracks().forEach((t) => t.stop());
        webMediaStreamRef.current = null;
      }
    };
  }, [visible, mode]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, []);

  // Collect a fresh capture onto the roll. The user reviews and saves later.
  const addCapture = useCallback(
    (item: Omit<CapturedMediaItem, "id" | "note">) => {
      setCaptures((prev) => [
        ...prev,
        { ...item, id: `capture-${Date.now()}-${prev.length}`, note: "" },
      ]);
    },
    [],
  );

  // Handle Photo Capture (Instantaneous)
  const handleTakePhoto = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (Platform.OS === "web") {
        if (webVideoRef.current) {
          const video = webVideoRef.current;
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const fileName = `photo-${Date.now()}.jpg`;

            setIsProcessing(false);
            addCapture({
              uri: dataUrl,
              fileName,
              evidenceType: "photo",
              mimeType: "image/jpeg",
            });
            return;
          }
        }
      }

      if (!cameraRef.current) {
        throw new Error("Camera not ready");
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        setIsProcessing(false);
        addCapture({
          uri: photo.uri,
          fileName: `photo-${Date.now()}.jpg`,
          evidenceType: "photo",
          mimeType: "image/jpeg",
        });
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      Alert.alert("Capture Error", err instanceof Error ? err.message : String(err));
    }
  };

  // Start Video Recording
  const handleStartRecording = async () => {
    if (isRecording || isProcessing) return;

    try {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      recordStartTimeRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);

      // This tick drives the clock pill. It only enforces the cap on web, where
      // MediaRecorder has no duration limit. Native is already capped by
      // `recordAsync`, and stopping it a second time from here would leave the
      // processing spinner up forever once the recording had resolved.
      recordIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartTimeRef.current) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= RECORD_MAX_SECONDS && Platform.OS === "web") {
          handleStopRecording();
        }
      }, 250);

      if (Platform.OS === "web") {
        if (!webMediaStreamRef.current) {
          throw new Error("Web media stream not ready");
        }
        webRecordedChunksRef.current = [];

        // Select the browser's native supported MIME format
        let selectedMime = "";
        const candidates = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4",
        ];
        for (const c of candidates) {
          if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
            selectedMime = c;
            break;
          }
        }

        const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
        const mediaRecorder = new MediaRecorder(webMediaStreamRef.current, options);
        webMediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            webRecordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(250);
        return;
      }

      if (cameraRef.current) {
        cameraRef.current
          .recordAsync({ maxDuration: RECORD_MAX_SECONDS })
          .then((recorded) => {
            if (recorded && recorded.uri) {
              addCapture({
                uri: recorded.uri,
                fileName: `video-${Date.now()}.mp4`,
                evidenceType: "video",
                mimeType: "video/mp4",
              });
            }
          })
          .catch((err) => {
            if (isRecording) {
              console.warn("Camera recording error:", err);
            }
          })
          .finally(() => {
            setIsRecording(false);
            setIsProcessing(false);
          });
      }
    } catch (err: unknown) {
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      Alert.alert("Recording Error", err instanceof Error ? err.message : String(err));
    }
  };

  // Stop Video Recording. Deliberately free of render state so the 60s tick can
  // call this from the closure it captured when recording started: a guard on
  // `isRecording` would read `false` there and silently do nothing.
  const handleStopRecording = useCallback(async () => {
    setIsProcessing(true);

    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }

    try {
      if (Platform.OS === "web") {
        if (webMediaRecorderRef.current && webMediaRecorderRef.current.state !== "inactive") {
          webMediaRecorderRef.current.onstop = () => {
            const recordedMime = webMediaRecorderRef.current?.mimeType || "video/webm";
            const blob = new Blob(webRecordedChunksRef.current, { type: recordedMime });
            const uri = URL.createObjectURL(blob);
            const ext = recordedMime.includes("mp4") ? "mp4" : "webm";

            setIsRecording(false);
            setIsProcessing(false);
            addCapture({
              uri,
              fileName: `video-${Date.now()}.${ext}`,
              evidenceType: "video",
              mimeType: recordedMime,
            });
          };
          webMediaRecorderRef.current.stop();
          return;
        }
        // Nothing left to stop (already stopped, or never started). Release the
        // spinner instead of falling through to a camera that does not exist.
        setIsProcessing(false);
        return;
      }

      if (cameraRef.current) {
        cameraRef.current.stopRecording();
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      setIsRecording(false);
      Alert.alert("Stop Error", err instanceof Error ? err.message : String(err));
    }
  }, [addCapture]);

  const toggleTorch = () => {
    setTorch((prev) => !prev);
  };

  // Closing the camera with unsaved captures should not silently drop them.
  const confirmClose = () => {
    if (isRecording) {
      handleStopRecording();
      return;
    }
    if (captures.length === 0) {
      onClose();
      return;
    }
    Alert.alert(
      "Discard captures?",
      `${captures.length} captured item${captures.length > 1 ? "s" : ""} will be lost.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setCaptures([]);
            setReviewIndex(null);
            onClose();
          },
        },
      ],
    );
  };

  const handleNoteChange = (text: string) => {
    if (reviewIndex === null) return;
    setCaptures((prev) =>
      prev.map((c, i) => (i === reviewIndex ? { ...c, note: text } : c)),
    );
  };

  const handleDiscardCurrent = () => {
    if (reviewIndex === null) return;
    const removing = captures[reviewIndex];
    if (!removing) return;
    Alert.alert(
      "Discard this capture?",
      "The photo or video will be deleted. This cannot be undone.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            const next = captures.filter((_, i) => i !== reviewIndex);
            setCaptures(next);
            setReviewIndex(next.length === 0 ? null : Math.min(reviewIndex, next.length - 1));
          },
        },
      ],
    );
  };

  const handleSaveAll = async () => {
    if (captures.length === 0) {
      onClose();
      return;
    }
    setIsProcessing(true);
    try {
      const saved = await onSaveMedia(captures);
      if (saved) {
        setCaptures([]);
        setReviewIndex(null);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const hasCameraPermission = Boolean(cameraPermission?.granted);
  const latestCapture = captures[captures.length - 1];
  const currentCapture = reviewIndex !== null ? captures[reviewIndex] : undefined;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      // Android only: let the viewfinder extend under the status bar, then pad
      // the chrome back in with the real insets. Ignored on iOS.
      statusBarTranslucent
      onRequestClose={confirmClose}
    >
      <View style={styles.container}>
        {/* Top Controls - overlaid on the full-bleed preview */}
        <View
          style={[
            styles.topHeader,
            {
              paddingTop: insets.top + 8,
              height: insets.top + 60,
            },
          ]}
        >
          {/* Close Button */}
          <Pressable
            onPress={confirmClose}
            style={styles.headerIconButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>

          {/* Action Row: Torch */}
          <View style={styles.headerActionRow}>
            <Pressable
              onPress={toggleTorch}
              style={styles.headerIconButton}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Toggle flash"
            >
              <Icon
                name={torch ? "flash" : "flash-outline"}
                size={21}
                color={torch ? "#FACC15" : "#FFFFFF"}
              />
            </Pressable>
          </View>
        </View>

        {/* Viewfinder Area - full screen, controls float above it */}
        <View style={styles.viewfinderContainer}>
          {Platform.OS === "web" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#000000",
                overflow: "hidden",
              }}
            >
              <video
                ref={webVideoRef}
                playsInline
                muted
                autoPlay
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          ) : hasCameraPermission ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
              mode={mode === "video" ? "video" : "picture"}
              enableTorch={torch}
              mute={false}
            />
          ) : null}

          {/* Alignment Grid Overlay */}
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridRow}>
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
            </View>
          </View>

          {/* Recording Timer Pill (Video Mode only when actively recording) */}
          {isRecording && (
            <View style={[styles.recordingPill, { top: insets.top + 72 }]}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                00:{recordSeconds < 10 ? `0${recordSeconds}` : recordSeconds} / 01:00
              </Text>
            </View>
          )}

          {/* Busy Processing Spinner */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Bottom Controls - overlaid on the preview */}
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + 22,
            },
          ]}
        >
          <View style={styles.modeSelectorRow}>
            {(["photo", "video"] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    if (isRecording || active) return;
                    setMode(m);
                    if (m === "video" && !micPermission?.granted) {
                      requestMicPermission().catch(() => {});
                    }
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.modeSelectorText,
                      { color: active ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)" },
                    ]}
                  >
                    {m.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.shutterRow}>
            <View style={styles.shutterSide} />

            <View style={styles.shutterCenter}>
              {mode === "photo" ? (
                <Pressable
                  onPress={handleTakePhoto}
                  disabled={isProcessing}
                  style={({ pressed }) => [
                    styles.photoShutterOuter,
                    pressed ? { transform: [{ scale: 0.93 }] } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                >
                  <View style={styles.photoShutterInner} />
                </Pressable>
              ) : (
                <View style={styles.videoShutterContainer}>
                  {!isRecording ? (
                    <Pressable
                      onPress={handleStartRecording}
                      disabled={isProcessing}
                      style={({ pressed }) => [
                        styles.videoShutterOuter,
                        pressed ? { transform: [{ scale: 0.93 }] } : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Start recording"
                    >
                      <View style={styles.videoShutterInner} />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleStopRecording}
                      disabled={isProcessing}
                      style={styles.stopButtonOuter}
                      accessibilityRole="button"
                      accessibilityLabel="Stop recording"
                    >
                      <View style={styles.stopButtonSquare} />
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* Gallery button - right of the shutter, like a standard camera app */}
            <View style={styles.shutterSide}>
              {latestCapture ? (
                <Pressable
                  onPress={() => setReviewIndex(captures.length - 1)}
                  style={styles.galleryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Review captured media"
                >
                  {latestCapture.evidenceType === "photo" ? (
                    <Image source={{ uri: latestCapture.uri }} style={styles.galleryThumb} />
                  ) : (
                    <View style={[styles.galleryThumb, styles.galleryThumbVideo]}>
                      <Icon name="play" size={20} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={styles.galleryBadge}>
                    <Text style={styles.galleryBadgeText}>{captures.length}</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Review captured media: caption, discard, save ── */}
        {reviewIndex !== null && currentCapture ? (
          <View style={styles.reviewOverlay}>
            <View style={[styles.reviewHeader, { paddingTop: insets.top + 8 }]}>
              <Pressable
                onPress={() => setReviewIndex(null)}
                style={styles.headerIconButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back to camera"
              >
                <Icon name="arrow-back" size={24} color="#FFFFFF" />
              </Pressable>

              <Text style={styles.reviewTitle}>
                {reviewIndex + 1} / {captures.length}
              </Text>

              <Pressable
                onPress={handleDiscardCurrent}
                style={styles.headerIconButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Discard this capture"
              >
                <Icon name="trash" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.reviewMediaWrap}>
              {currentCapture.evidenceType === "photo" ? (
                <Image
                  source={{ uri: currentCapture.uri }}
                  style={styles.reviewMedia}
                  resizeMode="contain"
                />
              ) : (
                <InteractiveVideoPlayer src={currentCapture.uri} style={styles.reviewMedia} />
              )}
            </View>

            {captures.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.reviewStrip}
                contentContainerStyle={styles.reviewStripContent}
              >
                {captures.map((c, i) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setReviewIndex(i)}
                    style={[
                      styles.reviewStripItem,
                      i === reviewIndex ? styles.reviewStripItemActive : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Show capture ${i + 1}`}
                  >
                    {c.evidenceType === "photo" ? (
                      <Image source={{ uri: c.uri }} style={styles.reviewStripThumb} />
                    ) : (
                      <View style={[styles.reviewStripThumb, styles.galleryThumbVideo]}>
                        <Icon name="play" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={[styles.reviewBottom, { paddingBottom: insets.bottom + 16 }]}>
              <TextInput
                style={styles.reviewCaption}
                value={currentCapture.note}
                onChangeText={handleNoteChange}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                multiline
                accessibilityLabel="Caption"
              />
              <Pressable
                onPress={handleSaveAll}
                disabled={isProcessing}
                style={styles.reviewSaveButton}
                accessibilityRole="button"
                accessibilityLabel="Save captures"
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Icon name="checkmark" size={24} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topHeader: {
    // Height and paddingTop come from device safe-area insets at render time.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 30,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewfinderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    flexDirection: "column",
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
  },
  gridCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  recordingPill: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  recordingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    paddingTop: 14,
    // paddingBottom comes from device safe-area insets at render time.
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  modeSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginBottom: 14,
  },
  modeSelectorText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 28,
  },
  shutterSide: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  galleryThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  galleryThumbVideo: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  photoShutterOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  photoShutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
  },
  videoShutterContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  videoShutterOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  videoShutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.error,
  },
  stopButtonOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  stopButtonSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  reviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 100,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  reviewTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  reviewMediaWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewMedia: {
    width: "100%",
    height: "100%",
  },
  reviewStrip: {
    maxHeight: 72,
    flexGrow: 0,
  },
  reviewStripContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  reviewStripItem: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  reviewStripItemActive: {
    borderColor: "#FFFFFF",
  },
  reviewStripThumb: {
    width: 48,
    height: 48,
  },
  reviewBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  reviewCaption: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    color: "#FFFFFF",
    fontSize: 15,
  },
  reviewSaveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
});
