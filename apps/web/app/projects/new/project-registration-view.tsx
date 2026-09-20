"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Project, ProjectPhoto, ProjectType } from "@netram/types";
import { IconChevronLeft, IconCheck, IconAlertTriangle } from "../../components/icons";

interface DistrictOption {
  id: string;
  name: string;
  code: string;
}

interface OrgOption {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface ProgrammeOption {
  id: string;
  name: string;
  code: string;
}

const DISTRICTS: DistrictOption[] = [
  { id: "5f6c6fcf-fc88-5bf1-9f63-cad86ee0bd3b", name: "Khordha", code: "KHOL" },
  { id: "92f0e386-2b80-5ca4-94a0-9c7d90d47dbf", name: "Cuttack", code: "CUT" },
  { id: "ec220eb3-d4a3-5b12-9412-26d8badeafe7", name: "Puri", code: "PURI" },
  { id: "a2dfd214-5aa0-5c7a-aa78-7b59865ba0a3", name: "Ganjam", code: "GANJ" },
  { id: "e71c0cc4-6569-5e2b-bb73-cc3cae07fb8d", name: "Sundargarh", code: "SNDR" },
];

const ORGANISATIONS: OrgOption[] = [
  {
    id: "5266b3f3-5695-5db7-8d95-2c4a945db254",
    name: "Vani Vihar SC/ST Hostel Society",
    code: "ORG-VANI",
    category: "SC/ST Hostel",
  },
  {
    id: "c0d66822-60ae-504f-9706-7eaecacd9cf5",
    name: "Rajdhani Educational Trust",
    code: "ORG-RAJDHANI",
    category: "ST Hostel",
  },
  {
    id: "ebb58aff-76d7-5982-a3a0-0cd5413444c9",
    name: "Cuttack Welfare & Education Society",
    code: "ORG-CUTG",
    category: "SC/ST Girls Hostel",
  },
  {
    id: "c7d11f0c-e82c-53e7-baa7-d9a7c13ee981",
    name: "Puri Model Residential Society",
    code: "ORG-PURI",
    category: "Model Hostel",
  },
  {
    id: "6aa7e13a-b8ab-50aa-a43d-28c1464ec8a6",
    name: "Ganjam District Development Committee",
    code: "ORG-GANJ",
    category: "Model School Hostel",
  },
];

const PROGRAMMES: ProgrammeOption[] = [
  {
    id: "3c704771-9317-50bb-9479-7c4c9ff4f46c",
    name: "National Scholarship Programme - Special Hostels",
    code: "PGM-NSP",
  },
  {
    id: "d9df7c02-a898-5423-8e77-8cd6aa5925ca",
    name: "Annual Surprise Inspection Drive",
    code: "PGM-SURPRISE",
  },
];

const FACILITY_CATEGORIES = [
  "SC/ST Residential Boys Hostel",
  "SC/ST Residential Girls Hostel",
  "De-Addiction & Rehabilitation Centre",
  "Model Residential School (Eklavya/Ashram)",
  "Senior Citizens Care Home (Vridhashram)",
  "Skill Development & Training Centre",
  "Special School for Divyangjan (Children with Disabilities)",
  "Short Stay Shelter & Transit Care Home",
  "General Sanctioned Welfare Facility",
];

const STEPS = [
  { label: "Facility Details", helper: "Identify the welfare facility and its sanction." },
  { label: "Location", helper: "Where is this facility located in Odisha?" },
  { label: "Agency & Contact", helper: "Who operates the facility and who is in charge?" },
  { label: "Programme & Capacity", helper: "Link programmes, capacity, and operational notes." },
  { label: "Project Photos", helper: "Attach a visual record of the facility." },
] as const;

interface PhotoEntry {
  key: string;
  file: File | null;
  capturedAt: string;
  caption: string;
  uploaded?: boolean;
}

function nowInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ParsedDescription {
  category: string;
  sanctionRef: string;
  sanctionDate: string;
  capacity: string;
  inChargeName: string;
  inChargePhone: string;
  inChargeEmail: string;
  address: string;
  block: string;
  pinCode: string;
  operationalNotes: string;
}

/**
 * Reverses compileFullDescription so an existing project's packed `description`
 * can prefill the edit form. Heuristic: a saved project that was never produced
 * by this wizard, or multi-part free text inside a section, may round-trip
 * imprecisely (the stored description itself is never rewritten by parsing).
 */
function parseProjectDescription(description: string | null): ParsedDescription {
  const empty: ParsedDescription = {
    category: "",
    sanctionRef: "",
    sanctionDate: "",
    capacity: "",
    inChargeName: "",
    inChargePhone: "",
    inChargeEmail: "",
    address: "",
    block: "",
    pinCode: "",
    operationalNotes: "",
  };
  if (!description) return empty;

  const part = (label: string): string => {
    const m = description.match(
      new RegExp(`(?:^|\\|\\s*)${label}:\\s?(.*?)(?=\\s*\\|\\s*[A-Za-z-]+:|$)`),
    );
    return m?.[1]?.trim() ?? "";
  };

  const out = { ...empty };
  out.category = part("Category");
  out.sanctionRef = part("Sanction Ref");
  out.sanctionDate = part("Sanction Date");
  out.capacity = part("Sanctioned Capacity").replace(/\s+beneficiaries$/i, "");

  const inCharge = part("In-Charge");
  const ic = inCharge.match(/^([^(]+?)\s*\(([^)]*)\)\s*$/);
  if (ic) {
    out.inChargeName = ic[1]!.trim();
    const [phone, email] = ic[2]!.split(",").map((s) => s.trim());
    out.inChargePhone = phone ?? "";
    out.inChargeEmail = email ?? "";
  } else {
    out.inChargeName = inCharge;
  }

  const loc = part("Location");
  const pin = loc.match(/,\s*PIN:\s*([0-9]+)\s*$/i);
  const rest = loc.replace(/,\s*PIN:\s*[0-9]+\s*$/i, "").split(",").map((s) => s.trim());
  out.address = rest[0] ?? "";
  out.block = rest[1] ?? "";
  out.pinCode = pin?.[1] ?? "";

  out.operationalNotes = part("Scope");
  return out;
}

interface ProjectRegistrationViewProps {
  userEmail: string;
  canCreate: boolean;
  canApprove?: boolean;
  isAuthority?: boolean;
  isInstitutionAdmin?: boolean;
  mode?: "create" | "edit";
  initialProject?: Project | null;
  initialPhotos?: ProjectPhoto[];
}

export function ProjectRegistrationView({
  userEmail: _userEmail,
  canCreate,
  canApprove: _canApprove = false,
  isAuthority: _isAuthority = false,
  isInstitutionAdmin = false,
  mode = "create",
  initialProject = null,
  initialPhotos = [],
}: ProjectRegistrationViewProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && initialProject !== null;
  const parsed = parseProjectDescription(isEdit ? initialProject.description : null);

  // Form State
  const [name, setName] = useState(isEdit ? initialProject.name : "");
  const [type, setType] = useState<ProjectType>(isEdit ? initialProject.type : "institution");
  const [category, setCategory] = useState((parsed.category || FACILITY_CATEGORIES[0]) ?? "");
  const [sanctionRef, setSanctionRef] = useState(parsed.sanctionRef);
  const [sanctionDate, setSanctionDate] = useState(parsed.sanctionDate);

  const [districtId, setDistrictId] = useState(
    isEdit ? initialProject.districtId ?? DISTRICTS[0]!.id : DISTRICTS[0]!.id,
  );
  const [block, setBlock] = useState(parsed.block);
  const [address, setAddress] = useState(parsed.address);
  const [pinCode, setPinCode] = useState(parsed.pinCode);

  const [organisationId, setOrganisationId] = useState(
    isEdit ? initialProject.organisationId ?? ORGANISATIONS[0]!.id : ORGANISATIONS[0]!.id,
  );
  const [inChargeName, setInChargeName] = useState(parsed.inChargeName);
  const [inChargePhone, setInChargePhone] = useState(parsed.inChargePhone);
  const [inChargeEmail, setInChargeEmail] = useState(parsed.inChargeEmail);

  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>(
    isEdit && initialProject.programmeIds.length > 0
      ? initialProject.programmeIds
      : [PROGRAMMES[0]!.id],
  );
  const [capacity, setCapacity] = useState(parsed.capacity || "100");
  const [operationalNotes, setOperationalNotes] = useState(parsed.operationalNotes);

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);

  const [projectId, setProjectId] = useState<string | null>(isEdit ? initialProject.id : null);

  const [step, setStep] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const uploadedKeys = useRef<Set<string>>(new Set());

  function updatePhoto(key: string, patch: Partial<PhotoEntry>) {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addPhoto() {
    setPhotos((prev) => [
      ...prev,
      { key: crypto.randomUUID(), file: null, capturedAt: nowInputValue(), caption: "" },
    ]);
  }

  function removePhoto(key: string) {
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  }

  function toggleProgramme(id: string) {
    setSelectedProgrammes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function goNext() {
    setError(null);
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function compileFullDescription(): string {
    const parts: string[] = [];
    if (category) parts.push(`Category: ${category}`);
    if (sanctionRef.trim()) parts.push(`Sanction Ref: ${sanctionRef.trim()}`);
    if (sanctionDate) parts.push(`Sanction Date: ${sanctionDate}`);
    if (capacity.trim()) parts.push(`Sanctioned Capacity: ${capacity.trim()} beneficiaries`);
    if (inChargeName.trim()) {
      const contactBits = [inChargePhone.trim(), inChargeEmail.trim()].filter(Boolean).join(", ");
      parts.push(`In-Charge: ${inChargeName.trim()}${contactBits ? ` (${contactBits})` : ""}`);
    }
    if (address.trim() || block.trim() || pinCode.trim()) {
      const locBits = [address.trim(), block.trim(), pinCode.trim() ? `PIN: ${pinCode.trim()}` : ""]
        .filter(Boolean)
        .join(", ");
      parts.push(`Location: ${locBits}`);
    }
    if (operationalNotes.trim()) parts.push(`Scope: ${operationalNotes.trim()}`);
    return parts.join(" | ").slice(0, 2000);
  }

  async function uploadPhotos(targetProjectId: string): Promise<number> {
    let uploaded = 0;
    for (const entry of photos) {
      if (!entry.file || entry.uploaded || uploadedKeys.current.has(entry.key)) continue;
      const formData = new FormData();
      formData.append("file", entry.file, entry.file.name);
      if (entry.capturedAt) {
        formData.append("capturedAt", new Date(entry.capturedAt).toISOString());
      }
      if (entry.caption.trim()) formData.append("caption", entry.caption.trim());

      const res = await fetch(`/api/projects/${targetProjectId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message || body?.message || `Photo upload failed (${res.status}).`,
        );
      }
      updatePhoto(entry.key, { uploaded: true });
      uploadedKeys.current.add(entry.key);
      uploaded++;
    }
    return uploaded;
  }

  /** Creates (or patches) the project record. Returns the server-authoritative project. */
  async function persist(): Promise<Project> {
    const compiledDescription = compileFullDescription();
    const payload = {
      name: name.trim(),
      type,
      districtId: districtId || null,
      organisationId: organisationId || null,
      programmeIds: selectedProgrammes,
      description: compiledDescription || null,
    };

    const res = await fetch(projectId ? `/api/projects/${projectId}` : "/api/projects", {
      method: projectId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Server error (${res.status})`);
    }
    return data as Project;
  }

  async function saveDraft(e: React.MouseEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError("Unauthorized: You lack permission to register projects.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const project = await persist();
      setProjectId(project.id);
      const photoCount = await uploadPhotos(project.id);
      const photoNote =
        photoCount > 0 ? ` with ${photoCount} photo${photoCount > 1 ? "s" : ""}` : "";
      setSuccess(`Draft saved as ${project.code}${photoNote}. You can continue editing and submit later.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError("Unauthorized: You lack permission to register projects.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const project = await persist();
      setProjectId(project.id);

      const photoCount = await uploadPhotos(project.id);

      let submitted = false;
      let submitWarn = "";
      if (project.status === "Draft") {
        try {
          const tRes = await fetch(`/api/projects/${project.id}/transition`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: "Pending Verification" }),
          });
          const tData = await tRes.json().catch(() => null);
          if (!tRes.ok) {
            throw new Error(
              tData?.error?.message || tData?.message || `Submission failed (${tRes.status})`,
            );
          }
          submitted = true;
        } catch (submitErr) {
          submitWarn = submitErr instanceof Error ? submitErr.message : String(submitErr);
        }
      }

      const photoNote =
        photoCount > 0 ? ` with ${photoCount} photo${photoCount > 1 ? "s" : ""}` : "";
      const outcome = submitted ? ` registered and submitted for verification${photoNote}` : ` saved${photoNote}`;
      setSuccess(`Project "${project.name}" ${outcome}${submitWarn ? ` (${submitWarn})` : ""}.`);
      setTimeout(() => {
        router.push(`/projects/${project.id}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function discard(e: React.MouseEvent) {
    e.preventDefault();
    if (confirm(isEdit ? "Discard changes to this project?" : "Discard this draft?")) {
      router.push(projectId ? `/projects/${projectId}` : "/projects");
    }
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div className="breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link
          href="/projects"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
        >
          <IconChevronLeft width={14} height={14} /> Projects
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--color-navy-brand)",
          }}
        >
          {isEdit ? "Edit Project" : "Register Project"}
        </h1>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {isEdit
            ? `Update the facility record across ${STEPS.length} steps, then register your changes.`
            : `Register a welfare facility in ${STEPS.length} steps.`}
        </p>
      </div>

      {/* Progress Indicator */}
      <div style={{ display: "flex", marginBottom: "1.75rem" }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={s.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <div style={{ width: "100%", display: "flex", alignItems: "center" }}>
                {i > 0 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done || active ? "#16a34a" : "#e2e8f0",
                      transition: "background 0.2s ease",
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  aria-current={active || undefined}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  title={i <= step ? s.label : s.helper}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    flexShrink: 0,
                    border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: done ? "#16a34a" : active ? "#eff6ff" : "#ffffff",
                    color: done ? "#ffffff" : active ? "#1d4ed8" : "#94a3b8",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: i <= step ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  {done ? <IconCheck width={14} height={14} /> : i + 1}
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done ? "#16a34a" : "#e2e8f0",
                      transition: "background 0.2s ease",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: active ? 700 : 600,
                  color: active
                    ? "var(--color-navy-brand)"
                    : done
                      ? "#15803d"
                      : "var(--text-muted)",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error & Success Banners */}
      {error && (
        <div
          className="error-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.25rem",
            borderRadius: "6px",
          }}
        >
          <IconAlertTriangle width={16} height={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          <IconCheck width={16} height={16} style={{ color: "#16a34a" }} />
          <span>{success}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {step === 0 && (
          <div className="form-card">
            <div className="form-card-header">
              <h3>Facility Details</h3>
              <span className="form-helper">Step 1 of {STEPS.length}</span>
            </div>

            <div className="form-card-grid">
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" htmlFor="facility-name">
                  Project Name
                </label>
                <input
                  id="facility-name"
                  type="text"
                  placeholder="e.g. Sambalpur SC/ST Model Residential Hostel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  autoComplete="organization"
                  disabled={busy}
                />
                <div className="form-helper">Official name as per the sanction order.</div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="classification-type">
                  Type
                </label>
                <select
                  id="classification-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ProjectType)}
                  disabled={busy || isInstitutionAdmin}
                  style={{
                    background: isInstitutionAdmin ? "var(--bg-subtle)" : "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: isInstitutionAdmin ? "not-allowed" : "default",
                  }}
                >
                  <option value="institution">Institution / NGO Facility</option>
                  <option value="authority_project">Authority Project (Govt. Run)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="facility-category">
                  Category
                </label>
                <select
                  id="facility-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}
                >
                  {FACILITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="sanction-ref">
                  Sanction Reference
                </label>
                <input
                  id="sanction-ref"
                  type="text"
                  placeholder="e.g. DOSJE/OD/2026/F-1049"
                  value={sanctionRef}
                  onChange={(e) => setSanctionRef(e.target.value)}
                  maxLength={100}
                  disabled={busy}
                />
                <div className="form-helper">Reference no. of the sanction order.</div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="sanction-date">
                  Sanction Date
                </label>
                <input
                  id="sanction-date"
                  type="date"
                  value={sanctionDate}
                  onChange={(e) => setSanctionDate(e.target.value)}
                  disabled={busy}
                />
                <div className="form-helper">Date the facility was sanctioned.</div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-card">
            <div className="form-card-header">
              <h3>Location</h3>
              <span className="form-helper">Step 2 of {STEPS.length}</span>
            </div>

            <div className="form-card-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="state-fixed">
                  State
                </label>
                <input
                  id="state-fixed"
                  type="text"
                  value="Odisha"
                  disabled
                  style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="district-select">
                  District
                </label>
                <select
                  id="district-select"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  disabled={busy}
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="block-input">
                  Block / Tehsil
                </label>
                <input
                  id="block-input"
                  type="text"
                  placeholder="e.g. Bhubaneswar Urban"
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  maxLength={100}
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="pincode-input">
                  PIN Code
                </label>
                <input
                  id="pincode-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="e.g. 751007"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  maxLength={6}
                  disabled={busy}
                />
                <div className="form-helper">6-digit postal code of the locality.</div>
              </div>

              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" htmlFor="address-input">
                  Street Address
                </label>
                <input
                  id="address-input"
                  type="text"
                  placeholder="e.g. Plot 42, Vani Vihar Campus, Saheed Nagar"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={250}
                  disabled={busy}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-card">
            <div className="form-card-header">
              <h3>Operating Agency & Contact</h3>
              <span className="form-helper">Step 3 of {STEPS.length}</span>
            </div>

            <div className="form-card-grid">
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" htmlFor="org-select">
                  Agency / Society
                </label>
                <select
                  id="org-select"
                  value={organisationId}
                  onChange={(e) => setOrganisationId(e.target.value)}
                  disabled={busy}
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--color-border-strong)",
                    padding: "0.5rem 0.85rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  {type === "authority_project" && (
                    <option value="">(Direct Departmental Directorate)</option>
                  )}
                  {ORGANISATIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} [{o.code}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="incharge-name">
                  In-Charge / Superintendent
                </label>
                <input
                  id="incharge-name"
                  type="text"
                  placeholder="e.g. Dr. S. K. Mahapatra"
                  value={inChargeName}
                  onChange={(e) => setInChargeName(e.target.value)}
                  maxLength={100}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="incharge-phone">
                  Phone
                </label>
                <input
                  id="incharge-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. 9876543210"
                  value={inChargePhone}
                  onChange={(e) => setInChargePhone(e.target.value)}
                  maxLength={20}
                  autoComplete="tel"
                  disabled={busy}
                />
                <div className="form-helper">Mobile or landline with STD code.</div>
              </div>

              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" htmlFor="incharge-email">
                  Email
                </label>
                <input
                  id="incharge-email"
                  type="email"
                  placeholder="e.g. superintendent@vani-vihar.org"
                  value={inChargeEmail}
                  onChange={(e) => setInChargeEmail(e.target.value)}
                  maxLength={120}
                  autoComplete="email"
                  disabled={busy}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-card">
            <div className="form-card-header">
              <h3>Programme &amp; Capacity</h3>
              <span className="form-helper">Step 4 of {STEPS.length}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="form-label" style={{ marginBottom: "0.4rem", display: "block" }}>
                  Programmes
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {PROGRAMMES.map((prog) => {
                    const isChecked = selectedProgrammes.includes(prog.id);
                    return (
                      <label
                        key={prog.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          padding: "0.6rem 0.8rem",
                          borderRadius: "6px",
                          border: `1px solid ${isChecked ? "var(--color-navy-light)" : "var(--color-border-subtle)"}`,
                          background: isChecked ? "#f0f7ff" : "var(--bg-surface)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProgramme(prog.id)}
                          disabled={busy}
                          style={{ width: 16, height: 16, accentColor: "var(--color-navy-brand)" }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              color: "var(--color-navy-brand)",
                            }}
                          >
                            {prog.name}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {prog.code}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="form-helper" style={{ marginTop: "0.4rem" }}>
                  Select the programmes this facility participates in.
                </div>
              </div>

              <div className="form-card-grid" style={{ marginBottom: 0 }}>
                <div className="form-field">
                  <label className="form-label" htmlFor="capacity-input">
                    Sanctioned Capacity
                  </label>
                  <input
                    id="capacity-input"
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 100"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    min={1}
                    max={5000}
                    disabled={busy}
                  />
                  <div className="form-helper">Number of sanctioned beneficiary seats.</div>
                </div>

                <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="operational-notes">
                    Notes
                  </label>
                  <textarea
                    id="operational-notes"
                    placeholder="Operational notes, infrastructure details, intake scope..."
                    value={operationalNotes}
                    onChange={(e) => setOperationalNotes(e.target.value)}
                    rows={3}
                    maxLength={1200}
                    disabled={busy}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.8rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border-strong)",
                      fontFamily: "inherit",
                      fontSize: "0.85rem",
                      color: "var(--text-primary)",
                      background: "var(--bg-surface)",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="form-card">
            <div className="form-card-header">
              <h3>Project Photos</h3>
              <span className="form-helper">Step 5 of {STEPS.length}</span>
            </div>

            <div className="form-helper" style={{ marginBottom: "1rem" }}>
              Attach a visual record of the facility (e.g. main gate, rooms, kitchen). Each photo
              stores who uploaded it, when it was captured, and a short note.
            </div>

            {initialPhotos.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <span
                  className="form-label"
                  style={{ display: "block", marginBottom: "0.4rem" }}
                >
                  Photos on file
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: "0.75rem",
                  }}
                >
                  {initialPhotos.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        border: "1px solid var(--color-border-subtle)",
                        borderRadius: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={`/api/projects/photos/${p.id}/content`}
                        alt={p.caption ?? "Project photo"}
                        style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                      />
                      <div style={{ padding: "0.4rem 0.5rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {p.caption ?? "Photo"}
                        </div>
                        <div style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>
                          Captured{" "}
                          {new Date(p.capturedAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {photos.length === 0 && initialPhotos.length === 0 && (
                <div
                  style={{
                    padding: "1.25rem",
                    border: "1px dashed var(--color-border-strong)",
                    borderRadius: "6px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  No photos added yet.
                </div>
              )}

              {photos.map((entry, idx) => (
                <div
                  key={entry.key}
                  style={{
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "6px",
                    padding: "0.9rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}
                    >
                      Photo {initialPhotos.length + idx + 1}{" "}
                      {entry.uploaded ? (
                        <span style={{ color: "#15803d", fontWeight: 600 }}>— Uploaded</span>
                      ) : (
                        entry.file && (
                          <span style={{ fontWeight: 500 }}>
                            — {entry.file.name} ({(entry.file.size / 1024).toFixed(0)} KB)
                          </span>
                        )
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(entry.key)}
                      disabled={busy || entry.uploaded}
                      className="btn-secondary"
                      style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="form-field">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        updatePhoto(entry.key, {
                          file: e.target.files?.[0] ?? null,
                          uploaded: false,
                        })
                      }
                      disabled={busy || entry.uploaded}
                      style={{ padding: "0.35rem 0", fontSize: "0.82rem" }}
                    />
                  </div>

                  <div className="form-card-grid" style={{ marginBottom: 0 }}>
                    <div className="form-field">
                      <label className="form-label" htmlFor={`photo-time-${entry.key}`}>
                        Date &amp; Time
                      </label>
                      <input
                        id={`photo-time-${entry.key}`}
                        type="datetime-local"
                        value={entry.capturedAt}
                        onChange={(e) => updatePhoto(entry.key, { capturedAt: e.target.value })}
                        disabled={busy || entry.uploaded}
                      />
                      <div className="form-helper">When the photo was taken.</div>
                    </div>

                    <div className="form-field">
                      <label className="form-label" htmlFor={`photo-caption-${entry.key}`}>
                        Short Detail
                      </label>
                      <input
                        id={`photo-caption-${entry.key}`}
                        type="text"
                        placeholder="e.g. Main gate, Computer room, Kitchen"
                        value={entry.caption}
                        onChange={(e) => updatePhoto(entry.key, { caption: e.target.value })}
                        maxLength={500}
                        disabled={busy || entry.uploaded}
                      />
                      <div className="form-helper">Brief note describing the photo.</div>
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={addPhoto}
                  disabled={busy}
                  className="btn-secondary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", fontWeight: 600 }}
                >
                  + Add Photo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 0",
            borderTop: "1px solid var(--color-border-subtle)",
            marginBottom: "3rem",
          }}
        >
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="btn-secondary"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
            }}
          >
            Discard
          </button>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy || !canCreate}
              className="btn-secondary"
              style={{
                padding: "0.5rem 1.1rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                opacity: busy || !canCreate ? 0.65 : 1,
              }}
            >
              {busy ? "Saving…" : "Save as Draft"}
            </button>

            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="btn-secondary"
                style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem", fontWeight: 600 }}
              >
                Back
              </button>
            )}

            {!isLastStep ? (
              <button
                type="button"
                onClick={goNext}
                disabled={busy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  opacity: busy ? 0.65 : 1,
                }}
              >
                <span>Continue</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !canCreate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  opacity: busy || !canCreate ? 0.65 : 1,
                }}
              >
                <IconCheck width={15} height={15} />
                <span>{busy ? "Registering…" : "Register"}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
