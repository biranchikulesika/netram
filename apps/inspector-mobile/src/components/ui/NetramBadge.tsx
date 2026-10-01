import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { typography } from "../../theme/colors";
import { useSettings } from "../../theme/settings-context";

export type BadgeVariant = "status" | "severity" | "id" | "sync" | "default";

export interface NetramBadgeProps {
  label: string;
  variant?: BadgeVariant;
  status?: "assigned" | "in_progress" | "submitted" | "closed" | string;
  severity?: "critical" | "high" | "medium" | "low" | string;
  sync?: "pending" | "accepted" | "synced" | "conflict" | "rejected" | string;
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function NetramBadge({
  label,
  variant = "default",
  status,
  severity,
  sync,
  size = "md",
  style,
  textStyle,
}: NetramBadgeProps) {
  const { theme } = useSettings();
  const normalizedKey = (status || severity || sync || label).toLowerCase().replace(/[-\s]/g, "_");

  let badgeColors: { bg: string; border: string; text: string } = {
    bg: theme.bgSubtle,
    border: theme.borderSubtle,
    text: theme.textMuted,
  };

  if (variant === "id") {
    badgeColors = {
      bg: theme.tagRust,
      border: theme.tagRustDark,
      text: theme.textInverse,
    };
  } else if (variant === "status" || status) {
    if (normalizedKey === "assigned" || normalizedKey === "draft") {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.accentBlue,
        text: theme.navyData,
      };
    } else if (
      normalizedKey === "in_progress" ||
      normalizedKey === "active" ||
      normalizedKey === "pending"
    ) {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.gold,
        text: theme.goldDark,
      };
    } else if (
      normalizedKey === "submitted" ||
      normalizedKey === "approved" ||
      normalizedKey === "verified" ||
      normalizedKey === "completed"
    ) {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.borderSubtle,
        text: theme.actionGreen,
      };
    } else if (normalizedKey === "closed" || normalizedKey === "archived") {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.borderSubtle,
        text: theme.textMuted,
      };
    } else if (
      normalizedKey === "rejected" ||
      normalizedKey === "voided" ||
      normalizedKey === "flagged"
    ) {
      badgeColors = {
        bg: theme.errorBg,
        border: theme.errorBorder,
        text: theme.error,
      };
    }
  } else if (variant === "severity" || severity) {
    if (normalizedKey === "critical") {
      badgeColors = {
        bg: theme.errorBg,
        border: theme.errorBorder,
        text: theme.error,
      };
    } else if (normalizedKey === "high") {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.tagRust,
        text: theme.tagRust,
      };
    } else if (normalizedKey === "medium") {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.gold,
        text: theme.goldDark,
      };
    } else if (normalizedKey === "low") {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.borderSubtle,
        text: theme.actionGreen,
      };
    }
  } else if (variant === "sync" || sync) {
    if (normalizedKey === "pending") {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.gold,
        text: theme.goldDark,
      };
    } else if (
      normalizedKey === "accepted" ||
      normalizedKey === "synced" ||
      normalizedKey === "ready"
    ) {
      badgeColors = {
        bg: theme.bgSubtle,
        border: theme.borderSubtle,
        text: theme.actionGreen,
      };
    } else if (normalizedKey === "conflict" || normalizedKey === "rejected") {
      badgeColors = {
        bg: theme.errorBg,
        border: theme.errorBorder,
        text: theme.error,
      };
    }
  }

  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeColors.bg,
          borderColor: badgeColors.border,
          paddingHorizontal: isSmall ? 6 : 8,
          paddingVertical: isSmall ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: badgeColors.text,
            fontSize: isSmall ? 10 : 11,
            fontFamily: variant === "id" ? typography.mono : undefined,
          },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
