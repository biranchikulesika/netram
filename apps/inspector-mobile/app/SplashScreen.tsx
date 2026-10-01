import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
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
        <Text style={[styles.brand, { color: theme.navyDark }]}>Netram</Text>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          {"Smart real-time monitoring\nand inspection platform"}
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
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  tagline: {
    color: "#45556c",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
});
