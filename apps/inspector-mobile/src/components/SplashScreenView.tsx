import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, typography } from "../theme/colors";

interface SplashScreenProps {
  onFinish?: () => void;
  statusText?: string;
}

export function SplashScreenView({ onFinish: _onFinish, statusText }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScaleAnim = useRef(new Animated.Value(1)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.6)).current;

  const [displayStatus, setDisplayStatus] = useState("Initializing terminal core...");

  useEffect(() => {
    // 1. Entrance animation (fade & slight scale up)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web" ? true : false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: Platform.OS !== "web" ? true : false,
      }),
    ]).start();

    // 2. Continuous radar/glow pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScaleAnim, {
            toValue: 1.35,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: Platform.OS !== "web" ? true : false,
          }),
          Animated.timing(ringOpacityAnim, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: Platform.OS !== "web" ? true : false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: Platform.OS !== "web" ? true : false,
          }),
          Animated.timing(ringOpacityAnim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: Platform.OS !== "web" ? true : false,
          }),
        ]),
      ]),
    );
    pulseLoop.start();

    // 3. Subtle breathing effect on central emblem
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web" ? true : false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== "web" ? true : false,
        }),
      ]),
    );
    breatheLoop.start();

    // 4. Progress step sequence across 2 seconds
    const t1 = setTimeout(() => {
      setDisplayStatus("Mounting offline SQLite database...");
    }, 500);

    const t2 = setTimeout(() => {
      setDisplayStatus("Checking cryptographic integrity...");
    }, 1000);

    const t3 = setTimeout(() => {
      setDisplayStatus("Loading inspector credentials...");
    }, 1500);

    const t4 = setTimeout(() => {
      setDisplayStatus("Ready • Launching terminal...");
    }, 1850);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      pulseLoop.stop();
      breatheLoop.stop();
    };
  }, [fadeAnim, scaleAnim, ringScaleAnim, ringOpacityAnim, pulseAnim]);

  useEffect(() => {
    if (statusText) {
      setDisplayStatus(statusText);
    }
  }, [statusText]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Government of India & Ministry Header with Ashoka Stambh */}
        <View style={styles.topHeader}>
          <View style={styles.govEmblemBox}>
            <Image
               // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/ashoka_stambh.png")}
              style={styles.ashokaStambh}
              resizeMode="contain"
            />
            <Text style={styles.govMinistry}>DEPARTMENT OF SOCIAL JUSTICE &amp; EMPOWERMENT</Text>
            <Text style={styles.govSubtext}>GOVERNMENT OF INDIA</Text>
          </View>
        </View>

        {/* Central Logo & Radar Emblem */}
        <View style={styles.emblemSection}>
          <View style={styles.emblemWrapper}>
            {/* Animated Radar Glow Ring */}
            <Animated.View
              style={[
                styles.radarRing,
                {
                  transform: [{ scale: ringScaleAnim }],
                  opacity: ringOpacityAnim,
                },
              ]}
            />

            {/* Core Shield */}
            <Animated.View
              style={[
                styles.emblemCore,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              {/* Outer decorative ring */}
              <View style={styles.emblemInnerRing}>
                {/* Netram Symbol: Iris / Radar Eye */}
                <View style={styles.eyeOuter}>
                  <View style={styles.eyeInner}>
                    <View style={styles.eyePupil} />
                    <View style={styles.radarSweepLine} />
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Wordmark */}
          <Text style={styles.brandTitle}>NETRAM</Text>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>FIELD INSPECTOR TERMINAL</Text>
          </View>

          <Text style={styles.tagline}>
            Smart Real-Time Monitoring &amp; Institutional Inspection
          </Text>
        </View>

        {/* Bottom Loading / Diagnostics Bar */}
        <View style={styles.bottomSection}>
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.navyLight} />
            <Text style={styles.statusText}>{displayStatus}</Text>
          </View>

          {/* Security & Version Info */}
          <View style={styles.securityMeta}>
            <Text style={styles.securityMetaText}>
              🔒 SHA-256 Tamper-Evident • Offline First • v0.1.0
            </Text>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyDark,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  topHeader: {
    alignItems: "center",
    width: "100%",
    paddingTop: 4,
  },
  govEmblemBox: {
    alignItems: "center",
    backgroundColor: colors.backdrop + "cc",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navyData,
  },
  ashokaStambh: {
    width: 64,
    height: 96,
    tintColor: colors.gold,
    marginBottom: 8,
  },
  govMinistry: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.bgCanvas,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  govSubtext: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.navyLight,
    letterSpacing: 1,
    marginTop: 2,
  },
  emblemSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: "auto",
  },
  emblemWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 20,
  },
  radarRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: colors.navyLight,
    backgroundColor: "transparent",
  },
  emblemCore: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.navyBrand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.accentBlue,
    shadowColor: colors.navyLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  emblemInnerRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: colors.navyLight + "55",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  eyeOuter: {
    width: 62,
    height: 38,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: colors.navyLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  eyeInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  eyePupil: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textInverse,
  },
  radarSweepLine: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyLight,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.textInverse,
    letterSpacing: 5,
  },
  badgePill: {
    backgroundColor: colors.navyData + "99",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navyLight,
    fontFamily: typography.mono,
    letterSpacing: 1.2,
  },
  tagline: {
    fontSize: 12,
    color: colors.navyLight,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 280,
    lineHeight: 17,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.backdrop + "cc",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.navyData,
  },
  statusText: {
    fontSize: 12,
    color: colors.bgCanvas,
    fontWeight: "500",
  },
  securityMeta: {
    marginTop: 6,
  },
  securityMetaText: {
    fontSize: 11,
    color: colors.navyLight,
    fontFamily: typography.mono,
    letterSpacing: 0.4,
  },
});
