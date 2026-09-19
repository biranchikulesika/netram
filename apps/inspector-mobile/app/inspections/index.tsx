import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
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
import { useAuth } from "../_layout";
import { OfflineInspectionQueue } from "../../src/offline/queue.js";
import type { CachedInspectionRecord } from "../../src/offline/queue.js";

const queue = new OfflineInspectionQueue();

export default function InspectionsScreen() {
    const router = useRouter();
    const { client } = useAuth();

    const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const loadInspections = useCallback(async () => {
        try {
            setError(null);

            const cached = await queue.getCachedInspections();
            setInspections(cached);

            if (client) {
                const response = await client.listInspections({
                    pageSize: 50,
                });

                await queue.cacheInspections(response.items);

                const updated = await queue.getCachedInspections();
                setInspections(updated);
            }
        } catch (err) {
            console.error("Failed to load inspections:", err);
            setError("Unable to load inspections.");
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        void loadInspections();
    }, [loadInspections]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadInspections();
        setRefreshing(false);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "in_progress":
                return styles.statusProgress;
            case "submitted":
                return styles.statusSubmitted;
            case "closed":
                return styles.statusClosed;
            default:
                return styles.statusDefault;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "in_progress":
                return "IN PROGRESS";
            case "submitted":
                return "SUBMITTED";
            case "closed":
                return "CLOSED";
            default:
                return status.replace(/_/g, " ").toUpperCase();
        }
    };

    const filteredInspections = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return inspections;
        }

        return inspections.filter(
            (item) =>
                item.project_name.toLowerCase().includes(query) ||
                item.id.toLowerCase().includes(query)
        );
    }, [inspections, search]);

    const renderInspection = ({
        item,
    }: {
        item: CachedInspectionRecord;
    }) => (
        <Pressable
            style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
            ]}
            onPress={() => router.push(`/inspections/${item.id}`)}
        >
            <View style={styles.cardTop}>
                <View style={styles.titleArea}>
                    <Text style={styles.projectName} numberOfLines={2}>
                        {item.project_name}
                    </Text>

                    <View style={styles.idRow}>
                        <View style={styles.idDot} />
                        <Text style={styles.inspectionId}>
                            {item.id}
                        </Text>
                    </View>
                </View>

                <View style={[styles.status, getStatusStyle(item.status)]}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>

            </View>

            <View style={styles.divider} />

            <View style={styles.cardBottom}>
                <View>
                    <Text style={styles.metaLabel}>FIELD INSPECTION</Text>
                    <Text style={styles.metaValue}>Open inspection →</Text>
                </View>

                <Text style={styles.arrow}>›</Text>
            </View>
        </Pressable>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>
                        Loading inspections...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.headerText}>
                        <Text style={styles.eyebrow}>NETRAM FIELD</Text>

                        <Text style={styles.headerTitle}>
                            My inspections
                        </Text>

                        <Text style={styles.headerSubtitle}>
                            Your assigned field work
                        </Text>
                    </View>

                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>
                            {filteredInspections.length}
                        </Text>
                    </View>
                </View>

                <View style={styles.searchBox}>
                    <View style={styles.searchIcon}>
                        <View style={styles.searchCircle} />
                        <View style={styles.searchHandle} />
                    </View>

                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search by project or inspection ID"
                        placeholderTextColor="#64748B"
                        style={styles.searchInput}
                        autoCapitalize="none"
                    />
                </View>
            </View>

            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={filteredInspections}
                keyExtractor={(item) => item.id}
                renderItem={renderInspection}
                contentContainerStyle={
                    inspections.length === 0
                        ? styles.emptyContainer
                        : styles.listContent
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#2563EB"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>⌁</Text>
                        <Text style={styles.emptyTitle}>
                            No inspections available
                        </Text>
                        <Text style={styles.emptyText}>
                            Pull down to refresh and check for available
                            inspection assignments.
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#071A2B",
    },

    searchBox: {
        height: 48,
        marginTop: 18,
        borderRadius: 13,
        backgroundColor: "#0D263D",
        borderWidth: 1,
        borderColor: "#23415A",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
    },

    searchIcon: {
        width: 20,
        height: 20,
        marginRight: 8,
        position: "relative",
    },

    searchCircle: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: "#64748B",
        position: "absolute",
        top: 1,
        left: 1,
    },

    searchHandle: {
        width: 7,
        height: 2,
        backgroundColor: "#64748B",
        position: "absolute",
        left: 11,
        top: 13,
        transform: [{ rotate: "45deg" }],
        borderRadius: 2,
    },

    searchInput: {
        flex: 1,
        color: "#F8FAFC",
        fontSize: 14,
    },

    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    loadingText: {
        marginTop: 12,
        color: "#94A3B8",
        fontSize: 14,
    },

    header: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 8,
    },

    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    headerText: {
        flex: 1,
        paddingRight: 12,
    },

    eyebrow: {
        color: "#14B8A6",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.5,
    },

    headerTitle: {
        color: "#F8FAFC",
        fontSize: 28,
        fontWeight: "800",
        marginTop: 4,
    },

    headerSubtitle: {
        color: "#94A3B8",
        fontSize: 13,
        marginTop: 4,
    },

    countBadge: {
        minWidth: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#12324A",
        borderWidth: 1,
        borderColor: "#23415A",
        alignItems: "center",
        justifyContent: "center",
    },

    countText: {
        color: "#60A5FA",
        fontSize: 16,
        fontWeight: "800",
    },

    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        gap: 12,
    },

    card: {
        backgroundColor: "#0D263D",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#23415A",
        padding: 16,
    },

    cardPressed: {
        opacity: 0.75,
    },

    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
    },

    titleArea: {
        flex: 1,
    },

    projectName: {
        color: "#F8FAFC",
        fontSize: 17,
        fontWeight: "700",
    },

    idRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 7,
    },

    idDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#14B8A6",
        marginRight: 7,
    },

    inspectionId: {
        color: "#64748B",
        fontSize: 11,
        marginTop: 6,
    },

    status: {
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
    },

    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#60A5FA",
        marginRight: 5,
    },

    statusProgress: {
        backgroundColor: "rgba(37, 99, 235, 0.18)",
    },

    statusSubmitted: {
        backgroundColor: "rgba(20, 184, 166, 0.18)",
    },

    statusClosed: {
        backgroundColor: "rgba(34, 197, 94, 0.15)",
    },

    statusDefault: {
        backgroundColor: "rgba(148, 163, 184, 0.15)",
    },

    statusText: {
        color: "#CBD5E1",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.5,
    },

    divider: {
        height: 1,
        backgroundColor: "#23415A",
        marginVertical: 14,
    },

    cardBottom: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    metaLabel: {
        color: "#64748B",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 1,
    },

    metaValue: {
        color: "#CBD5E1",
        fontSize: 13,
        marginTop: 3,
    },

    arrow: {
        color: "#60A5FA",
        fontSize: 28,
        fontWeight: "300",
    },

    emptyContainer: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 20,
        paddingBottom: 30,
    },

    emptyCard: {
        backgroundColor: "#0D263D",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#23415A",
        padding: 28,
        alignItems: "center",
    },

    emptyIcon: {
        color: "#2563EB",
        fontSize: 42,
        marginBottom: 10,
    },

    emptyTitle: {
        color: "#F8FAFC",
        fontSize: 18,
        fontWeight: "700",
        textAlign: "center",
    },

    emptyText: {
        color: "#94A3B8",
        fontSize: 13,
        lineHeight: 20,
        textAlign: "center",
        marginTop: 8,
    },

    errorBox: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(239, 68, 68, 0.3)",
    },

    errorText: {
        color: "#FCA5A5",
        fontSize: 13,
    },
});