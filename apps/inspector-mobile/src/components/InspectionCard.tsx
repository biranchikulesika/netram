import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, typography } from "../theme/colors";
import { useSettings } from "../theme/settings-context";
import { NetramBadge } from "./ui/NetramBadge";
import { NetramCard } from "./ui/NetramCard";
import type { CachedInspectionRecord } from "../offline/queue";

export interface InspectionCardProps {
  inspection: CachedInspectionRecord;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function InspectionCard({ inspection, onPress, style, testID }: InspectionCardProps) {
  const { theme } = useSettings();

  const formattedDate = inspection.scheduled_start
    ? new Date(inspection.scheduled_start).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unscheduled";

  const displayType = (inspection.type || "Routine").replace(/_/g, " ").toUpperCase();

  return (
    <NetramCard testID={testID} onPress={onPress} style={[styles.card, style]}>
      <View style={styles.topRow}>
        <NetramBadge label={inspection.project_code || "PRJ"} variant="id" size="sm" />
        <NetramBadge
          label={inspection.status.replace(/_/g, " ")}
          variant="status"
          status={inspection.status}
          size="sm"
        />
      </View>

      <View style={styles.body}>
        <Text style={[styles.projectName, { color: theme.textPrimary }]} numberOfLines={2}>
          {inspection.project_name || "Untitled Project"}
        </Text>
        <Text style={[styles.typeText, { color: theme.accentBlue }]}>
          {`${displayType} INSPECTION`}
        </Text>
      </View>

      <View style={[styles.bottomRow, { borderTopColor: theme.borderSubtle }]}>
        <View style={styles.dateContainer}>
          <Text style={[styles.dateLabel, { color: theme.textMuted }]}>SCHEDULED</Text>
          <Text style={[styles.dateValue, { color: theme.textPrimary }]}>{formattedDate}</Text>
        </View>

        <View style={styles.actionPrompt}>
          <Text style={[styles.actionPromptText, { color: theme.accentBlue }]}>View Details →</Text>
        </View>
      </View>
    </NetramCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  body: {
    marginBottom: 12,
  },
  projectName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  typeText: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: "700",
    color: colors.accentBlue,
    letterSpacing: 0.8,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  dateContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  actionPrompt: {
    paddingVertical: 2,
  },
  actionPromptText: {
    fontSize: 12,
    color: colors.accentBlue,
    fontWeight: "600",
  },
});
