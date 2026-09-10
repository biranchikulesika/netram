"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NetramApiClient } from "@netram/api-client";

export function LoginForm({ apiUrl }: { apiUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("admin.example-social@dev.netram.in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const client = new NetramApiClient({ baseUrl: apiUrl });
      const { token } = await client.devLogin(email);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`Session failed: ${res.status}`);
      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 360 }}>
      <label className="muted" htmlFor="email">
        Dev email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
