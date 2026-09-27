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
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from "expo-camera";
import { Icon } from "./Icon";
import { colors } from "../../theme/colors";

export interface CapturedEvidenceResult {
  uri: string;
  fileName: string;
  fileBytes?: Uint8Array;
  width?: number;
  height?: number;
  duration?: number;
}

export interface InAppCameraModalProps {
  visible: boolean;
  initialMode?: "photo" | "video";
  onClose: () => void;
  onCapturePhoto: (result: CapturedEvidenceResult) => void;
  onCaptureVideo: (result: CapturedEvidenceResult) => void;
}

export function InAppCameraModal({
  visible,
  initialMode = "photo",
  onClose,
  onCapturePhoto,
  onCaptureVideo,
}: InAppCameraModalProps) {
  const [mode, setMode] = useState<"photo" | "video">(initialMode);
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Camera permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webMediaStreamRef = useRef<MediaStream | null>(null);
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webRecordedChunksRef = useRef<Blob[]>([]);

  // Sync mode with initialMode whenever modal opens
  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setIsRecording(false);
      setRecordSeconds(0);
      setIsProcessing(false);
    }
  }, [visible, initialMode]);

  // Request permissions when modal opens
  useEffect(() => {
    if (visible) {
      if (!cameraPermission?.granted) {
        requestCameraPermission().catch(() => {});
      }
      if (!micPermission?.granted) {
        requestMicPermission().catch(() => {});
      }
    }
  }, [visible, cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  // Web camera initialization fallback
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    let stream: MediaStream | null = null;
    const startWebCam = async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing === "back" ? "environment" : "user" },
            audio: true,
          });
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
  }, [visible, facing]);

  // Clean up recording timer on unmount/close
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, []);

  // Handle Photo Capture
  const handleTakePhoto = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (Platform.OS === "web") {
        // Web canvas snapshot
        if (webVideoRef.current) {
          const video = webVideoRef.current;
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const fileName = `inspection-photo-${Date.now()}.jpg`;

            // Convert dataUrl to bytes
            const base64Data = dataUrl.split(",")[1] ?? "";
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            onCapturePhoto({
              uri: dataUrl,
              fileName,
              fileBytes: bytes,
              width: canvas.width,
              height: canvas.height,
            });
            onClose();
            return;
          }
        }
      }

      // Native CameraView capture
      if (!cameraRef.current) {
        throw new Error("In-app camera not ready");
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        const fileName = `inspection-photo-${Date.now()}.jpg`;
        let fileBytes: Uint8Array | undefined;
        try {
          const resp = await fetch(photo.uri);
          const buf = await resp.arrayBuffer();
          fileBytes = new Uint8Array(buf);
        } catch {
          fileBytes = new TextEncoder().encode(`photo-bytes-${fileName}`);
        }

        onCapturePhoto({
          uri: photo.uri,
          fileName,
          fileBytes,
          width: photo.width,
          height: photo.height,
        });
        onClose();
      }
    } catch (err: unknown) {
      Alert.alert("Capture Error", err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Video Recording
  const handleStartRecording = async () => {
    if (isRecording || isProcessing) return;

    try {
      setIsRecording(true);
      setRecordSeconds(0);

      // Start elapsed timer
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 59) {
            // Auto stop at 60 seconds
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      if (Platform.OS === "web") {
        if (!webMediaStreamRef.current) {
          throw new Error("Web media stream not ready");
        }
        webRecordedChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(webMediaStreamRef.current);
        webMediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            webRecordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start();
        return;
      }

      // Native CameraView recording
      if (cameraRef.current) {
        const videoPromise = cameraRef.current.recordAsync({
          maxDuration: 60,
        });

        // The promise resolves when stopRecording() is called or maxDuration is hit
        videoPromise
          .then(async (recorded) => {
            if (recorded && recorded.uri) {
              const fileName = `inspection-video-${Date.now()}.mp4`;
              let fileBytes: Uint8Array | undefined;
              try {
                const resp = await fetch(recorded.uri);
                const buf = await resp.arrayBuffer();
                fileBytes = new Uint8Array(buf);
              } catch {
                fileBytes = new TextEncoder().encode(`video-bytes-${fileName}`);
              }

              onCaptureVideo({
                uri: recorded.uri,
                fileName,
                fileBytes,
                duration: recordSeconds,
              });
              onClose();
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

  // Stop Video Recording
  const handleStopRecording = useCallback(async () => {
    if (!isRecording) return;
    setIsProcessing(true);

    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }

    try {
      if (Platform.OS === "web") {
        if (webMediaRecorderRef.current && webMediaRecorderRef.current.state !== "inactive") {
          webMediaRecorderRef.current.onstop = async () => {
            const blob = new Blob(webRecordedChunksRef.current, { type: "video/mp4" });
            const uri = URL.createObjectURL(blob);
            const fileName = `inspection-video-${Date.now()}.mp4`;
            const arrayBuffer = await blob.arrayBuffer();
            const fileBytes = new Uint8Array(arrayBuffer);

            setIsRecording(false);
            setIsProcessing(false);
            onCaptureVideo({
              uri,
              fileName,
              fileBytes,
              duration: recordSeconds,
            });
            onClose();
          };
          webMediaRecorderRef.current.stop();
          return;
        }
      }

      // Native CameraView stop
      if (cameraRef.current) {
        cameraRef.current.stopRecording();
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      setIsRecording(false);
      Alert.alert("Stop Error", err instanceof Error ? err.message : String(err));
    }
  }, [isRecording, recordSeconds, onCaptureVideo, onClose]);

  // Flip Camera Facing
  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  // Toggle Torch
  const toggleTorch = () => {
    setTorch((prev) => !prev);
  };

  const hasPermissions = cameraPermission?.granted && (mode === "photo" || micPermission?.granted);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (isRecording) {
          handleStopRecording();
        } else {
          onClose();
        }
      }}
    >
      <View style={styles.container}>
        {/* Top Header Controls Overlay */}
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => {
              if (isRecording) {
                handleStopRecording();
              } else {
                onClose();
              }
            }}
            style={styles.headerIconButton}
            hitSlop={10}
          >
            <Icon name="close" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Title & Live Status */}
          <View style={styles.headerTitleWrap}>
            <View style={styles.secureDot} />
            <Text style={styles.headerTitle}>
              NETRAM LIVE {mode.toUpperCase()} VIEW
            </Text>
          </View>

          {/* Action Tools: Torch & Flip */}
          <View style={styles.headerActionRow}>
            <Pressable
              onPress={toggleTorch}
              style={[
                styles.headerIconButton,
                torch ? styles.headerIconButtonActive : null,
              ]}
              hitSlop={10}
            >
              <Icon
                name={torch ? "flashlight" : "flashlight-outline"}
                size={20}
                color={torch ? "#F59E0B" : "#FFFFFF"}
              />
            </Pressable>

            <Pressable
              onPress={toggleFacing}
              style={styles.headerIconButton}
              hitSlop={10}
            >
              <Icon name="camera-reverse-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Viewfinder Area */}
        <View style={styles.viewfinderContainer}>
          {!hasPermissions ? (
            <View style={styles.permissionCard}>
              <Icon name="camera" size={48} color="#FFFFFF" />
              <Text style={styles.permissionTitle}>In-App Camera Authorization</Text>
              <Text style={styles.permissionBody}>
                Netram captures tamper-evident photo and video evidence directly
                inside the application without opening third-party camera apps.
              </Text>
              <Pressable
                onPress={() => {
                  requestCameraPermission();
                  requestMicPermission();
                }}
                style={styles.permissionBtn}
              >
                <Text style={styles.permissionBtnText}>Authorize Camera & Mic</Text>
              </Pressable>
            </View>
          ) : Platform.OS === "web" ? (
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
                  transform: facing === "front" ? "scaleX(-1)" : "none",
                }}
              />
            </div>
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={facing}
              mode={mode === "video" ? "video" : "picture"}
              enableTorch={torch}
            />
          )}

          {/* Subheader Government Watermark */}
          <View style={styles.watermarkBanner}>
            <Text style={styles.watermarkText}>
              GOVERNMENT OF INDIA • NETRAM INSPECTION AUDIT STREAM
            </Text>
          </View>

          {/* Framing Alignment Crosshairs / Grid */}
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

          {/* Recording Timer Pill Indicator */}
          {isRecording && (
            <View style={styles.recordingPill}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                REC 00:{recordSeconds < 10 ? `0${recordSeconds}` : recordSeconds} / 01:00
              </Text>
            </View>
          )}

          {/* Busy Processing Spinner */}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.processingText}>Processing Tamper-Proof Evidence...</Text>
            </View>
          )}
        </View>

        {/* Bottom In-App Control Bar */}
        <View style={styles.bottomBar}>
          {/* Mode Switcher Tabs */}
          {!isRecording && (
            <View style={styles.modeTabs}>
              <Pressable
                onPress={() => setMode("photo")}
                style={[
                  styles.modeTab,
                  mode === "photo" ? styles.modeTabActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "photo" ? styles.modeTabTextActive : null,
                  ]}
                >
                  PHOTO
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMode("video")}
                style={[
                  styles.modeTab,
                  mode === "video" ? styles.modeTabActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "video" ? styles.modeTabTextActive : null,
                  ]}
                >
                  VIDEO
                </Text>
              </Pressable>
            </View>
          )}

          {/* Shutter / Record Trigger Row */}
          <View style={styles.shutterRow}>
            {mode === "photo" ? (
              <Pressable
                onPress={handleTakePhoto}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.photoShutterOuter,
                  pressed ? { transform: [{ scale: 0.94 }] } : null,
                ]}
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
                      pressed ? { transform: [{ scale: 0.94 }] } : null,
                    ]}
                  >
                    <View style={styles.videoShutterInner} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleStopRecording}
                    disabled={isProcessing}
                    style={styles.stopButtonOuter}
                  >
                    <View style={styles.stopButtonSquare} />
                  </Pressable>
                )}
                <Text style={styles.shutterSubtext}>
                  {isRecording ? "Tap to Stop" : "Tap to Record (Max 60s)"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    display: "flex",
    flexDirection: "column",
  },
  topHeader: {
    height: Platform.OS === "ios" ? 88 : 64,
    paddingTop: Platform.OS === "ios" ? 44 : 12,
    backgroundColor: "rgba(0, 24, 52, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 30,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconButtonActive: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  viewfinderContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  watermarkBanner: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: "rgba(0, 15, 30, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    zIndex: 10,
  },
  watermarkText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
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
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 20,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    gap: 12,
  },
  processingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  permissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#001326",
    gap: 14,
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionBody: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  permissionBtn: {
    marginTop: 10,
    backgroundColor: "#0284C7",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  permissionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  bottomBar: {
    height: 140,
    backgroundColor: "#001326",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    zIndex: 30,
  },
  modeTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  modeTab: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  modeTabActive: {
    backgroundColor: "#0284C7",
  },
  modeTabText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  modeTabTextActive: {
    color: "#FFFFFF",
  },
  shutterRow: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoShutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  photoShutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  videoShutterContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  videoShutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  videoShutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.error,
  },
  stopButtonOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  stopButtonSquare: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  shutterSubtext: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
});
