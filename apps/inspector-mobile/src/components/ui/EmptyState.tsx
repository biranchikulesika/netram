import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";
import { useSettings } from "../../theme/settings-context";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = "clipboard-outline",
  title,
  subtitle,
  action,
  style,
}: EmptyStateProps) {
  const { theme } = useSettings();

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return <View style={styles.iconWrapper}>{icon}</View>;
    }
    if (typeof icon === "string") {
      // Map legacy emojis to CDN icon names
      const emojiMap: Record<string, string> = {
        "📋": "clipboard-outline",
        "✓": "checkmark-circle",
        "⚠️": "warning-outline",
        "📸": "camera-outline",
        "📝": "document-text-outline",
        "🔍": "search-outline",
        "🚩": "flag-outline",
        "🔔": "notifications-outline",
      };
      const iconName = emojiMap[icon] || icon;
      return (
        <View style={styles.iconWrapper}>
          <Icon name={iconName} size={36} color={theme.accentBlue} />
        </View>
      );
    }
    return null;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
        style,
      ]}
    >
      {renderIcon()}
      <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      ) : null}

      {action && (
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.accentBlue }]}
          onPress={action.onPress}
        >
          <Text style={styles.actionButtonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.darkSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    marginVertical: 12,
  },
  iconWrapper: {
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.darkTextPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.darkTextSecondary,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  actionButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.darkAccent,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
