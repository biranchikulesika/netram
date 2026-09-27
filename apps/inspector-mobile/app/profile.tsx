import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, typography } from "../src/theme/colors";
import {
  Icon,
  NetramButton,
  NetramCard,
  SectionHeader,
} from "../src/components/ui";
import { useAuth } from "../src/auth/auth-context";
import { useSettings } from "../src/theme/settings-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, isPureDark } = useSettings();
  const [loggingOut, setLoggingOut] = useState(false);

  const bgCanvas = theme.bgCanvas;
  const bgCard = theme.bgSurface;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;

  // Handle Sign Out reliably on Web & Mobile
  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed =
        typeof window !== "undefined"
          ? window.confirm("Are you sure you want to sign out from the official inspector terminal?")
          : true;
      if (!confirmed) return;

      setLoggingOut(true);
      try {
        await logout();
      } catch (err: unknown) {
        console.error("Sign out error:", err);
      } finally {
        setLoggingOut(false);
      }
      return;
    }

    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to sign out from the official inspector terminal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              Alert.alert("Sign Out Error", msg);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  const emailPrefix = user?.email?.split("@")[0];
  const displayName =
    user?.displayName ||
    (emailPrefix ? emailPrefix.replace(/[._-]/g, " ") : "Rajkumar G.");

  const _initial = displayName.charAt(0).toUpperCase() || "R";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      {/* ── Top Bar with Back Navigation ── */}
      <View style={[styles.topBar, { backgroundColor: bgCard, borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Icon name="arrow-back" size={20} color={theme.navyDark} />
          <Text style={[styles.backText, { color: theme.navyDark }]}>Back</Text>
        </Pressable>
        <Text style={[styles.topBarTitle, { color: theme.navyDark }]}>Inspector Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Section: Officer Identity Card ── */}
        <View style={[styles.headerSection, { backgroundColor: bgCard, borderColor }]}>
          <View style={[styles.avatar, { backgroundColor: theme.navyDark, borderColor: theme.borderSubtle, borderWidth: 2, overflow: "hidden" }]}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../assets/inspector_demo.jpg")}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.nameText, { color: theme.navyDark }]}>{displayName}</Text>
          <Text style={[styles.designationText, { color: textMuted }]}>Field Inspection Officer</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.statusPill, { backgroundColor: isPureDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4", borderColor: isPureDark ? "rgba(34, 197, 94, 0.3)" : "#bbf7d0" }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.actionGreen }]} />
              <Text style={[styles.statusText, { color: isPureDark ? theme.actionGreen : "#166534" }]}>Active Official Duty</Text>
            </View>
            <View style={[styles.jurisdictionPill, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.jurisdictionText, { color: theme.textPrimary }]}>Odisha • Khordha Division</Text>
            </View>
          </View>
        </View>

        {/* ── Official Credentials Card ── */}
        <SectionHeader title="INSPECTOR CREDENTIALS" primary />
        <NetramCard style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Full Name</Text>
            <Text style={[styles.metaValueBold, { color: theme.navyDark }]}>{displayName}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Official Email</Text>
            <Text style={[styles.metaValue, { color: textPrimary }]}>{user?.email ?? "inspector.one@dev.netram.in"}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Officer ID</Text>
            <Text style={[styles.codeValue, { color: theme.accentBlue }]}>
              {user?.id ? `INSP-${user.id.slice(0, 8).toUpperCase()}` : "INSP-2024-8842"}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Department</Text>
            <Text style={[styles.metaValue, { color: textPrimary }]}>Social Justice & Empowerment</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Assigned District</Text>
            <Text style={[styles.metaValue, { color: textPrimary }]}>Khordha, Odisha</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Role</Text>
            <Text style={[styles.metaValue, { color: textPrimary }]}>Field Inspector</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: textMuted }]}>Status</Text>
            <Text style={[styles.verifiedValue, { color: theme.actionGreen }]}>Active</Text>
          </View>
        </NetramCard>

        {/* ── Sign Out Action Button ── */}
        <View style={styles.logoutWrapper}>
          <NetramButton
            label={loggingOut ? "Signing Out…" : "Sign Out"}
            variant="danger"
            loading={loggingOut}
            disabled={loggingOut}
            onPress={handleLogout}
          />
        </View>

        {/* ── Official Footer ── */}
        <View style={styles.footer}>
          <Text style={[styles.footerTitle, { color: theme.navyDark }]}>NETRAM</Text>
          <Text style={[styles.footerSub, { color: textMuted }]}>
            National Electronic Transparency, Risk Assessment & Monitoring
          </Text>
          <Text style={[styles.footerGov, { color: theme.textSubtle }]}>
            Government of India • Ministry of Social Justice & Empowerment
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgCanvas,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navyDark,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navyDark,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  headerSection: {
    alignItems: "center",
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 4,
    gap: 6,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.navyDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  nameText: {
    color: colors.navyDark,
    fontSize: 20,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  designationText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.actionGreen,
  },
  statusText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "600",
  },
  jurisdictionPill: {
    backgroundColor: colors.bgSubtle,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  jurisdictionText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "500",
  },
  card: {
    padding: 16,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    flex: 1.5,
  },
  metaValueBold: {
    color: colors.navyDark,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    flex: 1.5,
    textTransform: "capitalize",
  },
  codeValue: {
    color: colors.accentBlue,
    fontSize: 12,
    fontFamily: typography.mono,
    fontWeight: "700",
    textAlign: "right",
    flex: 1.5,
  },
  verifiedValue: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 4,
  },
  logoutWrapper: {
    marginTop: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 4,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.navyDark,
    fontFamily: typography.mono,
  },
  footerSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
  footerGov: {
    fontSize: 9,
    color: colors.textSubtle,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 2,
  },
});