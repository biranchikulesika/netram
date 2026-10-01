import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../../theme/colors";
import { useSettings } from "../../theme/settings-context";

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, subtitle, rightAction, style }: ScreenHeaderProps) {
  const { theme } = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: theme.bgSurface }, style]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.navyDark }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSurface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navyDark,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  actionContainer: {
    marginLeft: 12,
  },
});
