import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useAuth } from "./_layout";

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim()) {
      setErrorMessage("Please enter your inspector email.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email.trim());
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e?.message ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>

          {/* NETRAM BRAND */}
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>N</Text>
              <View style={styles.checkMark} />
            </View>

            <View>
              <Text style={styles.brandName}>NETRAM</Text>
              <Text style={styles.brandSubtitle}>FIELD OPERATIONS</Text>
            </View>
          </View>

          {/* TOP STATUS */}
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>INSPECTOR ACCESS</Text>
          </View>

          {/* LOGIN CARD */}
          <View style={styles.card}>
            <Text style={styles.eyebrow}>INSPECTOR PORTAL</Text>

            <Text style={styles.title}>Welcome back</Text>

            <Text style={styles.description}>
              Sign in to access inspections, findings, evidence and field
              operations.
            </Text>

            <Text style={styles.label}>Inspector email</Text>

            <View
              style={[
                styles.inputWrapper,
                errorMessage ? styles.inputWrapperError : null,
              ]}
            >
              <View style={styles.emailIcon}>
                <Text style={styles.emailIconText}>@</Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Enter your inspector email"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (errorMessage) {
                    setErrorMessage(null);
                  }
                }}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* ERROR */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <View style={styles.errorCircle}>
                  <Text style={styles.errorCircleText}>!</Text>
                </View>

                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* LOGIN BUTTON */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && !loading ? styles.loginButtonPressed : null,
                loading ? styles.loginButtonDisabled : null,
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>CONNECTING...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.loginButtonText}>SIGN IN</Text>
                  <Text style={styles.arrow}>→</Text>
                </>
              )}
            </Pressable>

            {/* INFORMATION */}
            <View style={styles.infoBox}>
              <View style={styles.infoLine} />

              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>FIELD OPERATIONS</Text>

                <Text style={styles.infoText}>
                  Access your assigned inspections and manage field evidence
                  through the Netram system.
                </Text>
              </View>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>NETRAM INSPECTION SYSTEM</Text>

            <Text style={styles.footerText}>
              Smart monitoring • Evidence • Field operations
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071A2B",
  },

  scrollContent: {
    flexGrow: 1,
  },

  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 30,
  },

  /* BRAND */

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  logoMark: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    position: "relative",
  },

  logoLetter: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -2,
  },

  checkMark: {
    position: "absolute",
    width: 11,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#5EEAD4",
    right: 7,
    bottom: 10,
    transform: [{ rotate: "-45deg" }],
  },

  brandName: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
  },

  brandSubtitle: {
    color: "#5EEAD4",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginTop: 2,
  },

  /* STATUS */

  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D263D",
    borderWidth: 1,
    borderColor: "#23415A",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#14B8A6",
    marginRight: 8,
  },

  statusText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  /* CARD */

  card: {
    width: "100%",
    backgroundColor: "#0D263D",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#23415A",
    padding: 24,

    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 8,
  },

  eyebrow: {
    color: "#14B8A6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 9,
  },

  title: {
    color: "#F8FAFC",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },

  description: {
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 27,
  },

  /* INPUT */

  label: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 9,
  },

  inputWrapper: {
    width: "100%",
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#081D30",
    borderWidth: 1,
    borderColor: "#31516B",
    borderRadius: 13,
    paddingHorizontal: 13,
  },

  inputWrapperError: {
    borderColor: "#EF4444",
  },

  emailIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#123A55",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  emailIconText: {
    color: "#5EEAD4",
    fontSize: 14,
    fontWeight: "800",
  },

  input: {
    flex: 1,
    minHeight: 52,
    color: "#F8FAFC",
    fontSize: 14,
  },

  /* ERROR */

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A1720",
    borderWidth: 1,
    borderColor: "#7F1D2D",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginTop: 10,
  },

  errorCircle: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  errorCircleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  errorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 12,
    lineHeight: 17,
  },

  /* BUTTON */

  loginButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 13,
    backgroundColor: "#2563EB",
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 5,
  },

  loginButtonPressed: {
    opacity: 0.82,
  },

  loginButtonDisabled: {
    opacity: 0.65,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginLeft: 8,
  },

  arrow: {
    color: "#FFFFFF",
    fontSize: 21,
    marginLeft: 10,
  },

  /* INFO */

  infoBox: {
    flexDirection: "row",
    backgroundColor: "#102F45",
    borderRadius: 12,
    padding: 13,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#1F455F",
  },

  infoLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#14B8A6",
    marginRight: 11,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    color: "#5EEAD4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 3,
  },

  infoText: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 16,
  },

  /* FOOTER */

  footer: {
    alignItems: "center",
    marginTop: 24,
  },

  footerTitle: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  footerText: {
    color: "#475569",
    fontSize: 9,
    marginTop: 5,
    textAlign: "center",
  },
});