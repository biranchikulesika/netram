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
}));

vi.mock("react-native-webview", () => ({
  WebView: () => null,
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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


