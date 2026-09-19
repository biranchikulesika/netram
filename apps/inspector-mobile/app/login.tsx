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
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(`Live sign-in failed: ${msg}. You can tap \"Sign In (Offline Mode)\" if the backend is not running.`);
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
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Passcode / PIN</Text>
              <TextInput
                style={styles.input}
                value={passcode}
                onChangeText={setPasscode}
                placeholder="Enter field PIN"
                placeholderTextColor="#64748b"
                secureTextEntry
              />
            </View>

            {/* Advanced API Config Toggle */}
            <Pressable
              onPress={() => setShowAdvanced((prev) => !prev)}
              style={styles.advancedToggle}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? "? Hide Server URL" : "? Advanced Server Settings"}
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
                  placeholderTextColor="#64748b"
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
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In to Terminal</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                onPress={() => handleLogin(true)}
                disabled={busy}
              >
                <Text style={styles.secondaryButtonText}>? Continue in Offline Mode</Text>
              </Pressable>
            </View>

            {/* Security Notice */}
            <View style={styles.footerNotice}>
              <Text style={styles.footerNoticeText}>
                ?? Tamper-evident logging, GPS geo-stamping, and offline SHA-256 evidence hashing enabled.
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
    backgroundColor: "#0f172a",
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
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  ashokaStambh: {
    width: 48,
    height: 72,
    tintColor: "#f59e0b",
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
    color: "#f59e0b",
    backgroundColor: "#78350f33",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d9770644",
    letterSpacing: 0.5,
  },
  securityBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10b981",
    backgroundColor: "#064e3b33",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#05966944",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  chipActive: {
    backgroundColor: "#1e3a8a",
    borderColor: "#38bdf8",
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
  },
  advancedToggle: {
    marginVertical: 6,
  },
  advancedToggleText: {
    fontSize: 12,
    color: "#38bdf8",
  },
  errorBox: {
    backgroundColor: "#7f1d1d33",
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 16,
  },
  actionContainer: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryButtonText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerNotice: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  footerNoticeText: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 15,
  },
});

