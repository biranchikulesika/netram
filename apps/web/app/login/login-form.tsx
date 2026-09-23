"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { NetramApiClient } from "@netram/api-client";
import styles from "./login.module.css";

export interface LoginFormProps {
  apiUrl: string;
  isDev?: boolean;
}

const SEED_ACCOUNTS = [
  {
    role: "Department Admin",
    email: "admin.example-social@dev.netram.in",
    description: "Full state-level oversight & admin permissions",
  },
  {
    role: "District Officer (Khordha)",
    email: "officer.khordha@dev.netram.in",
    description: "District jurisdiction inspection approvals & projects",
  },
  {
    role: "Control Room Ops",
    email: "controlroom@dev.netram.in",
    description: "CCTV feeds, live monitoring & AI anomaly triage",
  },
  {
    role: "Institution Admin (Vani Vihar)",
    email: "institution.vani@dev.netram.in",
    description: "Institution reports & corrective actions",
  },
  {
    role: "Field Inspector",
    email: "inspector.one@dev.netram.in",
    description: "Inspection observation capture & assignment",
  },
];

export function LoginForm({ apiUrl, isDev = true }: LoginFormProps) {
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState("admin.example-social@dev.netram.in");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Validation & Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // UI state for institutional password reset assistance
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  const [showDevAccounts, setShowDevAccounts] = useState(false);

  function validate(): boolean {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email or username is required.");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid official email address.");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      isValid = false;
    }

    return isValid;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setServerError(null);

    try {
      let baseUrl = apiUrl;
      if (
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        try {
          const parsed = new URL(apiUrl);
          baseUrl = `${window.location.protocol}//${window.location.hostname}:${parsed.port || "3001"}`;
        } catch {
          // fallback to apiUrl
        }
      }

      const client = new NetramApiClient({
        baseUrl,
        fetchImpl: (...args) => fetch(...args),
      });

      // Authentication integration point:
      // In the current local/dev slice, we resolve the session via devLogin.
      // When password verification is activated on the backend, this cleanly
      // transitions to client.login({ email, password }).
      const { token } = await client.devLogin(email.trim());

      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          errorData?.error?.message ?? `Session creation failed (HTTP ${res.status})`,
        );
      }

      router.push("/dashboard/projects");
      router.refresh();
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please verify your credentials and network connection.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleQuickFill(seedEmail: string) {
    setEmail(seedEmail);
    setPassword("NetramSecure2026!");
    setEmailError(null);
    setPasswordError(null);
    setServerError(null);
  }

  return (
    <div className={styles.formContainer}>
      <div className={styles.cardHeader}>
        <div className={styles.sectionEyebrow}>
          <span>Portal Access</span>
        </div>
        <h2 className={styles.formTitle}>Authorized Sign In</h2>
        <p className={styles.formDescription}>
          Enter your official credentials to access the Netram monitoring and inspection portal.
        </p>
      </div>

      {serverError && (
        <div className={styles.alertBanner} role="alert">
          <svg
            className={styles.alertIcon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className={styles.alertContent}>
            <div className={styles.alertTitle}>Access Denied</div>
            <div>{serverError}</div>
          </div>
          <button
            type="button"
            className={styles.alertCloseButton}
            onClick={() => setServerError(null)}
            aria-label="Dismiss error message"
          >
            ×
          </button>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit} method="POST" noValidate>
        {/* Email or Username Field */}
        <div className={styles.fieldGroup}>
          <label htmlFor="email" className={styles.label}>
            Official Email <span className={styles.requiredAsterisk}>*</span>
          </label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputPrefixIcon} aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="officer@netram.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={`${styles.input} ${styles.inputWithPrefix} ${
                emailError ? styles.inputError : ""
              }`}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "email-error" : undefined}
              disabled={busy}
              required
            />
          </div>
          {emailError && (
            <p id="email-error" className={styles.fieldError} role="alert">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {emailError}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label htmlFor="password" className={styles.label}>
              Password <span className={styles.requiredAsterisk}>*</span>
            </label>
            <button
              type="button"
              className={styles.forgotLink}
              onClick={() => setShowForgotInfo(!showForgotInfo)}
            >
              Forgot password?
            </button>
          </div>

          <div className={styles.inputWrapper}>
            <span className={styles.inputPrefixIcon} aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              className={`${styles.input} ${styles.inputWithPrefix} ${styles.inputWithSuffix} ${
                passwordError ? styles.inputError : ""
              }`}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? "password-error" : undefined}
              disabled={busy}
              required
            />
            <button
              type="button"
              className={styles.togglePasswordButton}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              tabIndex={0}
            >
              {showPassword ? (
                /* Eye Off Icon */
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                /* Eye Open Icon */
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {passwordError && (
            <p id="password-error" className={styles.fieldError} role="alert">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {passwordError}
            </p>
          )}
        </div>

        {/* Institutional Password Reset Info Box */}
        {showForgotInfo && (
          <div className={styles.infoBox} role="status">
            <div className={styles.infoBoxHeader}>
              <span>Credential Assistance</span>
              <button
                type="button"
                className={styles.infoBoxClose}
                onClick={() => setShowForgotInfo(false)}
                aria-label="Close message"
              >
                ×
              </button>
            </div>
            Netram accounts are provisioned and managed by your Department Nodal Officer
            or Organization Administrator. To reset your password or recover access, please
            contact your designated system administrator or email{" "}
            <strong>support@netram.gov.in</strong>.
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={busy}
          className={styles.submitButton}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Authenticating…</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Development Quick-Fill Helper (only shown in development environments) */}
      {isDev && (
        <div className={styles.devSection}>
          <button
            type="button"
            className={styles.devToggle}
            onClick={() => setShowDevAccounts(!showDevAccounts)}
            aria-expanded={showDevAccounts}
          >
            <span className={styles.devBadge}>Dev Helper</span>
            <span>{showDevAccounts ? "Hide seeded accounts ▲" : "Quick-fill test account ▼"}</span>
          </button>

          {showDevAccounts && (
            <div className={styles.devAccountsList}>
              {SEED_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className={styles.devAccountButton}
                  onClick={() => handleQuickFill(acc.email)}
                  title={acc.description}
                >
                  <span className={styles.devAccountRole}>{acc.role}</span>
                  <span className={styles.devAccountEmail}>{acc.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
