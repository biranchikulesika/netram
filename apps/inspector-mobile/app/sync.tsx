import { useCallback, useEffect, useState } from "react";
import { AppState, type AppStateStatus, ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { NetramApiClient } from "@netram/api-client";
import { OfflineInspectionQueue, type FailedMediaUploadRecord, type OfflineOperationRecord } from "../src/offline/queue.js";

const queue = new OfflineInspectionQueue();
const inspectorEmail = "inspector.two@dev.netram.in";

async function authenticatedClient(): Promise<NetramApiClient> {
  const client = new NetramApiClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL! });
  const { token } = await client.devLogin(inspectorEmail);
  return new NetramApiClient({ baseUrl: process.env.EXPO_PUBLIC_API_URL!, getToken: () => token });
}

export default function SyncStatusScreen() {
  const [operations, setOperations] = useState<OfflineOperationRecord[]>([]);
  const [failedMedia, setFailedMedia] = useState<FailedMediaUploadRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ops, failed] = await Promise.all([queue.getAllOperations(), queue.getFailedMediaUploads()]);
    setOperations(ops);
    setFailedMedia(failed);
  }, []);

  const resync = useCallback(async (automatic = false) => {
    const pending = await queue.getPendingOperations();
    if (!pending.length) { if (!automatic) setMessage("No pending operations to resync."); return; }
    setBusy(true);
    try {
      const summary = await queue.sync(await authenticatedClient());
      setMessage(`Sync complete: ${summary.synced} accepted, ${summary.conflicts} conflicts, ${summary.rejected} rejected.`);
      await load();
    } catch (error) {
      if (!automatic) setMessage(`Sync could not complete: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  }, [load]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void resync(true);
    });
    return () => subscription.remove();
  }, [resync]);

  const pending = operations.filter((op) => op.status === "pending").length;
  const accepted = operations.filter((op) => op.status === "accepted").length;
  const issues = operations.filter((op) => op.status === "conflict" || op.status === "rejected");
  const lastSync = operations.map((op) => op.synced_at).filter((value): value is string => Boolean(value)).sort().at(-1);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>Sync status</Text>
    <Text style={styles.sub}>Operations remain on this device until the server accepts, rejects, or flags a conflict.</Text>
    <View style={styles.card}><Text style={styles.metric}>Pending: {pending}</Text><Text style={styles.metric}>Synced: {accepted}</Text><Text style={styles.metric}>Conflicts / rejected: {issues.length}</Text><Text style={styles.dim}>Last sync: {lastSync ? new Date(lastSync).toLocaleString() : "Not yet synced"}</Text></View>
    <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy} onPress={() => void resync()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Resync now</Text>}</Pressable>
    {message && <Text style={styles.message}>{message}</Text>}
    <Text style={styles.heading}>Needs reconciliation</Text>
    {issues.length === 0 ? <Text style={styles.dim}>No conflicted or rejected operations.</Text> : issues.map((op) => <View key={op.operation_id} style={styles.issue}><Text style={styles.issueTitle}>{op.operation_type.replaceAll("_", " ")} · {op.status}</Text><Text style={styles.code}>[{op.code ?? "SERVER_RESPONSE"}]</Text><Text style={styles.reason}>{op.error_message ?? "The server did not provide a reason."}</Text></View>)}
    <Text style={styles.heading}>Failed media uploads</Text>
    {failedMedia.length === 0 ? <Text style={styles.dim}>No failed media uploads.</Text> : failedMedia.map((item) => <View key={item.id} style={styles.issue}><Text style={styles.issueTitle}>{item.file_name}</Text><Text style={styles.reason}>{item.error_message ?? "Upload failed. Resync after connectivity is restored."}</Text></View>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#0f172a" }, content: { padding: 16, gap: 12 }, title: { color: "#f8fafc", fontSize: 22, fontWeight: "700" }, sub: { color: "#94a3b8" }, card: { backgroundColor: "#1e293b", borderRadius: 8, padding: 14, gap: 6 }, metric: { color: "#f1f5f9", fontWeight: "600" }, dim: { color: "#94a3b8" }, button: { backgroundColor: "#2563eb", borderRadius: 7, padding: 12, alignItems: "center" }, disabled: { opacity: 0.6 }, buttonText: { color: "#fff", fontWeight: "700" }, message: { color: "#bae6fd", backgroundColor: "#0c4a6e", padding: 10, borderRadius: 6 }, heading: { color: "#f8fafc", fontSize: 16, fontWeight: "700", marginTop: 8 }, issue: { backgroundColor: "#1e293b", borderRadius: 7, padding: 12, gap: 4 }, issueTitle: { color: "#f8fafc", fontWeight: "700", textTransform: "capitalize" }, code: { color: "#fbbf24", fontFamily: "monospace", fontSize: 12 }, reason: { color: "#fecaca", fontSize: 12 } });
