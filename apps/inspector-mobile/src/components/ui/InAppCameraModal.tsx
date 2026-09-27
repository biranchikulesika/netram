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
  // Mode is fixed to what was selected (photo only or video only)
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
  const recordStartTimeRef = useRef<number>(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webMediaStreamRef = useRef<MediaStream | null>(null);
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webRecordedChunksRef = useRef<Blob[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsRecording(false);
      setRecordSeconds(0);
      setIsProcessing(false);
      setTorch(false);
    }
  }, [visible]);

  // Request permissions when modal opens
  useEffect(() => {
    if (visible) {
      if (!cameraPermission?.granted) {
        requestCameraPermission().catch(() => {});
      }
      if (initialMode === "video" && !micPermission?.granted) {
        requestMicPermission().catch(() => {});
      }
    }
  }, [visible, initialMode, cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  // Web camera stream fallback
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    let stream: MediaStream | null = null;
    const startWebCam = async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing === "back" ? "environment" : "user" },
            audio: initialMode === "video",
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
  }, [visible, facing, initialMode]);

  // Clean up recording timer on unmount
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

      if (!cameraRef.current) {
        throw new Error("In-app camera not ready");
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        const fileName = `photo-${Date.now()}.jpg`;
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
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      recordStartTimeRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);

      recordIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartTimeRef.current) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= 60) {
          handleStopRecording();
        }
      }, 250);

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

      if (cameraRef.current) {
        const videoPromise = cameraRef.current.recordAsync({
          maxDuration: 60,
        });

        videoPromise
          .then(async (recorded) => {
            if (recorded && recorded.uri) {
              const fileName = `video-${Date.now()}.mp4`;
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
            const fileName = `video-${Date.now()}.mp4`;
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

      if (cameraRef.current) {
        cameraRef.current.stopRecording();
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      setIsRecording(false);
      Alert.alert("Stop Error", err instanceof Error ? err.message : String(err));
    }
  }, [isRecording, recordSeconds, onCaptureVideo, onClose]);

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const toggleTorch = () => {
    setTorch((prev) => !prev);
  };

  const hasPermissions = cameraPermission?.granted && (initialMode === "photo" || micPermission?.granted);

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
        {/* Top Header — Clean White with Premium Icons */}
        <View style={styles.topHeader}>
          {/* Close Button */}
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
            <Icon name="close" size={22} color={colors.navyDark} />
          </Pressable>

          {/* Action Row: Torch & Flip Lens with Premium Styling */}
          <View style={styles.headerActionRow}>
            <Pressable
              onPress={toggleTorch}
              style={[
                styles.headerIconButton,
                torch ? styles.headerIconButtonTorchActive : null,
              ]}
              hitSlop={10}
            >
              <Icon
                name={torch ? "flash" : "flash-outline"}
                size={21}
                color={torch ? "#D97706" : colors.navyDark}
              />
            </Pressable>

            <Pressable
              onPress={toggleFacing}
              style={styles.headerIconButton}
              hitSlop={10}
            >
              <Icon name="camera-reverse-outline" size={22} color={colors.navyDark} />
            </Pressable>
          </View>
        </View>

        {/* Viewfinder Area */}
        <View style={styles.viewfinderContainer}>
          {!hasPermissions ? (
            <View style={styles.permissionCard}>
              <Icon name="camera" size={44} color={colors.navyDark} />
              <Pressable
                onPress={() => {
                  requestCameraPermission();
                  requestMicPermission();
                }}
                style={styles.permissionBtn}
              >
                <Icon name="checkmark" size={18} color="#FFFFFF" />
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
              mode={initialMode === "video" ? "video" : "picture"}
              enableTorch={torch}
            />
          )}

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

          {/* Recording Timer Pill (Video Mode only when active) */}
          {isRecording && (
            <View style={styles.recordingPill}>
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

        {/* Bottom Bar — Clean White with Shutter Only */}
        <View style={styles.bottomBar}>
          <View style={styles.shutterRow}>
            {initialMode === "photo" ? (
              <Pressable
                onPress={handleTakePhoto}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.photoShutterOuter,
                  pressed ? { transform: [{ scale: 0.93 }] } : null,
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
                      pressed ? { transform: [{ scale: 0.93 }] } : null,
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
    backgroundColor: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
  },
  topHeader: {
    height: Platform.OS === "ios" ? 88 : 64,
    paddingTop: Platform.OS === "ios" ? 44 : 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 30,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconButtonTorchActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  viewfinderContainer: {
    flex: 1,
    position: "relative",
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
  permissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
    gap: 16,
  },
  permissionBtn: {
    backgroundColor: colors.navyDark,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  bottomBar: {
    height: 120,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  shutterRow: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoShutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: colors.navyDark,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  photoShutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.navyDark,
  },
  videoShutterContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  videoShutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  videoShutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.error,
  },
  stopButtonOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },
  stopButtonSquare: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
});
