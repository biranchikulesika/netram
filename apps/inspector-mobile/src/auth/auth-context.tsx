import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { NetramApiClient } from "@netram/api-client";
import { loadMobileEnv } from "@netram/config/env/mobile";
import * as Notifications from "expo-notifications";
import {
  clearSession,
  getStoredSession,
  loginAsInspector,
  type InspectorUser,
} from "./session";

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

export const SessionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<InspectorUser | null>(null);
  const [_initializing, setInitializing] = useState(true);

  const apiBase =
    Platform.OS === "web"
      ? "http://localhost:3001"
      : loadMobileEnv().EXPO_PUBLIC_API_URL;

  useEffect(() => {
    let mounted = true;
    async function initSession() {
      try {
        const stored = await getStoredSession();
        if (mounted && stored?.token && stored?.user) {
          setToken(stored.token);
          setUser(stored.user);
          const restoredClient = new NetramApiClient({
            baseUrl: apiBase,
            getToken: () => stored.token,
          });
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
  }, [apiBase]);

  const client = token
    ? new NetramApiClient({
        baseUrl: apiBase,
        getToken: () => token,
      })
    : null;

  const login = async (email: string, password?: string) => {
    const normalized = email.trim();
    const session = await loginAsInspector(normalized, password, apiBase);
    setToken(session.token);
    setUser(session.user);

    const newClient = new NetramApiClient({
      baseUrl: apiBase,
      getToken: () => session.token,
    });
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
