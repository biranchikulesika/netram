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
import { OfflineInspectionQueue } from "../../src/offline/queue";
import { captureEvidenceOffline } from "../../src/offline/evidence";
import type {
  CachedInspectionRecord,
  CachedObservationRecord,
  CachedEvidenceRecord,
  OfflineOperationRecord,
} from "../../src/offline/queue";
import type { EvidenceType } from "@netram/types";
import { colors, typography } from "../../src/theme/colors";

const queue = new OfflineInspectionQueue();

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
  const [loading, setLoading] = useState(true);

  // Observation form
  const [obsText, setObsText] = useState("");
  const [showObsModal, setShowObsModal] = useState(false);

  // Evidence form
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("photo");
  const [evidenceName, setEvidenceName] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cached, ops, obs, ev] = await Promise.all([
        queue.getCachedInspection(id),
        queue.getAllOperations(id),
        queue.getCachedObservations(id),
        queue.getCachedEvidence(id),
      ]);
      setInspection(cached);
      setOperations(ops);
      setCachedObservations(obs);
      setCachedEvidence(ev);
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

  const handleRecordObservation = async () => {
    if (!id || !obsText.trim()) return;
    setActionBusy(true);
    try {
      await queue.enqueueOperation(id, "record_observation", { text: obsText.trim() });
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
      const res = await captureEvidenceOffline(queue, {
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
  safeArea: { flex: 1, backgroundColor: colors.bgCanvas },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgCanvas,
  },
  scrollContent: { padding: 16, gap: 16 },
  backButton: { marginBottom: 4 },
  backButtonText: { color: colors.accentBlue, fontSize: 14, fontWeight: "600" },
  headerCard: {
    backgroundColor: colors.bgSurface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 6,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: { color: colors.textMuted, fontSize: 12, fontWeight: "700", fontFamily: typography.mono },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  status_assigned: { backgroundColor: "#f3f6fb", borderColor: "#cbd5e1" },
  status_in_progress: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  status_submitted: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  status_closed: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  projectName: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  projectCode: { fontSize: 13, color: colors.textMuted, fontFamily: typography.mono },
  actionsCard: {
    backgroundColor: colors.bgSurface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted },
  buttonGrid: { gap: 10 },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnText: { color: colors.textInverse, fontWeight: "700", fontSize: 14 },
  btnStart: { backgroundColor: colors.actionGreen },
  btnObs: { backgroundColor: colors.accentBlue },
  btnEv: { backgroundColor: colors.navyBrand },
  btnSubmit: { backgroundColor: colors.goldDark },
  queueCard: {
    backgroundColor: colors.bgSurface,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeCount: {
    backgroundColor: colors.bgSubtle,
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    fontFamily: typography.mono,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyOps: { padding: 16, alignItems: "center" },
  emptyOpsText: { color: colors.textMuted, fontSize: 13 },
  opItem: {
    backgroundColor: colors.bgSubtle,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  opHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  opType: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  opStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  opStatusAccepted: { backgroundColor: colors.actionGreen },
  opStatusPending: { backgroundColor: colors.goldDark },
  opStatusConflict: { backgroundColor: colors.tagRust },
  opStatusRejected: { backgroundColor: colors.error },
  opStatusText: { color: colors.textInverse, fontSize: 10, fontWeight: "700" },
  opId: { color: colors.textSubtle, fontSize: 11, fontFamily: typography.mono },
  opTime: { color: colors.textMuted, fontSize: 11 },
  opErrorBox: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  opErrorText: { color: colors.error, fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.backdrop + "99",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  modalSubtitle: { fontSize: 12, color: colors.textMuted },
  typeSelector: { flexDirection: "row", gap: 8 },
  typePill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  typePillActive: { backgroundColor: colors.navyBrand, borderColor: colors.accentBlue },
  typePillText: { color: colors.textMuted, fontSize: 11, fontWeight: "700", fontFamily: typography.mono },
  typePillTextActive: { color: colors.textInverse },
  textInput: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.textPrimary,
    textAlignVertical: "top",
    minHeight: 80,
  },
  textInputSmall: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.textPrimary,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  btnCancel: { backgroundColor: colors.bgSubtle, borderWidth: 1, borderColor: colors.borderStrong },
  btnConfirm: { backgroundColor: colors.actionGreen },
  modalBtnText: { color: colors.textInverse, fontWeight: "600", fontSize: 13 },
  obsText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  obsFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  localTag: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hashText: { color: colors.textMuted, fontSize: 11, fontFamily: typography.mono },
  integrityTag: { color: colors.actionGreen, fontSize: 11, fontWeight: "600" },
});
