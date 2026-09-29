import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Icon } from "../src/components/ui/Icon";
import { NetramCard } from "../src/components/ui/NetramCard";
import { SectionHeader } from "../src/components/ui/SectionHeader";
import {
  useSettings,
  type ThemeMode,
} from "../src/theme/settings-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, theme, isPureDark, updateSetting } = useSettings();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bgCanvas }]}>
      <Tabs.Screen
        options={{
          tabBarStyle: { display: "none" },
        }}
      />

      {/* ── Header ── */}
      <View style={[styles.topBar, { backgroundColor: theme.bgSurface, borderBottomColor: theme.borderSubtle }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <Icon name="chevron-back" size={24} color={theme.navyDark} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: theme.navyDark }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section: Theme ── */}
        <SectionHeader title="THEME" primary />
        <NetramCard style={styles.card}>
          <View style={[styles.segmentedControl, { backgroundColor: theme.bgSubtle }]}>
            {(
              [
                { mode: "light", label: "Light", icon: "sunny-outline" },
                { mode: "dark", label: "Dark", icon: "moon" },
                { mode: "system", label: "System", icon: "phone-portrait-outline" },
              ] as const
            ).map((t) => {
              const active = settings.themeMode === t.mode;
              return (
                <Pressable
                  key={t.mode}
                  style={({ pressed }) => [
                    styles.segmentTab,
                    active && [
                      styles.segmentTabActive,
                      {
                        backgroundColor: theme.bgSurface,
                        borderColor: isPureDark ? theme.borderSubtle : "rgba(0,0,0,0.06)",
                      },
                    ],
                    !active && pressed && { opacity: 0.6 },
                  ]}
                  onPress={() => updateSetting("themeMode", t.mode as ThemeMode)}
                >
                  <Icon
                    name={t.icon}
                    size={16}
                    color={active ? theme.accentBlue : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active ? (isPureDark ? "#FFFFFF" : theme.navyDark) : theme.textMuted,
                        fontWeight: active ? "700" : "500",
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </NetramCard>

        {/* ── Section: Storage & Sync ── */}
        <SectionHeader title="STORAGE & SYNC" primary />
        <NetramCard style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconCol}>
                <Icon name="wifi-outline" size={18} color={theme.actionGreen} />
              </View>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Wi-Fi Only Sync</Text>
            </View>
            <Switch
              value={settings.wifiOnlySync}
              onValueChange={(val) => updateSetting("wifiOnlySync", val)}
              trackColor={{
                false: isPureDark ? "#3F3F46" : "#E2E8F0",
                true: isPureDark ? "#2563EB" : "#93C5FD",
              }}
              thumbColor={
                settings.wifiOnlySync
                  ? isPureDark
                    ? "#60A5FA"
                    : theme.accentBlue
                  : isPureDark
                    ? "#71717A"
                    : "#FFFFFF"
              }
            />
          </View>
        </NetramCard>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Netram Field Inspector • Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 36,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  card: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 0,
  },
  segmentedControl: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 8,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  segmentTabActive: {
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCol: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
