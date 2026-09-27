import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { Icon } from "../src/components/ui/Icon";
import { NetramBadge } from "../src/components/ui/NetramBadge";
import { NetramCard } from "../src/components/ui/NetramCard";
import { EmptyState } from "../src/components/ui/EmptyState";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "../src/offline/queue";

type HistoryFilter = "ALL" | "SUBMITTED" | "CLOSED" | "IN_PROGRESS";

export default function HistoryScreen() {
  const router = useRouter();
  const { theme, isPureDark } = useSettings();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const records = await queue.getCachedInspections();
      // Inspected areas: submitted, closed, or in_progress (actively inspected)
      const inspected = records.filter(
        (r) =>
          r.status === "submitted" ||
          r.status === "closed" ||
          r.status === "in_progress",
      );
      setInspections(inspected);
    } catch {
      // ignore
    }
  }, [queue]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredInspections = useMemo(() => {
    let list = inspections;

    if (selectedFilter !== "ALL") {
      list = list.filter((i) => i.status === selectedFilter.toLowerCase());
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.project_name && i.project_name.toLowerCase().includes(q)) ||
          (i.project_code && i.project_code.toLowerCase().includes(q)) ||
          (i.district_id && i.district_id.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [inspections, selectedFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: inspections.length,
      submitted: inspections.filter((i) => i.status === "submitted").length,
      closed: inspections.filter((i) => i.status === "closed").length,
      inProgress: inspections.filter((i) => i.status === "in_progress").length,
    };
  }, [inspections]);

  const filters: { key: HistoryFilter; label: string; count: number }[] = [
    { key: "ALL", label: "ALL AUDITED", count: counts.all },
    { key: "SUBMITTED", label: "SUBMITTED", count: counts.submitted },
    { key: "CLOSED", label: "CLOSED", count: counts.closed },
    { key: "IN_PROGRESS", label: "IN FIELD", count: counts.inProgress },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bgCanvas }]}>
      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { backgroundColor: theme.bgSurface, borderBottomColor: theme.borderSubtle }]}>
        {router.canGoBack() ? (
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Icon name="arrow-back" size={20} color={theme.navyDark} />
            <Text style={[styles.backText, { color: theme.navyDark }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
        <Text style={[styles.topBarTitle, { color: theme.navyDark }]}>Past Inspections</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* ── Summary KPI Bar ── */}
      <View style={[styles.kpiStrip, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: theme.navyDark }]}>{counts.all}</Text>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Total</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: theme.borderSubtle }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: theme.actionGreen }]}>{counts.submitted}</Text>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Submitted</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: theme.borderSubtle }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: theme.textMuted }]}>{counts.closed}</Text>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>Completed</Text>
        </View>
      </View>

      {/* ── Search Input ── */}
      <View style={styles.searchBoxContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
          <Icon name="search-outline" size={17} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search inspected facilities or districts…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.textSubtle}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Icon name="close-circle" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Filter Chips ── */}
      <View style={styles.filterChipContainer}>
        {filters.map((f) => {
          const active = selectedFilter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? theme.navyDark : theme.bgSubtle,
                  borderColor: active ? theme.navyDark : theme.borderSubtle,
                },
              ]}
              onPress={() => setSelectedFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? "#FFFFFF" : theme.textMuted },
                ]}
              >
                {f.label} ({f.count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Inspected List ── */}
      <FlatList
        data={filteredInspections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.navyDark}
          />
        }
        renderItem={({ item }) => {
          const inspectionDate = item.submitted_at || item.started_at || item.scheduled_start;
          const dateStr = inspectionDate
            ? new Date(inspectionDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent";

          return (
            <NetramCard
              style={[
                styles.historyCard,
                {
                  backgroundColor: theme.bgSurface,
                  borderColor: theme.borderSubtle,
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/inspections/[id]",
                  params: { id: item.id },
                })
              }
            >
              <View style={styles.cardTopRow}>
                <NetramBadge label={item.project_code || "PRJ"} variant="id" size="sm" />
                <NetramBadge
                  label={item.status.replace(/_/g, " ").toUpperCase()}
                  variant="status"
                  status={item.status}
                  size="sm"
                />
              </View>

              <Text style={[styles.facilityName, { color: theme.textPrimary }]} numberOfLines={2}>
                {item.project_name || "Inspected Facility"}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Icon name="location-outline" size={13} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>{item.district_id || "Khordha"}</Text>
                </View>

                <View style={styles.metaItem}>
                  <Icon name="calendar-outline" size={13} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>{dateStr}</Text>
                </View>

                <View style={styles.metaItem}>
                  <Icon name="shield-checkmark-outline" size={13} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {(item.type || "routine").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: theme.borderSubtle }]}>
                <Text style={[styles.auditProofText, { color: theme.actionGreen }]}>
                  {item.status === "submitted"
                    ? "✓ Inspection submitted"
                    : item.status === "closed"
                    ? "✓ Inspection completed"
                    : "• Inspection in progress"}
                </Text>
                <Text style={[styles.viewLink, { color: theme.accentBlue }]}>View Record →</Text>
              </View>
            </NetramCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No Inspected Records Found"
            subtitle={
              searchQuery
                ? "No completed audits match your query."
                : "Inspections will appear in this history log once submitted or audited."
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0B2545",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B2545",
  },
  kpiStrip: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  kpiItem: {
    flex: 1,
    alignItems: "center",
  },
  kpiDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0B2545",
    fontFamily: typography.mono,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  searchBoxContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#F8FAFC",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  filterChipContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#0B2545",
    borderColor: "#0B2545",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    fontFamily: typography.mono,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 4,
  },
  historyCard: {
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  facilityName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  auditProofText: {
    fontSize: 10,
    color: "#166534",
    fontWeight: "600",
    flex: 1,
  },
  viewLink: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
});
