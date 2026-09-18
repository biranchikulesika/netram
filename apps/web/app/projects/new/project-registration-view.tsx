"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectType } from "@netram/types";
import {
  IconChevronLeft,
  IconCheck,
  IconAlertTriangle,
} from "../../components/icons";

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

interface ProjectRegistrationViewProps {
  userEmail: string;
  canCreate: boolean;
  canApprove?: boolean;
  isAuthority?: boolean;
  isInstitutionAdmin?: boolean;
}

export function ProjectRegistrationView({
  userEmail: _userEmail,
  canCreate,
  canApprove: _canApprove = false,
  isAuthority: _isAuthority = false,
  isInstitutionAdmin = false,
}: ProjectRegistrationViewProps) {
  const router = useRouter();

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("institution");
  const [category, setCategory] = useState(FACILITY_CATEGORIES[0] ?? "");
  const [sanctionRef, setSanctionRef] = useState("");
  const [sanctionDate, setSanctionDate] = useState("");

  const [districtId, setDistrictId] = useState(DISTRICTS[0]!.id);
  const [block, setBlock] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [coordinates, setCoordinates] = useState("");

  const [organisationId, setOrganisationId] = useState(ORGANISATIONS[0]!.id);
  const [inChargeName, setInChargeName] = useState("");
  const [inChargePhone, setInChargePhone] = useState("");
  const [inChargeEmail, setInChargeEmail] = useState("");

  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>([PROGRAMMES[0]!.id]);
  const [capacity, setCapacity] = useState("100");
  const [operationalNotes, setOperationalNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const locBits = [
        address.trim(),
        block.trim(),
        pinCode.trim() ? `PIN: ${pinCode.trim()}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`Location: ${locBits}`);
    }
    if (coordinates.trim()) parts.push(`GPS Coordinates: ${coordinates.trim()}`);
    if (operationalNotes.trim()) parts.push(`Scope: ${operationalNotes.trim()}`);
    return parts.join(" | ").slice(0, 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      setError("Unauthorized: You lack permission to register projects.");
      return;
    }
    if (name.trim().length < 3) {
      setError("Project name must be at least 3 characters.");
      return;
    }
    if (pinCode.trim() && !/^[1-9][0-9]{5}$/.test(pinCode.trim())) {
      setError("PIN code must be a valid 6-digit code.");
      return;
    }
    if (inChargePhone.trim() && !/^[0-9+\-\s()]{7,15}$/.test(inChargePhone.trim())) {
      setError("Phone number is invalid.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const compiledDescription = compileFullDescription();
      const payload = {
        name: name.trim(),
        type,
        districtId: districtId || null,
        organisationId: organisationId || null,
        programmeIds: selectedProgrammes,
        description: compiledDescription || null,
      };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            `Server error (${res.status})`,
        );
      }

      setSuccess(`Project "${data.name}" registered (${data.code}).`);
      setTimeout(() => {
        router.push(`/projects/${data.id}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div className="breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/projects" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
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
          Register Project
        </h1>
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
        {/* Card 1: Details */}
        <div className="form-card">
          <div className="form-card-header">
            <h3>Facility Details</h3>
          </div>

          <div className="form-card-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="facility-name">
                Project Name *
              </label>
              <input
                id="facility-name"
                type="text"
                placeholder="e.g. Sambalpur SC/ST Model Residential Hostel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={3}
                maxLength={200}
                required
                disabled={busy}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="classification-type">
                Type *
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
            </div>
          </div>
        </div>

        {/* Card 2: Location */}
        <div className="form-card">
          <div className="form-card-header">
            <h3>Location</h3>
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
                District *
              </label>
              <select
                id="district-select"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                disabled={busy}
                required
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
                placeholder="e.g. 751007"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                maxLength={6}
                disabled={busy}
              />
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

            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="coordinates-input">
                GPS Coordinates
              </label>
              <input
                id="coordinates-input"
                type="text"
                placeholder="e.g. 20.2961, 85.8245"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
                maxLength={50}
                disabled={busy}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Agency & Contact */}
        <div className="form-card">
          <div className="form-card-header">
            <h3>Operating Agency & Contact</h3>
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
                placeholder="e.g. 9876543210"
                value={inChargePhone}
                onChange={(e) => setInChargePhone(e.target.value)}
                maxLength={20}
                disabled={busy}
              />
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
                disabled={busy}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Programmes */}
        <div className="form-card">
          <div className="form-card-header">
            <h3>Programmes</h3>
          </div>

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
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-navy-brand)" }}>
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
        </div>

        {/* Card 5: Capacity & Notes */}
        <div className="form-card">
          <div className="form-card-header">
            <h3>Capacity & Notes</h3>
          </div>

          <div className="form-card-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="capacity-input">
                Sanctioned Capacity
              </label>
              <input
                id="capacity-input"
                type="number"
                placeholder="e.g. 100"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min={1}
                max={5000}
                disabled={busy}
              />
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
          <Link
            href="/projects"
            className="btn-secondary"
            style={{
              textDecoration: "none",
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
            }}
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={busy || !canCreate || name.trim().length < 3}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 1.25rem",
              fontSize: "0.88rem",
              fontWeight: 700,
              opacity: busy || !canCreate || name.trim().length < 3 ? 0.65 : 1,
            }}
          >
            <IconCheck width={15} height={15} />
            <span>{busy ? "Registering…" : "Register Project"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
