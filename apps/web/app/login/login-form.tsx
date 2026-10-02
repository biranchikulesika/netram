"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NetramApiClient } from "@netram/api-client";
import styles from "./login.module.css";

export interface LoginFormProps {
  isDev?: boolean;
  /**
   * The server holds a session cookie but could not verify it, because the API
   * could not be asked (restarting, database rebuilding). Showing the sign-in
   * form here would tell an already-authenticated visitor that they are signed
   * out, so the page holds a reconnecting state instead.
   */
  sessionCheckFailed?: boolean;
}

const SEED_ACCOUNTS = [
  {
    role: "Department Admin",
    email: "admin@netram.dev",
    password: "Admin@netram2026",
    description: "Full state-level oversight & admin permissions",
  },
  {
    role: "District Officer",
    email: "officer@netram.dev",
    password: "Officer@netram2026",
    description: "District jurisdiction inspection approvals & projects",
  },
  {
    role: "Control Room Ops",
    email: "controlroom@netram.dev",
    password: "Controlroom@netram2026",
    description: "CCTV feeds, live monitoring & AI anomaly triage",
  },
  {
    role: "Institution Admin",
    email: "institute@netram.dev",
    password: "Institute@netram2026",
    description: "Institution reports & corrective actions",
  },
  {
    role: "Field Inspector",
    email: "inspector@netram.dev",
    password: "Inspector@netram2026",
    description: "Inspection observation capture & assignment",
  },
];

export function LoginForm({ isDev = true, sessionCheckFailed = false }: LoginFormProps) {
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState(isDev ? (SEED_ACCOUNTS[0]?.email ?? "") : "");
  const [password, setPassword] = useState(isDev ? (SEED_ACCOUNTS[0]?.password ?? "") : "");
  const [showPassword, setShowPassword] = useState(isDev);
  const [busy, setBusy] = useState(false);

  // Validation & Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
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
      const client = new NetramApiClient({
        // Same-origin BFF proxy: the browser never talks to the Fastify API
        // directly. The BFF forwards /api/v1/* to the API over the internal
        // network and attaches the session token from the httpOnly cookie.
        baseUrl: "",
        fetchImpl: (...args) => fetch(...args),
      });

      // Demo deployment runs the dev auth provider: authentication is by
      // email only (any of the seeded demo accounts). When a real password
      // verification backend is activated, this transitions to
      // client.login({ email, password }).
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

      router.push("/dashboard");
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

  function handleQuickFill(account: (typeof SEED_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setEmailError(null);
    setPasswordError(null);
    setServerError(null);
  }

  // A held session that could not be verified is not the same as being signed
  // out. Rendering the sign-in form would tell an authenticated visitor they
  // have no session, so hold the page in a reconnecting state that retries the
  // server render instead.
  if (sessionCheckFailed) {
    return (
      <div className={styles.formContainer}>
        <div className={styles.alertBanner} role="status">
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
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className={styles.alertContent}>
            <div className={styles.alertTitle}>Reconnecting</div>
            <div>
              We could not confirm your existing session just now. You are still signed in -
              retrying will take you straight back to your dashboard.
            </div>
            <button
              type="button"
              className={styles.crossBtn}
              style={{ marginTop: "12px" }}
              onClick={() => router.refresh()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
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
              aria-label="Official email"
              placeholder="Enter your email"
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
              aria-label="Password"
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

        {/* Submit Button */}
        <button type="submit" disabled={busy} className={styles.submitButton} aria-busy={busy}>
          {busy ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              <span>Authenticating…</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>{" "}
      {/* Development Quick-Fill Helper (only shown in development environments) */}
      {isDev && (
        <div className={styles.devSection}>
          <button
            type="button"
            className={styles.devToggle}
            onClick={() => setShowDevAccounts(!showDevAccounts)}
            aria-expanded={showDevAccounts}
          >
            <span>Test accounts</span>
            <svg
              className={styles.devChevron}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {showDevAccounts && (
            <div className={styles.devAccountsList}>
              {SEED_ACCOUNTS.map((acc) => {
                const active = acc.email === email.trim();
                return (
                  <button
                    key={acc.email}
                    type="button"
                    className={`${styles.devAccountButton} ${
                      active ? styles.devAccountActive : ""
                    }`}
                    onClick={() => handleQuickFill(acc)}
                    title={`${acc.email} - ${acc.description}`}
                    aria-pressed={active}
                  >
                    <span className={styles.devAccountRole}>{acc.role}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* The dev account list takes the bottom slot; links would compete with it. */}
      {!showDevAccounts && (
        <div className={styles.crossLinks}>
          <Link href="/" className={styles.crossBtn}>
            Home
          </Link>
          <Link href="/register-complaint" className={styles.crossBtn}>
            Register a Complaint
          </Link>
        </div>
      )}
    </div>
  );
}
