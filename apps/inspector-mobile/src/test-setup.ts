import React from "react";
import { vi } from "vitest";

const mockStore = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

vi.mock("expo-camera", () => ({
  // Exposes the imperative handle the modal calls, so capture paths are
  // testable instead of dying on "Camera not ready".
  CameraView: React.forwardRef(function MockCameraView(
    _props: Record<string, unknown>,
    ref: React.Ref<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: async () => ({ uri: "file:///mock/photo.jpg" }),
      recordAsync: () => new Promise(() => {}),
      stopRecording: () => {},
    }));
    return null;
  }),
  useCameraPermissions: () => [{ granted: true }, vi.fn()],
  useMicrophonePermissions: () => [{ granted: true }, vi.fn()],
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestMicrophonePermissionsAsync: vi.fn(async () => ({ granted: true })),
  getCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  getMicrophonePermissionsAsync: vi.fn(async () => ({ granted: true })),
}));

// No SafeAreaProvider in tests; the modal only reads the insets for padding.
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("react-native-webview", () => ({
  WebView: () => null,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

vi.mock("expo-video", () => ({
  useVideoPlayer: () => ({
    playing: false,
    play: vi.fn(),
    pause: vi.fn(),
    currentTime: 0,
    duration: 0,
    muted: false,
  }),
  VideoView: () => null,
}));

vi.mock("expo-av", () => ({
  Audio: {
    Recording: vi.fn().mockImplementation(() => ({
      prepareToRecordAsync: vi.fn().mockResolvedValue({}),
      startAsync: vi.fn().mockResolvedValue({}),
      stopAndUnloadAsync: vi.fn().mockResolvedValue({}),
      getURI: vi.fn().mockReturnValue("file:///data/recording.m4a"),
    })),
    Sound: {
      createAsync: vi.fn().mockResolvedValue({
        sound: {
          playAsync: vi.fn().mockResolvedValue({}),
          pauseAsync: vi.fn().mockResolvedValue({}),
          stopAsync: vi.fn().mockResolvedValue({}),
          unloadAsync: vi.fn().mockResolvedValue({}),
          setPositionAsync: vi.fn().mockResolvedValue({}),
          setRateAsync: vi.fn().mockResolvedValue({}),
          setIsMutedAsync: vi.fn().mockResolvedValue({}),
          setOnPlaybackStatusUpdate: vi.fn(),
        },
      }),
    },
    requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: vi.fn().mockResolvedValue({}),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
  Video: () => null,
  ResizeMode: {
    CONTAIN: "contain",
    COVER: "cover",
    STRETCH: "stretch",
  },
}));

vi.mock("expo-file-system", () => ({
  cacheDirectory: "file:///mock/cache/",
  documentDirectory: "file:///mock/documents/",
  writeAsStringAsync: vi.fn().mockResolvedValue(undefined),
  readAsStringAsync: vi.fn().mockResolvedValue(""),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));


