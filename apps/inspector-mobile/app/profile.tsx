import React from "react";
import {
  ActivityIndicator,
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
  NetramCard,
  SectionHeader,
} from "../src/components/ui";
import { useAuth } from "../src/auth/auth-context";
import { useSettings } from "../src/theme/settings-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme } = useSettings();
  const [loggingOut, setLoggingOut] = React.useState(false);

  // RootLayout swaps to the login screen once the token is cleared.
  const handleLogout = React.useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }, [logout]);

  const bgCanvas = theme.bgCanvas;
  const bgCard = theme.bgSurface;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;

  const emailPrefix = user?.email?.split("@")[0];
  const displayName =
    user?.displayName ||
    (emailPrefix ? emailPrefix.replace(/[._-]/g, " ") : "Inspector");
  const officerId = user?.id ? `INSP-${user.id.slice(0, 8).toUpperCase()}` : "-";
  const initials =
    displayName
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "IN";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Officer Identity Hero Card ── */}
        <View style={[styles.heroCard, { backgroundColor: bgCard, borderColor }]}>
          <View style={[styles.avatar, { borderColor: theme.borderSubtle, backgroundColor: theme.navyDark }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={[styles.nameText, { color: theme.navyDark }]}>{displayName}</Text>
          <Text style={[styles.officerIdText, { color: theme.accentBlue }]}>{officerId}</Text>
        </View>

        {/* ── Officer Details (Clean, Non-Redundant) ── */}
        <SectionHeader title="OFFICER DETAILS" primary />
        <NetramCard style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.infoRow}>
            <View style={styles.iconCol}>
              <Icon name="mail-outline" size={17} color={textMuted} />
            </View>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: textMuted }]}>Official Email</Text>
              <Text style={[styles.infoValue, { color: textPrimary }]}>
                {user?.email ?? "-"}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.infoRow}>
            <View style={styles.iconCol}>
              <Icon name="person-outline" size={17} color={textMuted} />
            </View>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: textMuted }]}>Designation</Text>
              <Text style={[styles.infoValue, { color: textPrimary }]}>
                {user ? `Field Inspection Officer (${user.type})` : "-"}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.infoRow}>
            <View style={styles.iconCol}>
              <Icon name="business-outline" size={17} color={textMuted} />
            </View>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: textMuted }]}>Account Type</Text>
              <Text style={[styles.infoValue, { color: textPrimary }]}>
                {user?.type ?? "-"}
              </Text>
            </View>
          </View>
        </NetramCard>

        {/* ── Preferences & System ── */}
        <SectionHeader title="PREFERENCES & SYSTEM" primary />
        <NetramCard style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/settings")}
          >
            <View style={styles.iconCol}>
              <Icon name="settings-outline" size={18} color={theme.accentBlue} />
            </View>
            <View style={styles.actionCol}>
              <Text style={[styles.actionTitle, { color: textPrimary }]}>App Settings</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={textMuted} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
          >
            <View style={styles.iconCol}>
              <Icon name="log-out-outline" size={18} color={theme.error} />
            </View>
            <View style={styles.actionCol}>
              <Text style={[styles.actionTitle, { color: theme.error }]}>
                {loggingOut ? "Signing Out…" : "Sign Out"}
              </Text>
            </View>
            {loggingOut ? (
              <ActivityIndicator size="small" color={theme.error} />
            ) : (
              <Icon name="chevron-forward" size={16} color={textMuted} />
            )}
          </Pressable>
        </NetramCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgCanvas,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 22,
    paddingHorizontal: 16,
    gap: 4,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.navyDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
  },
  nameText: {
    color: colors.navyDark,
    fontSize: 20,
    fontWeight: "700",
    textTransform: "capitalize",
    letterSpacing: -0.3,
  },
  officerIdText: {
    fontSize: 12,
    fontFamily: typography.mono,
    fontWeight: "700",
    color: colors.accentBlue,
  },
  card: {
    padding: 14,
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  iconCol: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCol: {
    flex: 1,
    gap: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  actionCol: {
    flex: 1,
    gap: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginVertical: 4,
  },
});