import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { OfflineInspectionQueue } from "../../src/offline/queue.js";
import { captureEvidenceOffline as captureEvidenceOfflineFn } from "../../src/offline/evidence.js"; // alias to avoid duplicate name

/**
 * Capture evidence bytes, compute SHA‑256 hash, and enqueue an offline operation.
 * Returns the generated evidenceId and contentHash for UI feedback.
 */


import type {
  CachedInspectionRecord,
  CachedObservationRecord,
  CachedEvidenceRecord,
  CachedFindingDraftRecord,
  OfflineOperationRecord,
} from "../../src/offline/queue.js";
import type { EvidenceType, FindingSeverity } from "@netram/types";

const queue = new OfflineInspectionQueue();

function generateObsId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getStatusStyle(status: string) {
  switch (status) {
    case "in_progress":
      return styles.status_in_progress;
    case "submitted":
      return styles.status_submitted;
    case "closed":
      return styles.status_closed;
    case "assigned":
    default:
      return styles.status_assigned;
  }
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [inspection, setInspection] = useState<CachedInspectionRecord | null>(null);
  const [operations, setOperations] = useState<OfflineOperationRecord[]>([]);
  const [cachedObservations, setCachedObservations] = useState<CachedObservationRecord[]>([]);
  const [cachedEvidence, setCachedEvidence] = useState<CachedEvidenceRecord[]>([]);
  const [findingDrafts, setFindingDrafts] = useState<CachedFindingDraftRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Observation form
  const [obsText, setObsText] = useState("");
  const [showObsModal, setShowObsModal] = useState(false);

  // Evidence form
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("photo");
  const [evidenceName, setEvidenceName] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [editingFinding, setEditingFinding] = useState<CachedFindingDraftRecord | null>(null);
  const [findingSeverity, setFindingSeverity] = useState<FindingSeverity>("medium");
  const [findingDescription, setFindingDescription] = useState("");
  const [findingRemediation, setFindingRemediation] = useState("");

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cached, ops, obs, ev, drafts] = await Promise.all([
        queue.getCachedInspection(id),
        queue.getAllOperations(id),
        queue.getCachedObservations(id),
        queue.getCachedEvidence(id),
        queue.getCachedFindingDrafts(id),
      ]);
      setInspection(cached);
      setOperations(ops);
      setCachedObservations(obs);
      setCachedEvidence(ev);
      setFindingDrafts(drafts);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartInspection = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await queue.enqueueOperation(id, "start_inspection", { note: "Field visit started" });
      await loadData();
      Alert.alert("Operation Queued", "Start inspection operation added to offline queue.");
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const openFindingDraft = (draft?: CachedFindingDraftRecord) => {
    setEditingFinding(draft ?? null);
    setFindingSeverity((draft?.severity as FindingSeverity | undefined) ?? "medium");
    setFindingDescription(draft?.description ?? "");
    setFindingRemediation(draft?.remediation ?? "");
    setShowFindingModal(true);
  };

  const handleSaveFindingDraft = async () => {
    if (!id || !findingDescription.trim()) return;
    setActionBusy(true);
    try {
      await queue.saveFindingDraft(id, {
        findingId: editingFinding?.id,
        operationId: editingFinding?.operation_id,
        severity: findingSeverity,
        description: findingDescription.trim(),
        remediation: findingRemediation.trim() || null,
      });
      setShowFindingModal(false);
      await loadData();
      Alert.alert("Finding Draft Saved", "This is an inspector draft and will be submitted for authority review during sync.");
    } catch (err) { Alert.alert("Error", String(err)); } finally { setActionBusy(false); }
  };

  const handleRecordObservation = async () => {
    if (!id || !obsText.trim()) return;
    setActionBusy(true);
    try {
      const observationId = generateObsId();
      await queue.enqueueOperation(id, "record_observation", { text: obsText.trim(), observationId });
      setObsText("");
      setShowObsModal(false);
      await loadData();
      Alert.alert("Observation Queued", "Observation recorded in local queue.");
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleCaptureEvidence = async () => {
    if (!id) return;
    const fileName = evidenceName.trim() || `capture-${Date.now()}.jpg`;
    setActionBusy(true);
    try {
      // Simulate photo file capture with bytes and SHA-256 computation (§30)
      const mockPhotoBytes = new TextEncoder().encode(
        `Mock JPEG binary for ${fileName} - ${Date.now()}`,
      );
      const res = await captureEvidenceOfflineFn(queue, {
        inspectionId: id,
        evidenceType,
        fileName,
        fileBytes: mockPhotoBytes,
        latitude: 20.2961,
        longitude: 85.8245,
      });

      setEvidenceName("");
      setShowEvidenceModal(false);
      await loadData();
      Alert.alert(
        "Evidence Captured",
        `Evidence metadata registered offline with SHA-256: ${res.contentHash.slice(0, 18)}…`,
      );
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitInspection = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await queue.enqueueOperation(id, "submit_inspection", {
        note: "Inspection completed on site by lead inspector",
      });
      await loadData();
      Alert.alert(
        "Submission Queued",
        "Submission operation queued. It will be validated by the authority upon sync.",
      );
    } catch (err) {
      Alert.alert("Error", String(err));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </SafeAreaView>
    );
  }

  const status = inspection?.status ?? "assigned";
  const canStart = status === "assigned" || status === "scheduled";
  const isFieldStage = status === "in_progress" || status === "evidence_collection";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navigation back */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back to Inspections</Text>
        </Pressable>

        {/* Inspection Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.typeBadge}>
              {(inspection?.type ?? "routine").toUpperCase()} INSPECTION
            </Text>
            <View style={[styles.statusPill, getStatusStyle(status)]}>
              <Text style={styles.statusText}>{status.replace("_", " ")}</Text>
            </View>
          </View>
          <Text style={styles.projectName}>
            {inspection?.project_name ?? `Inspection #${id?.slice(0, 8)}`}
          </Text>
          <Text style={styles.projectCode}>Code: {inspection?.project_code ?? "PRJ"}</Text>
        </View>

        {/* Field Action Buttons */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Field Operations (Offline-First)</Text>
          <Text style={styles.sectionSubtitle}>
            Actions are queued locally in SQLite and synced idempotently (§5, §31).
          </Text>

          <View style={styles.buttonGrid}>
            {canStart && (
              <Pressable
                style={[styles.actionBtn, styles.btnStart]}
                onPress={handleStartInspection}
                disabled={actionBusy}
              >
                <Text style={styles.actionBtnText}>Start Inspection</Text>
              </Pressable>
            )}

            {isFieldStage && (
              <>
                <Pressable
                  style={[styles.actionBtn, styles.btnObs]}
                  onPress={() => setShowObsModal(true)}
                  disabled={actionBusy}
                >
                  <Text style={styles.actionBtnText}>+ Observation</Text>
                </Pressable>

                <Pressable style={[styles.actionBtn, styles.btnFinding]} onPress={() => openFindingDraft()} disabled={actionBusy}>
                  <Text style={styles.actionBtnText}>+ Finding Draft</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, styles.btnEv]}
                  onPress={() => setShowEvidenceModal(true)}
                  disabled={actionBusy}
                >
                  <Text style={styles.actionBtnText}>+ Capture Evidence</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, styles.btnSubmit]}
                  onPress={handleSubmitInspection}
                  disabled={actionBusy}
                >
                  <Text style={styles.actionBtnText}>Submit Inspection</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Field Observations Card */}
        {cachedObservations.length > 0 && (
          <View style={styles.queueCard}>
            <View style={styles.queueHeader}>
              <Text style={styles.sectionTitle}>Field Observations</Text>
              <Text style={styles.badgeCount}>{cachedObservations.length} recorded</Text>
            </View>
            {cachedObservations.map((obs) => (
              <View key={obs.id} style={styles.opItem}>
                <Text style={styles.obsText}>{obs.text}</Text>
                <View style={styles.obsFooter}>
                  <Text style={styles.opTime}>
                    {new Date(obs.created_at).toLocaleTimeString()}
                  </Text>
                  {obs.is_local === 1 && <Text style={styles.localTag}>Offline Stored</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {findingDrafts.length > 0 && (
          <View style={styles.queueCard}>
            <View style={styles.queueHeader}><Text style={styles.sectionTitle}>Finding Drafts</Text><Text style={styles.badgeCount}>{findingDrafts.length} saved</Text></View>
            <Text style={styles.sectionSubtitle}>Drafts are submitted as new findings for authority review; they are not decisions.</Text>
            {findingDrafts.map((draft) => (
              <Pressable key={draft.id} style={styles.opItem} onPress={() => draft.sync_state !== "submitted_for_review" && openFindingDraft(draft)}>
                <View style={styles.opHeader}><Text style={styles.opType}>{draft.severity.toUpperCase()} · {draft.sync_state.replaceAll("_", " ")}</Text><Text style={styles.editHint}>{draft.sync_state === "submitted_for_review" ? "Awaiting review" : "Edit & resync"}</Text></View>
                <Text style={styles.obsText}>{draft.description}</Text>
                {draft.remediation ? <Text style={styles.opTime}>Suggested remediation: {draft.remediation}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}

        {/* Captured Evidence Card */}
        {cachedEvidence.length > 0 && (
          <View style={styles.queueCard}>
            <View style={styles.queueHeader}>
              <Text style={styles.sectionTitle}>Captured Evidence & Hash Audit</Text>
              <Text style={styles.badgeCount}>{cachedEvidence.length} items</Text>
            </View>
            {cachedEvidence.map((ev) => (
              <View key={ev.id} style={styles.opItem}>
                <View style={styles.opHeader}>
                  <Text style={styles.opType}>
                    {ev.evidence_type.toUpperCase()}: {ev.file_name ?? "media"}
                  </Text>
                  <View
                    style={[
                      styles.opStatusPill,
                      ev.upload_state === "uploaded"
                        ? styles.opStatusAccepted
                        : styles.opStatusPending,
                    ]}
                  >
                    <Text style={styles.opStatusText}>{ev.upload_state.toUpperCase()}</Text>
                  </View>
                </View>
                {ev.content_hash ? (
                  <Text style={styles.hashText}>SHA-256: {ev.content_hash.slice(0, 24)}…</Text>
                ) : null}
                <View style={styles.obsFooter}>
                  <Text style={styles.opTime}>
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.integrityTag}>Integrity: {ev.integrity_state}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Operations Queue Log */}
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <Text style={styles.sectionTitle}>Local Operation Log</Text>
            <Text style={styles.badgeCount}>{operations.length} total</Text>
          </View>

          {operations.length === 0 ? (
            <View style={styles.emptyOps}>
              <Text style={styles.emptyOpsText}>No operations queued for this inspection yet.</Text>
            </View>
          ) : (
            operations.map((op) => (
              <View key={op.operation_id} style={styles.opItem}>
                <View style={styles.opHeader}>
                  <Text style={styles.opType}>
                    {op.operation_type.replace("_", " ").toUpperCase()}
                  </Text>
                  <View
                    style={[
                      styles.opStatusPill,
                      op.status === "accepted" && styles.opStatusAccepted,
                      op.status === "pending" && styles.opStatusPending,
                      op.status === "conflict" && styles.opStatusConflict,
                      op.status === "rejected" && styles.opStatusRejected,
                    ]}
                  >
                    <Text style={styles.opStatusText}>{op.status.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.opId}>ID: {op.operation_id.slice(0, 16)}…</Text>
                <Text style={styles.opTime}>
                  {new Date(op.client_timestamp).toLocaleTimeString()}
                </Text>

                {op.error_message && (
                  <View style={styles.opErrorBox}>
                    <Text style={styles.opErrorText}>
                      [{op.code ?? "ERROR"}] {op.error_message}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal: Add Observation */}
      <Modal visible={showObsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Field Observation</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Describe observation on site..."
              placeholderTextColor="#64748b"
              value={obsText}
              onChangeText={setObsText}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.btnCancel]}
                onPress={() => setShowObsModal(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.btnConfirm]}
                onPress={handleRecordObservation}
                disabled={!obsText.trim() || actionBusy}
              >
                <Text style={styles.modalBtnText}>Queue Observation</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFindingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{editingFinding ? "Edit Finding Draft" : "New Finding Draft"}</Text>
          <Text style={styles.modalSubtitle}>Saved offline first; authority review remains server-controlled.</Text>
          <View style={styles.typeSelector}>{(["critical", "high", "medium", "low"] as FindingSeverity[]).map((severity) => <Pressable key={severity} style={[styles.typePill, findingSeverity === severity && styles.typePillActive]} onPress={() => setFindingSeverity(severity)}><Text style={[styles.typePillText, findingSeverity === severity && styles.typePillTextActive]}>{severity.toUpperCase()}</Text></Pressable>)}</View>
          <TextInput style={styles.textInput} placeholder="Describe the condition observed..." placeholderTextColor="#64748b" value={findingDescription} onChangeText={setFindingDescription} multiline numberOfLines={4} />
          <TextInput style={styles.textInputSmall} placeholder="Suggested remediation (optional)" placeholderTextColor="#64748b" value={findingRemediation} onChangeText={setFindingRemediation} />
          <View style={styles.modalActions}><Pressable style={[styles.modalBtn, styles.btnCancel]} onPress={() => setShowFindingModal(false)}><Text style={styles.modalBtnText}>Cancel</Text></Pressable><Pressable style={[styles.modalBtn, styles.btnConfirm]} onPress={handleSaveFindingDraft} disabled={!findingDescription.trim() || actionBusy}><Text style={styles.modalBtnText}>Save Draft</Text></Pressable></View>
        </View></View>
      </Modal>

      {/* Modal: Capture Evidence */}
      <Modal visible={showEvidenceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Capture Evidence Offline</Text>
            <Text style={styles.modalSubtitle}>
              SHA-256 hash is computed at capture time and stored locally (§30).
            </Text>

            <View style={styles.typeSelector}>
              {(["photo", "video", "document"] as EvidenceType[]).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typePill, evidenceType === t && styles.typePillActive]}
                  onPress={() => setEvidenceType(t)}
                >
                  <Text
                    style={[styles.typePillText, evidenceType === t && styles.typePillTextActive]}
                  >
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.textInputSmall}
              placeholder="File name (e.g. kitchen-storage.jpg)"
              placeholderTextColor="#64748b"
              value={evidenceName}
              onChangeText={setEvidenceName}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.btnCancel]}
                onPress={() => setShowEvidenceModal(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.btnConfirm]}
                onPress={handleCaptureEvidence}
                disabled={actionBusy}
              >
                <Text style={styles.modalBtnText}>Capture & Hash</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  scrollContent: { padding: 16, gap: 16 },
  backButton: { marginBottom: 4 },
  backButtonText: { color: "#38bdf8", fontSize: 14, fontWeight: "600" },
  headerCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  status_assigned: { backgroundColor: "#334155" },
  status_in_progress: { backgroundColor: "#14532d" },
  status_submitted: { backgroundColor: "#581c87" },
  status_closed: { backgroundColor: "#022c22" },
  projectName: { fontSize: 18, fontWeight: "bold", color: "#f8fafc" },
  projectCode: { fontSize: 13, color: "#64748b", fontFamily: "monospace" },
  actionsCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },
  sectionSubtitle: { fontSize: 12, color: "#94a3b8" },
  buttonGrid: { gap: 10 },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  actionBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  btnStart: { backgroundColor: "#16a34a" },
  btnObs: { backgroundColor: "#0284c7" },
  btnEv: { backgroundColor: "#7c3aed" },
  btnFinding: { backgroundColor: "#0f766e" },
  btnSubmit: { backgroundColor: "#d97706" },
  queueCard: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeCount: {
    backgroundColor: "#334155",
    color: "#94a3b8",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
  },
  emptyOps: { padding: 16, alignItems: "center" },
  emptyOpsText: { color: "#64748b", fontSize: 13 },
  opItem: {
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 4,
  },
  opHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  opType: { color: "#f1f5f9", fontWeight: "700", fontSize: 13 },
  opStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  opStatusAccepted: { backgroundColor: "#14532d" },
  opStatusPending: { backgroundColor: "#713f12" },
  opStatusConflict: { backgroundColor: "#78350f" },
  opStatusRejected: { backgroundColor: "#7f1d1d" },
  opStatusText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  opId: { color: "#64748b", fontSize: 11, fontFamily: "monospace" },
  opTime: { color: "#94a3b8", fontSize: 11 },
  opErrorBox: {
    backgroundColor: "#450a0a",
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  opErrorText: { color: "#fca5a5", fontSize: 11 },
  editHint: { color: "#7dd3fc", fontSize: 12, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#f8fafc" },
  modalSubtitle: { fontSize: 12, color: "#94a3b8" },
  typeSelector: { flexDirection: "row", gap: 8 },
  typePill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "#334155",
  },
  typePillActive: { backgroundColor: "#3b82f6" },
  typePillText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  typePillTextActive: { color: "#ffffff" },
  textInput: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    color: "#f8fafc",
    textAlignVertical: "top",
    minHeight: 80,
  },
  textInputSmall: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    color: "#f8fafc",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  btnCancel: { backgroundColor: "#334155" },
  btnConfirm: { backgroundColor: "#2563eb" },
  modalBtnText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },
  obsText: { color: "#f8fafc", fontSize: 13, lineHeight: 18 },
  obsFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  localTag: {
    color: "#38bdf8",
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "#0369a1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hashText: { color: "#94a3b8", fontSize: 11, fontFamily: "monospace" },
  integrityTag: { color: "#10b981", fontSize: 11, fontWeight: "600" },
});
