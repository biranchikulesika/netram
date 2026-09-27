import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import {
  EmptyState,
  Icon,
  NetramBadge,
  NetramButton,
  NetramCard,
  SectionHeader,
} from "../src/components/ui";
import {
  OfflineInspectionQueue,
  type CachedInspectionRecord,
  type FailedMediaUploadRecord,
  type OfflineOperationRecord,
} from "../src/offline/queue";
import { useAuth } from "../src/auth/auth-context";
import { useSyncStatus } from "../src/offline/sync-context";

const queue = new OfflineInspectionQueue();

function formatOperationType(type: string): string {
  switch (type) {
    case "check_in":
      return "Field Check-In";
    case "start_inspection":
      return "Start Inspection";
    case "submit_inspection":
      return "Submit Inspection";
    case "record_observation":
      return "Record Observation";
    case "capture_evidence":
      return "Capture Evidence";
    case "draft_finding":
      return "Draft Finding";
    case "update_finding_draft":
      return "Update Finding Draft";
    case "update_checklist_item":
      return "Checklist Item Update";
    case "record_attendance":
      return "Worker Headcount";
    default:
      return type.replaceAll("_", " ");
  }
}

function getOperationIcon(type: string): string {
  switch (type) {
    case "check_in":
      return "location-outline";
    case "start_inspection":
      return "play-circle-outline";
    case "submit_inspection":
      return "checkmark-done-circle-outline";
    case "record_observation":
      return "document-text-outline";
    case "capture_evidence":
      return "camera-outline";
    case "draft_finding":
    case "update_finding_draft":
      return "alert-circle-outline";
    case "update_checklist_item":
      return "checkbox-outline";
    case "record_attendance":
      return "people-outline";
    default:
      return "sync-outline";
  }
}

function isAcknowledged(op: OfflineOperationRecord): boolean {
  if (!op.result_data) return false;
  try {
    const parsed = JSON.parse(op.result_data);
    return parsed?.acknowledged === true;
  } catch {
    return false;
  }
}

function getPayloadSummary(op: OfflineOperationRecord): string | null {
  if (!op.payload) return null;
  try {
    const p = JSON.parse(op.payload);
    if (typeof p.text === "string") return `"${p.text}"`;
    if (typeof p.description === "string") return `[${(p.severity ?? "MEDIUM").toUpperCase()}] ${p.description}`;
    if (typeof p.fileName === "string") return `File: ${p.fileName} (${p.evidenceType ?? "photo"})`;
    if (p.latitude !== undefined && p.longitude !== undefined) {
      return `GPS: ${p.latitude}, ${p.longitude} (±${p.accuracy ?? 0}m)`;
    }
    if (p.workerCount !== undefined) {
      return `Headcount: ${p.workerCount} workers${p.note ? ` ("${p.note}")` : ""}`;
    }
    if (p.checklistItemId !== undefined) {
      return `Item: ${String(p.checklistItemId).slice(0, 8)}… → ${(p.response ?? "None").toUpperCase()}${p.note ? ` ("${p.note}")` : ""}`;
    }
    return null;
  } catch {
    return null;
  }
}

function getLocalStateDetails(op: OfflineOperationRecord): string {
  if (!op.payload) return "No payload data recorded";
  try {
    const p = JSON.parse(op.payload);
    switch (op.operation_type) {
      case "update_checklist_item":
        return `Response: ${(p.response ?? "NONE").toUpperCase()}${p.note ? `\nNote: "${p.note}"` : ""}`;
      case "draft_finding":
        return `Severity: ${(p.severity ?? "MEDIUM").toUpperCase()}\nIssue: ${p.description || "(Empty)"}${p.remediation ? `\nRemedy: ${p.remediation}` : ""}`;
      case "start_inspection":
        return `Action: Start Inspection\nDevice Timestamp: ${new Date(op.client_timestamp || op.created_at).toLocaleTimeString()}`;
      case "submit_inspection":
        return `Action: Final Sign-off & Submit\nDevice Timestamp: ${new Date(op.client_timestamp || op.created_at).toLocaleTimeString()}`;
      case "record_observation":
        return `Observation: "${p.text || ""}"`;
      case "capture_evidence":
        return `File: ${p.fileName || "photo.jpg"}\nType: ${p.evidenceType || "photo"}${p.contentHash ? `\nHash: ${p.contentHash.slice(0, 16)}…` : ""}`;
      case "check_in":
        return `GPS: ${p.latitude}, ${p.longitude}\nAccuracy: ±${p.accuracy ?? 0}m`;
      case "record_attendance":
        return `Headcount: ${p.workerCount} workers\nNotes: ${p.note || "(None)"}`;
      default:
        return JSON.stringify(p, null, 2);
    }
  } catch {
    return "Malformed local payload";
  }
}

function getServerStateDetails(op: OfflineOperationRecord): string {
  let serverData: Record<string, unknown> = {};
  if (op.result_data) {
    try {
      serverData = JSON.parse(op.result_data);
    } catch {
      serverData = {};
    }
  }

  const parts: string[] = [];
  if (serverData.status) {
    parts.push(`Inspection Status: ${String(serverData.status).toUpperCase()}`);
  }
  if (serverData.serverStatus) {
    parts.push(`Server Status: ${String(serverData.serverStatus).toUpperCase()}`);
  }
  if (serverData.response !== undefined) {
    parts.push(`Checklist Response: ${String(serverData.response ?? "NONE").toUpperCase()}`);
  }
  if (serverData.note !== undefined && serverData.note !== null) {
    parts.push(`Server Note: "${serverData.note}"`);
  }
  if (op.code) {
    parts.push(`Conflict Code: ${op.code}`);
  }
  if (op.error_message) {
    parts.push(op.error_message);
  }

  return parts.length > 0 ? parts.join("\n") : "Server authoritative state supersedes local device modification.";
}

interface PendingInspectionGroup {
  inspectionId: string;
  inspection: CachedInspectionRecord | undefined;
  operations: OfflineOperationRecord[];
}

export default function SyncStatusScreen() {
  const router = useRouter();
  const { client } = useAuth();
  const { refreshPendingCount } = useSyncStatus();
  const { theme } = useSettings();

  const [operations, setOperations] = useState<OfflineOperationRecord[]>([]);
  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [failedMedia, setFailedMedia] = useState<FailedMediaUploadRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [retryingMediaId, setRetryingMediaId] = useState<string | null>(null);
  const [retryingOpId, setRetryingOpId] = useState<string | null>(null);
  const [dismissingOpId, setDismissingOpId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAccepted, setShowAccepted] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ops, failed, cachedInsp] = await Promise.all([
        queue.getAllOperations(),
        queue.getFailedMediaUploads(),
        queue.getCachedInspections(),
      ]);
      setOperations(ops);
      setFailedMedia(failed);
      setInspections(cachedInsp);
      await refreshPendingCount();
    } catch (err) {
      console.warn("Error loading sync data:", err);
    }
  }, [refreshPendingCount]);

  const inspectionMap = useMemo(() => {
    const map = new Map<string, CachedInspectionRecord>();
    for (const insp of inspections) {
      map.set(insp.id, insp);
    }
    return map;
  }, [inspections]);

  const handleResync = useCallback(
    async (silent = false) => {
      if (!client) {
        if (!silent) {
          Alert.alert(
            "Offline / Unauthenticated",
            "Please check network connection or sign in to sync with the server.",
          );
        }
        return;
      }

      const pending = await queue.getPendingOperations();
      const failed = await queue.getFailedMediaUploads();

      if (pending.length === 0 && failed.length === 0) {
        if (!silent) setMessage("All operations and media are synchronized.");
        return;
      }

      setBusy(true);
      try {
        const summary = await queue.sync(client);
        setMessage(
          `Sync complete: ${summary.synced} accepted, ${summary.conflicts} conflicts, ${summary.rejected} rejected, ${summary.mediaUploaded} media uploaded.`,
        );
        await loadData();
      } catch (error) {
        const errText = error instanceof Error ? error.message : String(error);
        if (!silent) setMessage(`Sync failed: ${errText}`);
      } finally {
        setBusy(false);
      }
    },
    [client, loadData],
  );

  const handleDismiss = async (operationId: string) => {
    setDismissingOpId(operationId);
    try {
      await queue.acknowledgeOperation(operationId);
      await loadData();
    } catch (err) {
      Alert.alert("Dismiss Failed", err instanceof Error ? err.message : String(err));
    } finally {
      setDismissingOpId(null);
    }
  };

  const handleRetryOperation = async (operationId: string) => {
    setRetryingOpId(operationId);
    try {
      await queue.retryOperation(operationId);
      await loadData();
      setMessage("Operation re-queued for synchronization.");
      if (client) {
        await handleResync(true);
      }
    } catch (err) {
      Alert.alert("Retry Failed", err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingOpId(null);
    }
  };

  const handleRetryAllFailedOps = async () => {
    setBusy(true);
    try {
      const count = await queue.retryAllOperations();
      await loadData();
      setMessage(`Re-queued ${count} operation${count === 1 ? "" : "s"} for synchronization.`);
      if (client) {
        await handleResync(true);
      }
    } catch (err) {
      Alert.alert("Retry Failed", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRetrySingleMedia = async (item: FailedMediaUploadRecord) => {
    setRetryingMediaId(item.id);
    try {
      await queue.retryMediaUpload(item.id);
      await loadData();
      if (client) {
        await handleResync(true);
      } else {
        setMessage(`Queued "${item.file_name}" for upload when connectivity returns.`);
      }
    } catch (err) {
      Alert.alert("Retry Failed", err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingMediaId(null);
    }
  };

  const handleRetryAllMedia = async () => {
    setBusy(true);
    try {
      await queue.retryAllMediaUploads();
      await loadData();
      if (client) {
        await handleResync(true);
      } else {
        setMessage("Queued all failed media for upload when online.");
      }
    } catch (err) {
      Alert.alert("Retry All Failed", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto-sync on app foreground (§3.1)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void handleResync(true);
    });
    return () => subscription.remove();
  }, [handleResync]);

  const pendingOps = operations.filter((op) => op.status === "pending");
  const acceptedOps = operations.filter((op) => op.status === "accepted");
  const conflictOps = operations.filter((op) => op.status === "conflict");
  const rejectedOps = operations.filter((op) => op.status === "rejected");
  const reconciliationOps = operations.filter(
    (op) => (op.status === "conflict" || op.status === "rejected") && !isAcknowledged(op),
  );

  // Group pending operations by inspection (§3.3)
  const groupedPendingOps = useMemo<PendingInspectionGroup[]>(() => {
    const groups = new Map<string, PendingInspectionGroup>();
    for (const op of pendingOps) {
      if (!groups.has(op.inspection_id)) {
        groups.set(op.inspection_id, {
          inspectionId: op.inspection_id,
          inspection: inspectionMap.get(op.inspection_id),
          operations: [],
        });
      }
      groups.get(op.inspection_id)!.operations.push(op);
    }
    return Array.from(groups.values());
  }, [pendingOps, inspectionMap]);

  const lastSync = operations
    .map((op) => op.synced_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bgCanvas }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() => void handleResync(false)}
            tintColor={theme.accentBlue}
            colors={[theme.accentBlue]}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.push("/"))}
            style={styles.backBtn}
            hitSlop={10}
            accessibilityLabel="Back"
          >
            <Icon name="arrow-back" size={18} color={theme.textPrimary} />
            <Text style={[styles.backText, { color: theme.textPrimary }]}>Back</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: theme.accentBlue }]}>OFFLINE-FIRST SYNCHRONIZATION</Text>
          <Text style={[styles.title, { color: theme.navyDark }]}>Sync Center</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            All field operations are queued locally and synchronized when connected
          </Text>
        </View>

        {/* STATUS SUMMARY CARD */}
        <NetramCard>
          <SectionHeader title="RECONCILIATION SUMMARY" primary />
          <View style={styles.metricsGrid}>
            <View style={[styles.metricItem, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Pending</Text>
              <Text style={[styles.metricValueMono, { color: colors.warningAmber }]}>
                {pendingOps.length}
              </Text>
            </View>
            <View style={[styles.metricItem, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Synced</Text>
              <Text style={[styles.metricValueMono, { color: colors.successGreen }]}>
                {acceptedOps.length}
              </Text>
            </View>
            <View style={[styles.metricItem, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Conflicts</Text>
              <Text
                style={[
                  styles.metricValueMono,
                  { color: conflictOps.length > 0 ? colors.warningAmber : theme.textMuted },
                ]}
              >
                {conflictOps.length}
              </Text>
            </View>
            <View style={[styles.metricItem, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Rejected</Text>
              <Text
                style={[
                  styles.metricValueMono,
                  { color: rejectedOps.length > 0 ? colors.errorRed : theme.textMuted },
                ]}
              >
                {rejectedOps.length}
              </Text>
            </View>
          </View>

          <View style={[styles.metaRow, { borderTopColor: theme.borderSubtle }]}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Last Server Sync</Text>
            <Text style={[styles.metaValue, { color: theme.navyBrand }]}>
              {lastSync ? new Date(lastSync).toLocaleString() : "Not yet synced"}
            </Text>
          </View>

          <NetramButton
            label={busy ? "Syncing Operations..." : "Sync Now"}
            variant="primary"
            loading={busy}
            disabled={busy}
            onPress={() => void handleResync(false)}
            style={styles.syncButton}
          />
        </NetramCard>

        {message && (
          <View style={[styles.messageBanner, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
            <Text style={[styles.messageText, { color: theme.navyDark }]}>{message}</Text>
          </View>
        )}

        {/* SECTION 1: PENDING OPERATIONS GROUPED BY INSPECTION (§3.3) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader title={`PENDING OPERATIONS (${pendingOps.length})`} />
            {pendingOps.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: theme.bgSubtle }]}>
                <Text style={[styles.countBadgeText, { color: theme.textMuted }]}>
                  {groupedPendingOps.length} {groupedPendingOps.length === 1 ? "Inspection" : "Inspections"}
                </Text>
              </View>
            )}
          </View>

          {groupedPendingOps.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Queue Clear"
              subtitle="No pending operations waiting for server transmission."
            />
          ) : (
            groupedPendingOps.map((group) => {
              const insp = group.inspection;
              const projectName = insp?.project_name ?? `Inspection: ${group.inspectionId.slice(0, 16)}…`;
              const projectCode = insp?.project_code;
              const district = insp?.district_id ? `${insp.district_id.toUpperCase()} District` : null;

              return (
                <NetramCard key={group.inspectionId} style={styles.groupCard}>
                  {/* Inspection Header */}
                  <View style={[styles.groupHeaderRow, { borderBottomColor: theme.borderSubtle }]}>
                    <View style={styles.groupHeaderLeft}>
                      <View style={styles.facilityRow}>
                        <Icon name="business-outline" size={15} color={theme.accentBlue} />
                        <Text style={[styles.groupFacilityName, { color: theme.navyDark }]} numberOfLines={1}>
                          {projectName}
                        </Text>
                      </View>
                      <View style={styles.groupSubMetaRow}>
                        {projectCode && (
                          <Text style={[styles.groupCodeMono, { color: theme.textMuted }]}>
                            {projectCode}
                          </Text>
                        )}
                        {district && (
                          <>
                            <Text style={[styles.metaDot, { color: theme.textMuted }]}>•</Text>
                            <Text style={[styles.groupDistrictText, { color: theme.textMuted }]}>
                              {district}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={[styles.opCountPill, { backgroundColor: theme.bgSubtle }]}>
                      <Text style={[styles.opCountPillText, { color: theme.textPrimary }]}>
                        {group.operations.length} queued
                      </Text>
                    </View>
                  </View>

                  {/* Operations List */}
                  <View style={styles.groupOpsList}>
                    {group.operations.map((op, idx) => {
                      const summarySnippet = getPayloadSummary(op);
                      const isLast = idx === group.operations.length - 1;

                      return (
                        <View
                          key={op.operation_id}
                          style={[
                            styles.groupedOpRow,
                            !isLast && [styles.groupedOpRowBorder, { borderBottomColor: theme.borderSubtle }],
                          ]}
                        >
                          <View style={styles.cardTopRow}>
                            <View style={styles.opTypeContainer}>
                              <Icon
                                name={getOperationIcon(op.operation_type)}
                                size={14}
                                color={theme.accentBlue}
                              />
                              <Text style={[styles.opTypeTitle, { color: theme.textPrimary }]}>
                                {formatOperationType(op.operation_type)}
                              </Text>
                            </View>
                            <NetramBadge label="PENDING" variant="sync" sync="pending" size="sm" />
                          </View>

                          {summarySnippet && (
                            <View style={[styles.snippetBox, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
                              <Text style={[styles.snippetText, { color: theme.textMuted }]} numberOfLines={2}>
                                {summarySnippet}
                              </Text>
                            </View>
                          )}

                          <View style={styles.cardFooter}>
                            <Text style={[styles.timestampText, { color: theme.textMuted }]}>
                              Queued:{" "}
                              {new Date(op.client_timestamp || op.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </Text>
                            <Text style={[styles.opIdMono, { color: theme.textMuted }]}>
                              ID: {op.operation_id.slice(0, 8)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </NetramCard>
              );
            })
          )}
        </View>

        {/* SECTION 2: NEEDS RECONCILIATION (§3.3) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader title={`NEEDS RECONCILIATION (${reconciliationOps.length})`} />
            {reconciliationOps.length > 0 && (
              <NetramButton
                label="Retry All"
                variant="secondary"
                size="sm"
                disabled={busy}
                onPress={handleRetryAllFailedOps}
              />
            )}
          </View>

          {reconciliationOps.length === 0 ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title="No Reconciliation Needed"
              subtitle="All operations have been accepted or acknowledged. Server state is consistent."
            />
          ) : (
            reconciliationOps.map((op) => {
              const insp = inspectionMap.get(op.inspection_id);
              const isDismissing = dismissingOpId === op.operation_id;
              const isRetrying = retryingOpId === op.operation_id;
              const isConflict = op.status === "conflict";
              const localDetails = getLocalStateDetails(op);
              const serverDetails = getServerStateDetails(op);

              return (
                <NetramCard key={op.operation_id}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.opTypeContainer}>
                      <Icon
                        name={getOperationIcon(op.operation_type)}
                        size={15}
                        color={isConflict ? colors.warningAmber : colors.errorRed}
                      />
                      <Text style={[styles.opTypeTitle, { color: theme.navyDark }]}>
                        {formatOperationType(op.operation_type)}
                      </Text>
                    </View>
                    <NetramBadge
                      label={isConflict ? "CONFLICT" : "REJECTED"}
                      variant="sync"
                      sync={isConflict ? "conflict" : "rejected"}
                      size="sm"
                    />
                  </View>

                  <Text style={[styles.inspectionName, { color: theme.textMuted }]} numberOfLines={1}>
                    {insp?.project_name ?? `Inspection: ${op.inspection_id.slice(0, 16)}…`}
                  </Text>

                  {/* CONFLICT: SERVER STATE VS LOCAL STATE (§3.3) */}
                  {isConflict ? (
                    <View style={[styles.conflictComparisonBox, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSubtle }]}>
                      <View style={styles.comparisonHeaderRow}>
                        <Icon name="git-compare-outline" size={13} color={colors.warningAmber} />
                        <Text style={[styles.comparisonTitle, { color: theme.textPrimary }]}>
                          STATE DIVERGENCE (LOCAL VS SERVER AUTHORITY)
                        </Text>
                      </View>

                      <View style={styles.diffColumnsContainer}>
                        {/* LOCAL DEVICE STATE */}
                        <View
                          style={[
                            styles.diffColumn,
                            { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
                          ]}
                        >
                          <View style={styles.diffColumnHeader}>
                            <Icon name="phone-portrait-outline" size={12} color={theme.textMuted} />
                            <Text style={[styles.diffColumnTitle, { color: theme.textMuted }]}>
                              LOCAL DEVICE
                            </Text>
                          </View>
                          <Text style={[styles.diffColumnBody, { color: theme.textPrimary }]}>
                            {localDetails}
                          </Text>
                        </View>

                        {/* SERVER AUTHORITY */}
                        <View
                          style={[
                            styles.diffColumn,
                            { backgroundColor: theme.bgSurface, borderColor: colors.warningAmber },
                          ]}
                        >
                          <View style={styles.diffColumnHeader}>
                            <Icon name="server-outline" size={12} color={colors.warningAmber} />
                            <Text style={[styles.diffColumnTitle, { color: colors.warningAmber }]}>
                              SERVER AUTHORITY
                            </Text>
                          </View>
                          <Text style={[styles.diffColumnBody, { color: theme.textPrimary }]}>
                            {serverDetails}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* REJECTED OPERATION (§3.3) */
                    <>
                      {op.code && (
                        <View style={styles.codeBox}>
                          <Text style={styles.codeText}>[{op.code}]</Text>
                        </View>
                      )}

                      <View style={[styles.errorBox, { backgroundColor: "#FFDAD6", borderColor: "#FFB4AB" }]}>
                        <Text style={[styles.errorLabel, { color: "#BA1A1A" }]}>REJECTION REASON</Text>
                        <Text style={[styles.errorText, { color: "#BA1A1A" }]}>
                          {op.error_message || "Operation rejected by server policy or state constraint."}
                        </Text>
                      </View>

                      <View style={[styles.snippetBox, { backgroundColor: theme.bgSubtle, borderColor: theme.borderSubtle }]}>
                        <Text style={[styles.snippetText, { color: theme.textMuted }]} numberOfLines={2}>
                          {getLocalStateDetails(op)}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* ACTION FOOTER: RETRY OR DISMISS (§3.3) */}
                  <View style={[styles.reconcileFooter, { borderTopColor: theme.borderSubtle }]}>
                    <Text style={[styles.timestampText, { color: theme.textMuted }]}>
                      {op.synced_at
                        ? `Synced: ${new Date(op.synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "Unsynced"}
                    </Text>
                    <View style={styles.reconcileBtnGroup}>
                      <NetramButton
                        label="Retry"
                        variant="secondary"
                        size="sm"
                        loading={isRetrying}
                        disabled={isRetrying || isDismissing || busy}
                        onPress={() => void handleRetryOperation(op.operation_id)}
                      />
                      <NetramButton
                        label="Dismiss"
                        variant="secondary"
                        size="sm"
                        loading={isDismissing}
                        disabled={isDismissing || isRetrying || busy}
                        onPress={() => void handleDismiss(op.operation_id)}
                      />
                    </View>
                  </View>
                </NetramCard>
              );
            })
          )}
        </View>

        {/* SECTION 3: FAILED MEDIA UPLOADS */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader title={`FAILED MEDIA UPLOADS (${failedMedia.length})`} />
            {failedMedia.length > 0 && (
              <NetramButton
                label="Retry All"
                variant="secondary"
                size="sm"
                disabled={busy}
                onPress={handleRetryAllMedia}
              />
            )}
          </View>

          {failedMedia.length === 0 ? (
            <EmptyState
              icon="camera-outline"
              title="No Failed Media"
              subtitle="All photos and document files have been uploaded to object storage."
            />
          ) : (
            failedMedia.map((item) => {
              const isRetrying = retryingMediaId === item.id;
              return (
                <NetramCard key={item.id}>
                  <View style={styles.failedMediaHeader}>
                    <View style={styles.failedMediaInfo}>
                      <View style={styles.failedFileNameRow}>
                        <Icon name="camera-outline" size={14} color={theme.textMuted} />
                        <Text style={[styles.failedFileName, { color: theme.navyDark }]} numberOfLines={1}>
                          {item.file_name}
                        </Text>
                      </View>
                      <Text style={[styles.evidenceIdMono, { color: theme.textMuted }]}>
                        Evidence ID: {item.evidence_id.slice(0, 16)}…
                      </Text>
                    </View>
                    <NetramBadge label="FAILED" variant="severity" severity="high" size="sm" />
                  </View>

                  <View style={[styles.errorBox, { backgroundColor: "#FFDAD6", borderColor: "#FFB4AB" }]}>
                    <Text style={[styles.errorLabel, { color: "#BA1A1A" }]}>UPLOAD FAILURE</Text>
                    <Text style={[styles.errorText, { color: "#BA1A1A" }]}>
                      {item.error_message || "Network request failed. Storage server was unreachable."}
                    </Text>
                  </View>

                  <View style={[styles.mediaFooter, { borderTopColor: theme.borderSubtle }]}>
                    <Text style={[styles.mediaDate, { color: theme.textMuted }]}>
                      Captured: {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <NetramButton
                      label="Retry"
                      variant="secondary"
                      size="sm"
                      loading={isRetrying}
                      disabled={isRetrying || busy}
                      onPress={() => void handleRetrySingleMedia(item)}
                    />
                  </View>
                </NetramCard>
              );
            })
          )}
        </View>

        {/* SECTION 4: ACCEPTED OPERATIONS (AUDIT TRAIL) */}
        <View style={styles.section}>
          <Pressable
            style={styles.collapseHeader}
            onPress={() => setShowAccepted((prev) => !prev)}
          >
            <SectionHeader title={`ACCEPTED OPERATIONS (${acceptedOps.length})`} />
            <View style={styles.collapseToggleRow}>
              <Icon
                name={showAccepted ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.accentBlue}
              />
              <Text style={[styles.collapseToggleText, { color: theme.accentBlue }]}>
                {showAccepted ? "Hide Audit" : "Show Audit"}
              </Text>
            </View>
          </Pressable>

          {showAccepted && (
            <View style={styles.acceptedList}>
              {acceptedOps.length === 0 ? (
                <EmptyState
                  icon="clipboard-outline"
                  title="No Accepted Operations"
                  subtitle="Operations accepted by the server will appear here for audit reference."
                />
              ) : (
                acceptedOps.map((op) => {
                  const insp = inspectionMap.get(op.inspection_id);
                  return (
                    <NetramCard key={op.operation_id}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.opTypeContainer}>
                          <Icon
                            name={getOperationIcon(op.operation_type)}
                            size={14}
                            color={colors.successGreen}
                          />
                          <Text style={[styles.opTypeTitle, { color: theme.textPrimary }]}>
                            {formatOperationType(op.operation_type)}
                          </Text>
                        </View>
                        <NetramBadge label="SYNCED" variant="sync" sync="synced" size="sm" />
                      </View>
                      <Text style={[styles.inspectionName, { color: theme.textMuted }]} numberOfLines={1}>
                        {insp?.project_name ?? `Inspection: ${op.inspection_id.slice(0, 16)}…`}
                      </Text>
                      <View style={[styles.cardFooter, { borderTopColor: theme.borderSubtle }]}>
                        <Text style={[styles.timestampText, { color: theme.textMuted }]}>
                          Synced: {op.synced_at ? new Date(op.synced_at).toLocaleString() : "Yes"}
                        </Text>
                        <Text style={[styles.opIdMono, { color: theme.textMuted }]}>
                          ID: {op.operation_id.slice(0, 8)}
                        </Text>
                      </View>
                    </NetramCard>
                  );
                })
              )}
            </View>
          )}
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
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "700",
    color: colors.accentBlue,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navyDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  metricItem: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 10,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  metricValueMono: {
    fontSize: 18,
    fontWeight: "800",
    fontFamily: typography.mono,
    color: colors.navyDark,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 12,
    color: colors.navyBrand,
    fontFamily: typography.mono,
  },
  syncButton: {
    marginTop: 6,
  },
  messageBanner: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  messageText: {
    color: colors.navyDark,
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "600",
  },
  groupCard: {
    padding: 0,
    overflow: "hidden",
  },
  groupHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  groupHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  facilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  groupFacilityName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  groupSubMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 21,
  },
  groupCodeMono: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "600",
  },
  metaDot: {
    fontSize: 10,
  },
  groupDistrictText: {
    fontSize: 11,
  },
  opCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  opCountPillText: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "700",
  },
  groupOpsList: {
    paddingHorizontal: 14,
  },
  groupedOpRow: {
    paddingVertical: 12,
  },
  groupedOpRowBorder: {
    borderBottomWidth: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  opTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  opTypeTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  inspectionName: {
    fontSize: 12,
    marginBottom: 8,
  },
  snippetBox: {
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    marginVertical: 6,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  timestampText: {
    fontSize: 11,
  },
  opIdMono: {
    fontSize: 10,
    fontFamily: typography.mono,
  },
  conflictComparisonBox: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  comparisonTitle: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  diffColumnsContainer: {
    gap: 6,
  },
  diffColumn: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  diffColumnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  diffColumnTitle: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  diffColumnBody: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: typography.mono,
  },
  codeBox: {
    marginBottom: 6,
  },
  codeText: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "700",
    color: colors.tagRust,
  },
  errorBox: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    marginBottom: 8,
  },
  errorLabel: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
  },
  reconcileFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  reconcileBtnGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  failedMediaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  failedMediaInfo: {
    flex: 1,
    marginRight: 8,
  },
  failedFileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  failedFileName: {
    fontSize: 14,
    fontWeight: "700",
  },
  evidenceIdMono: {
    fontSize: 10,
    fontFamily: typography.mono,
  },
  mediaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  mediaDate: {
    fontSize: 11,
  },
  collapseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  collapseToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  collapseToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  acceptedList: {
    gap: 10,
  },
});
