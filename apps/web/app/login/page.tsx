import type { Metadata } from "next";
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
      {/* Top Institutional Header */}
      <header className={styles.topBar}>
        <div className={styles.deptAffiliation}>
          <span className={styles.ashokaPill}>DoSJE</span>
          <span>Dept. of Social Justice &amp; Empowerment</span>
        </div>
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
