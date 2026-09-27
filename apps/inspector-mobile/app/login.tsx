import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../src/auth/auth-context";
import { Icon, NetramLogo } from "../src/components/ui";
import { colors, typography } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { seedDemoDataIfEmpty } from "../src/offline/demo-seed";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { theme, isPureDark } = useSettings();

  const [officerId, setOfficerId] = useState("DOSJE-INSP-2024-8842");
  const [password, setPassword] = useState("123456");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = () => setErrorMessage(null);

  const handleLogin = async () => {
    const trimmed = officerId.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your Officer ID.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setBusy(true);
    clearError();
    try {
      let targetUser = trimmed;
      if (
        trimmed.toUpperCase() === "DOSJE-INSP-2024-8842" ||
        trimmed.toLowerCase().includes("insp-001") ||
        trimmed.toLowerCase().includes("inspector.one")
      ) {
        targetUser = "inspector@netram.dev";
      } else if (
        trimmed.toLowerCase().includes("insp-002") ||
        trimmed.toLowerCase().includes("inspector.two")
      ) {
        targetUser = "inspector.two@dev.netram.in";
      }

      await login(targetUser, password);
      await seedDemoDataIfEmpty();
      router.replace("/");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bgCanvas }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.flex, { backgroundColor: theme.bgCanvas }]}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.bgCanvas }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.container, { backgroundColor: theme.bgCanvas }]}>
            {/* ── Official Header ── */}
            <View style={styles.headerArea}>
              <NetramLogo width={160} height={48} />
              <Text style={[styles.govSubtext, { color: theme.textMuted }]}>
                Ministry of Social Justice & Empowerment
              </Text>
            </View>

            {/* ── Title ── */}
            <View style={styles.titleSection}>
              <Text style={[styles.pageTitle, { color: theme.navyDark }]}>Officer Login</Text>
            </View>

            {/* ── Error Banner ── */}
            {errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: theme.errorBg,
                    borderColor: theme.errorBorder,
                  },
                ]}
              >
                <Icon name="alert-circle" size={16} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
              </View>
            )}

            {/* ── Authentication Box ── */}
            <View
              style={[
                styles.authCard,
                {
                  backgroundColor: theme.bgSurface,
                  borderColor: theme.borderSubtle,
                },
              ]}
            >
              {/* Field 1: Officer ID */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Officer ID</Text>
                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: isPureDark ? theme.bgSubtle : theme.bgSurface,
                      borderColor: theme.borderStrong,
                    },
                  ]}
                >
                  <Icon name="card-outline" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.inputMono, { color: theme.textPrimary }]}
                    value={officerId}
                    onChangeText={(text) => {
                      setOfficerId(text);
                      clearError();
                    }}
                    placeholder="e.g. DOSJE-INSP-2024-8842"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="characters"
                    editable={!busy}
                  />
                </View>
              </View>

              {/* Field 2: Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Password</Text>
                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: isPureDark ? theme.bgSubtle : theme.bgSurface,
                      borderColor: theme.borderStrong,
                    },
                  ]}
                >
                  <Icon name="key-outline" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.textPrimary }]}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      clearError();
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showPassword}
                    editable={!busy}
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={10}
                    style={styles.eyeButton}
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Icon
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={theme.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.signInButton,
                  { backgroundColor: theme.actionGreen },
                  pressed && { opacity: 0.9, backgroundColor: theme.actionGreenDark },
                  busy && styles.signInButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="lock-closed" size={18} color="#FFFFFF" />
                    <Text style={styles.signInButtonText}>Sign In</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* ── Official Footer ── */}
            <View style={styles.footerArea}>
              <Text style={[styles.footerText, { color: theme.textMuted }]}>
                Government of India
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 400,
  },
  headerArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  govSubtext: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  titleSection: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.navyDark,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
  },
  authCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 24,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputRow: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  inputMono: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    fontFamily: typography.mono,
    fontWeight: "500",
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  signInButton: {
    backgroundColor: colors.actionGreen,
    borderRadius: 8,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  signInButtonPressed: {
    opacity: 0.9,
    backgroundColor: colors.actionGreenDark,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textInverse,
  },
  footerArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
});
