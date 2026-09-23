"use client";

import Link from "next/link";
import { useState } from "react";
import type { DistrictView, JurisdictionView, StateView } from "@netram/types";
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconClipboard,
  IconMapPin,
  IconShieldCheck,
  IconTag,
  IconUser,
} from "../../components/icons";
import { useRotatingPlaceholder } from "../../../lib/use-rotating-placeholder";

/**
 * Dedicated registry forms (agency, scheme, inspector, official).
 *
 * Each form renders inside a page-level FormShell: a header with back link.
 * The form body mirrors the project-registration layout — icon-chip sections
 * in the main column and a live summary rail (progress meter, jump checklist,
 * contextual notes, submit action) that stays sticky while scrolling.
 * After a successful submit the shell swaps to a success panel.
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
  children: React.ReactNode;
}

export function FormShell({ title, description, children }: FormShellProps) {
  return (
    <div className="reg-page">
      <div className="reg-form-heading">
        <h1 className="reg-title">{title}</h1>
        <p className="reg-form-desc">{description}</p>
      </div>
      {children}
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

/* ---------------- summary rail ---------------- */

interface RailSection {
  key: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

interface SummaryRailProps {
  sections: RailSection[];
  footnoteTitle: string;
  footnote: React.ReactNode;
  submitLabel: string;
  busy?: boolean;
  busyLabel: string;
  submitDisabled?: boolean;
}

function SummaryRail({
  sections,
  footnoteTitle,
  footnote,
  submitLabel,
  busy = false,
  busyLabel,
  submitDisabled = false,
}: SummaryRailProps) {
  const completedCount = sections.filter((s) => s.done).length;
  const pct = Math.round((completedCount / sections.length) * 100);

  return (
    <aside className="reg-aside">
      <div className="reg-summary">
        <div className="reg-summary-head">
          <span className="reg-summary-title">Registration</span>
        </div>

        <div
          className="reg-meter"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Registration completeness"
        >
          <div className="reg-meter-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="reg-meter-caption">
          {pct === 100
            ? "All sections complete — ready to submit."
            : `${completedCount} of ${sections.length} sections complete`}
        </div>

        <ul className="reg-checklist">
          {sections.map((s) => (
            <li key={s.key} className={s.done ? "done" : ""}>
              <span className="reg-check-dot" aria-hidden="true">
                {s.done ? <IconCheck width={10} height={10} /> : null}
              </span>
              <span className="reg-check-label">{s.label}</span>
              {s.optional && <span className="reg-check-optional">optional</span>}
              <a
                href={`#section-${s.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`section-${s.key}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                className="reg-check-jump"
                title="Jump to section"
              >
                <IconChevronLeft width={11} height={11} style={{ transform: "rotate(180deg)" }} />
              </a>
            </li>
          ))}
        </ul>

        <div className="reg-lifecycle">
          <div className="reg-lifecycle-title">{footnoteTitle}</div>
          {footnote}
        </div>

        <div className="reg-actions">
          <button type="submit" className="reg-submit" disabled={busy || submitDisabled}>
            <IconCheck width={15} height={15} />
            <span>{busy ? busyLabel : submitLabel}</span>
          </button>
        </div>
      </div>
    </aside>
  );
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

export function OrganisationForm({ onSuccess }: FormChrome) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(ORG_CATEGORY_OPTIONS[0]!);
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
      });
      onSuccess(`Agency "${name}" registered`, `Code ${code} is now part of the registry.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const sections: RailSection[] = [
    { key: "identity", label: "Identity & code", done: code.trim().length >= 3 && name.trim().length >= 3 },
    { key: "classification", label: "Classification", done: category !== "" },
  ];

  return (
    <form className="reg-layout" onSubmit={submit}>
      <div className="reg-main">
        {error && <FormError message={error} />}

        <section className="reg-section" id="section-identity">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconTag width={13} height={13} />
            </span>
            <div>
              <h2>Identity</h2>
            </div>
            {sections[0]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="org-code">
                Code <span className="req">*</span>
              </label>
              <input
                id="org-code"
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
            </div>
            <div className="reg-field">
              <label className="form-label" htmlFor="org-name">
                Name <span className="req">*</span>
              </label>
              <input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePh.text}
                {...namePh.handlers}
                required
                minLength={3}
                maxLength={300}
                disabled={busy}
              />
            </div>
          </div>
        </section>

        <section className="reg-section" id="section-classification">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconBuilding width={13} height={13} />
            </span>
            <div>
              <h2>Classification</h2>
            </div>
            {sections[1]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="org-category">
                Category <span className="req">*</span>
              </label>
              <select
                id="org-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                {ORG_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>

      <SummaryRail
        sections={sections}
        footnoteTitle="Before you register"
        footnote={
          <>
            <ul className="reg-aside-list">
              <li>The code is the agency&apos;s permanent registry identifier.</li>
              <li>Category reflects the legal form of the society or trust.</li>
            </ul>
            <div className="registry-form-note">
              Agencies go live immediately. Facilities are linked to an agency when the facility is
              registered.
            </div>
          </>
        }
        submitLabel="Register Agency"
        busy={busy}
        busyLabel="Registering…"
      />
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

  const sections: RailSection[] = [
    { key: "identity", label: "Identity & code", done: code.trim().length >= 3 && name.trim().length >= 3 },
    { key: "scope", label: "Geographic scope", done: territoryReady },
    { key: "details", label: "Details", done: description.trim() !== "", optional: true },
  ];

  return (
    <form className="reg-layout" onSubmit={submit}>
      <div className="reg-main">
        {error && <FormError message={error} />}

        <section className="reg-section" id="section-identity">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconTag width={13} height={13} />
            </span>
            <div>
              <h2>Identity</h2>
            </div>
            {sections[0]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="pgm-code">
                Code <span className="req">*</span>
              </label>
              <input
                id="pgm-code"
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
            </div>
            <div className="reg-field">
              <label className="form-label" htmlFor="pgm-name">
                Name <span className="req">*</span>
              </label>
              <input
                id="pgm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePh.text}
                {...namePh.handlers}
                required
                minLength={3}
                maxLength={300}
                disabled={busy}
              />
            </div>
          </div>
        </section>

        <section className="reg-section" id="section-scope">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconMapPin width={13} height={13} />
            </span>
            <div>
              <h2>Geographic scope</h2>
            </div>
            {sections[1]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="pgm-scope">
                Scope <span className="req">*</span>
              </label>
              <select
                id="pgm-scope"
                value={scopeLevel}
                onChange={(e) => setScopeLevel(e.target.value as "national" | "state" | "district")}
                disabled={busy}
              >
                {SCOPE_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {scopeLevel === "state" && (
              <div className="reg-field">
                <label className="form-label" htmlFor="pgm-state">
                  State <span className="req">*</span>
                </label>
                <select
                  id="pgm-state"
                  value={stateId}
                  onChange={(e) => setStateId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select state…</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {scopeLevel === "district" && (
              <div className="reg-field">
                <label className="form-label" htmlFor="pgm-district">
                  District <span className="req">*</span>
                </label>
                <select
                  id="pgm-district"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select district…</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        <section className="reg-section" id="section-details">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconClipboard width={13} height={13} />
            </span>
            <div>
              <h2>Details</h2>
            </div>
            <span className="reg-check-optional">optional</span>
          </div>

          <div className="reg-fields">
            <div className="reg-field reg-field-wide">
              <label className="form-label" htmlFor="pgm-description">
                Description
              </label>
              <textarea
                id="pgm-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                disabled={busy}
              />
            </div>
          </div>
        </section>
      </div>

      <SummaryRail
        sections={sections}
        footnoteTitle="Scheme scope"
        footnote={
          <>
            <ul className="reg-aside-list">
              <li>
                <strong>National</strong> — any facility may link the scheme.
              </li>
              <li>
                <strong>State</strong> — only facilities inside the chosen state.
              </li>
              <li>
                <strong>District</strong> — only facilities in that district.
              </li>
            </ul>
            <div className="registry-form-note">
              Scope is enforced server-side at link time: a facility outside the scheme&apos;s
              territory cannot participate.
            </div>
          </>
        }
        submitLabel="Register Scheme"
        busy={busy}
        busyLabel="Registering…"
        submitDisabled={!territoryReady}
      />
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

  const sections: RailSection[] = [
    {
      key: "person",
      label: "Person & contact",
      done: displayName.trim().length >= 2 && email.includes("@") && email.includes("."),
    },
    { key: "jurisdiction", label: "Jurisdiction", done: jurisdictionId !== "" },
  ];

  return (
    <form className="reg-layout" onSubmit={submit}>
      <div className="reg-main">
        {error && <FormError message={error} />}

        <section className="reg-section" id="section-person">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconUser width={13} height={13} />
            </span>
            <div>
              <h2>Person</h2>
            </div>
            {sections[0]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="insp-name">
                Full name <span className="req">*</span>
              </label>
              <input
                id="insp-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={namePh.text}
                {...namePh.handlers}
                required
                minLength={2}
                maxLength={200}
                disabled={busy}
              />
            </div>
            <div className="reg-field">
              <label className="form-label" htmlFor="insp-email">
                Official email <span className="req">*</span>
              </label>
              <input
                id="insp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={emailPh.text}
                {...emailPh.handlers}
                required
                maxLength={255}
                disabled={busy}
              />
            </div>
            <div className="reg-field reg-field-wide">
              <label className="form-label" htmlFor="insp-phone">
                Contact phone
              </label>
              <input
                id="insp-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={phonePh.text}
                {...phonePh.handlers}
                maxLength={20}
                disabled={busy}
              />
            </div>
          </div>
        </section>

        <section className="reg-section" id="section-jurisdiction">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconMapPin width={13} height={13} />
            </span>
            <div>
              <h2>Jurisdiction</h2>
            </div>
            {sections[1]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field reg-field-wide">
              <label className="form-label" htmlFor="insp-jurisdiction">
                Jurisdiction <span className="req">*</span>
              </label>
              <select
                id="insp-jurisdiction"
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
            </div>
          </div>
        </section>
      </div>

      <SummaryRail
        sections={sections}
        footnoteTitle="What happens next"
        footnote={
          <ul className="reg-aside-list">
            <li>
              The account is created <strong>suspended</strong> — no password is set.
            </li>
            <li>The inspector activates it by signing in through the official flow.</li>
            <li>Their jurisdiction limits which inspections they can be assigned.</li>
          </ul>
        }
        submitLabel="Invite Inspector"
        busy={busy}
        busyLabel="Inviting…"
        submitDisabled={!jurisdictionId}
      />
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

  const grantReady = scope === "national" || jurisdictionId !== "";

  const sections: RailSection[] = [
    {
      key: "person",
      label: "Person & contact",
      done: displayName.trim().length >= 2 && email.includes("@") && email.includes("."),
    },
    { key: "access", label: "Access grant", done: grantReady },
  ];

  return (
    <form className="reg-layout" onSubmit={submit}>
      <div className="reg-main">
        {error && <FormError message={error} />}

        <section className="reg-section" id="section-person">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconUser width={13} height={13} />
            </span>
            <div>
              <h2>Person</h2>
            </div>
            {sections[0]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="off-name">
                Full name <span className="req">*</span>
              </label>
              <input
                id="off-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={namePh.text}
                {...namePh.handlers}
                required
                minLength={2}
                maxLength={200}
                disabled={busy}
              />
            </div>
            <div className="reg-field">
              <label className="form-label" htmlFor="off-email">
                Official email <span className="req">*</span>
              </label>
              <input
                id="off-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={emailPh.text}
                {...emailPh.handlers}
                required
                maxLength={255}
                disabled={busy}
              />
            </div>
            <div className="reg-field reg-field-wide">
              <label className="form-label" htmlFor="off-phone">
                Contact phone
              </label>
              <input
                id="off-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={phonePh.text}
                {...phonePh.handlers}
                maxLength={20}
                disabled={busy}
              />
            </div>
          </div>
        </section>

        <section className="reg-section" id="section-access">
          <div className="reg-section-head">
            <span className="reg-step-chip" aria-hidden="true">
              <IconShieldCheck width={13} height={13} />
            </span>
            <div>
              <h2>Access grant</h2>
            </div>
            {sections[1]!.done && (
              <span className="reg-section-done" title="Section complete">
                <IconCheck width={13} height={13} />
              </span>
            )}
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <label className="form-label" htmlFor="off-role">
                Role <span className="req">*</span>
              </label>
              <select
                id="off-role"
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value)}
                disabled={busy}
              >
                {OFFICIAL_ROLE_OPTIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} — {r.hint}
                  </option>
                ))}
              </select>
            </div>
            <div className="reg-field">
              <label className="form-label" htmlFor="off-scope">
                Scope <span className="req">*</span>
              </label>
              <select
                id="off-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as "national" | "jurisdiction")}
                disabled={busy}
              >
                <option value="national">National (all jurisdictions)</option>
                <option value="jurisdiction">Jurisdiction-scoped</option>
              </select>
            </div>
            {scope === "jurisdiction" && (
              <div className="reg-field reg-field-wide">
                <label className="form-label" htmlFor="off-jurisdiction">
                  Jurisdiction <span className="req">*</span>
                </label>
                <select
                  id="off-jurisdiction"
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
              </div>
            )}
          </div>
        </section>
      </div>

      <SummaryRail
        sections={sections}
        footnoteTitle="Access grants"
        footnote={
          <>
            <ul className="reg-aside-list">
              <li>
                <strong>Authority Official</strong> verifies registrations and reviews findings.
              </li>
              <li>
                <strong>District Officer</strong> oversees one district only.
              </li>
              <li>
                <strong>Institution Admin</strong> registers facilities for their organisation.
              </li>
            </ul>
            <div className="registry-form-note registry-form-note-warn">
              National scope grants reach across all jurisdictions. Grants are audited.
            </div>
          </>
        }
        submitLabel="Invite Official"
        busy={busy}
        busyLabel="Inviting…"
        submitDisabled={!grantReady}
      />
    </form>
  );
}