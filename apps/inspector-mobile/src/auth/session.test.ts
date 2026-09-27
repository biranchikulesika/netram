import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import {
  clearSession,
  getStoredSession,
  saveSession,
  SECURE_STORE_KEY,
  type InspectorSession,
} from "./session";

const mockStore = new Map<string, string>();

vi.mock("expo-secure-store", () => {
  return {
    getItemAsync: vi.fn(async (key: string) => mockStore.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      mockStore.delete(key);
    }),
  };
});

describe("InspectorSession (SecureStore)", () => {
  beforeEach(async () => {
    mockStore.clear();
    vi.clearAllMocks();
  });

  it("returns null when no session is saved", async () => {
    const session = await getStoredSession();
    expect(session).toBeNull();
  });

  it("saves and retrieves session through SecureStore", async () => {
    const mockSession: InspectorSession = {
      token: "secure-test-token-123",
      user: {
        id: "usr-001",
        email: "inspector.one@dev.netram.in",
        displayName: "Inspector One",
        type: "inspector",
      },
      apiUrl: "http://localhost:3001",
    };

    await saveSession(mockSession);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_STORE_KEY,
      JSON.stringify(mockSession),
    );

    const stored = await getStoredSession();
    expect(stored).toEqual(mockSession);
  });

  it("clears session cleanly from SecureStore", async () => {
    const mockSession: InspectorSession = {
      token: "secure-test-token-123",
      user: {
        id: "usr-001",
        email: "inspector.one@dev.netram.in",
      },
      apiUrl: "http://localhost:3001",
    };

    await saveSession(mockSession);
    expect(await getStoredSession()).toEqual(mockSession);

    await clearSession();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_STORE_KEY);
    expect(await getStoredSession()).toBeNull();
  });

  it("returns null gracefully when stored JSON is malformed", async () => {
    mockStore.set(SECURE_STORE_KEY, "{ invalid json structure");

    const session = await getStoredSession();
    expect(session).toBeNull();
  });

  it("returns null when stored object is missing token or user", async () => {
    mockStore.set(SECURE_STORE_KEY, JSON.stringify({ apiUrl: "http://localhost:3001" }));

    const session = await getStoredSession();
    expect(session).toBeNull();
  });
});
