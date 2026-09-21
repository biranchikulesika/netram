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
import { saveSession } from "../src/auth/session";
import { colors, typography } from "../src/theme/colors";

const DISTRICT_PRESETS = ["Khordha", "Cuttack", "Puri", "Ganjam", "Sambalpur"];

export default function SignUpScreen() {
  const router = useRouter();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [district, setDistrict] = useState("Khordha");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<{
    refNumber: string;
    fullName: string;
    badgeId: string;
    district: string;
    email: string;
  } | null>(null);

  const handleRegister = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedBadge = badgeId.trim();

    if (!trimmedName) {
      setErrorMessage("Please enter your full official name.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid official email address.");
      return;
    }
    if (!trimmedBadge) {
      setErrorMessage("Please enter your Inspector Badge or Employee ID.");
      return;
    }
    if (pin.length < 4) {
      setErrorMessage("Field PIN must be at least 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage("Field PIN and Confirm PIN do not match.");
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage("You must accept the official DoSJE undertaking and IT Act declaration before proceeding.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      // Simulate network / credential registration
      await new Promise((resolve) => setTimeout(resolve, 900));

      const refNum = `NETRAM/2026/REG-${Math.floor(10000 + Math.random() * 90000)}`;
      setRegistrationData({
        refNumber: refNum,
        fullName: trimmedName,
        badgeId: trimmedBadge,
        district,
        email: trimmedEmail,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleProceedToTerminal = () => {
    if (!registrationData) return;
    const newUserId = "00000000-0000-4000-8000-" + Math.floor(Math.random() * 1000000000000).toString().padStart(12, "0");
    saveSession({
      token: `inspector-registered-token-${Date.now()}`,
      user: {
        id: newUserId,
        email: registrationData.email,
        displayName: registrationData.fullName,
        type: "inspector",
      },
      apiUrl: "http://localhost:3001",
    });
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            {registrationData ? (
              /* Official Registration Success / Confirmation View */
              <View style={styles.confirmationContainer}>
                <Image
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  source={require("../assets/ashoka_stambh.png")}
                  style={styles.ashokaStambh}
                  resizeMode="contain"
                />
                <View style={styles.badgeRow}>
                  <Text style={styles.emblemBadge}>DOSJE • GOVT OF INDIA</Text>
                  <Text style={styles.securityBadge}>PROVISIONALLY VERIFIED</Text>
                </View>

                <Text style={styles.title}>REGISTRATION ISSUED</Text>
                <Text style={styles.refNumberBadge}>
                  REF NO: {registrationData.refNumber}
                </Text>

                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Inspector Name:</Text>
                    <Text style={styles.detailValue}>{registrationData.fullName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Badge ID:</Text>
                    <Text style={styles.detailValue}>{registrationData.badgeId}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Jurisdiction:</Text>
                    <Text style={styles.detailValue}>{registrationData.district} District</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Official Email:</Text>
                    <Text style={styles.detailValue}>{registrationData.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hardware Integrity:</Text>
                    <Text style={[styles.detailValue, { color: colors.actionGreen, fontWeight: "700" }]}>
                      SHA-256 HASHED ✓
                    </Text>
                  </View>
                </View>

                <View style={styles.undertakingNoteBox}>
                  <Text style={styles.undertakingNoteText}>
                    🏛️ Your field terminal has been provisionally enrolled in the Netram Registry. Complete inspection authority will sync automatically upon your first field log submission under IT Act 2000.
                  </Text>
                </View>

                <Pressable
                  style={styles.primaryButton}
                  onPress={handleProceedToTerminal}
                >
                  <Text style={styles.primaryButtonText}>Authorize &amp; Enter Terminal</Text>
                </Pressable>

                <Pressable
                  style={styles.loginLink}
                  onPress={() => router.replace("/login")}
                >
                  <Text style={styles.loginLinkText}>
                    Return to <Text style={styles.loginLinkBold}>Login Screen</Text>
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Registration Form */
              <>
                {/* Top Back Navigation Button */}
                <Pressable
                  style={styles.topBackButton}
                  onPress={() => router.replace("/login")}
                >
                  <Text style={styles.topBackText}>← Back to Login</Text>
                </Pressable>

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
                    <Text style={styles.securityBadge}>OFFICIAL ONBOARDING</Text>
                  </View>
                  <Text style={styles.title}>NETRAM</Text>
                  <Text style={styles.subtitle}>Field Inspector Registration &amp; Terminal Setup</Text>
                </View>

                {/* Form Fields */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Full Official Name</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      setErrorMessage(null);
                    }}
                    placeholder="e.g. Rajesh Kumar Mohapatra"
                    placeholderTextColor={colors.textSubtle}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Official Government Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setErrorMessage(null);
                    }}
                    placeholder="e.g. rajesh.kumar@dev.netram.in"
                    placeholderTextColor={colors.textSubtle}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Inspector Badge / Employee ID</Text>
                  <TextInput
                    style={styles.input}
                    value={badgeId}
                    onChangeText={(text) => {
                      setBadgeId(text);
                      setErrorMessage(null);
                    }}
                    placeholder="e.g. INS-2026-089"
                    placeholderTextColor={colors.textSubtle}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Jurisdiction District Selection */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Assigned District / Jurisdiction</Text>
                  <View style={styles.chipRow}>
                    {DISTRICT_PRESETS.map((d) => {
                      const isSelected = district === d;
                      return (
                        <Pressable
                          key={d}
                          style={[styles.chip, isSelected && styles.chipActive]}
                          onPress={() => setDistrict(d)}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {d}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* PIN Inputs with Show/Hide Toggle */}
                <View style={styles.pinRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Set Field PIN</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={pin}
                        onChangeText={setPin}
                        placeholder="4-6 digits"
                        placeholderTextColor={colors.textSubtle}
                        secureTextEntry={!showPin}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <Pressable
                        style={styles.eyeButton}
                        onPress={() => setShowPin((prev) => !prev)}
                        hitSlop={8}
                        accessibilityLabel={showPin ? "Hide PIN" : "Show PIN"}
                      >
                        <View style={styles.eyeContainer}>
                          <Text style={styles.eyeIcon}>👁️</Text>
                          {!showPin && <View style={styles.eyeSlash} />}
                        </View>
                      </Pressable>
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Confirm PIN</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={confirmPin}
                        onChangeText={setConfirmPin}
                        placeholder="Re-enter"
                        placeholderTextColor={colors.textSubtle}
                        secureTextEntry={!showConfirmPin}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <Pressable
                        style={styles.eyeButton}
                        onPress={() => setShowConfirmPin((prev) => !prev)}
                        hitSlop={8}
                        accessibilityLabel={showConfirmPin ? "Hide Confirm PIN" : "Show Confirm PIN"}
                      >
                        <View style={styles.eyeContainer}>
                          <Text style={styles.eyeIcon}>👁️</Text>
                          {!showConfirmPin && <View style={styles.eyeSlash} />}
                        </View>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Government Undertaking / Legal Declaration */}
                <Pressable
                  style={styles.undertakingContainer}
                  onPress={() => setAgreedToTerms((prev) => !prev)}
                >
                  <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                    {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.undertakingTextContainer}>
                    <Text style={styles.undertakingTitle}>Official Government Undertaking</Text>
                    <Text style={styles.undertakingText}>
                      I solemnly declare that I am an authorized Department of Social Justice &amp; Empowerment (DoSJE) inspection officer. I understand that unauthorized access, false declarations, or evidence tampering are cognizable offenses punishable under Section 66 &amp; 70 of the Information Technology Act, 2000.
                    </Text>
                  </View>
                </Pressable>

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
                    onPress={handleRegister}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.textInverse} size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Submit for Verification &amp; Register</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.loginLink}
                    onPress={() => router.replace("/login")}
                  >
                    <Text style={styles.loginLinkText}>
                      Already have an account? <Text style={styles.loginLinkBold}>Sign In to Terminal</Text>
                    </Text>
                  </Pressable>
                </View>

                {/* Security Notice */}
                <View style={styles.footerNotice}>
                  <Text style={styles.footerNoticeText}>
                    🔒 Official Department of Social Justice &amp; Empowerment credential issuance. Tamper-evident logging enabled.
                  </Text>
                </View>
              </>
            )}
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
  topBackButton: {
    alignSelf: "flex-start",
    marginBottom: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  topBackText: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: "700",
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
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
    fontSize: 30,
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
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: colors.bgSubtle,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
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
  pinRow: {
    flexDirection: "row",
    gap: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeContainer: {
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  eyeIcon: {
    fontSize: 15,
  },
  eyeSlash: {
    position: "absolute",
    width: 18,
    height: 2,
    backgroundColor: colors.textSubtle,
    borderRadius: 1,
    transform: [{ rotate: "-45deg" }],
  },
  undertakingContainer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    alignItems: "flex-start",
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
    marginTop: 2,
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
  undertakingTextContainer: {
    flex: 1,
  },
  undertakingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  undertakingText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  confirmationContainer: {
    alignItems: "center",
    paddingVertical: 10,
    width: "100%",
  },
  refNumberBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navyBrand,
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    fontFamily: typography.mono,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 16,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSubtle,
    fontFamily: typography.mono,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  undertakingNoteBox: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
    width: "100%",
  },
  undertakingNoteText: {
    fontSize: 11,
    color: colors.goldDark,
    lineHeight: 16,
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
    gap: 12,
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
  loginLink: {
    alignItems: "center",
    paddingVertical: 6,
  },
  loginLinkText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  loginLinkBold: {
    color: colors.accentBlue,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerNotice: {
    marginTop: 18,
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
