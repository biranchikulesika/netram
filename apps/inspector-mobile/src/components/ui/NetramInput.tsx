import { useState, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, typography } from "../../theme/colors";
import { useSettings } from "../../theme/settings-context";

export interface NetramInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  error?: string | null;
  helperText?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  rightElement?: ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function NetramInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  numberOfLines,
  error,
  helperText,
  keyboardType,
  autoCapitalize = "none",
  editable = true,
  rightElement,
  style,
  inputStyle,
  testID,
}: NetramInputProps) {
  const { theme, isPureDark } = useSettings();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.bgSurface,
            borderColor: error ? theme.error : isFocused ? theme.accentBlue : theme.borderStrong,
          },
          !editable && styles.inputDisabled,
          multiline && styles.inputMultiline,
        ]}
      >
        <TextInput
          testID={testID}
          style={[
            styles.input,
            { color: theme.textPrimary },
            multiline && styles.multilineText,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isPureDark ? "#71717A" : "#64748B"}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {rightElement && (
          <View style={styles.rightElementContainer}>{rightElement}</View>
        )}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: "700",
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputMultiline: {
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multilineText: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  rightElementContainer: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});
