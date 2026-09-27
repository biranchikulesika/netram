import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";
import { useSettings } from "../../theme/settings-context";

export interface NetramCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  activeOpacity?: number;
  testID?: string;
}

export function NetramCard({
  children,
  style,
  onPress,
  testID,
}: NetramCardProps) {
  const { theme } = useSettings();

  const dynamicCardStyle: ViewStyle = {
    backgroundColor: theme.bgSurface,
    borderColor: theme.borderSubtle,
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          dynamicCardStyle,
          pressed && styles.pressed,
          pressed && { borderColor: theme.accentBlue },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[styles.card, dynamicCardStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.9,
    borderColor: colors.accentBlue,
  },
});
