import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import {
  EmptyState,
  NetramButton,
  NetramCard,
  ScreenHeader,
  Icon,
} from "../src/components/ui";
import { useAuth } from "../src/auth/auth-context";
import type { Notification, NotificationType } from "@netram/types";

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return isoString;
  }
}

function getNotificationDetails(type: NotificationType): {
  icon: string;
  label: string;
} {
  switch (type) {
    case "inspection.assigned":
      return {
        icon: "clipboard-outline",
        label: "INSPECTION ASSIGNED",
      };
    case "corrective_action.overdue":
      return {
        icon: "alert-circle-outline",
        label: "CORRECTIVE ACTION",
      };
    case "ai.anomaly_detected":
      return {
        icon: "scan-outline",
        label: "AI ANOMALY NOTICE",
      };
    default:
      return {
        icon: "notifications-outline",
        label: "OFFICIAL NOTICE",
      };
  }
}

export default function NotificationsScreen() {
  const { client } = useAuth();
  const { theme } = useSettings();

  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!client) {
      // Not authenticated: nothing authoritative to show.
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const res = await client.listNotifications({ pageSize: 50 });
      setItems(res.items ?? []);
      setUnreadCount(res.unread ?? 0);
    } catch {
      setLoadError("Could not reach the server. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadError(null);
    await fetchNotifications();
  };

  const handleNotificationPress = async (item: Notification) => {
    if (item.status === "pending") {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, status: "read" } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      if (client) {
        try {
          await client.markNotificationRead(item.id);
        } catch {
          // ignore offline failure
        }
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAllRead(true);
    setItems((prev) => prev.map((n) => ({ ...n, status: "read" })));
    setUnreadCount(0);

    if (client) {
      try {
        await client.markAllNotificationsRead();
      } catch {
        // ignore offline failure
      }
    }
    setMarkingAllRead(false);
  };

  const bgCanvas = theme.bgCanvas;
  const bgCard = theme.bgSurface;
  const borderColor = theme.borderSubtle;
  const navyColor = theme.navyDark;
  const mutedColor = theme.textMuted;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgCanvas }]}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
            : "All notices acknowledged"
        }
        rightAction={
          unreadCount > 0 ? (
            <NetramButton
              label={markingAllRead ? "Marking..." : "Mark All Read"}
              variant="secondary"
              size="sm"
              loading={markingAllRead}
              disabled={markingAllRead}
              onPress={handleMarkAllRead}
              textStyle={{ color: theme.accentBlue }}
            />
          ) : undefined
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={navyColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={navyColor}
              colors={[navyColor]}
            />
          }
        >
          {loadError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Notifications Unavailable"
              subtitle={loadError}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="notifications-off-outline"
              title="No Notifications"
              subtitle="You have no pending alerts or field notices."
            />
          ) : (
            items.map((item) => {
              const details = getNotificationDetails(item.type);
              const isUnread = item.status === "pending";

              return (
                <NetramCard
                  key={item.id}
                  onPress={() => void handleNotificationPress(item)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: bgCard,
                      borderColor,
                    },
                    isUnread && {
                      borderLeftWidth: 4,
                      borderLeftColor: navyColor,
                    },
                  ]}
                >
                  {/* Category Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={styles.iconAndType}>
                      <View style={[styles.iconContainer, { backgroundColor: theme.bgSubtle }]}>
                        <Icon name={details.icon} size={18} color={navyColor} />
                      </View>
                      <Text style={[styles.typeLabel, { color: mutedColor }]}>
                        {details.label}
                      </Text>
                    </View>

                    <View style={styles.metaRight}>
                      <Text style={[styles.timeText, { color: mutedColor }]}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                      {isUnread && (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: navyColor },
                          ]}
                        />
                      )}
                    </View>
                  </View>

                  {/* Notification Content */}
                  <Text
                    style={[
                      styles.notificationTitle,
                      { color: navyColor, fontWeight: isUnread ? "700" : "600" },
                    ]}
                  >
                    {item.title}
                  </Text>

                  {item.body && (
                    <Text
                      style={[styles.notificationBody, { color: mutedColor }]}
                      numberOfLines={3}
                    >
                      {item.body}
                    </Text>
                  )}

                  {/* Clean Footer Row */}
                  <View
                    style={[
                      styles.cardFooter,
                      { borderTopColor: theme.borderSubtle },
                    ]}
                  >
                    <View style={styles.footerPrompt}>
                      <Text style={[styles.actionPrompt, { color: navyColor }]}>
                        View Details
                      </Text>
                      <Icon name="chevron-forward" size={13} color={navyColor} />
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: theme.bgSubtle,
                          borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: mutedColor }]}>
                        {isUnread ? "UNREAD" : "READ"}
                      </Text>
                    </View>
                  </View>
                </NetramCard>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  iconAndType: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    fontFamily: typography.mono,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notificationTitle: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionPrompt: {
    fontSize: 11,
    fontWeight: "600",
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    fontFamily: typography.mono,
  },
});
