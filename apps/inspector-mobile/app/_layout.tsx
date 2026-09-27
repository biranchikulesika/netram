import { useState, useEffect, type ReactNode } from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Icon } from "../src/components/ui/Icon";
import { colors } from "../src/theme/colors";

import SplashScreen from "./SplashScreen";
import LoginScreen from "./login";
import { SyncStatusProvider } from "../src/offline/sync-context";

import {
  SessionProvider,
  AuthProvider,
  useAuth,
  type AuthContextValue,
} from "../src/auth/auth-context";

export { SessionProvider, AuthProvider, useAuth, type AuthContextValue };

import { SettingsProvider, useSettings } from "../src/theme/settings-context";

export default function RootLayout() {
  return (
    <SessionProvider>
      <SettingsProvider>
        <SyncStatusWrapper>
          <RootContent />
        </SyncStatusWrapper>
      </SettingsProvider>
    </SessionProvider>
  );
}

function SyncStatusWrapper({ children }: { children: ReactNode }) {
  const { client } = useAuth();
  return <SyncStatusProvider client={client}>{children}</SyncStatusProvider>;
}

const RootContent = () => {
  const { token } = useAuth();
  const { isPureDark } = useSettings();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

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
          backgroundColor: isPureDark ? "#0A0A0A" : (colors?.bgSurface ?? "#ffffff"),
          borderBottomColor: isPureDark ? "#27272A" : (colors?.borderSubtle ?? "#e2e8f0"),
          borderBottomWidth: 1,
        },
        headerTintColor: isPureDark ? "#FFFFFF" : (colors?.navyDark ?? "#002449"),
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
        },
        tabBarStyle: {
          backgroundColor: isPureDark ? "#0A0A0A" : (colors?.bgSurface ?? "#ffffff"),
          borderTopColor: isPureDark ? "#27272A" : (colors?.borderSubtle ?? "#e2e8f0"),
          borderTopWidth: 1,
          height: Platform.OS === "web" ? 56 : 64,
          paddingTop: 4,
          paddingBottom: Platform.OS === "web" ? 4 : 8,
          elevation: 0,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: isPureDark ? "#3B82F6" : (colors?.navyDark ?? "#002449"),
        tabBarInactiveTintColor: isPureDark ? "#71717A" : (colors?.textSubtle ?? "#64748b"),
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: 1,
          marginBottom: 0,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* 1: DASHBOARD */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerShown: false,
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? "grid" : "grid-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />

      {/* 2: INSPECTIONS */}
      <Tabs.Screen
        name="inspections"
        options={{
          title: "Inspections",
          headerShown: false,
          tabBarLabel: "Inspections",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? "list" : "list-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />

      {/* 3: MAP (Check-in) */}
      <Tabs.Screen
        name="check-in"
        options={{
          title: "Map",
          headerShown: false,
          tabBarLabel: "Map",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? "navigate" : "navigate-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />

      {/* 4: HISTORY */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerShown: false,
          tabBarLabel: "History",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? "time" : "time-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />

      {/* 5: CALLS */}
      <Tabs.Screen
        name="videocall"
        options={{
          title: "Calls",
          headerShown: false,
          tabBarLabel: "Calls",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              name={focused ? "videocam" : "videocam-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* INTERNAL / HIDDEN ROUTES */}

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="sync"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="notifications"
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
        name="SplashScreen"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
};
