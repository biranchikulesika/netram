import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { typography } from "../../theme/colors";
import { useSettings } from "../../theme/settings-context";

export interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, action, primary = false, style }: SectionHeaderProps) {
  const { theme } = useSettings();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: primary ? theme.navyDark : theme.textMuted }]}>
        {title}
      </Text>

      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} style={styles.action}>
          <Text style={[styles.actionText, { color: theme.accentBlue }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  action: {
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
