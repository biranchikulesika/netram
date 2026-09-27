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
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, vi.fn()],
  useMicrophonePermissions: () => [{ granted: true }, vi.fn()],
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestMicrophonePermissionsAsync: vi.fn(async () => ({ granted: true })),
  getCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  getMicrophonePermissionsAsync: vi.fn(async () => ({ granted: true })),
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
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
    setAudioModeAsync: vi.fn(async () => {}),
    Recording: vi.fn().mockImplementation(() => ({
      prepareToRecordAsync: vi.fn(async () => {}),
      startAsync: vi.fn(async () => {}),
      stopAndUnloadAsync: vi.fn(async () => {}),
      getURI: vi.fn(() => "file:///mock/audio.m4a"),
    })),
    Sound: {
      createAsync: vi.fn(async () => ({
        sound: {
          playAsync: vi.fn(async () => {}),
          pauseAsync: vi.fn(async () => {}),
          stopAsync: vi.fn(async () => {}),
          unloadAsync: vi.fn(async () => {}),
          setOnPlaybackStatusUpdate: vi.fn(),
        },
      })),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
}));



