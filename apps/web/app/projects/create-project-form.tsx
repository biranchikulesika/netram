"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NetramApiClient, ApiError } from "@netram/api-client";

export function CreateProjectForm({ apiUrl }: { apiUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await new NetramApiClient({ baseUrl: apiUrl }).createProject({
        name: name.trim(),
      });
      setName("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
      <input
        placeholder="New project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        minLength={3}
        maxLength={200}
      />
      <button type="submit" disabled={busy || name.trim().length < 3}>
        {busy ? "Creating…" : "Create project"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
