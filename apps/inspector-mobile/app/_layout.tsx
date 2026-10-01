import { useState, useEffect, type ReactNode } from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
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
  const { isPureDark, theme } = useSettings();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const statusBar = (
    <StatusBar
      style={isPureDark ? "light" : "dark"}
      backgroundColor={theme.bgCanvas}
    />
  );

  // -------------------------
  // SPLASH
  // -------------------------
  if (showSplash) {
    return (
      <>
        {statusBar}
        <SplashScreen />
      </>
    );
  }

  // -------------------------
  // LOGIN
  // -------------------------
  if (!token) {
    return (
      <>
        {statusBar}
        <LoginScreen />
      </>
    );
  }

  // -------------------------
  // MAIN APP
  // -------------------------
  return (
    <>
      {statusBar}
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.bgSurface,
            borderBottomColor: theme.borderSubtle,
            borderBottomWidth: 1,
          },
          headerTintColor: theme.navyDark,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 17,
          },
          tabBarStyle: {
            backgroundColor: theme.bgSurface,
            borderTopColor: "transparent",
            borderTopWidth: 0,
            height: Platform.OS === "web" ? 56 : 64,
            paddingTop: 4,
            paddingBottom: Platform.OS === "web" ? 4 : 8,
            elevation: 0,
            shadowOpacity: 0,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 0,
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: isPureDark ? "#3B82F6" : theme.navyDark,
          tabBarInactiveTintColor: isPureDark ? "#71717A" : theme.textSubtle,
          tabBarItemStyle: {
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 2,
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
            <Icon name={focused ? "grid" : "grid-outline"} size={20} color={color} />
          ),
        }}
      />

      {/* 2: MAP (Check-in) */}
      <Tabs.Screen
        name="check-in"
        options={{
          headerShown: false,
          tabBarLabel: "",
          tabBarAccessibilityLabel: "Map",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "navigate" : "navigate-outline"} size={20} color={color} />
          ),
        }}
      />

      {/* 3: HISTORY */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerShown: false,
          tabBarLabel: "History",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "time" : "time-outline"} size={20} color={color} />
          ),
        }}
      />

      {/* 4: CALLS */}
      <Tabs.Screen
        name="videocall"
        options={{
          title: "Calls",
          headerShown: false,
          tabBarLabel: "Calls",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "videocam" : "videocam-outline"} size={21} color={color} />
          ),
        }}
      />

      {/* 5: PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "person" : "person-outline"} size={21} color={color} />
          ),
        }}
      />

      {/* INTERNAL / HIDDEN ROUTES */}

      <Tabs.Screen
        name="inspections"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
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
    </>
  );
};
