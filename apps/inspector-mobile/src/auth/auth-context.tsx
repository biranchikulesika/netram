import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";
import { Platform } from "react-native";
import { NetramApiClient } from "@netram/api-client";
import { loadMobileEnv } from "@netram/config/env/mobile";
import * as Notifications from "expo-notifications";
import { clearSession, getStoredSession, loginAsInspector, type InspectorUser } from "./session";

async function registerForPushNotifications(apiClient: NetramApiClient) {
  try {
    if (Platform.OS === "web") return;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return;
    }
    const pushTokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (pushTokenData?.data) {
      await apiClient.registerDevicePushToken({
        token: pushTokenData.data,
        platform: Platform.OS,
      });
    }
  } catch {
    // Proceed silently (push is optional, not blocking)
  }
}

export interface AuthContextValue {
  token: string | null;
  client: NetramApiClient | null;
  user: InspectorUser | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<InspectorUser | null>(null);
  const [_initializing, setInitializing] = useState(true);

  // Same API server the web app talks to (shared config; defaults to :3001).
  // On local browser development (localhost/127.0.0.1), use same-origin proxy
  // to avoid browser CORS blocks against the remote API server.
  const rawApiBase = loadMobileEnv().EXPO_PUBLIC_API_URL;
  const apiBase =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? window.location.origin
      : rawApiBase;

  // An expired or rejected token must not look like an empty inspection list.
  // Dev tokens expire after 8h with no refresh, so a session restored from
  // SecureStore can be dead on arrival. Drop it and return the user to login.
  const handleUnauthorized = useCallback(() => {
    setToken(null);
    setUser(null);
    void clearSession();
  }, []);

  const makeClient = useCallback(
    (token: string) =>
      new NetramApiClient({
        baseUrl: apiBase,
        getToken: () => token,
        onUnauthorized: handleUnauthorized,
      }),
    [apiBase, handleUnauthorized],
  );

  useEffect(() => {
    let mounted = true;
    async function initSession() {
      try {
        const stored = await getStoredSession();
        if (mounted && stored?.token && stored?.user) {
          setToken(stored.token);
          setUser(stored.user);
          const restoredClient = makeClient(stored.token);
          void registerForPushNotifications(restoredClient);
        }
      } catch (err) {
        console.warn("Failed to load stored session from SecureStore:", err);
      } finally {
        if (mounted) {
          setInitializing(false);
        }
      }
    }

    void initSession();

    return () => {
      mounted = false;
    };
  }, [makeClient]);

  const client = token ? makeClient(token) : null;

  const login = async (email: string, password?: string) => {
    const normalized = email.trim();
    const session = await loginAsInspector(normalized, password, apiBase);
    setToken(session.token);
    setUser(session.user);

    const newClient = makeClient(session.token);
    void registerForPushNotifications(newClient);
  };

  const logout = async () => {
    await clearSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        client,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = SessionProvider;

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within a SessionProvider");
  }
  return ctx;
};
