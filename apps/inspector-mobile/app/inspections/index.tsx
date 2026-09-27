import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { typography } from "../../src/theme/colors";
import { useSettings } from "../../src/theme/settings-context";
import { EmptyState, ScreenHeader, Icon, NetramBadge } from "../../src/components/ui";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "../../src/offline/queue";
import { useAuth } from "../../src/auth/auth-context";
import { seedDemoDataIfEmpty } from "../../src/offline/demo-seed";

type FilterTab = "ALL" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "ALL" },
  { key: "ASSIGNED", label: "ASSIGNED" },
  { key: "IN_PROGRESS", label: "IN PROGRESS" },
  { key: "COMPLETED", label: "COMPLETED" },
];

export default function InspectionsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { client } = useAuth();
  const { theme } = useSettings();
  const queue = useMemo(() => new OfflineInspectionQueue(), []);

  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (params.tab) {
      const upper = params.tab.toUpperCase();
      if (upper === "IN_PROGRESS") setSelectedTab("IN_PROGRESS");
      else if (upper === "ASSIGNED") setSelectedTab("ASSIGNED");
      else if (upper === "ALL") setSelectedTab("ALL");
      else if (upper === "COMPLETED") setSelectedTab("COMPLETED");
    }
  }, [params.tab]);

  const loadLocalInspections = useCallback(async () => {
    try {
      await seedDemoDataIfEmpty();
      const cached = await queue.getCachedInspections();
      setInspections(cached);
      const ops = await queue.getAllOperations();
      const checkedSet = new Set(
        ops
          .filter(
            (o) =>
              o.operation_type === "check_in" ||
              o.operation_type === "start_inspection",
          )
          .map((o) => o.inspection_id),
      );
      setCheckedInIds(checkedSet);
    } catch (err) {
      console.warn("Failed to load local inspections:", err);
    }
  }, [queue]);

  useEffect(() => {
    void loadLocalInspections();
  }, [loadLocalInspections]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (!client) {
      setIsOffline(true);
      await loadLocalInspections();
      setRefreshing(false);
      return;
    }
    try {
      const page = await client.listInspections({ pageSize: 50 });
      await queue.cacheInspections(page.items);
      setIsOffline(false);
      await loadLocalInspections();
    } catch {
      setIsOffline(true);
      await loadLocalInspections();
    } finally {
      setRefreshing(false);
    }
  };

  // Counts
  const counts = useMemo(() => {
    const inProgress = inspections.filter((i) => i.status === "in_progress").length;
    const assigned = inspections.filter((i) => i.status === "assigned").length;
    const completed = inspections.filter(
      (i) => i.status === "submitted" || i.status === "closed",
    ).length;
    return { inProgress, assigned, completed, all: inspections.length };
  }, [inspections]);

  const filteredInspections = useMemo(() => {
    let result = inspections;
    if (selectedTab === "IN_PROGRESS") {
      result = result.filter((i) => i.status === "in_progress");
    } else if (selectedTab === "ASSIGNED") {
      result = result.filter((i) => i.status === "assigned");
    } else if (selectedTab === "COMPLETED") {
      result = result.filter(
        (i) => i.status === "submitted" || i.status === "closed",
      );
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (i) =>
          (i.project_name && i.project_name.toLowerCase().includes(query)) ||
          (i.project_code && i.project_code.toLowerCase().includes(query)) ||
          (i.district_id && i.district_id.toLowerCase().includes(query)),
      );
    }
    return result;
  }, [inspections, selectedTab, searchQuery]);

  const getTabCount = (key: FilterTab) => {
    if (key === "IN_PROGRESS") return counts.inProgress;
    if (key === "ASSIGNED") return counts.assigned;
    if (key === "COMPLETED") return counts.completed;
    return counts.all;
  };

  const navyDark = theme.navyDark;
  const borderColor = theme.borderSubtle;
  const textMuted = theme.textMuted;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bgCanvas }]}>
      <View style={[styles.container, { backgroundColor: theme.bgCanvas }]}>
        {/* ── Screen Header ── */}
        <ScreenHeader
          title="Field Assignments"
          subtitle="Assigned inspection schedule"
        />

        {/* ── Offline Indicator ── */}
        {isOffline && (
          <View style={[styles.offlineBanner, { backgroundColor: theme.bgSubtle, borderColor }]}>
            <Icon name="cloud-offline-outline" size={13} color={textMuted} />
            <Text style={[styles.offlineBannerText, { color: textMuted }]}>
              Offline — Showing Cached Data
            </Text>
          </View>
        )}

        {/* ── Search Bar ── */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.bgSurface,
              borderColor: searchFocused ? theme.accentBlue : borderColor,
            },
          ]}
        >
          <Icon name="search-outline" size={16} color={searchFocused ? theme.accentBlue : textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search facility, code, or district..."
            placeholderTextColor={theme.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8} accessibilityLabel="Clear search">
              <Icon name="close-circle" size={16} color={textMuted} />
            </Pressable>
          )}
        </View>

        {/* ── Filter Tabs ── */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = selectedTab === tab.key;
              const count = getTabCount(tab.key);
              return (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: isActive ? navyDark : theme.bgSubtle,
                      borderColor: isActive ? navyDark : borderColor,
                    },
                  ]}
                  onPress={() => setSelectedTab(tab.key)}
                  accessibilityLabel={`Filter by ${tab.label}`}
                >
                  <Text
                    style={[
                      styles.tabPillText,
                      { color: isActive ? "#FFFFFF" : textMuted },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.tabCount,
                      {
                        backgroundColor: isActive
                          ? "rgba(255,255,255,0.2)"
                          : theme.bgHover,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabCountText,
                        { color: isActive ? "#FFFFFF" : textMuted },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Inspection List ── */}
        <FlatList
          data={filteredInspections}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isUnlocked =
              item.status !== "assigned" || checkedInIds.has(item.id);
            const isInProgress = item.status === "in_progress";
            const isCompleted =
              item.status === "submitted" || item.status === "closed";

            // Status indicator icon & colors (call-list style)
            const iconName = isInProgress
              ? "play"
              : isCompleted
                ? "checkmark-circle"
                : "business-outline";
            const iconBg = isInProgress
              ? "rgba(245,158,11,0.12)"
              : isCompleted
                ? "rgba(22,163,74,0.12)"
                : "rgba(37,99,235,0.1)";
            const iconColor = isInProgress
              ? theme.gold
              : isCompleted
                ? theme.actionGreen
                : theme.accentBlue;

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.listRow,
                  {
                    borderBottomColor: borderColor,
                    backgroundColor: pressed ? theme.bgSubtle : "transparent",
                  },
                ]}
                onPress={() => router.push(`/inspections/${item.id}`)}
                accessibilityLabel={`Open inspection for ${item.project_name || "facility"}`}
              >
                {/* Left Status Icon Avatar */}
                <View style={[styles.rowAvatar, { backgroundColor: iconBg }]}>
                  <Icon name={iconName} size={18} color={iconColor} />
                </View>

                {/* Middle Content */}
                <View style={styles.rowMiddle}>
                  <Text
                    style={[styles.rowFacilityName, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {isUnlocked
                      ? item.project_name
                      : "Assigned Facility — Reach Site"}
                  </Text>

                  <View style={styles.rowMetaLine}>
                    {item.project_code && (
                      <Text style={[styles.rowProjectCode, { color: theme.accentBlue }]}>
                        {item.project_code}
                      </Text>
                    )}
                    {item.district_id && (
                      <>
                        <Text style={[styles.rowDot, { color: textMuted }]}>•</Text>
                        <Text style={[styles.rowMetaText, { color: textMuted }]}>
                          {item.district_id}
                        </Text>
                      </>
                    )}
                    {item.type && (
                      <>
                        <Text style={[styles.rowDot, { color: textMuted }]}>•</Text>
                        <Text style={[styles.rowMetaText, { color: textMuted }]}>
                          {item.type.replace(/_/g, " ")}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Right: Status badge & Arrow Mark */}
                <View style={styles.rowRight}>
                  <NetramBadge
                    label={item.status.replace(/_/g, " ").toUpperCase()}
                    variant="status"
                    status={item.status}
                    size="sm"
                  />
                  <Icon name="chevron-forward" size={16} color={textMuted} />
                </View>
              </Pressable>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={navyDark}
              colors={[navyDark]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-outline"
              title={
                searchQuery
                  ? "No Matching Inspections"
                  : selectedTab === "ASSIGNED"
                    ? "No Upcoming Assignments"
                    : selectedTab === "IN_PROGRESS"
                      ? "No Active Inspections"
                      : selectedTab === "COMPLETED"
                        ? "No Completed Inspections"
                        : "No Inspections"
              }
              subtitle={
                searchQuery
                  ? `No inspection found matching "${searchQuery}".`
                  : "All assignments are up to date."
              }
              action={
                searchQuery
                  ? { label: "Clear Search", onPress: () => setSearchQuery("") }
                  : { label: "Refresh from Server", onPress: handleRefresh }
              }
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  // ── Offline Banner ──
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  offlineBannerText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: typography.mono,
  },

  // ── Search Bar ──
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
  },
  // ── Filter Tabs ──
  tabsWrapper: {
    marginBottom: 10,
  },
  tabsContainer: {
    gap: 6,
    paddingVertical: 2,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  tabPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tabCount: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: "700",
    fontFamily: typography.mono,
  },
  // ── List ──
  listContent: {
    paddingBottom: 28,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMiddle: {
    flex: 1,
    gap: 3,
  },
  rowFacilityName: {
    fontSize: 14,
    fontWeight: "700",
  },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  rowProjectCode: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.mono,
  },
  rowDot: {
    fontSize: 11,
    marginHorizontal: 4,
  },
  rowMetaText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
