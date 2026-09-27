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
  const isDev =
    env.NODE_ENV !== "production" ||
    env.NEXT_PUBLIC_API_URL.includes("localhost") ||
    env.NEXT_PUBLIC_API_URL.includes("127.0.0.1");

  return (
    <div className={styles.pageWrapper}>
      {/* ADDED: thin tricolor accent strip, common on Indian govt portals */}
      <div className={styles.govStrip} />

      {/* Top Institutional Header */}
      <header className={styles.topBar}>
        {/* CHANGED: replaced the "DoSJE" pill + written affiliation text with the actual logo */}
        <Image
          src="National-Emblem-1.svg"
          alt="Netram"
          width={90}
          height={90}
          style={{ objectFit: "contain" }}
        />
        <Image
          src="/netram2.png"
          alt="Netram"
          width={90}
          height={90}
          style={{ objectFit: "contain" }}
        />
      </header>

      {/* Main Login Card */}
      <main className={styles.mainContainer}>
        <div className={styles.loginCard}>
          <Branding />
          <LoginForm apiUrl={env.NEXT_PUBLIC_API_URL} isDev={isDev} />
        </div>
      </main>
    </div>
  );
}