import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { OfflineInspectionQueue } from "../src/offline/queue.js";
import type { CachedInspectionRecord } from "../src/offline/queue.js";
import { useAuth } from "./_layout";

export default function InspectorHomeScreen() {
  const router = useRouter();
  const { client, user } = useAuth();

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocalState = useCallback(async () => {
    const cached = await queue.getCachedInspections();
    setInspections(cached);

    const pending = await queue.getPendingOperations();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    loadLocalState();
  }, [loadLocalState]);

  const handleFetchFromServer = async () => {
    if (!client) {
      setSyncMessage("API client unavailable.");
      return;
    }

    setRefreshing(true);
    setSyncMessage(null);

    try {
      const page = await client.listInspections({ pageSize: 50 });
      await queue.cacheInspections(page.items);
      await loadLocalState();

      setSyncMessage(`Updated ${page.items.length} inspections from server.`);
    } catch (err) {
      setSyncMessage(
        `Offline mode: using local inspection data. ${err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncQueue = async () => {
    if (!client) {
      setSyncMessage("API client unavailable.");
      return;
    }

    setSyncing(true);
    setSyncMessage(null);

    try {
      const summary = await queue.sync(client);
      await loadLocalState();

      const parts = [`${summary.synced} operations synced`];

      if (summary.mediaUploaded > 0) {
        parts.push(`${summary.mediaUploaded} media uploaded`);
      }

      if (summary.conflicts > 0) {
        parts.push(`${summary.conflicts} conflicts`);
      }

      if (summary.rejected > 0) {
        parts.push(`${summary.rejected} rejected`);
      }

      if (
        summary.synced === 0 &&
        summary.mediaUploaded === 0 &&
        summary.conflicts === 0 &&
        summary.rejected === 0
      ) {
        setSyncMessage("Everything is already synchronized.");
      } else {
        setSyncMessage(`Sync complete: ${parts.join(" • ")}`);
      }
    } catch (err) {
      setSyncMessage(
        `Sync failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSyncing(false);
    }
  };

  const inspectorName =
    user?.email?.split("@")[0]?.replace(/[._-]/g, " ") ?? "Inspector";

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={inspections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleFetchFromServer}
            tintColor="#14B8A6"
          />
        }
        ListHeaderComponent={
          <>
            {/* Top bar */}
            <View style={styles.topBar}>
              <View style={styles.brandRow}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoText}>N</Text>
                  <View style={styles.logoCheck} />
                </View>

                <View>
                  <Text style={styles.brandName}>NETRAM</Text>
                  <Text style={styles.brandSubtitle}>
                    FIELD OPERATIONS
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.profileCircle}
                onPress={() => router.push("/profile")}
              >
                <Text style={styles.profileInitial}>
                  {inspectorName.charAt(0).toUpperCase()}
                </Text>
              </Pressable>
            </View>

            {/* Welcome */}
            <View style={styles.welcomeBlock}>
              <Text style={styles.eyebrow}>INSPECTOR DASHBOARD</Text>

              <Text style={styles.welcomeTitle}>
                Welcome back, {inspectorName.split(" ")[0]}
              </Text>

              <Text style={styles.welcomeSubtitle}>
                Your field operations at a glance.
              </Text>
            </View>

            {/* Sync status */}
            <View style={styles.syncCard}>
              <View style={styles.syncTopRow}>
                <View style={styles.syncIcon}>
                  <Text style={styles.syncIconText}>↻</Text>
                </View>

                <View style={styles.syncInfo}>
                  <View style={styles.syncTitleRow}>
                    <Text style={styles.syncTitle}>Sync status</Text>

                    <View
                      style={[
                        styles.connectionBadge,
                        pendingCount > 0
                          ? styles.connectionPending
                          : styles.connectionGood,
                      ]}
                    >
                      <View
                        style={[
                          styles.connectionDot,
                          pendingCount > 0
                            ? styles.pendingDot
                            : styles.goodDot,
                        ]}
                      />

                      <Text style={styles.connectionText}>
                        {pendingCount > 0 ? "PENDING" : "READY"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.syncSubtitle}>
                    {pendingCount === 0
                      ? "All local operations are synchronized."
                      : `${pendingCount} operation${pendingCount === 1 ? "" : "s"
                      } waiting to sync.`}
                  </Text>
                </View>
              </View>

              {/* Sync Queue button */}
              <Pressable
                style={[
                  styles.primaryButton,
                  syncing && styles.primaryButtonDisabled,
                ]}
                onPress={handleSyncQueue}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      Sync Queue
                    </Text>

                    <Text style={styles.primaryButtonArrow}>→</Text>
                  </>
                )}
              </Pressable>

              {syncMessage && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>
                    {syncMessage}
                  </Text>
                </View>
              )}

              <View style={styles.quickLinks}>
                <Pressable onPress={() => router.push("/sync")}>
                  <Text style={styles.quickLink}>
                    View sync details
                  </Text>
                </Pressable>

                <View style={styles.linkDivider} />

                <Pressable onPress={() => router.push("/check-in")}>
                  <Text style={styles.quickLink}>
                    Field check-in
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Quick actions */}
            <View style={styles.quickActionRow}>
              <Pressable
                style={styles.quickAction}
                onPress={() => router.push("/inspections")}
              >
                <View style={styles.actionIconBlue}>
                  <Text style={styles.actionIconText}>▣</Text>
                </View>

                <View>
                  <Text style={styles.actionTitle}>
                    Inspections
                  </Text>

                  <Text style={styles.actionSubtitle}>
                    View assigned work
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.quickAction}
                onPress={() => router.push("/check-in")}
              >
                <View style={styles.actionIconTeal}>
                  <Text style={styles.actionIconText}>⌖</Text>
                </View>

                <View>
                  <Text style={styles.actionTitle}>
                    Check-in
                  </Text>

                  <Text style={styles.actionSubtitle}>
                    Field guidance
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  FIELD WORK
                </Text>

                <Text style={styles.sectionTitle}>
                  Assigned inspections
                </Text>
              </View>

              <Pressable
                onPress={handleFetchFromServer}
                disabled={refreshing}
                style={styles.refreshButton}
              >
                <Text style={styles.refreshIcon}>↻</Text>

                <Text style={styles.refreshText}>
                  {refreshing ? "Updating" : "Refresh"}
                </Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.inspectionCard,
              pressed && styles.inspectionCardPressed,
            ]}
            onPress={() => router.push(`/inspections/${item.id}`)}
          >
            <View style={styles.inspectionTopRow}>
              <View style={styles.typeRow}>
                <View
                  style={[
                    styles.typeTag,
                    item.type === "surprise"
                      ? styles.surpriseTag
                      : styles.routineTag,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeTagText,
                      item.type === "surprise"
                        ? styles.surpriseText
                        : styles.routineText,
                    ]}
                  >
                    {item.type.toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.projectCode}>
                  {item.project_code}
                </Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  getStatusStyle(item.status),
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    getStatusTextStyle(item.status),
                  ]}
                >
                  {item.status.replace("_", " ")}
                </Text>
              </View>
            </View>

            <Text style={styles.projectName}>
              {item.project_name}
            </Text>

            <View style={styles.idRow}>
              <Text style={styles.idLabel}>
                INSPECTION ID
              </Text>

              <Text style={styles.idValue}>
                {item.id}
              </Text>
            </View>

            <View style={styles.inspectionDivider} />

            <View style={styles.inspectionBottomRow}>
              <View>
                <Text style={styles.dateLabel}>
                  SCHEDULED
                </Text>

                <Text style={styles.dateValue}>
                  {item.scheduled_start
                    ? new Date(
                      item.scheduled_start
                    ).toLocaleDateString()
                    : "Unscheduled"}
                </Text>
              </View>

              <View style={styles.openFileButton}>
                <Text style={styles.openFileText}>
                  Open field file
                </Text>

                <Text style={styles.openFileArrow}>
                  →
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>▣</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No cached inspections
            </Text>

            <Text style={styles.emptyText}>
              Connect to the server and refresh to download your
              assigned inspections.
            </Text>

            <Pressable
              style={styles.emptyButton}
              onPress={handleFetchFromServer}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.emptyButtonText}>
                  Refresh from server
                </Text>
              )}
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#071A2B",
  },

  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
  },

  /* ---------- TOP BAR ---------- */

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },

  logoCheck: {
    position: "absolute",
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#14B8A6",
    transform: [
      { rotate: "-45deg" },
      { translateX: 9 },
      { translateY: 10 },
    ],
  },

  brandName: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 2.5,
  },

  brandSubtitle: {
    color: "#14B8A6",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginTop: 2,
  },

  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0D263D",
    borderWidth: 1,
    borderColor: "#23415A",
    alignItems: "center",
    justifyContent: "center",
  },

  profileInitial: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },

  /* ---------- WELCOME ---------- */

  welcomeBlock: {
    marginBottom: 20,
  },

  eyebrow: {
    color: "#14B8A6",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 7,
  },

  welcomeTitle: {
    color: "#F8FAFC",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  welcomeSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 6,
  },

  /* ---------- SYNC ---------- */

  syncCard: {
    backgroundColor: "#0D263D",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#23415A",
    padding: 16,
    marginBottom: 14,
  },

  syncTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  syncIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#12324A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  syncIconText: {
    color: "#14B8A6",
    fontSize: 25,
    fontWeight: "700",
  },

  syncInfo: {
    flex: 1,
  },

  syncTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  syncTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },

  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  connectionGood: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },

  connectionPending: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },

  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  goodDot: {
    backgroundColor: "#22C55E",
  },

  pendingDot: {
    backgroundColor: "#F59E0B",
  },

  connectionText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#CBD5E1",
  },

  syncSubtitle: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },

  primaryButton: {
    height: 45,
    borderRadius: 11,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonDisabled: {
    backgroundColor: "#23415A",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  primaryButtonArrow: {
    color: "#FFFFFF",
    fontSize: 18,
    marginLeft: 8,
  },

  messageBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    backgroundColor: "#071A2B",
    borderWidth: 1,
    borderColor: "#23415A",
  },

  messageText: {
    color: "#94A3B8",
    fontSize: 10,
    lineHeight: 15,
  },

  quickLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
  },

  quickLink: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "600",
  },

  linkDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#23415A",
    marginHorizontal: 13,
  },

  /* ---------- QUICK ACTIONS ---------- */

  quickActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
  },

  quickAction: {
    flex: 1,
    backgroundColor: "#0D263D",
    borderWidth: 1,
    borderColor: "#23415A",
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  actionIconBlue: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  actionIconTeal: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(20, 184, 166, 0.13)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  actionIconText: {
    color: "#60A5FA",
    fontSize: 17,
    fontWeight: "700",
  },

  actionTitle: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
  },

  actionSubtitle: {
    color: "#64748B",
    fontSize: 9,
    marginTop: 3,
  },

  /* ---------- SECTION ---------- */

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionEyebrow: {
    color: "#64748B",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 19,
    fontWeight: "800",
  },

  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 2,
  },

  refreshIcon: {
    color: "#14B8A6",
    fontSize: 16,
    marginRight: 4,
  },

  refreshText: {
    color: "#60A5FA",
    fontSize: 10,
    fontWeight: "700",
  },

  /* ---------- INSPECTION CARD ---------- */

  inspectionCard: {
    backgroundColor: "#0D263D",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#23415A",
    padding: 15,
    marginBottom: 11,
  },

  inspectionCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  inspectionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  typeTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  routineTag: {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
  },

  surpriseTag: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },

  typeTagText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  routineText: {
    color: "#60A5FA",
  },

  surpriseText: {
    color: "#FCA5A5",
  },

  projectCode: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "monospace",
    marginLeft: 8,
  },

  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  status_assigned: {
    backgroundColor: "#1E3348",
  },

  status_in_progress: {
    backgroundColor: "rgba(34, 197, 94, 0.13)",
  },

  status_submitted: {
    backgroundColor: "rgba(168, 85, 247, 0.13)",
  },

  status_findings: {
    backgroundColor: "rgba(245, 158, 11, 0.13)",
  },

  status_closed: {
    backgroundColor: "rgba(20, 184, 166, 0.13)",
  },

  statusAssignedText: {
    color: "#CBD5E1",
  },

  statusProgressText: {
    color: "#86EFAC",
  },

  statusSubmittedText: {
    color: "#D8B4FE",
  },

  statusFindingsText: {
    color: "#FCD34D",
  },

  statusClosedText: {
    color: "#5EEAD4",
  },

  projectName: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
    lineHeight: 21,
  },

  idRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  idLabel: {
    color: "#526B80",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1,
    marginRight: 7,
  },

  idValue: {
    color: "#64748B",
    fontSize: 9,
    fontFamily: "monospace",
  },

  inspectionDivider: {
    height: 1,
    backgroundColor: "#1B3A53",
    marginVertical: 13,
  },

  inspectionBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateLabel: {
    color: "#526B80",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1,
  },

  dateValue: {
    color: "#CBD5E1",
    fontSize: 10,
    marginTop: 3,
  },

  openFileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  openFileText: {
    color: "#60A5FA",
    fontSize: 9,
    fontWeight: "700",
  },

  openFileArrow: {
    color: "#60A5FA",
    fontSize: 13,
    marginLeft: 5,
  },

  /* ---------- EMPTY ---------- */

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingVertical: 55,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: "#0D263D",
    borderWidth: 1,
    borderColor: "#23415A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyIconText: {
    color: "#14B8A6",
    fontSize: 24,
  },

  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },

  emptyText: {
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 7,
  },

  emptyButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 17,
    paddingVertical: 10,
    marginTop: 17,
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});

const queue = new OfflineInspectionQueue();

function getStatusStyle(status: string) {
  switch (status) {
    case "in_progress":
      return styles.status_in_progress;

    case "submitted":
      return styles.status_submitted;

    case "findings":
      return styles.status_findings;

    case "closed":
      return styles.status_closed;

    default:
      return styles.status_assigned;
  }
}

function getStatusTextStyle(status: string) {
  switch (status) {
    case "in_progress":
      return styles.statusProgressText;

    case "submitted":
      return styles.statusSubmittedText;

    case "findings":
      return styles.statusFindingsText;

    case "closed":
      return styles.statusClosedText;

    default:
      return styles.statusAssignedText;
  }
}