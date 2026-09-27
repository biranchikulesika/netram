import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface NetramButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function NetramButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  size = "md",
  style,
  textStyle,
  testID,
}: NetramButtonProps) {
  const isInteractive = !disabled && !loading;

  let containerStyle: ViewStyle = styles.primary;
  let labelColor: string = colors.textInverse;
  let indicatorColor: string = colors.textInverse;

  if (variant === "secondary") {
    containerStyle = styles.secondary;
    labelColor = colors.textPrimary;
    indicatorColor = colors.textPrimary;
  } else if (variant === "danger") {
    containerStyle = styles.danger;
    labelColor = colors.textInverse;
    indicatorColor = colors.textInverse;
  }

  const sizeStyle: ViewStyle =
    size === "sm"
      ? styles.sizeSm
      : size === "lg"
        ? styles.sizeLg
        : styles.sizeMd;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!isInteractive}
      style={({ pressed }) => [
        styles.base,
        containerStyle,
        sizeStyle,
        (!isInteractive || disabled) && styles.disabled,
        pressed && isInteractive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.label,
              { color: labelColor },
              size === "sm" && styles.labelSm,
              textStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconContainer: {
    marginRight: 2,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sizeLg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelSm: {
    fontSize: 12,
  },
  primary: {
    backgroundColor: colors.actionGreen,
  },
  secondary: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  danger: {
    backgroundColor: colors.error,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
