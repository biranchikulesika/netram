import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadClientEnv } from "@netram/config";
import { getSessionState } from "../../lib/api";
import { Masthead } from "../components/masthead";
import { Branding } from "./branding";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

// Title only. The description is inherited from the root layout so the site has
// a single, honest statement of what Netram is — see app/layout.tsx. Netram is
// a Smart India Hackathon 2026 project, not an official DoSJE or Government of
// India portal.
export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage() {
  const { status } = await getSessionState();
  if (status === "authenticated") redirect("/dashboard");

  const env = loadClientEnv();
  // Demo deployment: the platform intentionally runs the dev auth provider so
  // visitors can explore with the seeded demo accounts. The provider is the
  // honest signal — not a hostname guess (the demo VPS serves a public domain).
  const isDev = env.NETRAM_AUTH_PROVIDER !== "supabase";

  return (
    <div className={styles.pageWrapper}>
      {/* Masthead */}
      <Masthead />

      {/* Main Login Card */}
      <main className={styles.mainContainer}>
        <div className={styles.loginCard}>
          <Branding />
          <LoginForm isDev={isDev} sessionCheckFailed={status === "unverified"} />
        </div>
      </main>
    </div>
  );
}