import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSettings } from "../src/theme/settings-context";

export default function SplashScreen() {
  const { theme, isPureDark } = useSettings();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bgCanvas }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[styles.logo, isPureDark && { backgroundColor: "#18181B", borderColor: "#27272A", borderWidth: 1 }]}>
          <Text style={styles.logoN}>N</Text>
        </View>

        <Text style={[styles.brand, { color: theme.navyDark }]}>NETRAM</Text>

        <Text style={[styles.subtitle, { color: theme.actionGreen }]}>
          DEPARTMENT OF SOCIAL JUSTICE & EMPOWERMENT
        </Text>

        <View
          style={[
            styles.status,
            {
              backgroundColor: theme.bgSubtle,
              borderColor: theme.borderSubtle,
            },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: theme.actionGreen }]} />
          <Text style={[styles.statusText, { color: theme.textMuted }]}>
            OFFICIAL INSPECTION SYSTEM
          </Text>
        </View>
      </Animated.View>

      <Text style={[styles.footer, { color: theme.textMuted }]}>
        GOVERNMENT OF INDIA • STATUTORY FIELD MONITORING
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    alignItems: "center",
  },

  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: "#002449",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  logoN: {
    color: "#FFFFFF",
    fontSize: 54,
    fontWeight: "800",
    lineHeight: 62,
  },

  brand: {
    color: "#002449",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 3,
  },

  subtitle: {
    color: "#15803d",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 8,
    textAlign: "center",
  },

  status: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f3f6fb",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#15803d",
    marginRight: 8,
  },

  statusText: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  footer: {
    position: "absolute",
    bottom: 30,
    color: "#64748b",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
    textAlign: "center",
  },
});