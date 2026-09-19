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
                    <Text style={styles.statusText}>{item.status.replace("_", " ")}</Text>
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
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  container: { flex: 1, padding: 16, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  appName: { fontSize: 20, fontWeight: "bold", color: "#f8fafc" },
  appSubtitle: { fontSize: 13, color: "#94a3b8" },
  badge: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#475569",
  },
  badgeText: { color: "#e2e8f0", fontSize: 12, fontWeight: "600" },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#475569",
  },
  signOutText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "600",
  },
  syncCard: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  syncCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  syncTitle: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  syncSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  syncButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 100,
    alignItems: "center",
  },
  syncButtonDisabled: { backgroundColor: "#475569", opacity: 0.6 },
  syncButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  syncMessageBanner: {
    backgroundColor: "#0f172a",
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  syncMessageText: { color: "#cbd5e1", fontSize: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },
  refreshLink: { color: "#38bdf8", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  tagRoutine: { backgroundColor: "#1e3a8a", color: "#bfdbfe" },
  tagSurprise: { backgroundColor: "#7f1d1d", color: "#fecaca" },
  projectCode: { color: "#94a3b8", fontSize: 12, fontFamily: "monospace" },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  status_assigned: { backgroundColor: "#334155" },
  status_in_progress: { backgroundColor: "#14532d" },
  status_submitted: { backgroundColor: "#581c87" },
  status_findings: { backgroundColor: "#78350f" },
  status_closed: { backgroundColor: "#022c22" },
  projectName: { fontSize: 15, fontWeight: "600", color: "#f8fafc" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 8,
  },
  footerDate: { color: "#94a3b8", fontSize: 12 },
  openLink: { color: "#60a5fa", fontSize: 13, fontWeight: "600" },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyText: { color: "#cbd5e1", fontSize: 15, fontWeight: "600" },
  emptySubtext: { color: "#64748b", fontSize: 13, textAlign: "center" },
});
