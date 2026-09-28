import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSettings } from "../src/theme/settings-context";

export default function SplashScreen() {
  const { theme } = useSettings();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bgCanvas }]}>
      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={[styles.brand, { color: theme.navyDark }]}>NETRAM</Text>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          DEPARTMENT OF SOCIAL JUSTICE & EMPOWERMENT
        </Text>
      </Animated.View>
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
    paddingHorizontal: 32,
  },

  brand: {
    color: "#002449",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 3,
  },

  tagline: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: 10,
    textAlign: "center",
  },
});