import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function SplashScreen() {
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
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.logo}>
          <Text style={styles.logoN}>N</Text>
          <View style={styles.check} />
        </View>

        <Text style={styles.brand}>NETRAM</Text>

        <Text style={styles.subtitle}>
          FIELD OPERATIONS
        </Text>

        <View style={styles.status}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            SECURE INSPECTION SYSTEM
          </Text>
        </View>
      </Animated.View>

      <Text style={styles.footer}>
        SMART MONITORING • EVIDENCE • FIELD OPERATIONS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071A2B",
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    alignItems: "center",
  },

  logo: {
    width: 108,
    height: 108,
    borderRadius: 26,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  logoN: {
    color: "#FFFFFF",
    fontSize: 64,
    fontWeight: "800",
    lineHeight: 72,
  },

  check: {
    position: "absolute",
    width: 15,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#14B8A6",
    transform: [
      { rotate: "-45deg" },
      { translateX: 25 },
      { translateY: 27 },
    ],
  },

  brand: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
  },

  subtitle: {
    color: "#14B8A6",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 7,
  },

  status: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#23415A",
    backgroundColor: "#0D263D",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#14B8A6",
    marginRight: 9,
  },

  statusText: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  footer: {
    position: "absolute",
    bottom: 30,
    color: "#526B80",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1,
  },
});