import { NetramApiClient } from "@netram/api-client";

export interface InspectorUser {
  id: string;
  email: string;
  displayName?: string | null;
  type?: string;
}

export interface InspectorSession {
  token: string;
  user: InspectorUser;
  apiUrl: string;
}

const STORAGE_KEY = "netram_inspector_session_v1";

let memorySession: InspectorSession | null = null;

export function getStoredSession(): InspectorSession | null {
  if (memorySession) return memorySession;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memorySession = JSON.parse(raw) as InspectorSession;
        return memorySession;
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  return null;
}

export function saveSession(session: InspectorSession): void {
  memorySession = session;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
  }
}

export function clearSession(): void {
  memorySession = null;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export async function loginAsInspector(
  email: string,
  apiUrl = "http://localhost:3001",
): Promise<InspectorSession> {
  const client = new NetramApiClient({ baseUrl: apiUrl });
  const result = await client.devLogin(email);

  const session: InspectorSession = {
    token: result.token,
    user: {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      type: result.user.type,
    },
    apiUrl,
  };

  saveSession(session);
  return session;
}

export function loginOfflineDemo(email: string): InspectorSession {
  const id = email.includes("one")
    ? "00000000-0000-4000-8000-000000000101"
    : "00000000-0000-4000-8000-000000000102";

  const nameParts = email.split("@")[0]?.split(".") ?? ["inspector"];
  const displayName = nameParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

  const session: InspectorSession = {
    token: "dev-offline-inspector-token",
    user: {
      id,
      email,
      displayName,
      type: "inspector",
    },
    apiUrl: "http://localhost:3001",
  };

  saveSession(session);
  return session;
}

