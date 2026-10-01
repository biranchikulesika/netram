import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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
import { Icon } from "../src/components/ui";

/**
 * Development quick-fill accounts. These are the dev/test seed users shared
 * with the web app via the same API and local database - development-only
 * credentials, not production secrets. The dev-login provider resolves the
 * account by email; the password field is the shared dev placeholder kept for
 * form completeness.
 */
const DEV_ACCOUNTS = [
  {
    email: "inspector@netram.dev",
    password: "Inspector@netram2026",
  },
  {
    email: "inspector.two@dev.netram.in",
    password: "Inspector@netram2026",
  },
  {
    email: "inspector.three@dev.netram.in",
    password: "Inspector@netram2026",
  },
] as const;

const DEFAULT_DEV_ACCOUNT = DEV_ACCOUNTS[0];

/* Web login palette (does not follow the app's dark mode - the web has none). */
const palette = {
  canvas: "#ffffff",
  surface: "#ffffff",
  borderSubtle: "#edf0f5",
  borderStrong: "#45556c",
  textPrimary: "#0c2a52",
  textMuted: "#45556c",
  actionGreen: "#137e3a",
  error: "#dc2626",
  errorBg: "rgba(220, 38, 38, 0.08)",
  pillBg: "#edf0f5",
  pillActive: "rgba(12, 42, 82, 0.12)",
  focusRing: "rgba(12, 42, 82, 0.18)",
  buttonShadow: "rgba(19, 126, 58, 0.25)",
};

function FieldError({ message }: { message: string }) {
  return (
    <View style={styles.fieldError} accessibilityLiveRegion="polite">
      <Icon name="alert-circle" size={14} color={palette.error} />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState<string>(DEFAULT_DEV_ACCOUNT.email);
  const [password, setPassword] = useState<string>(DEFAULT_DEV_ACCOUNT.password);
  const [showPassword, setShowPassword] = useState(true);
  const [busy, setBusy] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clearError = () => {
    setEmailError(null);
    setPasswordError(null);
    setServerError(null);
  };

  function validate(): boolean {
    let valid = true;
    setEmailError(null);
    setPasswordError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email or username is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid official email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    }

    return valid;
  }

  const handleLogin = async () => {
    if (!validate()) return;

    setBusy(true);
    setServerError(null);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  function handleQuickFill(account: (typeof DEV_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    clearError();
    setShowDevAccounts(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {/* ── Branding ── */}
            <View style={styles.branding}>
              <Text style={styles.brandTitle}>Netram</Text>
              <Text style={styles.brandSubtitle}>
                {"Smart real-time monitoring\n& inspection platform"}
              </Text>
            </View>

            {/* ── Error Banner ── */}
            {serverError && (
              <View style={styles.alertBanner} accessibilityLiveRegion="assertive">
                <Icon name="alert-circle" size={18} color={palette.error} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Access Denied</Text>
                  <Text style={styles.alertText}>{serverError}</Text>
                </View>
                <Pressable
                  onPress={() => setServerError(null)}
                  hitSlop={10}
                  accessibilityLabel="Dismiss error message"
                >
                  <Text style={styles.alertClose}>×</Text>
                </Pressable>
              </View>
            )}

            {/* ── Email or Username ── */}
            <View style={styles.fieldGroup}>
              <View
                style={[
                  styles.inputRow,
                  emailError && styles.inputRowError,
                  focusedField === "email" && styles.inputRowFocused,
                ]}
              >
                <Icon name="mail-outline" size={16} color={palette.textMuted} />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    clearError();
                  }}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your email"
                  placeholderTextColor={palette.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!busy}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Official email"
                />
              </View>
              {emailError && <FieldError message={emailError} />}
            </View>

            {/* ── Password ── */}
            <View style={styles.fieldGroup}>
              <View
                style={[
                  styles.inputRow,
                  passwordError && styles.inputRowError,
                  focusedField === "password" && styles.inputRowFocused,
                ]}
              >
                <Icon name="lock-closed" size={16} color={palette.textMuted} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearError();
                  }}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  placeholderTextColor={palette.textMuted}
                  secureTextEntry={!showPassword}
                  editable={!busy}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={10}
                  style={styles.eyeButton}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={palette.textMuted}
                  />
                </Pressable>
              </View>
              {passwordError && <FieldError message={passwordError} />}
            </View>

            {/* ── Submit ── */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !busy && styles.submitButtonPressed,
                busy && styles.submitButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Authenticating…</Text>
                </>
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </Pressable>

            {/* ── Development Quick-Fill Helper ── */}
            <View style={styles.devSection}>
              <Pressable
                style={styles.devToggle}
                onPress={() => setShowDevAccounts((prev) => !prev)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDevAccounts }}
              >
                <Text style={styles.devToggleText}>Test accounts</Text>
                <Icon
                  name="chevron-down"
                  size={14}
                  color={palette.textMuted}
                  style={[styles.devChevron, showDevAccounts && styles.devChevronOpen]}
                />
              </Pressable>

              {showDevAccounts && (
                <View style={styles.devAccountsList}>
                  {DEV_ACCOUNTS.map((account) => {
                    const active = account.email === email.trim();
                    return (
                      <Pressable
                        key={account.email}
                        style={[styles.devAccountButton, active && styles.devAccountActive]}
                        onPress={() => handleQuickFill(account)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[styles.devAccountRole, active && styles.devAccountRoleActive]}
                        >
                          {account.email}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
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
    backgroundColor: palette.canvas,
  },
  flex: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  formContainer: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  branding: {
    alignItems: "center",
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: palette.textPrimary,
    marginBottom: 4,
    lineHeight: 30,
  },
  brandSubtitle: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: palette.errorBg,
    borderWidth: 1,
    borderColor: palette.errorBg,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontWeight: "700",
    fontSize: 13,
    color: palette.error,
    marginBottom: 2,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.error,
  },
  alertClose: {
    fontSize: 18,
    lineHeight: 20,
    color: palette.error,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  inputRowFocused: {
    borderColor: palette.textPrimary,
    boxShadow: `0 0 0 3px ${palette.focusRing}`,
  },
  inputRowError: {
    borderColor: palette.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: palette.textPrimary,
    paddingVertical: 11,
  },
  fieldError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  fieldErrorText: {
    fontSize: 12,
    color: palette.error,
    fontWeight: "500",
  },
  eyeButton: {
    padding: 4,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: palette.actionGreen,
    borderRadius: 8,
    minHeight: 48,
    marginTop: 6,
    boxShadow: "0 1px 3px rgba(19,126,58,0.25)",
    elevation: 1,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  devSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.textMuted,
    borderStyle: "dashed",
  },
  devToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    alignSelf: "center",
  },
  devToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.textMuted,
  },
  devChevron: {},
  devChevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  devAccountsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
    marginTop: 9,
  },
  devAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.pillBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  devAccountActive: {
    backgroundColor: palette.pillActive,
  },
  devAccountRole: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.textMuted,
  },
  devAccountRoleActive: {
    color: palette.textPrimary,
  },
});
