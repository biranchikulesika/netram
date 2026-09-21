import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { loginAsInspector, loginOfflineDemo } from "../src/auth/session";
import { colors, typography } from "../src/theme/colors";

const PRESET_INSPECTORS = [
  { label: "Inspector 1", email: "inspector.one@dev.netram.in" },
  { label: "Inspector 2", email: "inspector.two@dev.netram.in" },
  { label: "Inspector 3", email: "inspector.three@dev.netram.in" },
];

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("inspector.one@dev.netram.in");
  const [passcode, setPasscode] = useState("******");
  const [apiUrl, setApiUrl] = useState("http://localhost:3001");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [rememberId, setRememberId] = useState(true);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBiometricLogin = async () => {
    setBiometricBusy(true);
    setErrorMessage(null);
    try {
      // Simulate biometric sensor read & verification
      await new Promise((resolve) => setTimeout(resolve, 800));
      loginOfflineDemo(email.trim() || "inspector.one@dev.netram.in");
      router.replace("/");
    } catch {
      setErrorMessage("Biometric sensor verification failed. Please enter your PIN.");
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleLogin = async (useOfflineFallback = false) => {
    if (!email.trim()) {
      setErrorMessage("Please enter an official inspector email.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    if (useOfflineFallback) {
      try {
        loginOfflineDemo(email.trim());
        router.replace("/");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      await loginAsInspector(email.trim(), apiUrl.trim());
      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Live sign-in failed: ${msg}. You can tap "Sign In (Offline Mode)" if the backend is not running.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            {/* Header / Emblem */}
            <View style={styles.header}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../assets/ashoka_stambh.png")}
                style={styles.ashokaStambh}
                resizeMode="contain"
              />
              <View style={styles.badgeRow}>
                <Text style={styles.emblemBadge}>DOSJE • GOVT OF INDIA</Text>
                <Text style={styles.securityBadge}>SECURE TERMINAL</Text>
              </View>
              <Text style={styles.title}>NETRAM</Text>
              <Text style={styles.subtitle}>Field Inspection &amp; Evidence Terminal</Text>
            </View>

            {/* Presets Chips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Select Inspector</Text>
              <View style={styles.chipRow}>
                {PRESET_INSPECTORS.map((preset) => {
                  const isSelected = email === preset.email;
                  return (
                    <Pressable
                      key={preset.email}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        setEmail(preset.email);
                        setErrorMessage(null);
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Official Email / Inspector ID</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage(null);
                }}
                placeholder="e.g. inspector.one@dev.netram.in"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Passcode / PIN</Text>
                <Pressable onPress={() => setShowForgotInfo((prev) => !prev)}>
                  <Text style={styles.forgotLink}>Forgot PIN?</Text>
                </Pressable>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={passcode}
                  onChangeText={setPasscode}
                  placeholder="Enter field PIN"
                  placeholderTextColor={colors.textSubtle}
                  secureTextEntry={!showPin}
                  keyboardType="numeric"
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPin((prev) => !prev)}
                  hitSlop={10}
                  accessibilityLabel={showPin ? "Hide PIN" : "Show PIN"}
                >
                  <View style={styles.eyeContainer}>
                    <Text style={styles.eyeIcon}>👁️</Text>
                    {!showPin && <View style={styles.eyeSlash} />}
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Remember ID Checkbox */}
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setRememberId((prev) => !prev)}
            >
              <View style={[styles.checkbox, rememberId && styles.checkboxChecked]}>
                {rememberId && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Remember Inspector ID on this terminal</Text>
            </Pressable>

            {showForgotInfo && (
              <View style={styles.infoBox}>
                <View style={styles.infoBoxHeader}>
                  <Text style={styles.infoBoxTitle}>🔐 PIN Reset Assistance</Text>
                  <Pressable onPress={() => setShowForgotInfo(false)}>
                    <Text style={styles.infoBoxClose}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.infoBoxText}>
                  For institutional security, field terminal PINs are authenticated by your District Officer. Contact your district IT coordinator at{" "}
                  <Text style={{ fontWeight: "700" }}>admin.social@dev.netram.in</Text> to re-issue credentials.
                </Text>
              </View>
            )}

            {/* Advanced API Config Toggle */}
            <Pressable
              onPress={() => setShowAdvanced((prev) => !prev)}
              style={styles.advancedToggle}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? "▾ Hide Server URL" : "▸ Advanced Server Settings"}
              </Text>
            </Pressable>

            {showAdvanced && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Backend API Endpoint</Text>
                <TextInput
                  style={styles.input}
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="http://localhost:3001"
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Error Display */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionContainer}>
              <Pressable
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={() => handleLogin(false)}
                disabled={busy || biometricBusy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In to Terminal</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.biometricButton, (busy || biometricBusy) && styles.buttonDisabled]}
                onPress={handleBiometricLogin}
                disabled={busy || biometricBusy}
              >
                {biometricBusy ? (
                  <ActivityIndicator color={colors.accentBlue} size="small" />
                ) : (
                  <Text style={styles.biometricButtonText}>👆 Biometric Quick-Login (Fingerprint)</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                onPress={() => handleLogin(true)}
                disabled={busy || biometricBusy}
              >
                <Text style={styles.secondaryButtonText}>⚡ Continue in Offline Mode</Text>
              </Pressable>

              <Pressable
                style={styles.registerLink}
                onPress={() => router.push("/signup")}
              >
                <Text style={styles.registerLinkText}>
                  New Field Inspector? <Text style={styles.registerLinkBold}>Register Terminal</Text>
                </Text>
              </Pressable>
            </View>

            {/* Security Notice */}
            <View style={styles.footerNotice}>
              <Text style={styles.footerNoticeText}>
                🛡️ Tamper-evident logging, GPS geo-stamping, and offline SHA-256 evidence hashing enabled.
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
    backgroundColor: colors.bgCanvas,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.bgSurface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.navyBrand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  ashokaStambh: {
    width: 48,
    height: 72,
    tintColor: colors.gold,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  emblemBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.goldDark,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fde68a",
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  securityBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.actionGreen,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accentBlue,
    marginBottom: 8,
    textTransform: "uppercase",
    fontFamily: typography.mono,
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: colors.navyBrand,
    borderColor: colors.accentBlue,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  formGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accentBlue,
  },
  infoBox: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  infoBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  infoBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  infoBoxClose: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSubtle,
    padding: 2,
  },
  infoBoxText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  advancedToggle: {
    marginVertical: 6,
  },
  advancedToggleText: {
    fontSize: 12,
    color: colors.accentBlue,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 16,
  },
  actionContainer: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: colors.actionGreen,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: colors.actionGreenDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: colors.bgSubtle,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerLink: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 2,
  },
  registerLinkText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  registerLinkBold: {
    color: colors.accentBlue,
    fontWeight: "700",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  eyeIcon: {
    fontSize: 16,
  },
  eyeSlash: {
    position: "absolute",
    width: 20,
    height: 2,
    backgroundColor: colors.textSubtle,
    borderRadius: 1,
    transform: [{ rotate: "-45deg" }],
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSurface,
  },
  checkboxChecked: {
    backgroundColor: colors.actionGreen,
    borderColor: colors.actionGreen,
  },
  checkmark: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 14,
  },
  checkboxLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  biometricButton: {
    backgroundColor: "#eff6ff",
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  biometricButtonText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: "700",
  },
  footerNotice: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  footerNoticeText: {
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: "center",
    lineHeight: 15,
    fontFamily: typography.mono,
  },
});

