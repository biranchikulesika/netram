"use client";

import React, { useState } from "react";
import type { AuthenticatedUser } from "@netram/types";
import { IconUser } from "../../components/icons";

export interface AccountViewProps {
  user: AuthenticatedUser;
  permissions: string[];
}

/** Permission verbs grouped by what an operator actually wants to know. */
const ACTION_GROUPS = [
  { key: "view", label: "View", color: "#0c2a52", verbs: ["read", "stream", "list", "view"] },
  {
    key: "create",
    label: "Create",
    color: "#137e3a",
    verbs: ["create", "register", "upload", "anomaly"],
  },
  {
    key: "decide",
    label: "Decide",
    color: "#dd501e",
    verbs: ["approve", "verify", "resolve", "review", "evaluate", "release", "void", "submit"],
  },
  {
    key: "admin",
    label: "Administer",
    color: "#0c2a52",
    verbs: ["configure", "allocate", "assign", "transition", "manage", "update"],
  },
] as const;

function classify(action: string): (typeof ACTION_GROUPS)[number] {
  return (
    ACTION_GROUPS.find((g) => (g.verbs as readonly string[]).includes(action)) ?? ACTION_GROUPS[0]
  );
}

/** "ai" -> "AI", "corrective_action" -> "Corrective action". */
function humanise(code: string): string {
  const text = code.replace(/_/g, " ").toLowerCase();
  return text === "ai" ? "AI" : text.charAt(0).toUpperCase() + text.slice(1);
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      style={{
        flexShrink: 0,
        background: "none",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "5px",
        padding: "0.1rem 0.4rem",
        fontFamily: "inherit",
        fontSize: "0.7rem",
        fontWeight: 600,
        color: "var(--text-muted)",
        cursor: "pointer",
      }}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function AccountView({ user, permissions }: AccountViewProps) {
  const codes = permissions.map((p) => p.split(":") as [string, string]);
  const areas = new Set(codes.map(([resource]) => resource));
  const mix = ACTION_GROUPS.map((g) => ({
    ...g,
    count: codes.filter(([, action]) => classify(action ?? "").key === g.key).length,
  }));
  const total = permissions.length || 1;

  return (
    <div>
      <div className="section-title-row" style={{ marginBottom: "1.25rem" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "1.35rem",
            fontWeight: 700,
            color: "var(--color-navy-brand)",
          }}
        >
          Account
        </h2>
      </div>

      <div className="table-card" style={{ padding: "1.35rem", maxWidth: "560px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--color-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-navy-brand)",
            }}
          >
            <IconUser style={{ width: 18, height: 18 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--color-navy-brand)" }}>
              {user.displayName || user.email}
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginTop: "0.2rem",
                fontSize: "0.78rem",
                color: "var(--text-subtle)",
              }}
            >
              <span style={{ overflowWrap: "anywhere" }}>{user.email}</span>
              <CopyButton value={user.email} label="email" />
            </div>
          </div>
        </div>

        <hr
          style={{
            border: 0,
            borderTop: "1px solid var(--color-border-subtle)",
            margin: "1.1rem 0",
          }}
        />

        <div
          style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.85rem" }}
        >
          <h3
            style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "var(--text-subtle)" }}
          >
            {permissions.length} grants across {areas.size} areas
          </h3>
        </div>

        {/* One bar answers "what kind of access do I have" without a list. */}
        <div
          role="img"
          aria-label={mix.map((m) => `${m.label}: ${m.count}`).join(", ")}
          style={{
            display: "flex",
            height: "8px",
            borderRadius: "999px",
            overflow: "hidden",
            background: "var(--color-border-subtle)",
          }}
        >
          {mix.map((m) => (
            <div
              key={m.key}
              style={{ width: `${(m.count / total) * 100}%`, background: m.color }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.7rem" }}>
          {mix.map((m) => (
            <span
              key={m.key}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem" }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  background: m.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--text-subtle)" }}>{m.label}</span>
              <strong style={{ color: "var(--text-primary, #0c2a52)" }}>{m.count}</strong>
            </span>
          ))}
        </div>

        <details style={{ marginTop: "1rem" }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--color-navy-brand)",
            }}
          >
            View by area
          </summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "0.4rem",
              marginTop: "0.7rem",
            }}
          >
            {[...areas].sort().map((resource) => (
              <div
                key={resource}
                style={{
                  padding: "0.4rem 0.5rem",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "6px",
                  background: "var(--bg-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    color: "var(--text-primary, #0c2a52)",
                  }}
                >
                  {humanise(resource)}
                </div>
                <div
                  style={{ fontSize: "0.72rem", color: "var(--text-subtle)", marginTop: "0.1rem" }}
                >
                  {codes
                    .filter(([r]) => r === resource)
                    .map(([, a]) => humanise(a))
                    .join(", ")}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
