import React from "react";
import {
  Image,
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
  const { user } = useAuth();
  const { theme } = useSettings();

  const bgCanvas = theme.bgCanvas;
  const bgCard = theme.bgSurface;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;

  const emailPrefix = user?.email?.split("@")[0];
  const displayName =
    user?.displayName ||
    (emailPrefix ? emailPrefix.replace(/[._-]/g, " ") : "Rajkumar G.");
  const officerId = user?.id ? `INSP-${user.id.slice(0, 8).toUpperCase()}` : "INSP-2024-8842";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Officer Identity Hero Card ── */}
        <View style={[styles.heroCard, { backgroundColor: bgCard, borderColor }]}>
          <View style={[styles.avatar, { borderColor: theme.borderSubtle }]}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../assets/inspector_demo.jpg")}
              style={styles.avatarImage}
              resizeMode="cover"
            />
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
                {user?.email ?? "inspector@netram.dev"}
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
              <Text style={[styles.infoValue, { color: textPrimary }]}>Field Inspection Officer</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.infoRow}>
            <View style={styles.iconCol}>
              <Icon name="business-outline" size={17} color={textMuted} />
            </View>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: textMuted }]}>Department</Text>
              <Text style={[styles.infoValue, { color: textPrimary }]}>
                Ministry of Social Justice & Empowerment
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />

          <View style={styles.infoRow}>
            <View style={styles.iconCol}>
              <Icon name="location-outline" size={17} color={textMuted} />
            </View>
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: textMuted }]}>Assigned District</Text>
              <Text style={[styles.infoValue, { color: textPrimary }]}>Khordha, Odisha</Text>
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
              <Text style={[styles.actionSubtitle, { color: textMuted }]}>Theme, auto-lock & diagnostics</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={textMuted} />
          </Pressable>
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
  actionSubtitle: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginVertical: 4,
  },
  logoutWrapper: {
    marginTop: 6,
  },
});