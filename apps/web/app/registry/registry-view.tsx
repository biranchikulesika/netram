"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  DistrictView,
  JurisdictionView,
  OrganisationView,
  ProgrammeScopeLevel,
  ProgrammeView,
  StateView,
} from "@netram/types";
import {
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconClipboard,
  IconShieldCheck,
  IconTag,
  IconUser,
  IconAlertTriangle,
} from "../components/icons";
import { useRotatingPlaceholder } from "../../lib/use-rotating-placeholder";

/**
 * Hint ↔ example pairs per field. The placeholder alternates so the field
 * first explains what it wants, then shows how to fill it. Rotation pauses
 * while the field is focused.
 */
const PLACEHOLDER_HINTS = {
  orgCode: ["Unique agency code"],
  orgName: ["Registered agency or society name"],
  orgCategory: ["Organisation category"],
  programmeCode: ["Unique scheme code"],
  programmeName: ["Official scheme or programme name"],
  inspectorName: ["Inspector full name"],
  officialName: ["Official full name"],
  email: ["Official email address"],
  phone: ["Contact phone (optional)"],
} as const;

interface RegistryViewProps {
  currentEmail: string;
  canRegisterFacility: boolean;
  canRegisterOrganisation: boolean;
  canRegisterProgramme: boolean;
  canRegisterInspector: boolean;
  canRegisterOfficial: boolean;
  canListRegistryData: boolean;
}

type Feedback = { type: "success" | "error"; message: string } | null;

const OFFICIAL_ROLE_OPTIONS = [
  { code: "authority_official", label: "Authority Official", hint: "Reviews and approves registrations" },
  { code: "district_officer", label: "District Officer", hint: "District-scoped oversight" },
  { code: "institution_admin", label: "Institution Admin", hint: "Registers facilities for their organisation" },
  { code: "inspector", label: "Inspector", hint: "Field inspection staff" },
  { code: "viewer", label: "Viewer", hint: "Read-only monitoring access" },
];

export function RegistryView({
  currentEmail: _currentEmail,
  canRegisterFacility,
  canRegisterOrganisation,
  canRegisterProgramme,
  canRegisterInspector,
  canRegisterOfficial,
  canListRegistryData,
}: RegistryViewProps) {
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Existing records for context lists
  const [organisations, setOrganisations] = useState<OrganisationView[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeView[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionView[]>([]);
  const [states, setStates] = useState<StateView[]>([]);
  const [districts, setDistricts] = useState<DistrictView[]>([]);

  const anyCapability =
    canRegisterFacility ||
    canRegisterOrganisation ||
    canRegisterProgramme ||
    canRegisterInspector ||
    canRegisterOfficial;

  const loadLists = useCallback(async () => {
    if (!canListRegistryData) return;
    try {
      const [orgRes, progRes, jurRes, stateRes, distRes] = await Promise.all([
        fetch("/api/registry/organisations"),
        fetch("/api/registry/programmes"),
        fetch("/api/jurisdictions", { cache: "no-store" }),
        fetch("/api/registry/states", { cache: "no-store" }),
        fetch("/api/registry/districts", { cache: "no-store" }),
      ]);
      if (orgRes?.ok) setOrganisations(await orgRes.json());
      if (progRes?.ok) setProgrammes(await progRes.json());
      if (jurRes?.ok) setJurisdictions(await jurRes.json());
      if (stateRes?.ok) setStates(await stateRes.json());
      if (distRes?.ok) setDistricts(await distRes.json());
    } catch {
      // lists are supplementary; failures leave them empty
    }
  }, [canListRegistryData]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

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

  const cards = [
    {
      key: "facility",
      icon: <IconBuilding width={16} height={16} />,
      label: "Facility / Project",
      description: "Register a welfare facility: sanction, location, agency, capacity, photos.",
      allowed: canRegisterFacility,
      href: "/projects/new",
    },
    {
      key: "organisation",
      icon: <IconShieldCheck width={16} height={16} />,
      label: "Agency / Society",
      description: "Register an operating agency or society that runs facilities.",
      allowed: canRegisterOrganisation,
    },
    {
      key: "programme",
      icon: <IconClipboard width={16} height={16} />,
      label: "Scheme / Programme",
      description: "Register a welfare scheme that facilities participate in.",
      allowed: canRegisterProgramme,
    },
    {
      key: "inspector",
      icon: <IconUser width={16} height={16} />,
      label: "Inspector",
      description: "Invite a field inspector and assign their jurisdiction.",
      allowed: canRegisterInspector,
    },
    {
      key: "official",
      icon: <IconTag width={16} height={16} />,
      label: "Authority Official / Admin",
      description: "Invite an official and grant role, authority and jurisdiction.",
      allowed: canRegisterOfficial,
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      {feedback && (
        <div
          className={feedback.type === "success" ? "reg-success" : "error-banner"}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}
        >
          {feedback.type === "success" ? (
            <IconCheck width={16} height={16} style={{ color: "#16a34a" }} />
          ) : (
            <IconAlertTriangle width={16} height={16} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {!anyCapability && (
        <div className="error-banner" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <IconShieldCheck width={16} height={16} />
          <span>Your role does not include registration rights.</span>
        </div>
      )}

      {/* Capability cards */}
      <div className="registry-grid">
        {cards.map((card) => {
          if (!card.allowed) return null;
          const isActive = activeCard === card.key;
          return (
            <section
              key={card.key}
              className={`registry-card ${isActive ? "registry-card-active" : ""}`}
              onClick={() => card.href ? undefined : setActiveCard(isActive ? null : card.key)}
              role={card.href ? undefined : "button"}
              tabIndex={card.href ? undefined : 0}
              onKeyDown={(e) => {
                if (!card.href && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setActiveCard(isActive ? null : card.key);
                }
              }}
            >
              <div className="registry-card-head">
                <span className="registry-card-icon">{card.icon}</span>
                <div className="registry-card-titles">
                  <h2>{card.label}</h2>
                  <p className="registry-card-desc">{card.description}</p>
                </div>
              </div>
              <div className="registry-card-foot">
                {card.href ? (
                  <Link href={card.href} className="registry-card-link">
                    Open form <IconChevronRight width={12} height={12} className="registry-card-chev" />
                  </Link>
                ) : (
                  <span className="registry-card-link">
                    {isActive ? "Close" : "Register"}
                    <IconChevronRight
                      width={12}
                      height={12}
                      className={`registry-card-chev ${isActive ? "registry-card-chev-open" : ""}`}
                    />
                  </span>
                )}
              </div>

              {isActive && card.key === "organisation" && (
                <OrganisationForm
                  districts={districts}
                  onDone={(msg) => {
                    setFeedback({ type: "success", message: msg });
                    setActiveCard(null);
                    void loadLists();
                  }}
                  onError={(msg) => setFeedback({ type: "error", message: msg })}
                  postJson={postJson}
                />
              )}
              {isActive && card.key === "programme" && (
                <ProgrammeForm
                  states={states}
                  districts={districts}
                  onDone={(msg) => {
                    setFeedback({ type: "success", message: msg });
                    setActiveCard(null);
                    void loadLists();
                  }}
                  onError={(msg) => setFeedback({ type: "error", message: msg })}
                  postJson={postJson}
                />
              )}
              {isActive && card.key === "inspector" && (
                <InspectorForm
                  jurisdictions={jurisdictions}
                  onDone={(msg) => {
                    setFeedback({ type: "success", message: msg });
                    setActiveCard(null);
                  }}
                  onError={(msg) => setFeedback({ type: "error", message: msg })}
                  postJson={postJson}
                />
              )}
              {isActive && card.key === "official" && (
                <OfficialForm
                  jurisdictions={jurisdictions}
                  onDone={(msg) => {
                    setFeedback({ type: "success", message: msg });
                    setActiveCard(null);
                  }}
                  onError={(msg) => setFeedback({ type: "error", message: msg })}
                  postJson={postJson}
                />
              )}
            </section>
          );
        })}
      </div>

      {/* Existing records */}
      {canListRegistryData && (organisations.length > 0 || programmes.length > 0) && (
        <div className="registry-lists">
          {organisations.length > 0 && (
            <div className="registry-list">
              <h3>Registered agencies</h3>
              <ul>
                {organisations.slice(0, 8).map((o) => (
                  <li key={o.id}>
                    <span className="registry-list-code">{o.code}</span> {o.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {programmes.length > 0 && (
            <div className="registry-list">
              <h3>Registered schemes</h3>
              <ul>
                {programmes.slice(0, 8).map((p) => {
                  const scopeLabel =
                    p.scopeLevel === "national"
                      ? "National"
                      : p.scopeLevel === "state"
                        ? (states.find((s) => s.id === p.stateId)?.name ?? "State")
                        : (districts.find((d) => d.id === p.districtId)?.name ?? "District");
                  return (
                    <li key={p.id}>
                      <span className="registry-list-code">{p.code}</span> {p.name}
                      <span className="registry-list-scope">{scopeLabel}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Inline forms ---------------- */

interface FormProps {
  onDone: (message: string) => void;
  onError: (message: string) => void;
  postJson: <T>(url: string, body: unknown) => Promise<T>;
}

const ORG_CATEGORY_OPTIONS = [
  "NGO / Society",
  "Charitable Trust",
  "Section 8 Company",
  "Government Directorate",
  "Autonomous Body",
  "Other",
];

function OrganisationForm({
  districts,
  onDone,
  onError,
  postJson,
}: FormProps & { districts: DistrictView[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(ORG_CATEGORY_OPTIONS[0]!);
  const [districtId, setDistrictId] = useState("");
  const [busy, setBusy] = useState(false);
  const codePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.orgCode);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.orgName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/registry/organisations", {
        code,
        name,
        category,
        districtId: districtId || null,
      });
      onDone(`Agency "${name}" registered with code ${code}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="registry-form" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
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
      <button type="submit" className="reg-submit" disabled={busy}>
        <IconCheck width={14} height={14} />
        {busy ? "Registering…" : "Register Agency"}
      </button>
    </form>
  );
}

const SCOPE_LEVEL_OPTIONS: { value: ProgrammeScopeLevel; label: string }[] = [
  { value: "national", label: "National — open to all facilities" },
  { value: "state", label: "State — facilities within one state" },
  { value: "district", label: "District — facilities in a single district" },
];

function ProgrammeForm({
  states,
  districts,
  onDone,
  onError,
  postJson,
}: FormProps & { states: StateView[]; districts: DistrictView[] }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeLevel, setScopeLevel] = useState<ProgrammeScopeLevel>("national");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [busy, setBusy] = useState(false);
  const codePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.programmeCode);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.programmeName);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/registry/programmes", {
        code,
        name,
        description: description || null,
        scopeLevel,
        stateId: scopeLevel === "state" ? stateId : null,
        districtId: scopeLevel === "district" ? districtId : null,
      });
      onDone(`Scheme "${name}" registered with code ${code}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const territoryReady =
    scopeLevel === "national" ||
    (scopeLevel === "state" && stateId !== "") ||
    (scopeLevel === "district" && districtId !== "");

  return (
    <form className="registry-form" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
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
      <label>
        Geographic scope <span className="req">*</span>
        <select
          value={scopeLevel}
          onChange={(e) => setScopeLevel(e.target.value as ProgrammeScopeLevel)}
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
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={1000}
          disabled={busy}
        />
      </label>
      <button type="submit" className="reg-submit" disabled={busy || !territoryReady}>
        <IconCheck width={14} height={14} />
        {busy ? "Registering…" : "Register Scheme"}
      </button>
    </form>
  );
}

function InspectorForm({
  jurisdictions,
  onDone,
  onError,
  postJson,
}: FormProps & { jurisdictions: JurisdictionView[] }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [busy, setBusy] = useState(false);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.inspectorName);
  const emailPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.email);
  const phonePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.phone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/registry/inspectors", {
        email,
        displayName,
        phone: phone.trim() || null,
        jurisdictionId,
      });
      onDone(`Inspector "${displayName}" invited — their account activates on first sign-in.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="registry-form" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
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
      <div className="registry-form-row">
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
      </div>
      <div className="registry-form-note">
        The inspector is created <strong>suspended</strong> and gains access when they first sign in
        through the official account flow.
      </div>
      <button type="submit" className="reg-submit" disabled={busy || !jurisdictionId}>
        <IconCheck width={14} height={14} />
        {busy ? "Inviting…" : "Invite Inspector"}
      </button>
    </form>
  );
}

function OfficialForm({
  jurisdictions,
  onDone,
  onError,
  postJson,
}: FormProps & { jurisdictions: JurisdictionView[] }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleCode, setRoleCode] = useState(OFFICIAL_ROLE_OPTIONS[0]!.code);
  const [scope, setScope] = useState<"national" | "jurisdiction">("national");
  const [jurisdictionId, setJurisdictionId] = useState("");
  const [busy, setBusy] = useState(false);
  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.officialName);
  const emailPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.email);
  const phonePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.phone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/registry/officials", {
        email,
        displayName,
        phone: phone.trim() || null,
        roleCode,
        scope,
        jurisdictionId: scope === "jurisdiction" ? jurisdictionId : null,
      });
      onDone(`Official "${displayName}" invited as ${roleCode} — account activates on first sign-in.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="registry-form registry-form-privileged" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
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
      <div className="registry-form-note registry-form-note-warn">
        <IconAlertTriangle width={13} height={13} />
        This grants system access. The invitee receives no password — they activate their account
        through the official sign-in flow. All grants are audited.
      </div>
      <button type="submit" className="reg-submit" disabled={busy}>
        <IconCheck width={14} height={14} />
        {busy ? "Inviting…" : "Invite Official"}
      </button>
    </form>
  );
}
