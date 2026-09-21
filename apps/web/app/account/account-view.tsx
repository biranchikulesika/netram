"use client";

import React from "react";
import type { AuthenticatedUser } from "@netram/types";
import { IconUser, IconShieldCheck, IconLock } from "../components/icons";

export interface AccountViewProps {
  user: AuthenticatedUser;
  permissions: string[];
}

export function AccountView({ user, permissions }: AccountViewProps) {
  return (
    <div>
      <div className="section-title-row" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
            Account Profile
          </h2>
          <p className="muted" style={{ marginTop: "0.15rem", fontSize: "0.82rem" }}>
            Operator identity, jurisdictional credentials, and active session details
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", maxWidth: "900px" }}>
        {/* Operator Identity Card */}
        <div className="table-card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--color-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-navy-brand)",
              }}
            >
              <IconUser style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--color-navy-brand)" }}>
                {user.displayName || "Authorized Operator"}
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                {user.type === "netram" ? "National Oversight System Account" : "External Federated Identity"}
              </span>
            </div>
          </div>

          <dl className="dossier-list">
            <div className="dossier-row">
              <dt className="dossier-dt">Official Email</dt>
              <dd className="dossier-dd" style={{ fontWeight: 600 }}>{user.email}</dd>
            </div>
            <div className="dossier-row">
              <dt className="dossier-dt">Operator ID</dt>
              <dd className="dossier-dd" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                {user.id}
              </dd>
            </div>
            <div className="dossier-row">
              <dt className="dossier-dt">Account Type</dt>
              <dd className="dossier-dd">
                <span className="badge badge-routine">{user.type.toUpperCase()}</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Security & Access Scope Card */}
        <div className="table-card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--action-green)",
              }}
            >
              <IconShieldCheck style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--color-navy-brand)" }}>
                Authorization Scope
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                {permissions.length} Active System Capabilities
              </span>
            </div>
          </div>

          <dl className="dossier-list">
            <div className="dossier-row">
              <dt className="dossier-dt">Enforced Policy</dt>
              <dd className="dossier-dd">Role-Based Access Control (RBAC)</dd>
            </div>
            <div className="dossier-row">
              <dt className="dossier-dt">Permission Total</dt>
              <dd className="dossier-dd" style={{ fontFamily: "var(--font-mono)" }}>
                {permissions.length} grants
              </dd>
            </div>
            <div className="dossier-row">
              <dt className="dossier-dt">Security Status</dt>
              <dd className="dossier-dd">
                <span className="badge badge-routine" style={{ color: "var(--action-green)" }}>AUTHENTICATED</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Under Construction / Placeholder Section */}
      <div
        className="table-card"
        style={{
          marginTop: "1.25rem",
          padding: "1.25rem 1.5rem",
          maxWidth: "900px",
          background: "var(--bg-subtle)",
          border: "1px dashed var(--color-border-strong)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
          <IconLock style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span>
            Account credential rotation and session audit preferences are managed according to Central DoSJE security policies. Full self-service management panel under construction.
          </span>
        </div>
      </div>
    </div>
  );
}
