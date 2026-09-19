import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useEffect, useState } from "react";
import { getStoredSession } from "../src/auth/session";
import { getOfflineDatabase } from "../src/offline/db";
import { SplashScreenView } from "../src/components/SplashScreenView";

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
    const isLoginPage = segments[0] === "login";

    if (!session && !isLoginPage) {
      router.replace("/login");
    } else if (session && isLoginPage) {
      router.replace("/");
    }
  }, [isBootstrapping, segments, router, rootNavigationState?.key]);

  if (isBootstrapping) {
    return <SplashScreenView />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1e293b" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: "Netram Inspector" }} />
      <Stack.Screen name="inspections/[id]" options={{ title: "Field Inspection" }} />
    </Stack>
  );
}


