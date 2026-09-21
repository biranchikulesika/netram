import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getStoredSession } from "../src/auth/session";
import { getOfflineDatabase } from "../src/offline/db";
import { SplashScreenView } from "../src/components/SplashScreenView";
import { colors } from "../src/theme/colors";

export default function RootLayout() {
  const rootNavigationState = useRootNavigationState();
  const segments = useSegments();
  const router = useRouter();
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const startTime = Date.now();
      try {
        // 1. Initialize local SQLite schema & database
        await getOfflineDatabase();
      } catch (err) {
        console.warn("Offline database pre-initialization notice:", err);
      }

      // Guarantee minimum splash time for smooth animation (2000ms / 2 seconds)
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 2000 - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      if (isMounted) {
        setIsBootstrapping(false);
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isBootstrapping || !rootNavigationState?.key) return;

    const session = getStoredSession();
    const isAuthPage = segments[0] === "login" || segments[0] === "signup";

    if (!session && !isAuthPage) {
      router.replace("/login");
    } else if (session && isAuthPage) {
      router.replace("/");
    }
  }, [isBootstrapping, segments, router, rootNavigationState?.key]);

  return (
    <View style={styles.rootContainer}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navyDark },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: "Netram Inspector" }} />
        <Stack.Screen name="inspections/[id]" options={{ title: "Field Inspection" }} />
      </Stack>
      {isBootstrapping && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
          <SplashScreenView />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});


