import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  getStoredSession,
  loginOfflineDemo,
  saveSession,
} from "./session";

describe("InspectorSession", () => {
  beforeEach(() => {
    clearSession();
  });

  it("returns null when no session is saved", () => {
    expect(getStoredSession()).toBeNull();
  });

  it("saves and retrieves session in memory", () => {
    const mockSession = {
      token: "test-token",
      user: {
        id: "test-id",
        email: "inspector.one@dev.netram.in",
        displayName: "Inspector One",
        type: "inspector",
      },
      apiUrl: "http://localhost:3001",
    };

    saveSession(mockSession);
    const stored = getStoredSession();
    expect(stored).toEqual(mockSession);
  });

  it("clears session cleanly", () => {
    saveSession({
      token: "test-token",
      user: { id: "test-id", email: "test@example.com" },
      apiUrl: "http://localhost:3001",
    });

    clearSession();
    expect(getStoredSession()).toBeNull();
  });

  it("creates valid offline demo session with formatted display name", () => {
    const session = loginOfflineDemo("inspector.one@dev.netram.in");
    expect(session.token).toBe("dev-offline-inspector-token");
    expect(session.user.email).toBe("inspector.one@dev.netram.in");
    expect(session.user.displayName).toBe("Inspector One");
    expect(getStoredSession()).toEqual(session);
  });
});

