import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { typography } from "../../src/theme/colors";
import { useSettings } from "../../src/theme/settings-context";
import { requestInspectionPermissions } from "../../src/utils/permissions";
import {
  EmptyState,
  Icon,
  NetramBadge,
  NetramButton,
  InteractiveVideoPlayer,
  InAppCameraModal,
  type CapturedMediaItem,
} from "../../src/components/ui";
import {
  OfflineInspectionQueue,
  type CachedEvidenceRecord,
  type CachedFindingDraftRecord,
  type CachedInspectionRecord,
  type CachedObservationRecord,
} from "../../src/offline/queue";
import { captureEvidenceOffline } from "../../src/offline/evidence";
import { useSyncStatus } from "../../src/offline/sync-context";
import { useAuth } from "../../src/auth/auth-context";
import { formatCurrencyString } from "../../src/utils/currency";
import { formatInspectionType } from "../../src/utils/formatters";
import type {
  InspectionFlag,
  OrganisationView,
  Project,
  ProjectFundOverview,
} from "@netram/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Video evidence may be typed loosely or only carry an .mp4/.mov file name. */
function isVideoMedia(media: { evidence_type?: string | null; file_name?: string | null }) {
  return (
    media.evidence_type === "video" ||
    /\.(mp4|mov)$/i.test(media.file_name ?? "")
  );
}

export default function InspectionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);
  const { refreshPendingCount } = useSyncStatus();
  const { client } = useAuth();
  const { theme, isPureDark } = useSettings();

  const [inspection, setInspection] = useState<CachedInspectionRecord | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [organisation, setOrganisation] = useState<OrganisationView | null>(null);
  const [fundOverview, setFundOverview] = useState<ProjectFundOverview | null>(null);
  const [inspectionFlags, setInspectionFlags] = useState<InspectionFlag[]>([]);

  const [observations, setObservations] = useState<CachedObservationRecord[]>([]);
  const [evidenceList, setEvidenceList] = useState<CachedEvidenceRecord[]>([]);
  const [findings, setFindings] = useState<CachedFindingDraftRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Evidence preview modal state
  const [previewMedia, setPreviewMedia] = useState<
    | (CachedEvidenceRecord & {
        caption?: string | null;
      })
    | null
  >(null);

  // In-App Camera and Video Modal state (No external mobile apps)
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState<"photo" | "video">("photo");

  // Request Android runtime permissions on screen entry
  useEffect(() => {
    void requestInspectionPermissions();
  }, []);

  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    if (!id) {
      setLoadError("This inspection could not be identified.");
      setLoading(false);
      return;
    }
    try {
      const [cached, obs, ev, drafts] = await Promise.all([
        queue.getCachedInspection(id),
        queue.getCachedObservations(id),
        queue.getCachedEvidence(id),
        queue.getCachedFindingDrafts(id),
      ]);
      setInspection(cached);
      setObservations(obs);
      setEvidenceList(ev);
      setFindings(drafts);
      void refreshPendingCount();

      // Graceful server enrichment if online
      if (client && cached?.project_id) {
        try {
          const prj = await client.getProject(cached.project_id);
          setProject(prj);

          if (prj.organisationId) {
            try {
              const orgs = await client.listOrganisations();
              const foundOrg = orgs.find((o) => o.id === prj.organisationId);
              if (foundOrg) setOrganisation(foundOrg);
            } catch {
              // Proceed gracefully
            }
          }
        } catch {
          // Proceed gracefully
        }

        try {
          const funds = await client.getProjectFundOverview(cached.project_id);
          setFundOverview(funds);
        } catch {
          // Proceed gracefully
        }

        try {
          const flagsRes = await client.listInspectionFlags({
            projectId: cached.project_id,
            pageSize: 20,
          });
          setInspectionFlags(flagsRes.items);
        } catch {
          // Proceed gracefully
        }
      }
    } catch (err) {
      console.warn("Failed to load inspection detail:", err);
      setLoadError("This inspection could not be read from the offline store.");
    } finally {
      setLoading(false);
    }
  }, [id, queue, refreshPendingCount, client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Status computation
  const status = inspection?.status ?? "assigned";
  const canStart = status === "assigned";
  const isFieldStage = status === "in_progress";

  // Workflow Action: Start Inspection
  const handleStartInspection = async () => {
    if (!id) return;

    Alert.alert(
      "Start Inspection",
      `Begin field inspection for ${inspection?.project_name || "this assigned facility"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: async () => {
            setActionBusy(true);
            try {
              await queue.startInspection(id);
              await loadData();
              Alert.alert("Inspection Started", "Status updated to In Progress.");
            } catch (err: unknown) {
              Alert.alert("Error", String(err));
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  };

  // Workflow Action: Submit Inspection (§2.6)
  const handleSubmitInspection = () => {
    if (!id) return;
    if (!canSubmitInspection) {
      if (observations.length === 0 && findings.length === 0 && evidenceList.length === 0) {
        Alert.alert(
          "Submission Blocked",
          "Statutory inspection protocol requires at least 1 field observation note, media evidence, or finding before sign-off.",
        );
        return;
      }
      Alert.alert(
        "Submission Blocked",
        "This inspection does not currently satisfy mandatory pre-submission conditions.",
      );
      return;
    }
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await queue.submitInspection(id);
      setShowSubmitModal(false);
      await loadData();
      Alert.alert(
        "Inspection Submitted",
        "The inspection record has been officially signed and queued in the offline outbox for server reconciliation.",
      );
    } catch (err: unknown) {
      Alert.alert("Submission Error", String(err));
    } finally {
      setActionBusy(false);
    }
  };

  // Helper to acquire location at evidence capture time (§2.5) - instant with fallback
  const getCaptureLocation = async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        // 1. Try instant last known location (0ms delay)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && Date.now() - lastKnown.timestamp < 120000) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
        }
        // 2. Fast race with 1.5s timeout for fresh GPS
        const posPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 1500),
        );
        const pos = await Promise.race([posPromise, timeoutPromise]);
        if (pos) {
          return {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        }
        if (lastKnown) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
        }
      }
    } catch {
      // Store null/undefined if unavailable per Rule 2.5
    }
    return {};
  };

  // Evidence Action: In-App Camera (§2.5, §30 - No external apps).
  // Photo or video is chosen inside the camera, the way a native camera app works.
  const handleOpenCamera = async () => {
    if (!id) return;
    try {
      const perms = await requestInspectionPermissions();
      if (!perms.camera) {
        Alert.alert(
          "Camera access needed",
          "Netram needs camera access to capture site evidence. You can enable it in Settings.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (Platform.OS !== "web" && Linking.openSettings) {
                  void Linking.openSettings();
                }
              },
            },
          ],
        );
        return;
      }
      setCameraModalMode("photo");
      setCameraModalVisible(true);
    } catch (err: unknown) {
      Alert.alert("Capture Error", err instanceof Error ? err.message : String(err));
    }
  };

  const openCheckIn = () =>
    router.push({ pathname: "/check-in", params: { inspectionId: id } });

  // Persist the captures the user reviewed and saved in the camera. Location is
  // attached to every item, since they were all taken in the same pass.
  const handleSaveMediaBatch = async (
    items: CapturedMediaItem[],
  ): Promise<boolean> => {
    if (!id || items.length === 0) return true;
    setActionBusy(true);
    try {
      const loc = await getCaptureLocation();
      for (const item of items) {
        const mediaResult = await captureEvidenceOffline(queue, {
          inspectionId: id,
          evidenceType: item.evidenceType,
          fileName: item.fileName,
          fileBytes: item.fileBytes,
          localFileUri: item.uri,
          mimeType: item.mimeType,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });

        let obsPayload = `[media:${mediaResult.evidenceId}]`;
        const caption = item.note.trim();
        if (caption.length > 0) {
          obsPayload += ` ${caption}`;
        }
        await queue.recordObservation(id, obsPayload);
      }

      await loadData();
      return true;
    } catch (err: unknown) {
      Alert.alert("Save Error", err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  const canSubmitInspection = useMemo(() => {
    if (status !== "in_progress") return false;
    return observations.length > 0 || findings.length > 0 || evidenceList.length > 0;
  }, [status, observations.length, findings.length, evidenceList.length]);

  // Derived media observations (Photo & Video evidence linked with their observation note)
  const mediaObservations = useMemo(() => {
    const captionMap: Record<string, string> = {};

    for (const obs of observations) {
      const mediaMatch = obs.text.match(/\[media:([^\]]+)\]/);
      if (mediaMatch && mediaMatch[1]) {
        const mediaId = mediaMatch[1];
        // "[voice:…]" is still stripped: observations captured before voice
        // notes were removed may carry the marker, and it is not display text.
        const cleanCaption = obs.text
          .replace(/\[media:[^\]]+\]/g, "")
          .replace(/\[voice:[^\]]+\]/g, "")
          .trim();
        if (cleanCaption) {
          captionMap[mediaId] = cleanCaption;
        }
      }
    }

    return evidenceList
      .filter((ev) => ev.evidence_type === "photo" || ev.evidence_type === "video")
      .map((ev) => ({
        ...ev,
        caption: captionMap[ev.id] || null,
      }));
  }, [evidenceList, observations]);

  // Color theme tokens - follows user's dark/light mode preference
  const bgCanvas = theme.bgCanvas;
  const bgSurface = theme.bgSurface;
  const bgSubtle = isPureDark ? "#18181B" : theme.bgSubtle;
  const borderColor = theme.borderSubtle;
  const textPrimary = theme.textPrimary;
  const textMuted = theme.textMuted;
  const accentBlue = theme.accentBlue;
  const navyDark = theme.navyDark;

  if (loading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: bgCanvas }]}>
        <ActivityIndicator size="large" color={accentBlue} />
      </SafeAreaView>
    );
  }

  // Only a genuine read failure gets the dead-end screen. A record that is
  // simply absent still renders the detail page, because the officer followed
  // a link to a real inspection and must not be bounced to another screen.
  if (!inspection && loadError) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
        <View
          style={[
            styles.inspTopBar,
            { backgroundColor: bgSurface, borderBottomColor: borderColor },
          ]}
        >
          <View style={styles.navRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Icon name="chevron-back" size={24} color={textPrimary} />
            </Pressable>
            <Text style={[styles.inspTitle, { color: textPrimary }]}>Inspection</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Inspection unavailable"
            subtitle={loadError}
            action={{ label: "Retry", onPress: () => void loadData() }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Helper row component for Facility specs
  const MetaRow = ({
    label,
    value,
    mono,
    bold,
    badge,
  }: {
    label: string;
    value?: string;
    mono?: boolean;
    bold?: boolean;
    badge?: React.ReactNode;
  }) => (
    <View style={[styles.metaRow, { borderBottomColor: borderColor }]}>
      <Text style={[styles.metaLabel, { color: textMuted }]}>{label}</Text>
      {badge ? (
        badge
      ) : (
        <Text
          style={[
            styles.metaValue,
            { color: textPrimary },
            bold && { fontWeight: "700" },
            mono && { fontFamily: typography.mono, color: accentBlue },
          ]}
        >
          {value ?? "-"}
        </Text>
      )}
    </View>
  );

  // The schema has no inspection code, only the uuid. Show a short, stable
  // reference an inspector can read out over the phone.
  const inspectionRef = inspection?.id
    ? `INSP-${inspection.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
    : undefined;

  const SectionHeading = ({ title, count }: { title: string; count?: number }) => (
    <View style={styles.cleanSectionHeadingRow}>
      <Text style={[styles.cleanSectionHeading, { color: accentBlue }]}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.sectionCountPill, { backgroundColor: bgSubtle }]}>
          <Text style={[styles.sectionCountText, { color: textMuted }]}>{count}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      <View style={[styles.container, { backgroundColor: bgCanvas }]}>
        {/* ── TOP BAR (video-call style) ── */}
        <View
          style={[
            styles.inspTopBar,
            { backgroundColor: bgSurface, borderBottomColor: borderColor },
          ]}
        >
          <View style={styles.navRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Icon name="chevron-back" size={24} color={textPrimary} />
            </Pressable>

            <View style={styles.inspTitleGroup}>
              <Text style={[styles.inspTitle, { color: textPrimary }]} numberOfLines={1}>
                {project?.name || inspection?.project_name || "Inspection"}
              </Text>
              <Text style={[styles.inspSubtitle, { color: textMuted }]} numberOfLines={1}>
                {project?.code || inspection?.project_code || ""}
                {inspection?.district_id ? ` · ${inspection.district_id}` : ""}
              </Text>
            </View>

          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageContainer}>
            {/* ──────────────── FACILITY DOSSIER ──────────────── */}
            <>
                {/* FACILITY IDENTITY */}
                <View style={styles.cleanSection}>
                  <SectionHeading title="Facility Identity" />
                  <MetaRow label="Inspection Ref" value={inspectionRef} mono />
                  <MetaRow
                    label="Project Code"
                    value={project?.code || inspection?.project_code}
                    mono
                  />
                  <MetaRow
                    label="Type"
                    value={formatInspectionType(project?.type || inspection?.type)}
                  />
                  <MetaRow label="Operating Agency" value={organisation?.name} />
                  <MetaRow
                    label="Status"
                    value={(project?.status || inspection?.status || "active")
                      .replace(/_/g, " ")
                      .toUpperCase()}
                  />
                  <Pressable
                    style={[styles.metaRow, { borderBottomColor: borderColor }]}
                    onPress={openCheckIn}
                    accessibilityRole="button"
                    accessibilityLabel="View site on map"
                  >
                    <Text style={[styles.metaLabel, { color: textMuted }]}>Location</Text>
                    <View style={styles.metaLinkValue}>
                      <Text style={[styles.metaValue, { color: accentBlue }]}>View on Map</Text>
                      <Icon name="chevron-forward" size={14} color={accentBlue} />
                    </View>
                  </Pressable>
                </View>

                {/* FUNDS & SANCTIONS */}
                {fundOverview && (
                  <View style={styles.cleanSection}>
                    <SectionHeading title="Funds & Sanctions" />
                    <MetaRow
                      label="Total Sanctioned"
                      value={formatCurrencyString(fundOverview.summary.totalAllocated)}
                      bold
                    />
                    <MetaRow
                      label="Total Released"
                      value={formatCurrencyString(fundOverview.summary.totalReleased)}
                    />
                    <MetaRow
                      label="Total Expended"
                      value={formatCurrencyString(fundOverview.summary.totalExpenditure)}
                    />
                    <View style={styles.utilisationBlock}>
                      <View style={styles.utilisationHeader}>
                        <Text style={[styles.utilisationLabel, { color: textMuted }]}>
                          UTILISATION
                        </Text>
                        <Text style={[styles.utilisationValue, { color: accentBlue }]}>
                          {fundOverview.summary.utilizationRate.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={[styles.utilisationTrack, { backgroundColor: bgSubtle }]}>
                        <View
                          style={[
                            styles.utilisationFill,
                            {
                              backgroundColor: accentBlue,
                              width: `${Math.min(100, Math.max(0, fundOverview.summary.utilizationRate))}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* ADVISORY FLAGS */}
                {inspectionFlags.length > 0 && (
                  <View style={styles.cleanSection}>
                    <SectionHeading title="Advisory Flags" count={inspectionFlags.length} />
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {inspectionFlags.map((flag) => (
                        <View
                          key={flag.id}
                          style={[
                            styles.cleanFlagRow,
                            {
                              backgroundColor: bgSubtle,
                              borderLeftColor:
                                flag.riskLevel === "high" || flag.riskLevel === "critical"
                                  ? "#EF4444"
                                  : accentBlue,
                            },
                          ]}
                        >
                          <View style={styles.flagTopRow}>
                            <NetramBadge
                              label={flag.riskLevel.toUpperCase()}
                              variant="severity"
                              severity={flag.riskLevel}
                              size="sm"
                            />
                          </View>
                          <Text style={[styles.flagText, { color: textPrimary }]}>
                            {flag.explanation}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>

            {/* ──────────────── OBSERVATIONS ──────────────── */}
            <View style={styles.cleanSection}>
              <SectionHeading title="Observations" count={mediaObservations.length} />
              {/* Sideways roll: one row of evidence instead of a tall stack. */}
              {mediaObservations.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.obsStrip}
                >
                  {mediaObservations.map((item) => {
                    const isVideo = isVideoMedia(item);
                    const synced = item.upload_state === "uploaded";

                    return (
                      <View
                        key={item.id}
                        style={[styles.obsTile, { backgroundColor: bgSurface, borderColor }]}
                      >
                        <Pressable
                          style={[styles.obsTileMedia, { backgroundColor: bgSubtle }]}
                          onPress={() => setPreviewMedia(item)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isVideo ? "Play observation video" : "Open observation photo"
                          }
                        >
                          {!isVideo && item.local_file_uri ? (
                            <Image
                              source={{ uri: item.local_file_uri }}
                              style={styles.obsImage}
                              resizeMode="cover"
                            />
                          ) : isVideo && item.local_file_uri ? (
                            <InteractiveVideoPlayer
                              src={item.local_file_uri}
                              style={styles.obsImage}
                            />
                          ) : (
                            <View style={styles.obsVideoPlaceholder}>
                              <Icon
                                name={isVideo ? "videocam" : "camera"}
                                size={32}
                                color={isVideo ? navyDark : accentBlue}
                              />
                            </View>
                          )}

                          {/* Capture time and upload state sit on the media
                              itself, so a tile stays one clean block. */}
                          <View style={styles.obsTileOverlay}>
                            <View style={styles.obsTimeRow}>
                              <Icon name="time-outline" size={11} color="#FFFFFF" />
                              <Text style={styles.obsTimeText}>
                                {new Date(item.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>

                            {/* Icon only, but labelled so the state is still
                                announced rather than read as decoration. */}
                            <View
                              accessibilityRole="image"
                              accessibilityLabel={synced ? "Synced" : "Not synced"}
                            >
                              <Icon
                                name={synced ? "cloud-done" : "cloud-offline-outline"}
                                size={13}
                                color={synced ? "#4ADE80" : "#FBBF24"}
                              />
                            </View>
                          </View>
                        </Pressable>

                        {item.caption ? (
                          <Text
                            style={[styles.obsTileCaption, { color: textPrimary }]}
                            numberOfLines={3}
                          >
                            {item.caption}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={[styles.obsEmptyCard, { backgroundColor: bgSurface, borderColor }]}>
                  <Icon name="camera-outline" size={44} color={accentBlue} />
                  <Text style={[styles.obsEmptyTitle, { color: textPrimary }]}>
                    No observations recorded
                  </Text>
                </View>
              )}
            </View>

          </View>
        </ScrollView>

        {/* ── BOTTOM ACTION BAR: capture + the one primary workflow action ── */}
        {(isFieldStage || canStart) && (
          <View
            style={[styles.actionBar, { backgroundColor: bgSurface, borderTopColor: borderColor }]}
          >
            {canStart ? (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBarPrimary,
                  { backgroundColor: accentBlue },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleStartInspection}
                disabled={actionBusy}
                accessibilityRole="button"
                accessibilityLabel="Start inspection"
              >
                <Icon name="play" size={16} color="#FFFFFF" />
                <Text style={styles.actionBarPrimaryText}>Start Inspection</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBarPrimary,
                  {
                    backgroundColor: canSubmitInspection
                      ? theme.actionGreen
                      : theme.textMuted,
                  },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleSubmitInspection}
                disabled={actionBusy}
                accessibilityRole="button"
                accessibilityLabel="Submit inspection"
              >
                <Text style={styles.actionBarPrimaryText}>Submit Inspection</Text>
              </Pressable>
            )}

            {isFieldStage && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBarCapture,
                  { backgroundColor: accentBlue },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleOpenCamera}
                accessibilityRole="button"
                accessibilityLabel="Open camera to capture photo or video"
              >
                <Icon name="camera" size={24} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        )}

        {/* ── MODAL: Media Full Preview ── */}
        <Modal
          visible={previewMedia !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewMedia(null)}
        >
          <View style={styles.previewModalOverlay}>
            {/* Frameless lightbox: media edge-to-edge on pure black, no card chrome. */}
            <View
              style={[
                styles.previewLightbox,
                { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
              ]}
            >
              <View style={styles.previewModalHeader}>
                <Pressable
                  onPress={() => setPreviewMedia(null)}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel="Close preview"
                >
                  <Icon name="close" size={26} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.previewMediaContent}>
                {previewMedia && !isVideoMedia(previewMedia) && previewMedia.local_file_uri ? (
                  <Image
                    source={{ uri: previewMedia.local_file_uri }}
                    style={styles.previewMediaImage}
                    resizeMode="contain"
                  />
                ) : previewMedia && isVideoMedia(previewMedia) && previewMedia.local_file_uri ? (
                  <InteractiveVideoPlayer
                    src={previewMedia.local_file_uri}
                    autoPlay
                    style={styles.previewMediaImage}
                  />
                ) : (
                  <View style={styles.previewMediaPlaceholder}>
                    <Icon name="videocam" size={56} color="#FFFFFF" />
                  </View>
                )}
              </View>

              {previewMedia?.caption || previewMedia?.created_at ? (
                <View style={styles.previewMetaBar}>
                  {previewMedia?.caption ? (
                    <Text style={styles.previewCaptionText}>{previewMedia.caption}</Text>
                  ) : null}
                  {previewMedia?.created_at ? (
                    <View style={styles.obsTimeRow}>
                      <Icon name="time-outline" size={13} color="#FFFFFF" />
                      <Text style={styles.obsTimeText}>
                        {new Date(previewMedia.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* ── MODAL: Official Submission Confirmation ── */}
        <Modal
          visible={showSubmitModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSubmitModal(false)}
        >
          <View
            style={[
              styles.modalOverlay,
              { backgroundColor: isPureDark ? "rgba(0,0,0,0.85)" : "rgba(0, 36, 73, 0.65)" },
            ]}
          >
            <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                OFFICIAL FIELD SIGN-OFF
              </Text>
              <Text style={[styles.modalSubtitle, { color: textMuted }]}>
                Netram Field Inspection Oversight Protocol
              </Text>

              {/* Project / Facility Summary */}
              <View style={[styles.declarationBox, { backgroundColor: bgSubtle, borderColor }]}>
                <Text style={[styles.declarationTitle, { color: accentBlue }]}>
                  FACILITY VERIFICATION
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: textPrimary }}>
                  {inspection?.project_name || project?.name || "Facility Site"}
                </Text>
                <Text style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                  {[
                    inspection?.project_code,
                    inspection?.district_id && `${inspection.district_id} District`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "-"}
                </Text>
              </View>

              {/* Metric Summary Grid */}
              <View style={styles.submitSummaryGrid}>
                <View
                  style={[styles.submitSummaryCell, { backgroundColor: bgSubtle, borderColor }]}
                >
                  <Text style={[styles.submitSummaryLabel, { color: textMuted }]}>Field Notes</Text>
                  <Text style={[styles.submitSummaryValue, { color: textPrimary }]}>
                    {observations.length}
                  </Text>
                </View>
                <View
                  style={[styles.submitSummaryCell, { backgroundColor: bgSubtle, borderColor }]}
                >
                  <Text style={[styles.submitSummaryLabel, { color: textMuted }]}>
                    Media Evidence
                  </Text>
                  <Text style={[styles.submitSummaryValue, { color: textPrimary }]}>
                    {evidenceList.length}
                  </Text>
                </View>
              </View>

              {/* Formal Statutory Declaration */}
              <View
                style={[
                  styles.declarationBox,
                  {
                    backgroundColor: isPureDark ? "#112211" : "#F0FDF4",
                    borderColor: theme.actionGreen,
                  },
                ]}
              >
                <Text style={[styles.declarationTitle, { color: theme.actionGreen }]}>
                  STATUTORY DECLARATION
                </Text>
                <Text style={[styles.declarationText, { color: textPrimary }]}>
                  "I hereby solemnly declare that this inspection was conducted in person within the
                  designated geofence boundary, and the field notes and media evidence recorded herein
                  represent an accurate on-site verification."
                </Text>
              </View>

              <View style={styles.modalBtnRow}>
                <NetramButton
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setShowSubmitModal(false)}
                  style={styles.modalActionBtn}
                />
                <NetramButton
                  label="Sign & Submit"
                  variant="primary"
                  loading={actionBusy}
                  disabled={actionBusy}
                  onPress={handleConfirmSubmit}
                  style={[styles.modalActionBtn, { backgroundColor: theme.actionGreen }]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* ── MODAL: In-App Camera & Video Recorder (No External Apps) ── */}
        <InAppCameraModal
          visible={cameraModalVisible}
          initialMode={cameraModalMode}
          onClose={() => setCameraModalVisible(false)}
          onSaveMedia={handleSaveMediaBatch}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },

  // Video-call-style top bar
  inspTopBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inspTitleGroup: {
    flex: 1,
    marginHorizontal: 10,
    gap: 1,
  },
  inspTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  inspSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Underline tab bar (video-call style)
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cleanSection: {
    marginBottom: 22,
  },
  pageContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  cleanSectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  sectionCountText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cleanSectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
    paddingBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    flex: 1,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  metaLinkValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cleanFlagRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderRadius: 4,
    gap: 4,
  },
  flagTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flagText: {
    fontSize: 13,
    lineHeight: 18,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalActionBtn: {
    flex: 1,
  },

  // ── In-progress banner styles ──────────────────────────────

  // ── Tab bar styles ─────────────────────────────────────────

  submitSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 12,
  },
  submitSummaryCell: {
    flex: 1,
    minWidth: 90,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  submitSummaryLabel: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  submitSummaryValue: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  declarationBox: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: 10,
  },
  declarationTitle: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: typography.mono,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  declarationText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
  },

  // ── Preview Modal Styles ──────────────────────────────────
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  previewLightbox: {
    flex: 1,
    gap: 16,
  },
  previewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  previewMediaContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewMediaImage: {
    width: "100%",
    height: "100%",
  },
  previewMediaPlaceholder: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  previewMetaBar: {
    paddingHorizontal: 16,
    gap: 6,
  },
  previewCaptionText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBarCapture: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  actionBarPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
  },
  actionBarPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  obsStrip: {
    gap: 12,
    paddingRight: 4,
  },
  obsTile: {
    width: 210,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  obsTileMedia: {
    width: "100%",
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  obsTileOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  obsTileCaption: {
    fontSize: 12,
    lineHeight: 17,
    padding: 10,
  },
  obsImage: {
    width: "100%",
    height: "100%",
  },
  obsVideoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  obsTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  obsTimeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  utilisationBlock: {
    marginTop: 10,
    gap: 6,
  },
  utilisationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  utilisationLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  utilisationValue: {
    fontSize: 12,
    fontWeight: "800",
  },
  utilisationTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  utilisationFill: {
    height: 6,
    borderRadius: 3,
  },
  obsEmptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  obsEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
});
