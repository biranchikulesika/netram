import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// The RN-core SafeAreaView is an iOS-only no-op; edge-to-edge Android (SDK 35)
// draws content under the status bar unless insets come from this package.
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSettings } from "../src/theme/settings-context";
import { Icon } from "../src/components/ui/Icon";
import { NetramCard } from "../src/components/ui/NetramCard";
import { EmptyState } from "../src/components/ui/EmptyState";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "../src/offline/queue";
import { useAuth } from "../src/auth/auth-context";
import { CustomDatePicker } from "../src/components/CustomDatePicker";
import { formatInspectionType } from "../src/utils/formatters";

type HistoryFilter = "ALL" | "SUBMITTED" | "CLOSED" | "IN_PROGRESS";
type DateFilter = "all" | "7d" | "month" | "year" | "lastyear" | "custom";

const DATE_PILLS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "7d", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "year", label: "Current Year" },
  { key: "lastyear", label: "Last Year" },
  { key: "custom", label: "Custom" },
];

interface InspectionType {
  key: string;
  label: string;
}

const TYPE_OPTIONS: InspectionType[] = [
  { key: "ALL", label: "All" },
  { key: "routine", label: "Routine" },
  { key: "surprise", label: "Surprise" },
  { key: "special", label: "Special" },
  { key: "social_audit", label: "Social audit" },
];

export default function HistoryScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user } = useAuth();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<"date" | "status" | "type">("date");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pickerTarget, setPickerTarget] = useState<"from" | "to" | null>(null);
  const hasActiveFilter = dateFilter !== "all" || selectedFilter !== "ALL" || typeFilter !== "ALL";

  useEffect(() => {
    if (!hasActiveFilter) return;
    const t = setTimeout(
      () => {
        setDateFilter("all");
        setSelectedFilter("ALL");
        setTypeFilter("ALL");
        setCustomFrom("");
        setCustomTo("");
      },
      5 * 60 * 1000,
    );
    return () => clearTimeout(t);
  }, [hasActiveFilter]);

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fmtDisplay = (s: string) =>
    s
      ? new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Select date";

  const isInvalidRange = Boolean(customFrom && customTo && customTo < customFrom);

  const handlePickerSelect = (value: string) => {
    if (pickerTarget === "from") {
      setCustomFrom(value);
      if (customTo && customTo < value) {
        setCustomTo(value);
      }
    } else {
      if (customFrom && value < customFrom) {
        setCustomTo(customFrom);
      } else {
        setCustomTo(value);
      }
    }
  };

  const loadData = useCallback(async () => {
    try {
      const records = await queue.getCachedInspections();
      // Only show inspections assigned to the logged-in inspector
      const assigned = user?.id
        ? records.filter((r) => {
            try {
              const ids = JSON.parse(r.assigned_user_ids || "[]") as string[];
              return ids.includes(user.id);
            } catch {
              return false;
            }
          })
        : records;
      // Inspected areas: submitted, closed, or in_progress (actively inspected)
      const inspected = assigned.filter(
        (r) => r.status === "submitted" || r.status === "closed" || r.status === "in_progress",
      );
      setInspections(inspected);
    } catch {
      // ignore
    }
  }, [queue, user?.id]);

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

    if (typeFilter !== "ALL") {
      list = list.filter((i) => (i.type || "routine").toLowerCase() === typeFilter.toLowerCase());
    }

    if (selectedFilter !== "ALL") {
      list = list.filter((i) => i.status === selectedFilter.toLowerCase());
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      list = list.filter((i) => {
        const raw = i.submitted_at || i.started_at || i.scheduled_start;
        const dt = raw ? new Date(raw) : null;
        if (!dt || isNaN(dt.getTime())) {
          return dateFilter === "custom" && !customFrom && !customTo;
        }
        if (dateFilter === "7d") {
          return dt >= new Date(startOfToday.getTime() - 6 * 86400000);
        }
        if (dateFilter === "month") {
          return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
        }
        if (dateFilter === "year") {
          return dt.getFullYear() === now.getFullYear();
        }
        if (dateFilter === "lastyear") {
          return dt.getFullYear() === now.getFullYear() - 1;
        }
        if (dateFilter === "custom") {
          if (!customFrom || !customTo || customTo < customFrom) return false;
          const from = new Date(`${customFrom}T00:00:00`);
          const to = new Date(`${customTo}T23:59:59.999`);
          if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
          return dt >= from && dt <= to;
        }
        return true;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.project_name && i.project_name.toLowerCase().includes(q)) ||
          (i.project_code && i.project_code.toLowerCase().includes(q)) ||
          (i.district_name && i.district_name.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [inspections, selectedFilter, searchQuery, dateFilter, typeFilter, customFrom, customTo]);

  const filters: { key: HistoryFilter; label: string }[] = [
    { key: "ALL", label: "ALL AUDITED" },
    { key: "SUBMITTED", label: "SUBMITTED" },
    { key: "CLOSED", label: "CLOSED" },
    { key: "IN_PROGRESS", label: "IN FIELD" },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bgCanvas }]}>
      {/* ── Search Row (search bar + filter chip) ── */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
          ]}
        >
          <Icon name="search-outline" size={17} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search"
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

        <Pressable
          style={[
            styles.filterBtn,
            { borderColor: hasActiveFilter ? theme.navyDark : theme.borderSubtle },
          ]}
          onPress={() => setShowFilterSheet(true)}
          accessibilityLabel="Open history filters"
        >
          <Icon
            name="funnel-outline"
            size={16}
            color={hasActiveFilter ? theme.navyDark : theme.textMuted}
          />
        </Pressable>
      </View>

      {/* ── Filter Bottom Sheet ── */}
      <Modal
        visible={showFilterSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <View style={styles.sheetModalRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowFilterSheet(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.bgSurface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.borderSubtle }]} />
            <Text style={[styles.sheetHeader, { color: theme.textMuted }]}>Filters</Text>
            <View style={styles.sheetBody}>
              {/* ── Left rail: filter tabs ── */}
              <View style={styles.sheetRail}>
                <Pressable
                  style={[
                    styles.sheetRailTab,
                    sheetTab === "date" && { backgroundColor: theme.accentBlue },
                  ]}
                  onPress={() => setSheetTab("date")}
                >
                  <Text
                    style={[
                      styles.sheetTabText,
                      { color: sheetTab === "date" ? "#FFFFFF" : theme.textMuted },
                    ]}
                  >
                    DATE
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.sheetRailTab,
                    sheetTab === "status" && { backgroundColor: theme.accentBlue },
                  ]}
                  onPress={() => setSheetTab("status")}
                >
                  <Text
                    style={[
                      styles.sheetTabText,
                      { color: sheetTab === "status" ? "#FFFFFF" : theme.textMuted },
                    ]}
                  >
                    STATUS
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.sheetRailTab,
                    sheetTab === "type" && { backgroundColor: theme.accentBlue },
                  ]}
                  onPress={() => setSheetTab("type")}
                >
                  <Text
                    style={[
                      styles.sheetTabText,
                      { color: sheetTab === "type" ? "#FFFFFF" : theme.textMuted },
                    ]}
                  >
                    TYPE
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
              >
                {sheetTab === "date" ? (
                  <>
                    <View style={styles.sheetPillWrap}>
                      {DATE_PILLS.map((p) => {
                        const active = dateFilter === p.key;
                        return (
                          <Pressable
                            key={p.key}
                            style={[
                              styles.sheetPill,
                              {
                                backgroundColor: active ? theme.navyDark : theme.bgSubtle,
                                borderColor: active ? theme.navyDark : theme.borderSubtle,
                              },
                            ]}
                            onPress={() => {
                              setDateFilter(p.key);
                              if (p.key === "custom") {
                                setCustomFrom(fmtDate(new Date(Date.now() - 7 * 86400000)));
                                setCustomTo(fmtDate(new Date()));
                              } else {
                                setCustomFrom("");
                                setCustomTo("");
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.sheetPillText,
                                { color: active ? "#FFFFFF" : theme.textMuted },
                              ]}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {dateFilter === "custom" ? (
                      <View style={styles.customRangeContainer}>
                        <View style={styles.customRange}>
                          <Pressable
                            style={[styles.outerBox, { borderColor: theme.borderSubtle }]}
                            onPress={() => setPickerTarget("from")}
                          >
                            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                              FROM
                            </Text>
                            <Text
                              style={[
                                styles.customValue,
                                { color: customFrom ? theme.textPrimary : theme.textSubtle },
                              ]}
                            >
                              {fmtDisplay(customFrom)}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.outerBox,
                              { borderColor: isInvalidRange ? theme.error : theme.borderSubtle },
                            ]}
                            onPress={() => setPickerTarget("to")}
                          >
                            <Text
                              style={[
                                styles.fieldLabel,
                                { color: isInvalidRange ? theme.error : theme.textMuted },
                              ]}
                            >
                              TO
                            </Text>
                            <Text
                              style={[
                                styles.customValue,
                                {
                                  color: customTo
                                    ? isInvalidRange
                                      ? theme.error
                                      : theme.textPrimary
                                    : theme.textSubtle,
                                },
                              ]}
                            >
                              {fmtDisplay(customTo)}
                            </Text>
                          </Pressable>
                        </View>
                        {isInvalidRange && (
                          <Text style={[styles.rangeErrorText, { color: theme.error }]}>
                            "To" date cannot be earlier than "From" date.
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </>
                ) : sheetTab === "status" ? (
                  <View style={styles.sheetPillWrap}>
                    {filters.map((f) => {
                      const active = selectedFilter === f.key;
                      return (
                        <Pressable
                          key={f.key}
                          style={[
                            styles.sheetPill,
                            {
                              backgroundColor: active ? theme.navyDark : theme.bgSubtle,
                              borderColor: active ? theme.navyDark : theme.borderSubtle,
                            },
                          ]}
                          onPress={() => setSelectedFilter(f.key)}
                        >
                          <Text
                            style={[
                              styles.sheetPillText,
                              { color: active ? "#FFFFFF" : theme.textMuted },
                            ]}
                          >
                            {f.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.sheetPillWrap}>
                    {TYPE_OPTIONS.map((t) => {
                      const active = typeFilter === t.key;
                      return (
                        <Pressable
                          key={t.key}
                          style={[
                            styles.sheetPill,
                            {
                              backgroundColor: active ? theme.navyDark : theme.bgSubtle,
                              borderColor: active ? theme.navyDark : theme.borderSubtle,
                            },
                          ]}
                          onPress={() => setTypeFilter(t.key)}
                        >
                          <Text
                            style={[
                              styles.sheetPillText,
                              { color: active ? "#FFFFFF" : theme.textMuted },
                            ]}
                          >
                            {t.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={styles.sheetFooter}>
              <Pressable
                style={[
                  styles.footerBtn,
                  {
                    backgroundColor: theme.bgSurface,
                    borderColor: hasActiveFilter ? theme.navyDark : theme.borderSubtle,
                  },
                ]}
                disabled={!hasActiveFilter}
                onPress={() => {
                  setDateFilter("all");
                  setSelectedFilter("ALL");
                  setTypeFilter("ALL");
                  setCustomFrom("");
                  setCustomTo("");
                  setShowFilterSheet(false);
                }}
              >
                <Text
                  style={[
                    styles.footerBtnText,
                    { color: hasActiveFilter ? theme.navyDark : theme.textMuted },
                  ]}
                >
                  Clear All
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.footerBtn,
                  styles.footerBtnPrimary,
                  { backgroundColor: isInvalidRange ? theme.borderSubtle : theme.navyDark },
                ]}
                disabled={isInvalidRange}
                onPress={() => {
                  if (!isInvalidRange) setShowFilterSheet(false);
                }}
              >
                <Text style={styles.footerBtnTextPrimary}>Show Results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CustomDatePicker
        visible={pickerTarget !== null}
        initialValue={pickerTarget === "from" ? customFrom : customTo}
        minDate={pickerTarget === "to" ? customFrom : undefined}
        maxDate={pickerTarget === "from" && customTo ? customTo : undefined}
        onSelect={handlePickerSelect}
        onClose={() => setPickerTarget(null)}
      />

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

          const statusLabel = item.status.replace(/_/g, " ").toUpperCase();

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
              <View style={styles.cardHeader}>
                <Text style={[styles.cardStatusLabel, { color: theme.textMuted }]}>
                  {statusLabel}
                </Text>
                <Text style={[styles.headerType, { color: theme.textMuted }]}>
                  {formatInspectionType(item.type)}
                </Text>
              </View>

              <Text style={[styles.facilityName, { color: theme.textPrimary }]} numberOfLines={2}>
                {item.project_name || "Inspected Facility"}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Icon
                    name="location-outline"
                    size={13}
                    color={theme.textMuted}
                    style={styles.metaIcon}
                  />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {item.district_name || "District unavailable"}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Icon
                    name="document-text-outline"
                    size={13}
                    color={theme.textMuted}
                    style={styles.metaIcon}
                  />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {item.project_code}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Icon
                    name="calendar-outline"
                    size={13}
                    color={theme.textMuted}
                    style={styles.metaIcon}
                  />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>{dateStr}</Text>
                </View>
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

const makeStyles = (theme: Record<string, string>) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bgSubtle,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.bgSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.textPrimary,
    height: 40,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
  },
  // ── Filter Bottom Sheet ──
  sheetModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    height: "70%",
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "left",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sheetBody: {
    flexDirection: "row",
    flex: 1,
    paddingBottom: 12,
  },
  sheetRail: {
    width: 76,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: theme.borderSubtle,
  },
  sheetRailTab: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  sheetTabText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sheetPillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sheetPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  sheetPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  customRangeContainer: {
    gap: 6,
    marginTop: 12,
  },
  customRange: {
    flexDirection: "row",
    gap: 10,
  },
  rangeErrorText: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 2,
  },
  outerBox: {
    width: 124,
    position: "relative",
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    gap: 2,
    backgroundColor: theme.bgSurface,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 0,
  },
  customValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerBtn: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnPrimary: {
    borderWidth: 0,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footerBtnTextPrimary: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 4,
  },
  historyCard: {
    padding: 16,
    backgroundColor: theme.bgSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    marginBottom: 10,
    height: 134,
    justifyContent: "space-between",
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
    color: theme.textPrimary,
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
    color: theme.textMuted,
    fontWeight: "500",
    includeFontPadding: false,
  },
  cardDivider: {
    height: 1,
    marginVertical: 4,
  },
});
