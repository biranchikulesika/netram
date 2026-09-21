import { Redirect, useRouter } from "expo-router";
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
import { NetramApiClient } from "@netram/api-client";
import { OfflineInspectionQueue } from "../src/offline/queue";
import type { CachedInspectionRecord } from "../src/offline/queue";
import { getStoredSession, clearSession } from "../src/auth/session";
import { colors, typography } from "../src/theme/colors";

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
      return { color: "#1d4ed8" };
    case "submitted":
      return { color: colors.actionGreen };
    case "findings":
      return { color: colors.tagRust };
    case "closed":
      return { color: colors.textMuted };
    default:
      return { color: colors.navyData };
  }
}

export default function InspectorHomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState(getStoredSession());
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
    const current = getStoredSession();
    if (!current) return;
    setSession(current);
    loadLocalState();
  }, [loadLocalState]);

  const handleSignOut = () => {
    clearSession();
    setSession(null);
  };

  if (!session) {
    return <Redirect href="/login" />;
  }

  const handleFetchFromServer = async () => {
    setRefreshing(true);
    setSyncMessage(null);
    try {
      const current = getStoredSession();
      const apiUrl = current?.apiUrl ?? "http://localhost:3001";
      const token = current?.token;

      const authClient = new NetramApiClient({
        baseUrl: apiUrl,
        getToken: () => token ?? null,
      });

      const page = await authClient.listInspections({ pageSize: 50 });
      await queue.cacheInspections(page.items);
      await loadLocalState();
      setSyncMessage(`Refreshed ${page.items.length} inspections from server.`);
    } catch (err) {
      setSyncMessage(
        `Offline: could not connect to server. Using local cache. (${err instanceof Error ? err.message : String(err)})`,
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncQueue = async () => {
    if (pendingCount === 0) {
      setSyncMessage("No pending operations to sync.");
      return;
    }

    setSyncing(true);
    setSyncMessage(null);
    try {
      const current = getStoredSession();
      const apiUrl = current?.apiUrl ?? "http://localhost:3001";
      const token = current?.token;

      const authClient = new NetramApiClient({
        baseUrl: apiUrl,
        getToken: () => token ?? null,
      });

      const summary = await queue.sync(authClient);
      await loadLocalState();

      const parts = [`Synced ${summary.synced} ops`];
      if (summary.mediaUploaded > 0) parts.push(`${summary.mediaUploaded} media uploaded`);
      if (summary.conflicts > 0) parts.push(`${summary.conflicts} conflicts`);
      if (summary.rejected > 0) parts.push(`${summary.rejected} rejected`);

      setSyncMessage(`Sync complete: ${parts.join(", ")}`);
    } catch (err) {
      setSyncMessage(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Profile */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>DoSJE Netram</Text>
            <Text style={styles.appSubtitle}>
              {session?.user.displayName ?? session?.user.email ?? "Inspector Field Terminal"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {session?.user.email.split("@")[0] ?? "inspector"}
              </Text>
            </View>
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>

        {/* Sync Status Card */}
        <View style={styles.syncCard}>
          <View style={styles.syncCardRow}>
            <View>
              <Text style={styles.syncTitle}>Offline Operation Queue</Text>
              <Text style={styles.syncSubtitle}>
                {pendingCount === 0
                  ? "All local operations synchronized"
                  : `${pendingCount} operation(s) pending sync`}
              </Text>
            </View>
            <Pressable
              style={[
                styles.syncButton,
                (syncing || pendingCount === 0) && styles.syncButtonDisabled,
              ]}
              onPress={handleSyncQueue}
              disabled={syncing || pendingCount === 0}
            >
              {syncing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.syncButtonText}>Sync Queue</Text>
              )}
            </Pressable>
          </View>

          {syncMessage && (
            <View style={styles.syncMessageBanner}>
              <Text style={styles.syncMessageText}>{syncMessage}</Text>
            </View>
          )}
        </View>

        {/* Inspections Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Inspections</Text>
          <Pressable onPress={handleFetchFromServer} disabled={refreshing}>
            <Text style={styles.refreshLink}>
              {refreshing ? "Refreshing..." : "Refresh from Server"}
            </Text>
          </Pressable>
        </View>

        {/* Inspections List */}
        {inspections.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No cached inspections found.</Text>
            <Text style={styles.emptySubtext}>
              Tap &quot;Refresh from Server&quot; when connected to download assigned inspections.
            </Text>
          </View>
        ) : (
          <FlatList
            data={inspections}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleFetchFromServer} />
            }
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => router.push(`/inspections/${item.id}`)}>
                <View style={styles.cardHeader}>
                  <View style={styles.tagRow}>
                    <Text
                      style={[
                        styles.typeTag,
                        item.type === "surprise" ? styles.tagSurprise : styles.tagRoutine,
                      ]}
                    >
                      {item.type.toUpperCase()}
                    </Text>
                    <Text style={styles.projectCode}>{item.project_code}</Text>
                  </View>
                  <View style={[styles.statusPill, getStatusStyle(item.status)]}>
                    <Text style={[styles.statusText, getStatusTextStyle(item.status)]}>
                      {item.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.projectName}>{item.project_name}</Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.footerDate}>
                    {item.scheduled_start
                      ? `Sched: ${new Date(item.scheduled_start).toLocaleDateString()}`
                      : "Unscheduled"}
                  </Text>
                  <Text style={styles.openLink}>Open Field File →</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgCanvas },
  container: { flex: 1, padding: 16, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  appName: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 },
  appSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  badgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600", fontFamily: typography.mono },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  signOutText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
  },
  syncCard: {
    backgroundColor: colors.bgSurface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  syncCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  syncTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  syncSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  syncButton: {
    backgroundColor: colors.actionGreen,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 100,
    alignItems: "center",
    shadowColor: colors.actionGreenDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  syncButtonDisabled: { backgroundColor: colors.borderStrong, opacity: 0.6 },
  syncButtonText: { color: colors.textInverse, fontWeight: "600", fontSize: 13 },
  syncMessageBanner: {
    backgroundColor: colors.bgSubtle,
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
  },
  syncMessageText: { color: colors.textPrimary, fontSize: 12, lineHeight: 16 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  refreshLink: { color: colors.accentBlue, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  tagRoutine: { backgroundColor: "#eff6ff", color: "#1d4ed8", borderWidth: 1, borderColor: "#bfdbfe" },
  tagSurprise: { backgroundColor: "#fef2f2", color: colors.error, borderWidth: 1, borderColor: "#fecaca" },
  projectCode: { color: colors.textMuted, fontSize: 12, fontFamily: typography.mono },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  status_assigned: { backgroundColor: "#f3f6fb", borderColor: "#cbd5e1" },
  status_in_progress: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  status_submitted: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  status_findings: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  status_closed: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  projectName: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 10,
  },
  footerDate: { color: colors.textMuted, fontSize: 12 },
  openLink: { color: colors.accentBlue, fontSize: 13, fontWeight: "600" },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyText: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  emptySubtext: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});
