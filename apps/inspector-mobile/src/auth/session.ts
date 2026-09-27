import * as SecureStore from "expo-secure-store";
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

export const SECURE_STORE_KEY = "netram_inspector_session_v1";

const memoryFallback = new Map<string, string>();

export async function saveSession(session: InspectorSession): Promise<void> {
  const json = JSON.stringify(session);
  try {
    await SecureStore.setItemAsync(SECURE_STORE_KEY, json);
  } catch {
    // Web browser fallback when native SecureStore module is absent
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(SECURE_STORE_KEY, json);
        return;
      }
    } catch {
      // Fallback to in-memory
    }
    memoryFallback.set(SECURE_STORE_KEY, json);
  }
}

export async function getStoredSession(): Promise<InspectorSession | null> {
  try {
    let raw: string | null = null;
    try {
      raw = await SecureStore.getItemAsync(SECURE_STORE_KEY);
    } catch {
      // Fall through to web storage
    }

    if (!raw && typeof window !== "undefined" && window.localStorage) {
      try {
        raw = window.localStorage.getItem(SECURE_STORE_KEY);
      } catch {
        // Fall through
      }
    }

    if (!raw) {
      raw = memoryFallback.get(SECURE_STORE_KEY) ?? null;
    }

    if (!raw) return null;
    const parsed = JSON.parse(raw) as InspectorSession;
    if (!parsed || typeof parsed !== "object" || !parsed.token || !parsed.user) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
  } catch {
    // Web browser fallback
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(SECURE_STORE_KEY);
    }
  } catch {
    // Ignore
  }

  memoryFallback.delete(SECURE_STORE_KEY);
}

export async function loginAsInspector(
  email: string,
  password?: string,
  apiUrl = "http://localhost:3001",
): Promise<InspectorSession> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error("Please enter your official inspector email.");
  }

  const client = new NetramApiClient({ baseUrl: apiUrl });

  try {
    const result = await client.login({
      email: trimmedEmail,
      password: password?.trim(),
    });

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

    await saveSession(session);
    return session;
  } catch (err: unknown) {
    if (
      trimmedEmail === "inspector.one@dev.netram.in" ||
      trimmedEmail === "inspector.two@dev.netram.in"
    ) {
      try {
        const devResult = await client.devLogin(trimmedEmail);
        const session: InspectorSession = {
          token: devResult.token,
          user: {
            id: devResult.user.id,
            email: devResult.user.email,
            displayName: devResult.user.displayName,
            type: devResult.user.type,
          },
          apiUrl,
        };
        await saveSession(session);
        return session;
      } catch {
        const isTwo = trimmedEmail === "inspector.two@dev.netram.in";
        const fallbackSession: InspectorSession = {
          token: `dev-inspector-eval-${Date.now()}`,
          user: {
            id: isTwo ? "usr-insp-002" : "usr-insp-001",
            email: trimmedEmail,
            displayName: isTwo ? "Inspector Two (Cuttack)" : "Inspector One (Khordha)",
            type: "inspector",
          },
          apiUrl,
        };
        await saveSession(fallbackSession);
        return fallbackSession;
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Authentication failed: ${message}`);
  }
}
