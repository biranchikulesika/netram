import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon, NetramBadge } from "../src/components/ui";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "../src/offline/queue";
import { useAuth } from "../src/auth/auth-context";
import { useSyncStatus } from "../src/offline/sync-context";
import { typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { seedDemoDataIfEmpty } from "../src/offline/demo-seed";

export default function InspectorDashboardScreen() {
  const router = useRouter();
  const { client, user } = useAuth();
  const { theme, isPureDark } = useSettings();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);
  const { refreshPendingCount } = useSyncStatus();

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
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
    if (client) {
      client
        .listNotifications({ pageSize: 1 })
        .then((res) => setUnreadNotifications(res.unread ?? 0))
        .catch(() => {});
    }
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
      router.push("/sync");
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
  const bgSubtle = isPureDark ? "#18181B" : theme.bgSubtle;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;
  const navyDark = theme.navyDark;
  const accentBlue = theme.accentBlue;

  const isCurrentTaskUnlocked =
    currentTask && (currentTask.status !== "assigned" || checkedInIds.has(currentTask.id));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      {/* ── Header Bar ── */}
      <View style={[styles.headerBar, { backgroundColor: navyDark }]}>
        <View style={styles.brandGroup}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require("../assets/ashoka_stambh.png")}
            style={styles.emblemImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.appTitle}>NETRAM</Text>
            <Text style={styles.appSubtitle}>Field Inspector Portal</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => router.push("/notifications")}
            accessibilityLabel="Notifications"
          >
            <Icon name="notifications-outline" size={20} color="#FFFFFF" />
            {unreadNotifications > 0 && <View style={styles.notifDot} />}
          </Pressable>

          <Pressable
            style={styles.avatarBtn}
            onPress={() => router.push("/profile")}
            accessibilityLabel="Profile"
          >
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../assets/inspector_demo.jpg")}
              style={styles.avatarThumb}
              resizeMode="cover"
            />
          </Pressable>
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
          <Pressable
            style={[styles.statItem, { backgroundColor: bgSurface, borderRightWidth: 1, borderRightColor: borderColor }]}
            onPress={() => router.push({ pathname: "/inspections", params: { tab: "ASSIGNED" } })}
            accessibilityLabel="Assigned inspections"
          >
            <Text style={[styles.statCount, { color: navyDark }]}>{assignedCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>ASSIGNED</Text>
          </Pressable>

          <Pressable
            style={[styles.statItem, { backgroundColor: bgSurface, borderRightWidth: 1, borderRightColor: borderColor }]}
            onPress={() => router.push({ pathname: "/inspections", params: { tab: "IN_PROGRESS" } })}
            accessibilityLabel="In-progress inspections"
          >
            <Text style={[styles.statCount, { color: theme.gold }]}>{inProgressCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>IN PROGRESS</Text>
          </Pressable>

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
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      currentTask.status === "in_progress"
                        ? theme.gold
                        : accentBlue,
                  },
                ]}
              />
              <Text style={[styles.cardStatusLabel, { color: textMuted }]}>
                {currentTask.status === "in_progress" ? "IN PROGRESS" : "NEXT ASSIGNMENT"}
              </Text>
              <View style={styles.flex1} />
              <NetramBadge
                label={currentTask.status.replace(/_/g, " ").toUpperCase()}
                variant="status"
                status={currentTask.status}
                size="sm"
              />
            </View>

            <Text style={[styles.facilityName, { color: textPrimary }]} numberOfLines={2}>
              {isCurrentTaskUnlocked
                ? currentTask.project_name
                : "Assigned Facility — Reach Site to Unlock"}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="location-outline" size={13} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>
                  {currentTask.district_id || "District"}
                </Text>
              </View>
              {currentTask.project_code && (
                <View style={styles.metaItem}>
                  <Icon name="document-text-outline" size={13} color={textMuted} />
                  <Text style={[styles.metaText, { color: textMuted }]}>
                    {currentTask.project_code}
                  </Text>
                </View>
              )}
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
                <Icon name="clipboard-outline" size={15} color="#FFFFFF" />
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
                <Icon name="navigate-outline" size={15} color={navyDark} />
                <Text style={[styles.secondaryBtnText, { color: navyDark }]}>Map</Text>
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

        {/* ── Section Label ── */}
        <Text style={[styles.sectionLabel, { color: textMuted }]}>FIELD SCHEDULE</Text>

        {/* ── All Assignments Navigation ── */}
        <Pressable
          style={[styles.navCard, { backgroundColor: bgSurface, borderColor }]}
          onPress={() => router.push({ pathname: "/inspections", params: { tab: "ASSIGNED" } })}
          accessibilityLabel="View all field assignments"
        >
          <View style={[styles.navIconBox, { backgroundColor: bgSubtle }]}>
            <Icon name="list-outline" size={20} color={navyDark} />
          </View>
          <View style={styles.navCardContent}>
            <Text style={[styles.navCardTitle, { color: textPrimary }]}>
              All Field Assignments
            </Text>
            <Text style={[styles.navCardSub, { color: textMuted }]}>
              {assignedCount + inProgressCount > 0
                ? `${assignedCount + inProgressCount} active — tap to view schedule`
                : "View scheduled inspection tasks"}
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color={textMuted} />
        </Pressable>

        {/* ── Sync Status ── */}
        <View style={[styles.syncRow, { backgroundColor: bgSurface, borderColor }]}>
          <View style={styles.syncLeft}>
            <Icon
              name={
                pendingCount > 0 ? "cloud-upload-outline" : "checkmark-circle-outline"
              }
              size={16}
              color={pendingCount > 0 ? accentBlue : theme.actionGreen}
            />
            <Text style={[styles.syncText, { color: textPrimary }]}>
              {pendingCount > 0
                ? `${pendingCount} pending offline operation${pendingCount === 1 ? "" : "s"}`
                : "Offline data synchronised"}
            </Text>
          </View>

          {pendingCount > 0 && (
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
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // ── Header ──
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emblemImage: {
    width: 26,
    height: 26,
    tintColor: "#FFFFFF",
  },
  appTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  appSubtitle: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
    marginTop: 1,
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarThumb: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  // ── Scroll Content ──
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
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
    fontSize: 22,
    fontWeight: "800",
    fontFamily: typography.mono,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  // ── Section Labels ──
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.0,
    marginTop: 6,
    marginBottom: -2,
  },
  // ── Assignment Card ──
  assignmentCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardStatusLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  flex1: {
    flex: 1,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  cardDivider: {
    height: 1,
    marginVertical: 2,
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
    paddingVertical: 10,
    borderRadius: 6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // ── Empty Card ──
  emptyCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: "500",
  },
  // ── Nav Card ──
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  navIconBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  navCardContent: {
    flex: 1,
    gap: 2,
  },
  navCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  navCardSub: {
    fontSize: 12,
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
    fontWeight: "500",
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
