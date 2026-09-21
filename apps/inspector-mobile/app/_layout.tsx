import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { NetramApiClient } from "@netram/api-client";
import { loadMobileEnv } from "@netram/config/env/mobile";

import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";

interface AuthContextValue {
  token: string | null;
  client: NetramApiClient | null;
  user: { email: string } | null;
  login: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);

  const apiBase =
    Platform.OS === "web"
      ? "http://localhost:3001"
      : loadMobileEnv().EXPO_PUBLIC_API_URL;

  const client = token
    ? new NetramApiClient({
      baseUrl: apiBase,
      getToken: () => token,
    })
    : null;

  const login = async (email: string) => {
    const api = new NetramApiClient({
      baseUrl: apiBase,
    });

    const result = await api.devLogin(email);

    setToken(result.token);
    setUser(result.user);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        client,
        user,
        login,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("AuthContext not provided");
  }

  return ctx;
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}

const RootContent = () => {
  const { token } = useAuth();

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // -------------------------
  // SPLASH
  // -------------------------

  if (showSplash) {
    return <SplashScreen />;
  }

  // -------------------------
  // LOGIN
  // -------------------------

  if (!token) {
    return <LoginScreen />;
  }

  // -------------------------
  // MAIN APP
  // -------------------------

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#071A2B",
        },

        headerTintColor: "#F8FAFC",

        headerTitleStyle: {
          fontWeight: "700",
        },

        tabBarStyle: {
          backgroundColor: "#0D263D",
          borderTopColor: "#23415A",
        },

        tabBarActiveTintColor: "#2563EB",

        tabBarInactiveTintColor: "#94A3B8",

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },

        tabBarHideOnKeyboard: true,
      }}
    >
      {/* HOME */}

      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* INSPECTIONS */}

      <Tabs.Screen
        name="inspections"
        options={{
          title: "Inspections",
          headerShown: false,
          tabBarLabel: "Inspections",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      {/* SYNC */}

      <Tabs.Screen
        name="sync"
        options={{
          title: "Sync Center",
          headerShown: false,
          tabBarLabel: "Sync",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sync-outline" size={size} color={color} />
          ),
        }}
      />

      {/* PROFILE */}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* INTERNAL ROUTES */}

      <Tabs.Screen
        name="check-in"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="LoginScreen"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="login"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="signup"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="SplashScreen"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
};
