import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  OfflineInspectionQueue,
  type CachedInspectionRecord,
  type PendingMediaUploadRecord,
} from "../src/offline/queue";
import { useAuth } from "../src/auth/auth-context";
import { useSyncStatus } from "../src/offline/sync-context";
import { typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { formatInspectionType } from "../src/utils/formatters";

/** Single consumer, so this stays local rather than in shared formatters. */
function formatBytes(bytes: number): string {
  if (!bytes) return "-";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function InspectorDashboardScreen() {
  const router = useRouter();
  const { client, user } = useAuth();
  const { theme } = useSettings();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);
  const { refreshPendingCount } = useSyncStatus();

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaUploadRecord[]>([]);
  const [showUploads, setShowUploads] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocalState = useCallback(async () => {
    try {
      const cached = await queue.getCachedInspections();
      setInspections(cached);
      const pending = await queue.getPendingOperations();
      setPendingCount(pending.length);
      setPendingMedia(await queue.getPendingMediaUploads());
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
      setShowUploads(false);
      Alert.alert("Sync Complete", "Inspections synchronised with central server.");
    } catch (err) {
      Alert.alert("Sync Error", err instanceof Error ? err.message : "Unable to reach server.");
    } finally {
      setSyncing(false);
    }
  };

  const officerName = user?.displayName || user?.email?.split("@")[0] || "Inspector";
  const _initials =
    officerName
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

  const totalBytes = useMemo(
    () => pendingMedia.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0),
    [pendingMedia],
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
          <Text style={[styles.brandTitle, { color: theme.navyDark }]}>NETRAM</Text>
        </View>

        {pendingCount > 0 ? (
          <Pressable
            style={[styles.uploadBtn, { borderColor }]}
            onPress={() => setShowUploads(true)}
            accessibilityRole="button"
            accessibilityLabel={`Pending uploads, ${pendingCount} operation${pendingCount === 1 ? "" : "s"}`}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={accentBlue} />
            ) : (
              <Icon name="cloud-upload-outline" size={18} color={accentBlue} />
            )}
            <View style={[styles.uploadBadge, { backgroundColor: navyDark }]}>
              <Text style={styles.uploadBadgeText}>{pendingCount}</Text>
            </View>
          </Pressable>
        ) : null}
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
            style={[
              styles.statItem,
              { backgroundColor: bgSurface, borderRightWidth: 1, borderRightColor: borderColor },
            ]}
          >
            <Text style={[styles.statCount, { color: navyDark }]}>{assignedCount}</Text>
            <Text style={[styles.statLabel, { color: textMuted }]}>ASSIGNED</Text>
          </View>

          <View
            style={[
              styles.statItem,
              { backgroundColor: bgSurface, borderRightWidth: 1, borderRightColor: borderColor },
            ]}
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
              {currentTask.project_name}
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
                  <Icon
                    name="document-text-outline"
                    size={13}
                    color={textMuted}
                    style={styles.metaIcon}
                  />
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
                  currentTask.status === "in_progress" ? "Continue inspection" : "Start inspection"
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
            <Text style={[styles.emptyCardText, { color: textMuted }]}>No active assignments</Text>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL: files queued for upload ── */}
      <Modal
        visible={showUploads}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploads(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: bgSurface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: borderColor }]} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={[styles.sheetTitle, { color: textPrimary }]}>Pending uploads</Text>
                <Text style={[styles.sheetSubtitle, { color: textMuted }]}>
                  {pendingMedia.length > 0
                    ? `${pendingMedia.length} file${pendingMedia.length === 1 ? "" : "s"} · ${formatBytes(totalBytes)}`
                    : "No files waiting"}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowUploads(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close pending uploads"
              >
                <Icon name="close" size={22} color={textMuted} />
              </Pressable>
            </View>

            {pendingMedia.length > 0 ? (
              <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                {pendingMedia.map((file) => (
                  <View key={file.id} style={styles.fileRow}>
                    <View style={[styles.fileIconTile, { backgroundColor: theme.bgSubtle }]}>
                      <Icon
                        name={
                          file.mime_type.startsWith("video") ? "videocam-outline" : "image-outline"
                        }
                        size={16}
                        color={accentBlue}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text style={[styles.fileName, { color: textPrimary }]} numberOfLines={1}>
                        {file.file_name}
                      </Text>
                      <Text style={[styles.fileMeta, { color: textMuted }]}>
                        {formatBytes(file.file_size_bytes)} ·{" "}
                        {new Date(file.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Pressable
              style={[styles.syncBtn, { backgroundColor: navyDark }]}
              onPress={handleSyncNow}
              disabled={syncing}
              accessibilityLabel="Sync now"
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="cloud-upload-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.syncBtnText}>Sync Now</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // ── Header (web topbar parity - ignore dark mode) ──
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
  // ── Header upload indicator ──
  uploadBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    borderWidth: 1,
  },
  uploadBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    includeFontPadding: false,
  },
  // ── Pending uploads sheet ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 14,
    maxHeight: "70%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetHeaderText: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  sheetSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
  sheetList: {
    flexGrow: 0,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  fileIconTile: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
    gap: 1,
  },
  fileName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  fileMeta: {
    fontSize: 11,
    lineHeight: 15,
    includeFontPadding: false,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    borderRadius: 8,
  },
  syncBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
