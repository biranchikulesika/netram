import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { loadClientEnv } from "@netram/config";
import { getSessionUser } from "../../lib/api";
import { Branding } from "./branding";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign In — Netram Monitoring Platform",
  description:
    "Official access portal for the Department of Social Justice & Empowerment (DoSJE) monitoring system.",
};

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");

  const env = loadClientEnv();
  // Demo deployment: the platform intentionally runs the dev auth provider so
  // visitors can explore with the seeded demo accounts. The provider is the
  // honest signal — not a hostname guess (the demo VPS serves a public domain).
  const isDev = env.NETRAM_AUTH_PROVIDER !== "supabase";

  return (
    <div className={styles.pageWrapper}>
      {/* Masthead */}
      <div className={styles.masthead}>
        <a
          href="https://socialjustice.gov.in"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.mastheadLink}
        >
          <Image
            src="/National-Emblem-1.svg"
            alt="Department of Social Justice & Empowerment logo"
            width={72}
            height={72}
            className={styles.emblem}
          />
          <div className={styles.mastheadName}>
            <strong>Department of Social Justice and Empowerment</strong>
            <span>Government of India</span>
          </div>
        </a>
        <a
          href="https://sih.gov.in"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.mastheadEnd}
        >
          <Image
            src="/sih-logo.png"
            alt="Smart India Hackathon"
            width={208}
            height={96}
            className={styles.sihLogo}
          />
        </a>
      </div>

      {/* Main Login Card */}
      <main className={styles.mainContainer}>
        <div className={styles.loginCard}>
          <Branding />
          <LoginForm isDev={isDev} />
        </div>
      </main>
    </div>
  );
}