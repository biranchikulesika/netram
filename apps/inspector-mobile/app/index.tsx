import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "../src/components/ui";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "../src/offline/queue";
import { useAuth } from "../src/auth/auth-context";
import { useSyncStatus } from "../src/offline/sync-context";
import { typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { seedDemoDataIfEmpty } from "../src/offline/demo-seed";
import { formatInspectionType } from "../src/utils/formatters";

export default function InspectorDashboardScreen() {
  const router = useRouter();
  const { client, user } = useAuth();
  const { theme } = useSettings();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);
  const { refreshPendingCount } = useSyncStatus();

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());

  const loadLocalState = useCallback(async () => {
    try {
      await seedDemoDataIfEmpty();
      const cached = await queue.getCachedInspections();
      setInspections(cached);
      const allOps = await queue.getAllOperations();
      const checkedSet = new Set(
        allOps
          .filter(
            (o) =>
              o.operation_type === "check_in" ||
              o.operation_type === "start_inspection",
          )
          .map((o) => o.inspection_id),
      );
      setCheckedInIds(checkedSet);
      const pending = await queue.getPendingOperations();
      setPendingCount(pending.length);
      void refreshPendingCount();
    } catch (err) {
      console.warn("Error reading SQLite local state:", err);
    }
  }, [queue, refreshPendingCount]);

  useEffect(() => {
    loadLocalState();
  }, [loadLocalState, client]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (client) {
        const page = await client.listInspections({ pageSize: 50 });
        if (page.items.length > 0) {
          await queue.cacheInspections(page.items);
        }
      }
      await loadLocalState();
    } catch {
      await loadLocalState();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncNow = async () => {
    if (!client) {
      Alert.alert("Offline Mode", "Please connect to network to synchronise.");
      return;
    }
    setSyncing(true);
    try {
      await queue.sync(client);
      await loadLocalState();
      Alert.alert("Sync Complete", "Inspections synchronised with central server.");
    } catch (err) {
      Alert.alert("Sync Error", err instanceof Error ? err.message : "Unable to reach server.");
    } finally {
      setSyncing(false);
    }
  };

  const officerName = user?.displayName || user?.email?.split("@")[0] || "Inspector";
  const _initials = officerName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "IN";

  const assignedCount = useMemo(
    () => inspections.filter((i) => i.status === "assigned").length,
    [inspections],
  );
  const inProgressCount = useMemo(
    () => inspections.filter((i) => i.status === "in_progress").length,
    [inspections],
  );
  const submittedCount = useMemo(
    () => inspections.filter((i) => i.status === "submitted").length,
    [inspections],
  );

  const currentTask = useMemo(() => {
    return (
      inspections.find((i) => i.status === "in_progress") ||
      inspections.find((i) => i.status === "assigned") ||
      inspections[0] ||
      null
    );
  }, [inspections]);

  // Color tokens
  const bgCanvas = theme.bgCanvas;
  const bgSurface = theme.bgSurface;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;
  const navyDark = theme.navyDark;
  const accentBlue = theme.accentBlue;

  const isCurrentTaskUnlocked =
    currentTask && (currentTask.status !== "assigned" || checkedInIds.has(currentTask.id));

  const currentTaskDate = currentTask
    ? currentTask.scheduled_start || currentTask.started_at || currentTask.cached_at
    : null;
  const currentTaskDateStr = currentTaskDate
    ? new Date(currentTaskDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Today";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      {/* ── Header Bar (web topbar parity) ── */}
      <View style={styles.headerBar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>DoSJE</Text>
          </View>
          <Text style={styles.brandTitle}>NETRAM</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={navyDark}
            colors={[navyDark]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats Strip ── */}
        <View style={[styles.statsRow, { borderColor }]}>
          <View
            style={[styles.statItem, { backgroundColor: bgSurface, borderRightWidth: 1, borderRightColor: borderColor }]}
          >
            <Text style={[styles.statCount, { color: navyDark }]}>{assignedCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>ASSIGNED</Text>
          </View>

          <View
            style={[styles.statItem, { backgroundColor: bgSurface, borderRightWidth: 1, borderRightColor: borderColor }]}
          >
            <Text style={[styles.statCount, { color: theme.gold }]}>{inProgressCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>IN PROGRESS</Text>
          </View>

          <Pressable
            style={[styles.statItem, { backgroundColor: bgSurface }]}
            onPress={() => router.push("/history")}
            accessibilityLabel="Submitted inspections"
          >
            <Text style={[styles.statCount, { color: theme.actionGreen }]}>{submittedCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>SUBMITTED</Text>
          </Pressable>
        </View>

        {/* ── Section Label ── */}
        <Text style={[styles.sectionLabel, { color: textMuted }]}>CURRENT ASSIGNMENT</Text>

        {/* ── Current Assignment Card ── */}
        {currentTask ? (
          <View style={[styles.assignmentCard, { backgroundColor: bgSurface, borderColor }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardStatusLabel, { color: textMuted }]}>
                {currentTask.status === "in_progress" ? "IN PROGRESS" : "NEXT ASSIGNMENT"}
              </Text>
              {currentTask.type ? (
                <Text style={[styles.headerType, { color: textMuted }]}>
                  {formatInspectionType(currentTask.type)}
                </Text>
              ) : null}
            </View>

            <Text style={[styles.facilityName, { color: textPrimary }]} numberOfLines={2}>
              {isCurrentTaskUnlocked
                ? currentTask.project_name
                : "Assigned Facility — Reach Site to Unlock"}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="location-outline" size={13} color={textMuted} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: textMuted }]}>
                  {currentTask.district_id || "District"}
                </Text>
              </View>
              {currentTask.project_code && (
                <View style={styles.metaItem}>
                  <Icon name="document-text-outline" size={13} color={textMuted} style={styles.metaIcon} />
                  <Text style={[styles.metaText, { color: textMuted }]}>
                    {currentTask.project_code}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Icon name="calendar-outline" size={13} color={textMuted} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: textMuted }]}>{currentTaskDateStr}</Text>
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: borderColor }]} />

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: navyDark }]}
                onPress={() => router.push(`/inspections/${currentTask.id}`)}
                accessibilityLabel={
                  currentTask.status === "in_progress"
                    ? "Continue inspection"
                    : "Start inspection"
                }
              >
                <Text style={styles.primaryBtnText}>
                  {currentTask.status === "in_progress"
                    ? "Continue Inspection"
                    : "Start Inspection"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.secondaryBtn, { borderColor }]}
                onPress={() =>
                  router.push({
                    pathname: "/check-in",
                    params: { inspectionId: currentTask.id },
                  })
                }
                accessibilityLabel="Open map for inspection site"
              >
                <Icon name="navigate-outline" size={16} color={navyDark} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: bgSurface, borderColor }]}>
            <Icon name="clipboard-outline" size={28} color={textMuted} />
            <Text style={[styles.emptyCardText, { color: textMuted }]}>
              No active assignments
            </Text>
          </View>
        )}

        {/* ── Sync Status (shown only while offline operations are pending) ── */}
        {pendingCount > 0 && (
          <View style={[styles.syncRow, { backgroundColor: bgSurface, borderColor }]}>
            <View style={styles.syncLeft}>
              <Icon name="cloud-upload-outline" size={16} color={accentBlue} style={styles.metaIcon} />
              <Text style={[styles.syncText, { color: textPrimary }]}>
                {`${pendingCount} pending offline operation${pendingCount === 1 ? "" : "s"}`}
              </Text>
            </View>

            <Pressable
              style={[styles.syncBtn, { backgroundColor: navyDark }]}
              onPress={handleSyncNow}
              disabled={syncing}
              accessibilityLabel="Sync now"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.syncBtnText}>Sync Now</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // ── Header (web topbar parity — ignore dark mode) ──
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandBadge: {
    backgroundColor: "#002449",
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  brandBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0c2a52",
    letterSpacing: 0.3,
  },
  // ── Scroll Content ──
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  // ── Stats Strip ──
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    gap: 3,
  },
  statCount: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: typography.mono,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  // ── Section Labels ──
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.0,
    marginTop: 4,
  },
  // ── Assignment Card ──
  assignmentCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerType: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 14,
  },
  cardStatusLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  facilityName: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23,
    height: 46,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaIcon: {
    marginTop: Platform.OS === "android" ? 0 : 1,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    includeFontPadding: false,
  },
  cardDivider: {
    height: 1,
    marginVertical: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    includeFontPadding: false,
  },
  secondaryBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
  },
  // ── Empty Card ──
  emptyCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // ── Sync Row ──
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  syncLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  syncText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    includeFontPadding: false,
  },
  syncBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 72,
    alignItems: "center",
  },
  syncBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
