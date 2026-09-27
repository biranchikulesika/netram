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


