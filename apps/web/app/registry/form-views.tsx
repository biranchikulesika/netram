"use client";

import Link from "next/link";
import { useState } from "react";
import type { DistrictView, JurisdictionView, StateView } from "@netram/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronLeft,
} from "../components/icons";
import { useRotatingPlaceholder } from "../../lib/use-rotating-placeholder";

/**
 * Dedicated registry forms (agency, scheme, inspector, official).
 *
 * Each form renders inside a page-level FormShell: a header with back link,
 * the form card, and a contextual side rail. After a successful submit the
 * shell swaps to a success panel with next actions.
 */

/* ---------------- shared field hint ---------------- */

const PLACEHOLDER_HINTS = {
  orgCode: ["Unique agency code"],
  orgName: ["Registered agency or society name"],
  programmeCode: ["Unique scheme code"],
  programmeName: ["Official scheme or programme name"],
  inspectorName: ["Inspector full name"],
  officialName: ["Official full name"],
  email: ["Official email address"],
  phone: ["Contact phone (optional)"],
} as const;

/* ---------------- shell + feedback ---------------- */

interface FormShellProps {
  title: string;
  description: string;
  /** Section eyebrow above the title. */
  kind: string;
  backHref: string;
  children: React.ReactNode;
  /** Sticky side rail content (context, guidance, actions). */
  aside: React.ReactNode;
}

export function FormShell({ title, description, kind, backHref, children, aside }: FormShellProps) {
  return (
    <div className="reg-page">
      <div className="reg-form-header">
        <Link className="reg-form-back" href={backHref}>
          <IconChevronLeft width={12} height={12} /> Registrations
        </Link>
        <span className="reg-form-kind">{kind}</span>
      </div>
      <div className="reg-form-heading">
        <h1 className="reg-title">{title}</h1>
        <p className="reg-form-desc">{description}</p>
      </div>

      <div className="reg-layout">
        <div className="reg-main">{children}</div>
        <aside className="reg-aside">{aside}</aside>
      </div>
    </div>
  );
}

interface SuccessPanelProps {
  title: string;
  message: string;
  onAnother: () => void;
  anotherLabel?: string;
  backHref: string;
  backLabel?: string;
}

/** Post-submit state: replaces the form; no silent resets. */
export function SuccessPanel({
  title,
  message,
  onAnother,
  anotherLabel = "Register another",
  backHref,
  backLabel = "Back to Registrations",
}: SuccessPanelProps) {
  return (
    <section className="reg-success-panel" aria-live="polite">
      <span className="reg-success-icon">
        <IconCheck width={18} height={18} />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="reg-success-actions">
        <button type="button" className="btn-secondary" onClick={onAnother}>
          {anotherLabel}
        </button>
        <Link href={backHref} className="reg-success-link">
          {backLabel}
        </Link>
      </div>
    </section>
  );
}

/* ---------------- shared submit plumbing ---------------- */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Error banner shown above the form while the panel keeps entered values. */
function FormError({ message }: { message: string }) {
  return (
    <div className="error-banner" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <IconAlertTriangle width={15} height={15} />
      <span>{message}</span>
    </div>
  );
}

interface FormChrome {
  onSuccess: (title: string, message: string) => void;
}

/* ---------------- Agency / Society ---------------- */

const ORG_CATEGORY_OPTIONS = [
  "NGO / Society",
  "Charitable Trust",
  "Section 8 Company",
  "Government Directorate",
  "Autonomous Body",
  "Other",
];

export function OrganisationForm({ districts, onSuccess }: FormChrome & { districts: DistrictView[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(ORG_CATEGORY_OPTIONS[0]!);
  const [districtId, setDistrictId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.orgCode);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.orgName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/registry/organisations", {
        code,
        name,
        category,
        districtId: districtId || null,
      });
      onSuccess(`Agency "${name}" registered`, `Code ${code} is now part of the registry.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form className="registry-form-page" onSubmit={submit}>
      {error && <FormError message={error} />}
      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">1</span>
          <div>
            <h2>Identity</h2>
          </div>
        </div>
        <div className="registry-form-row">
          <label>
            Code <span className="req">*</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={codePh.text}
              {...codePh.handlers}
              required
              minLength={3}
              maxLength={50}
              pattern="[A-Z0-9-]+"
              disabled={busy}
            />
          </label>
          <label>
            Name <span className="req">*</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePh.text}
              {...namePh.handlers}
              required
              minLength={3}
              maxLength={300}
              disabled={busy}
            />
          </label>
        </div>
      </section>

      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">2</span>
          <div>
            <h2>Classification</h2>
          </div>
        </div>
        <div className="registry-form-row">
          <label>
            Category <span className="req">*</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
              {ORG_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Home district
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={busy}>
              <option value="">— Not district-specific —</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <button type="submit" className="reg-submit" disabled={busy}>
        <IconCheck width={14} height={14} />
        {busy ? "Registering…" : "Register Agency"}
      </button>
    </form>
  );
}

/* ---------------- Scheme / Programme ---------------- */

const SCOPE_LEVEL_OPTIONS: { value: "national" | "state" | "district"; label: string }[] = [
  { value: "national", label: "National — open to all facilities" },
  { value: "state", label: "State — facilities within one state" },
  { value: "district", label: "District — facilities in a single district" },
];

export function ProgrammeForm({
  states,
  districts,
  onSuccess,
}: FormChrome & { states: StateView[]; districts: DistrictView[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeLevel, setScopeLevel] = useState<"national" | "state" | "district">("national");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.programmeCode);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.programmeName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/registry/programmes", {
        code,
        name,
        description: description || null,
        scopeLevel,
        stateId: scopeLevel === "state" ? stateId : null,
        districtId: scopeLevel === "district" ? districtId : null,
      });
      onSuccess(`Scheme "${name}" registered`, `Code ${code} — scope: ${scopeLevel}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const territoryReady =
    scopeLevel === "national" ||
    (scopeLevel === "state" && stateId !== "") ||
    (scopeLevel === "district" && districtId !== "");

  return (
    <form className="registry-form-page" onSubmit={submit}>
      {error && <FormError message={error} />}
      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">1</span>
          <div>
            <h2>Identity</h2>
          </div>
        </div>
        <div className="registry-form-row">
          <label>
            Code <span className="req">*</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={codePh.text}
              {...codePh.handlers}
              required
              minLength={3}
              maxLength={50}
              pattern="[A-Z0-9-]+"
              disabled={busy}
            />
          </label>
          <label>
            Name <span className="req">*</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePh.text}
              {...namePh.handlers}
              required
              minLength={3}
              maxLength={300}
              disabled={busy}
            />
          </label>
        </div>
      </section>

      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">2</span>
          <div>
            <h2>Geographic scope</h2>
          </div>
        </div>
        <label>
          Scope <span className="req">*</span>
          <select
            value={scopeLevel}
            onChange={(e) => setScopeLevel(e.target.value as "national" | "state" | "district")}
            disabled={busy}
          >
            {SCOPE_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        {scopeLevel === "state" && (
          <label>
            State <span className="req">*</span>
            <select value={stateId} onChange={(e) => setStateId(e.target.value)} disabled={busy}>
              <option value="">Select state…</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </label>
        )}
        {scopeLevel === "district" && (
          <label>
            District <span className="req">*</span>
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              disabled={busy}
            >
              <option value="">Select district…</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">3</span>
          <div>
            <h2>Details</h2>
          </div>
        </div>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            disabled={busy}
          />
        </label>
      </section>

      <button type="submit" className="reg-submit" disabled={busy || !territoryReady}>
        <IconCheck width={14} height={14} />
        {busy ? "Registering…" : "Register Scheme"}
      </button>
    </form>
  );
}

/* ---------------- Inspector ---------------- */

export function InspectorForm({
  jurisdictions,
  onSuccess,
}: FormChrome & { jurisdictions: JurisdictionView[] }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.inspectorName);
  const emailPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.email);
  const phonePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.phone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/registry/inspectors", {
        email,
        displayName,
        phone: phone.trim() || null,
        jurisdictionId,
      });
      onSuccess(
        `Inspector "${displayName}" invited`,
        "Their account activates on first sign-in through the official account flow.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form className="registry-form-page" onSubmit={submit}>
      {error && <FormError message={error} />}
      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">1</span>
          <div>
            <h2>Person</h2>
          </div>
        </div>
        <div className="registry-form-row">
          <label>
            Full name <span className="req">*</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={namePh.text}
              {...namePh.handlers}
              required
              minLength={2}
              maxLength={200}
              disabled={busy}
            />
          </label>
          <label>
            Official email <span className="req">*</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPh.text}
              {...emailPh.handlers}
              required
              maxLength={255}
              disabled={busy}
            />
          </label>
        </div>
        <label>
          Contact phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={phonePh.text}
            {...phonePh.handlers}
            maxLength={20}
            disabled={busy}
          />
        </label>
      </section>

      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">2</span>
          <div>
            <h2>Jurisdiction</h2>
          </div>
        </div>
        <label>
          Jurisdiction <span className="req">*</span>
          <select
            value={jurisdictionId}
            onChange={(e) => setJurisdictionId(e.target.value)}
            required
            disabled={busy}
          >
            <option value="">Select jurisdiction…</option>
            {jurisdictions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} ({j.code})
              </option>
            ))}
          </select>
        </label>
        <div className="registry-form-note">
          The inspector is created <strong>suspended</strong> and gains access when they first sign
          in through the official account flow.
        </div>
      </section>

      <button type="submit" className="reg-submit" disabled={busy || !jurisdictionId}>
        <IconCheck width={14} height={14} />
        {busy ? "Inviting…" : "Invite Inspector"}
      </button>
    </form>
  );
}

/* ---------------- Authority Official / Admin ---------------- */

const OFFICIAL_ROLE_OPTIONS = [
  { code: "authority_official", label: "Authority Official", hint: "Reviews and approves registrations" },
  { code: "district_officer", label: "District Officer", hint: "District-scoped oversight" },
  { code: "institution_admin", label: "Institution Admin", hint: "Registers facilities for their organisation" },
  { code: "inspector", label: "Inspector", hint: "Field inspection staff" },
  { code: "viewer", label: "Viewer", hint: "Read-only monitoring access" },
];

export function OfficialForm({
  jurisdictions,
  onSuccess,
}: FormChrome & { jurisdictions: JurisdictionView[] }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleCode, setRoleCode] = useState(OFFICIAL_ROLE_OPTIONS[0]!.code);
  const [scope, setScope] = useState<"national" | "jurisdiction">("national");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.officialName);
  const emailPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.email);
  const phonePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.phone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/registry/officials", {
        email,
        displayName,
        phone: phone.trim() || null,
        roleCode,
        scope,
        jurisdictionId: scope === "jurisdiction" ? jurisdictionId : null,
      });
      onSuccess(
        `Official "${displayName}" invited as ${roleCode}`,
        "Their account activates on first sign-in. All grants are audited.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form className="registry-form-page registry-form-privileged" onSubmit={submit}>
      {error && <FormError message={error} />}
      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">1</span>
          <div>
            <h2>Person</h2>
          </div>
        </div>
        <div className="registry-form-row">
          <label>
            Full name <span className="req">*</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={namePh.text}
              {...namePh.handlers}
              required
              minLength={2}
              maxLength={200}
              disabled={busy}
            />
          </label>
          <label>
            Official email <span className="req">*</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPh.text}
              {...emailPh.handlers}
              required
              maxLength={255}
              disabled={busy}
            />
          </label>
        </div>
        <label>
          Contact phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={phonePh.text}
            {...phonePh.handlers}
            maxLength={20}
            disabled={busy}
          />
        </label>
      </section>

      <section className="reg-section">
        <div className="reg-section-head">
          <span className="reg-step-chip">2</span>
          <div>
            <h2>Access grant</h2>
          </div>
        </div>
        <div className="registry-form-row">
          <label>
            Role <span className="req">*</span>
            <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)} disabled={busy}>
              {OFFICIAL_ROLE_OPTIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} — {r.hint}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope <span className="req">*</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "national" | "jurisdiction")}
              disabled={busy}
            >
              <option value="national">National (all jurisdictions)</option>
              <option value="jurisdiction">Jurisdiction-scoped</option>
            </select>
          </label>
        </div>
        {scope === "jurisdiction" && (
          <label>
            Jurisdiction <span className="req">*</span>
            <select
              value={jurisdictionId}
              onChange={(e) => setJurisdictionId(e.target.value)}
              required
              disabled={busy}
            >
              <option value="">Select jurisdiction…</option>
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} ({j.code})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="registry-form-note registry-form-note-warn">
          <IconAlertTriangle width={13} height={13} />
          This grants system access. The invitee receives no password — they activate their account
          through the official sign-in flow. All grants are audited.
        </div>
      </section>

      <button type="submit" className="reg-submit" disabled={busy}>
        <IconCheck width={14} height={14} />
        {busy ? "Inviting…" : "Invite Official"}
      </button>
    </form>
  );
}
