"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Project, ProjectPhoto, ProjectType } from "@netram/types";
import {
  IconChevronLeft,
  IconCheck,
  IconAlertTriangle,
  IconTag,
  IconMapPin,
  IconBuilding,
  IconClipboard,
  IconCamera,
  IconX,
  IconShieldCheck,
} from "../../../components/icons";
import { StatusBadge } from "../[id]/status-badge";
import { useRotatingPlaceholder } from "../../../../lib/use-rotating-placeholder";

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
    name: "National Scholarship Programme — Special Hostels",
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

/**
 * Hint ↔ example pairs per field — short and scannable. The placeholder
 * alternates so the field first says what it wants, then shows an example.
 */
const PLACEHOLDER_HINTS = {
  name: ["Name as per sanction order"],
  sanctionRef: ["Sanction order reference no."],
  pinCode: ["6-digit PIN code"],
  phone: ["Mobile or landline number"],
  email: ["Official email address"],
  block: ["Block or tehsil"],
  address: ["Street address"],
  inCharge: ["Facility in-charge name"],
  capacity: ["Sanctioned seats"],
} as const;

interface PhotoEntry {
  key: string;
  file: File | null;
  previewUrl?: string;
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
 * can prefill the form. Heuristic: a saved project that was never produced
 * by this flow, or multi-part free text inside a section, may round-trip
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
    isEdit ? initialProject.organisationId ?? "" : "",
  );
  const [inChargeName, setInChargeName] = useState(parsed.inChargeName);
  const [inChargePhone, setInChargePhone] = useState(parsed.inChargePhone);
  const [inChargeEmail, setInChargeEmail] = useState(parsed.inChargeEmail);

  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>(
    isEdit && initialProject.programmeIds.length > 0
      ? initialProject.programmeIds
      : [],
  );
  const [capacity, setCapacity] = useState(parsed.capacity);
  // Operational Notes field was removed from the form; existing scope text is
  // still preserved (parsed + re-compiled) so edit mode never drops data.

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const [projectId, setProjectId] = useState<string | null>(isEdit ? initialProject.id : null);
  const [savedCode, setSavedCode] = useState<string | null>(isEdit ? initialProject.code : null);
  const [savedStatus, setSavedStatus] = useState<string | null>(
    isEdit ? initialProject.status : null,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const namePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.name);
  const sanctionRefPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.sanctionRef);
  const pinCodePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.pinCode);
  const blockPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.block);
  const addressPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.address);
  const inChargePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.inCharge);
  const phonePh = useRotatingPlaceholder(PLACEHOLDER_HINTS.phone);
  const emailPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.email);
  const capacityPh = useRotatingPlaceholder(PLACEHOLDER_HINTS.capacity);

  // Revoke any object URLs when the component unmounts
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function updatePhoto(key: string, patch: Partial<PhotoEntry>) {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function attachFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: PhotoEntry[] = [];
    for (const file of Array.from(fileList)) {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      next.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: url,
        capturedAt: nowInputValue(),
        caption: file.name.replace(/\.[^.]+$/, ""),
      });
    }
    setPhotos((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const entry = prev.find((p) => p.key === key);
      if (entry?.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
        objectUrlsRef.current.delete(entry.previewUrl);
      }
      return prev.filter((p) => p.key !== key);
    });
  }

  function toggleProgramme(id: string) {
    setSelectedProgrammes((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
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
    if (parsed.operationalNotes.trim()) parts.push(`Scope: ${parsed.operationalNotes.trim()}`);
    return parts.join(" | ").slice(0, 2000);
  }

  async function uploadPhotos(targetProjectId: string): Promise<number> {
    let uploaded = 0;
    for (const entry of photos) {
      if (!entry.file || entry.uploaded || objectUrlsRef.current.has(entry.key)) continue;
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
      contactName: inChargeName.trim() || null,
      contactPhone: inChargePhone.trim() || null,
      contactEmail: inChargeEmail.trim() || null,
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

  async function saveDraft() {
    if (!canCreate) {
      setError("Unauthorized: You lack permission to register projects.");
      return;
    }
    if (!validateIdentity()) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const project = await persist();
      setProjectId(project.id);
      setSavedCode(project.code);
      setSavedStatus(project.status);
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

  function validateIdentity(): boolean {
    if (name.trim().length < 3) {
      setNameError("Enter the official facility name (at least 3 characters).");
      document.getElementById("facility-name")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    setNameError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError("Unauthorized: You lack permission to register projects.");
      return;
    }
    if (!validateIdentity()) return;

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const project = await persist();
      setProjectId(project.id);
      setSavedCode(project.code);
      setSavedStatus(project.status);

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
          setSavedStatus("Pending Verification");
        } catch (submitErr) {
          submitWarn = submitErr instanceof Error ? submitErr.message : String(submitErr);
        }
      }

      const photoNote =
        photoCount > 0 ? ` with ${photoCount} photo${photoCount > 1 ? "s" : ""}` : "";
      const outcome = submitted ? ` registered and submitted for verification${photoNote}` : ` saved${photoNote}`;
      setSuccess(`Project "${project.name}" ${outcome}${submitWarn ? ` (${submitWarn})` : ""}.`);
      setTimeout(() => {
        router.push(`/dashboard/projects/${project.id}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function discard(e: React.MouseEvent) {
    e.preventDefault();
    if (confirm(isEdit ? "Discard changes to this project?" : "Discard this draft?")) {
      router.push(projectId ? `/dashboard/projects/${projectId}` : "/dashboard/projects");
    }
  }

  // ---- Live completion tracking (drives the summary rail) ----
  const sectionDone = {
    identity: name.trim().length >= 3 && sanctionRef.trim() !== "" && sanctionDate !== "",
    location: address.trim() !== "" && pinCode.trim() !== "",
    agency: organisationId !== "" && inChargeName.trim() !== "" && (inChargePhone.trim() !== "" || inChargeEmail.trim() !== ""),
    programme: selectedProgrammes.length > 0 && capacity.trim() !== "",
    evidence: photos.length > 0 || initialPhotos.length > 0,
  };
  const optional = { identity: false, location: false, agency: false, programme: false, evidence: true } as const;
  const completedCount = Object.values(sectionDone).filter(Boolean).length;
  const completenessPct = Math.round((completedCount / 5) * 100);

  const summaryItems: { key: keyof typeof sectionDone; label: string }[] = [
    { key: "identity", label: "Facility & Sanction" },
    { key: "location", label: "Location" },
    { key: "agency", label: "Agency & Contact" },
    { key: "programme", label: "Programme & Capacity" },
    { key: "evidence", label: "Photo Evidence" },
  ];

  return (
    <div className="reg-page">
      {/* Header */}
      <div className="reg-header">
        <h1 className="reg-title">{isEdit ? "Edit Project" : "Register Project"}</h1>
        {isEdit && savedStatus ? <StatusBadge status={savedStatus as Project["status"]} /> : null}
      </div>

      {!canCreate && (
        <div className="error-banner" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <IconShieldCheck width={16} height={16} />
          <span>Your role does not include project registration rights — the form is read-only.</span>
        </div>
      )}

      {/* Error & Success Banners */}
      {error && (
        <div className="error-banner" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <IconAlertTriangle width={16} height={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="reg-success" role="status">
          <IconCheck width={16} height={16} style={{ color: "#137e3a", flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="reg-layout">
        {/* ---------------- Main column ---------------- */}
        <div className="reg-main">
          {/* 1 — Facility & Sanction */}
          <section className="reg-section" id="section-identity">
            <div className="reg-section-head">
              <span className="reg-step-chip" aria-hidden="true">
                <IconTag width={13} height={13} />
              </span>
              <div>
                <h2>Facility &amp; Sanction</h2>
              </div>
              {sectionDone.identity && (
                <span className="reg-section-done" title="Section complete">
                  <IconCheck width={13} height={13} />
                </span>
              )}
            </div>

            <div className="reg-fields">
              <div className="reg-field reg-field-wide">
                <label className="form-label" htmlFor="facility-name">
                  Project Name <span className="req">*</span>
                </label>
                <input
                  id="facility-name"
                  type="text"
                  placeholder={namePh.text}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  {...namePh.handlers}
                  maxLength={200}
                  autoComplete="organization"
                  disabled={busy}
                  aria-invalid={nameError ? true : undefined}
                  className={nameError ? "reg-input-error" : undefined}
                />
                {nameError && <div className="reg-error-text">{nameError}</div>}
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="classification-type">Type</label>
                <select
                  id="classification-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ProjectType)}
                  disabled={busy || isInstitutionAdmin}
                  style={{ cursor: isInstitutionAdmin ? "not-allowed" : "default" }}
                >
                  <option value="institution">Institution / NGO Facility</option>
                  <option value="authority_project">Authority Project (Govt. Run)</option>
                  <option value="other">Other</option>
                </select>
                {isInstitutionAdmin && (
                  <div className="form-helper">Fixed to your organisation&apos;s registration type.</div>
                )}
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="facility-category">Category</label>
                <select
                  id="facility-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                >
                  {FACILITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="sanction-ref">Sanction Reference</label>
                                <input
                  id="sanction-ref"
                  type="text"
                  placeholder={sanctionRefPh.text}
                  value={sanctionRef}
                  onChange={(e) => setSanctionRef(e.target.value)}
                  {...sanctionRefPh.handlers}
                  maxLength={100}
                  disabled={busy}
                />
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="sanction-date">Sanction Date</label>
                <input
                  id="sanction-date"
                  type="date"
                  value={sanctionDate}
                  onChange={(e) => setSanctionDate(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
          </section>

          {/* 2 — Location */}
          <section className="reg-section" id="section-location">
            <div className="reg-section-head">
              <span className="reg-step-chip" aria-hidden="true">
                <IconMapPin width={13} height={13} />
              </span>
              <div>
                <h2>Location</h2>
              </div>
              {sectionDone.location && (
                <span className="reg-section-done" title="Section complete">
                  <IconCheck width={13} height={13} />
                </span>
              )}
            </div>

            <div className="reg-fields">
              <div className="reg-field">
                <label className="form-label" htmlFor="state-fixed">State</label>
                <input id="state-fixed" type="text" value="Odisha" disabled />
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="district-select">District</label>
                <select
                  id="district-select"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  disabled={busy}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="block-input">Block / Tehsil</label>
                                <input
                  id="block-input"
                  type="text"
                  placeholder={blockPh.text}
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  {...blockPh.handlers}
                  maxLength={100}
                  disabled={busy}
                />
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="pincode-input">PIN Code</label>
                                <input
                  id="pincode-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder={pinCodePh.text}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  {...pinCodePh.handlers}
                  maxLength={6}
                  disabled={busy}
                />
              </div>

              <div className="reg-field reg-field-wide">
                <label className="form-label" htmlFor="address-input">Street Address</label>
                                <input
                  id="address-input"
                  type="text"
                  placeholder={addressPh.text}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  {...addressPh.handlers}
                  maxLength={250}
                  disabled={busy}
                />
              </div>
            </div>
          </section>

          {/* 3 — Agency & Contact */}
          <section className="reg-section" id="section-agency">
            <div className="reg-section-head">
              <span className="reg-step-chip" aria-hidden="true">
                <IconBuilding width={13} height={13} />
              </span>
              <div>
                <h2>Agency &amp; Contact</h2>
              </div>
              {sectionDone.agency && (
                <span className="reg-section-done" title="Section complete">
                  <IconCheck width={13} height={13} />
                </span>
              )}
            </div>

            <div className="reg-fields">
              <div className="reg-field reg-field-wide">
                <label className="form-label" htmlFor="org-select">Agency / Society</label>
                <select
                  id="org-select"
                  value={organisationId}
                  onChange={(e) => setOrganisationId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select the operating agency…</option>
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

              <div className="reg-field">
                <label className="form-label" htmlFor="incharge-name">In-Charge / Superintendent</label>
                                <input
                  id="incharge-name"
                  type="text"
                  placeholder={inChargePh.text}
                  value={inChargeName}
                  onChange={(e) => setInChargeName(e.target.value)}
                  {...inChargePh.handlers}
                  maxLength={100}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>

              <div className="reg-field">
                <label className="form-label" htmlFor="incharge-phone">Phone</label>
                                <input
                  id="incharge-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder={phonePh.text}
                  value={inChargePhone}
                  onChange={(e) => setInChargePhone(e.target.value)}
                  {...phonePh.handlers}
                  maxLength={20}
                  autoComplete="tel"
                  disabled={busy}
                />
              </div>

              <div className="reg-field reg-field-wide">
                <label className="form-label" htmlFor="incharge-email">Email</label>
                                <input
                  id="incharge-email"
                  type="email"
                  placeholder={emailPh.text}
                  value={inChargeEmail}
                  onChange={(e) => setInChargeEmail(e.target.value)}
                  {...emailPh.handlers}
                  maxLength={120}
                  autoComplete="email"
                  disabled={busy}
                />
              </div>
            </div>
          </section>

          {/* 4 — Programme & Capacity */}
          <section className="reg-section" id="section-programme">
            <div className="reg-section-head">
              <span className="reg-step-chip" aria-hidden="true">
                <IconClipboard width={13} height={13} />
              </span>
              <div>
                <h2>Programme &amp; Capacity</h2>
              </div>
              {sectionDone.programme && (
                <span className="reg-section-done" title="Section complete">
                  <IconCheck width={13} height={13} />
                </span>
              )}
            </div>

            <div className="reg-fields">
              <div className="reg-field reg-field-wide">
                <span className="form-label">Schemes</span>
                <div className="reg-scheme-list" role="group" aria-label="Linked schemes">
                  {PROGRAMMES.map((prog) => {
                    const isChecked = selectedProgrammes.includes(prog.id);
                    return (
                      <label key={prog.id} className="reg-scheme-row">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProgramme(prog.id)}
                          disabled={busy}
                        />
                        <span className="reg-scheme-check" aria-hidden="true">
                          {isChecked && <IconCheck width={11} height={11} />}
                        </span>
                        <span className="reg-scheme-body">
                          <span className="reg-scheme-name">{prog.name}</span>
                          <span className="reg-scheme-code">{prog.code}</span>
                        </span>
                        <span
                          className={`reg-scheme-state ${isChecked ? "on" : ""}`}
                          aria-hidden="true"
                        >
                          {isChecked ? "Linked" : "Not linked"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="reg-field reg-field-wide">
                <span className="form-label" id="capacity-label">Sanctioned Capacity</span>
                <div className="reg-capacity-box">
                  <input
                    id="capacity-input"
                    type="number"
                    inputMode="numeric"
                    aria-labelledby="capacity-label"
                    placeholder={capacityPh.text}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    {...capacityPh.handlers}
                    min={1}
                    max={5000}
                    disabled={busy}
                  />
                  <span className="reg-capacity-unit">seats</span>
                </div>
                <div className="form-helper">Number of beneficiary seats this facility is sanctioned for.</div>
              </div>
            </div>
          </section>

          {/* 5 — Photo Evidence */}
          <section className="reg-section" id="section-photos">
            <div className="reg-section-head">
              <span className="reg-step-chip" aria-hidden="true">
                <IconCamera width={13} height={13} />
              </span>
              <div>
                <h2>Photo Evidence</h2>
              </div>
              <span className="reg-check-optional">optional</span>
            </div>

            {initialPhotos.length > 0 && (
              <div className="reg-photo-grid" style={{ marginBottom: "1rem" }}>
                {initialPhotos.map((p) => (
                  <div key={p.id} className="reg-photo-tile">
                    <img
                      src={`/api/projects/photos/${p.id}/content`}
                      alt={p.caption ?? "Project photo"}
                    />
                    <div className="reg-photo-meta">
                      <div className="reg-photo-caption">{p.caption ?? "Photo"}</div>
                      <div className="reg-photo-sub">On file</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="reg-dropzone">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => attachFiles(e.target.files)}
                disabled={busy}
              />
              <IconCamera width={18} height={18} />
              <span className="reg-dropzone-title">Add photos</span>
              <span className="reg-dropzone-sub">Select images — capture time and note per photo</span>
            </label>

            {photos.length > 0 && (
              <div className="reg-photo-grid" style={{ marginTop: "0.9rem" }}>
                {photos.map((entry) => (
                  <div key={entry.key} className={`reg-photo-tile ${entry.uploaded ? "reg-photo-uploaded" : ""}`}>
                    {entry.previewUrl ? (
                      <img src={entry.previewUrl} alt={entry.caption || "New photo"} />
                    ) : (
                      <div className="reg-photo-placeholder">
                        <IconCamera width={20} height={20} />
                      </div>
                    )}
                    <div className="reg-photo-meta">
                      <input
                        type="text"
                        placeholder="Short detail — e.g. Main gate"
                        value={entry.caption}
                        onChange={(e) => updatePhoto(entry.key, { caption: e.target.value })}
                        maxLength={500}
                        disabled={busy || entry.uploaded}
                        aria-label="Photo caption"
                      />
                      <input
                        type="datetime-local"
                        value={entry.capturedAt}
                        onChange={(e) => updatePhoto(entry.key, { capturedAt: e.target.value })}
                        disabled={busy || entry.uploaded}
                        aria-label="Capture date and time"
                      />
                      <div className="reg-photo-row">
                        <span className="reg-photo-sub">
                          {entry.uploaded
                            ? "Uploaded"
                            : entry.file
                              ? `${(entry.file.size / 1024).toFixed(0)} KB`
                              : "No file"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhoto(entry.key)}
                          disabled={busy || entry.uploaded}
                          className="reg-photo-remove"
                          aria-label={`Remove photo ${entry.caption || ""}`}
                          title={entry.uploaded ? "Already uploaded" : "Remove"}
                        >
                          <IconX width={12} height={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ---------------- Summary rail ---------------- */}
        <aside className="reg-aside">
          <div className="reg-summary">
            <div className="reg-summary-head">
              <span className="reg-summary-title">Registration</span>
              {savedCode && <span className="reg-summary-code">{savedCode}</span>}
            </div>

            <div className="reg-meter" role="progressbar" aria-valuenow={completenessPct} aria-valuemin={0} aria-valuemax={100} aria-label="Registration completeness">
              <div className="reg-meter-fill" style={{ width: `${completenessPct}%` }} />
            </div>
            <div className="reg-meter-caption">
              {completenessPct === 100
                ? "All sections complete — ready to submit."
                : `${completedCount} of 5 sections complete`}
            </div>

            <ul className="reg-checklist">
              {summaryItems.map((item) => (
                <li key={item.key} className={sectionDone[item.key] ? "done" : ""}>
                  <span className="reg-check-dot" aria-hidden="true">
                    {sectionDone[item.key] ? <IconCheck width={10} height={10} /> : null}
                  </span>
                  <span className="reg-check-label">{item.label}</span>
                  {optional[item.key] && <span className="reg-check-optional">optional</span>}
                  <a
                    href={`#section-${item.key === "identity" ? "identity" : item.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`section-${item.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="reg-check-jump"
                    title="Jump to section"
                  >
                    <IconChevronLeft width={11} height={11} style={{ transform: "rotate(180deg)" }} />
                  </a>
                </li>
              ))}
            </ul>

            {!isEdit && (
              <div className="reg-lifecycle">
                <div className="reg-lifecycle-title">What happens next</div>
                <p className="reg-lifecycle-note">
                  An authority official verifies this registration before the facility becomes active.
                </p>
              </div>
            )}

            {/* Actions — stacked at the end of the summary rail, primary last */}
            <div className="reg-actions">
              <button
                type="button"
                onClick={discard}
                disabled={busy}
                className="btn-secondary"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={busy || !canCreate}
                className="btn-secondary"
              >
                {busy ? "Saving…" : "Save as Draft"}
              </button>
              <button
                type="submit"
                disabled={busy || !canCreate}
                className="reg-submit"
              >
                <IconCheck width={15} height={15} />
                <span>{busy ? "Registering…" : isEdit ? "Save & Submit" : "Submit Registration"}</span>
              </button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
