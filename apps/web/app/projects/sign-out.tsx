"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} style={{ background: "#6b7280" }}>
      Sign out
    </button>
  );
}
