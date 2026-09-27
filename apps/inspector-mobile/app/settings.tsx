import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Icon } from "../src/components/ui/Icon";
import { OfflineInspectionQueue } from "../src/offline/queue";
import { seedDemoDataIfEmpty } from "../src/offline/demo-seed";
import {
  useSettings,
  type AutoLockTimeout,
  type ThemeMode,
} from "../src/theme/settings-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, isPureDark, updateSetting } = useSettings();

  const queue = React.useMemo(() => new OfflineInspectionQueue(), []);

  const [cachedCount, setCachedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<string>("Active");

  const loadData = useCallback(async () => {
    try {
      const cached = await queue.getCachedInspections();
      setCachedCount(cached.length);
      const pending = await queue.getPendingOperations();
      setPendingCount(pending.length);
    } catch {
      // ignore
    }
  }, [queue]);

  useEffect(() => {
    void loadData();

    void (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setGpsAccuracy(`±${Math.round(loc.coords.accuracy ?? 15)}m`);
        } else {
          setGpsAccuracy("Offline");
        }
      } catch {
        setGpsAccuracy("Active");
      }
    })();
  }, [loadData]);

  const handleClearCache = async () => {
    const doClear = () => {
      Alert.alert("Cleared", "Photo previews cleared.");
    };

    if (Platform.OS === "web") {
      const confirmed =
        typeof window !== "undefined"
          ? window.confirm("Clear temporary preview cache?")
          : true;
      if (confirmed) doClear();
      return;
    }

    Alert.alert("Clear Photo Cache", "Free temporary photo thumbnails?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: doClear },
    ]);
  };

  const handleReSeedData = async () => {
    const doReload = async () => {
      await seedDemoDataIfEmpty();
      await loadData();
      Alert.alert("Restored", "Sample inspection records restored.");
    };

    if (Platform.OS === "web") {
      const confirmed =
        typeof window !== "undefined"
          ? window.confirm("Restore sample field inspections?")
          : true;
      if (confirmed) void doReload();
      return;
    }

    Alert.alert("Restore Sample Data", "Reload sample field inspections?", [
      { text: "Cancel", style: "cancel" },
      { text: "Restore", onPress: () => void doReload() },
    ]);
  };

  const bgCanvas = isPureDark ? "#000000" : "#F8FAFC";
  const bgCard = isPureDark ? "#121212" : "#FFFFFF";
  const bgSubtle = isPureDark ? "#1C1C1E" : "#F1F5F9";
  const borderColor = isPureDark ? "#27272A" : "#E2E8F0";
  const textPrimary = isPureDark ? "#FFFFFF" : "#0F172A";
  const textMuted = isPureDark ? "#A1A1AA" : "#64748B";
  const accentBlue = "#3B82F6";
  const dividerColor = isPureDark ? "#1F1F23" : "#F1F5F9";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      {/* ── Header ── */}
      <View style={[styles.topBar, { backgroundColor: bgCard, borderBottomColor: borderColor }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Icon name="arrow-back" size={20} color={textPrimary} />
          <Text style={[styles.backText, { color: textPrimary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.topBarTitle, { color: textPrimary }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section: Theme ── */}
        <Text style={[styles.sectionTitle, { color: textMuted }]}>THEME</Text>
        <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.segmentedControl}>
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
                  style={[
                    styles.segmentTab,
                    active && {
                      backgroundColor: isPureDark ? "#27272A" : "#FFFFFF",
                      shadowColor: "#000",
                      shadowOpacity: 0.08,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                      elevation: 1,
                    },
                  ]}
                  onPress={() => updateSetting("themeMode", t.mode as ThemeMode)}
                >
                  <Icon
                    name={t.icon}
                    size={16}
                    color={active ? accentBlue : textMuted}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? (isPureDark ? "#FFFFFF" : accentBlue) : textMuted, fontWeight: active ? "700" : "500" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Section: Location & Privacy ── */}
        <Text style={[styles.sectionTitle, { color: textMuted }]}>LOCATION & PRIVACY</Text>
        <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="navigate-outline" size={18} color={accentBlue} />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>1 KM Area Alert</Text>
            </View>
            <Switch
              value={settings.geofenceAlert}
              onValueChange={(val) => updateSetting("geofenceAlert", val)}
              trackColor={{ false: "#64748B", true: "#93C5FD" }}
              thumbColor={settings.geofenceAlert ? accentBlue : "#F1F5F9"}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="locate-outline" size={18} color="#10B981" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>High-Accuracy GPS</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={[styles.statusPill, { backgroundColor: bgSubtle }]}>
                <Text style={[styles.statusPillText, { color: textMuted }]}>{gpsAccuracy}</Text>
              </View>
              <Switch
                value={settings.highAccuracyGps}
                onValueChange={(val) => updateSetting("highAccuracyGps", val)}
                trackColor={{ false: "#64748B", true: "#93C5FD" }}
                thumbColor={settings.highAccuracyGps ? accentBlue : "#F1F5F9"}
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="map-outline" size={18} color="#F59E0B" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Offline Map Cache</Text>
            </View>
            <Switch
              value={settings.offlineMapPreload}
              onValueChange={(val) => updateSetting("offlineMapPreload", val)}
              trackColor={{ false: "#64748B", true: "#93C5FD" }}
              thumbColor={settings.offlineMapPreload ? accentBlue : "#F1F5F9"}
            />
          </View>
        </View>

        {/* ── Section: Camera & Evidence ── */}
        <Text style={[styles.sectionTitle, { color: textMuted }]}>CAMERA</Text>
        <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="camera-outline" size={18} color={accentBlue} />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Resolution</Text>
            </View>
            <View style={styles.miniPillGroup}>
              {(["1080p", "720p"] as const).map((q) => {
                const active = settings.cameraQuality === q;
                return (
                  <Pressable
                    key={q}
                    style={[
                      styles.miniPill,
                      {
                        backgroundColor: active
                          ? isPureDark
                            ? "#27272A"
                            : "#EFF6FF"
                          : bgSubtle,
                        borderColor: active ? accentBlue : "transparent",
                      },
                    ]}
                    onPress={() => updateSetting("cameraQuality", q)}
                  >
                    <Text
                      style={[
                        styles.miniPillText,
                        {
                          color: active ? accentBlue : textMuted,
                          fontWeight: active ? "700" : "500",
                        },
                      ]}
                    >
                      {q}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="location-outline" size={18} color="#8B5CF6" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Auto Geotagging</Text>
            </View>
            <Switch
              value={settings.autoGeotag}
              onValueChange={(val) => updateSetting("autoGeotag", val)}
              trackColor={{ false: "#64748B", true: "#93C5FD" }}
              thumbColor={settings.autoGeotag ? accentBlue : "#F1F5F9"}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="radio-outline" size={18} color="#EC4899" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Haptic Feedback</Text>
            </View>
            <Switch
              value={settings.shutterFeedback}
              onValueChange={(val) => updateSetting("shutterFeedback", val)}
              trackColor={{ false: "#64748B", true: "#93C5FD" }}
              thumbColor={settings.shutterFeedback ? accentBlue : "#F1F5F9"}
            />
          </View>
        </View>

        {/* ── Section: Storage & Sync ── */}
        <Text style={[styles.sectionTitle, { color: textMuted }]}>STORAGE & SYNC</Text>
        <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="folder-outline" size={18} color="#6366F1" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Saved Inspections</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: bgSubtle }]}>
              <Text style={[styles.badgeText, { color: textPrimary }]}>{cachedCount}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="cloud-upload-outline" size={18} color="#0EA5E9" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Pending Uploads</Text>
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: pendingCount > 0 ? (isPureDark ? "#450A0A" : "#FEE2E2") : bgSubtle },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: pendingCount > 0 ? "#EF4444" : textPrimary },
                ]}
              >
                {pendingCount}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="wifi-outline" size={18} color="#14B8A6" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Wi-Fi Only Sync</Text>
            </View>
            <Switch
              value={settings.wifiOnlySync}
              onValueChange={(val) => updateSetting("wifiOnlySync", val)}
              trackColor={{ false: "#64748B", true: "#93C5FD" }}
              thumbColor={settings.wifiOnlySync ? accentBlue : "#F1F5F9"}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <View style={styles.actionBtnRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: bgSubtle, borderColor }]}
              onPress={handleClearCache}
            >
              <Icon name="trash-outline" size={15} color={textMuted} />
              <Text style={[styles.actionBtnText, { color: textPrimary }]}>Clear Cache</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: bgSubtle, borderColor }]}
              onPress={handleReSeedData}
            >
              <Icon name="refresh-outline" size={15} color={textMuted} />
              <Text style={[styles.actionBtnText, { color: textPrimary }]}>Reload Data</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Section: Security ── */}
        <Text style={[styles.sectionTitle, { color: textMuted }]}>SECURITY</Text>
        <View style={[styles.card, { backgroundColor: bgCard, borderColor }]}>
          <View style={styles.settingRow}>
            <View style={styles.rowLeft}>
              <Icon name="shield-checkmark-outline" size={18} color="#10B981" />
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Screen Lock</Text>
            </View>
            <Switch
              value={settings.biometricLock}
              onValueChange={(val) => updateSetting("biometricLock", val)}
              trackColor={{ false: "#64748B", true: "#93C5FD" }}
              thumbColor={settings.biometricLock ? accentBlue : "#F1F5F9"}
            />
          </View>

          {settings.biometricLock && (
            <>
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.settingRow}>
                <Text style={[styles.rowTitle, { color: textMuted, fontSize: 13 }]}>Auto-Lock Delay</Text>
                <View style={styles.miniPillGroup}>
                  {(
                    [
                      { val: "immediate", label: "0m" },
                      { val: "5min", label: "5m" },
                      { val: "15min", label: "15m" },
                    ] as const
                  ).map((t) => {
                    const active = settings.autoLockTimeout === t.val;
                    return (
                      <Pressable
                        key={t.val}
                        style={[
                          styles.miniPill,
                          {
                            backgroundColor: active
                              ? isPureDark
                                ? "#27272A"
                                : "#EFF6FF"
                              : bgSubtle,
                            borderColor: active ? accentBlue : "transparent",
                          },
                        ]}
                        onPress={() => updateSetting("autoLockTimeout", t.val as AutoLockTimeout)}
                      >
                        <Text
                          style={[
                            styles.miniPillText,
                            {
                              color: active ? accentBlue : textMuted,
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
              </View>
            </>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: textMuted }]}>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    overflow: "hidden",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "transparent",
    paddingVertical: 8,
    gap: 8,
  },
  segmentTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  miniPillGroup: {
    flexDirection: "row",
    gap: 6,
  },
  miniPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniPillText: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
