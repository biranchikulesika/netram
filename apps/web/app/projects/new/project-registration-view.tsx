"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectType } from "@netram/types";
import {
  IconBuilding,
  IconMapPin,
  IconShieldCheck,
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

// Known statutory districts in Odisha (matching synthetic seed data)
const DISTRICTS: DistrictOption[] = [
  { id: "5f6c6fcf-fc88-5bf1-9f63-cad86ee0bd3b", name: "Khordha", code: "KHOL" },
  { id: "92f0e386-2b80-5ca4-94a0-9c7d90d47dbf", name: "Cuttack", code: "CUT" },
  { id: "ec220eb3-d4a3-5b12-9412-26d8badeafe7", name: "Puri", code: "PURI" },
  { id: "a2dfd214-5aa0-5c7a-aa78-7b59865ba0a3", name: "Ganjam", code: "GANJ" },
  { id: "e71c0cc4-6569-5e2b-bb73-cc3cae07fb8d", name: "Sundargarh", code: "SNDR" },
];

// Known registered implementing organisations
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

// Known statutory welfare programmes
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
  userEmail,
  canCreate,
  canApprove: _canApprove = false,
  isAuthority = false,
  isInstitutionAdmin = false,
}: ProjectRegistrationViewProps) {
  const router = useRouter();

  // Section 1: Facility Identity
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("institution");
  const [category, setCategory] = useState(FACILITY_CATEGORIES[0] ?? "");
  const [sanctionRef, setSanctionRef] = useState("");
  const [sanctionDate, setSanctionDate] = useState("");

  // Section 2: Administrative Jurisdiction & Geographic Location
  const [districtId, setDistrictId] = useState(DISTRICTS[0]!.id);
  const [block, setBlock] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [coordinates, setCoordinates] = useState("");

  // Section 3: Implementing Organisation & In-Charge
  const [organisationId, setOrganisationId] = useState(ORGANISATIONS[0]!.id);
  const [inChargeName, setInChargeName] = useState("");
  const [inChargePhone, setInChargePhone] = useState("");
  const [inChargeEmail, setInChargeEmail] = useState("");

  // Section 4: Programme Linkage
  const [selectedProgrammes, setSelectedProgrammes] = useState<string[]>([PROGRAMMES[0]!.id]);

  // Section 5: Capacity & Operational Scope
  const [capacity, setCapacity] = useState("100");
  const [operationalNotes, setOperationalNotes] = useState("");

  // UI state
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
      setError("Unauthorized: Your user role lacks the required 'project:create' permission.");
      return;
    }
    if (name.trim().length < 3) {
      setError("Project title must contain at least 3 characters.");
      return;
    }
    if (pinCode.trim() && !/^[1-9][0-9]{5}$/.test(pinCode.trim())) {
      setError("PIN Code must be a valid 6-digit postal code.");
      return;
    }
    if (inChargePhone.trim() && !/^[0-9+\-\s()]{7,15}$/.test(inChargePhone.trim())) {
      setError("Contact phone number contains invalid characters.");
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
            `Server returned HTTP ${res.status}: ${res.statusText}`,
        );
      }

      setSuccess(`Project "${data.name}" successfully registered with code ${data.code}! Redirecting to facility dossier...`);
      setTimeout(() => {
        router.push(`/projects/${data.id}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const selectedDistrict = DISTRICTS.find((d) => d.id === districtId);
  const selectedOrg = ORGANISATIONS.find((o) => o.id === organisationId);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* Top Breadcrumb Navigation */}
      <div className="breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href="/projects" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <IconChevronLeft width={14} height={14} /> Back to Projects Registry
        </Link>
      </div>

      {/* Institutional Masthead */}
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
          <span
            style={{
              fontSize: "0.68rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              background: "var(--color-navy-dark)",
              color: "#ffffff",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            DEPARTMENT OF SOCIAL JUSTICE & EMPOWERMENT
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            Govt. of Odisha • Statutory Portal
          </span>
        </div>
        <h1
          style={{
            margin: "0 0 0.35rem 0",
            fontSize: "1.65rem",
            fontWeight: 800,
            color: "var(--color-navy-brand)",
            letterSpacing: "-0.02em",
          }}
        >
          Register New Project / Institutional Facility
        </h1>
        <p className="muted" style={{ fontSize: "0.88rem", maxWidth: 840, lineHeight: 1.5 }}>
          Formal statutory enrollment into the Netram unified inspection and monitoring registry.
          Enrolled facilities are subject to scheduled inspections, biometric verification, CCTV stream
          acquisition, and automated SLA compliance oversight under DoSJE governance.
        </p>
      </div>

      {/* Statutory 3-Stage Lifecycle Stepper (§33) */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "8px",
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-navy-brand)",
            marginBottom: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>STATUTORY ENROLLMENT PIPELINE (AGENTS.MD §33)</span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500, textTransform: "none" }}>
            Enforcing Separation of Powers & Jurisdictional Oversight
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              borderLeft: "3px solid var(--action-green)",
              padding: "0.65rem 0.85rem",
              background: "var(--bg-subtle)",
              borderRadius: "0 6px 6px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem", background: "var(--action-green)", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "3px", fontWeight: 700 }}>
                STAGE 1 (CURRENT)
              </span>
              <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Facility Enrollment</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
              Operating Agency or Authority enters statutory dossier, geolocation, and capacity. Enters registry as <strong>Draft</strong>.
            </p>
          </div>

          <div
            style={{
              borderLeft: "3px solid var(--color-border-strong)",
              padding: "0.65rem 0.85rem",
              background: "var(--bg-subtle)",
              borderRadius: "0 6px 6px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem", background: "var(--text-muted)", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "3px", fontWeight: 700 }}>
                STAGE 2
              </span>
              <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Jurisdictional Scrutiny</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
              Dossier submitted to DSWO. Field Inspector dispatched for physical premises audit (<strong>Pending Verification</strong>).
            </p>
          </div>

          <div
            style={{
              borderLeft: "3px solid var(--color-border-strong)",
              padding: "0.65rem 0.85rem",
              background: "var(--bg-subtle)",
              borderRadius: "0 6px 6px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem", background: "var(--text-muted)", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "3px", fontWeight: 700 }}>
                STAGE 3
              </span>
              <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Authority Sanction</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
              District Social Welfare Authority issues sanction sign-off. Facility marked <strong>Approved</strong> &rarr; <strong>Active</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Role-Specific Protocol Notice */}
      {isAuthority ? (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "0.9rem 1.15rem",
            marginBottom: "1.75rem",
            display: "flex",
            gap: "0.85rem",
            alignItems: "flex-start",
          }}
        >
          <IconShieldCheck width={20} height={20} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "0.82rem", color: "#14532d", lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: "0.15rem", fontWeight: 700 }}>
              Authority Officer Mode &mdash; Direct Departmental & Supervisory Enrollment
            </strong>
            Authenticated with Departmental Authority privileges ({userEmail}). You have authority to enroll <strong>Direct Departmental Facilities</strong> (state residential hostels, welfare shelters) or onboard accredited <strong>NGO Institutions</strong> within your district jurisdiction. As an Authority Officer, you hold statutory approval rights.
          </div>
        </div>
      ) : isInstitutionAdmin ? (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "8px",
            padding: "0.9rem 1.15rem",
            marginBottom: "1.75rem",
            display: "flex",
            gap: "0.85rem",
            alignItems: "flex-start",
          }}
        >
          <IconBuilding width={20} height={20} style={{ color: "#d97706", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "0.82rem", color: "#78350f", lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: "0.15rem", fontWeight: 700 }}>
              Operating Agency Mode &mdash; Institutional Enrollment Application
            </strong>
            You are registering an Institutional Facility dossier on behalf of your operating organisation ({userEmail}). In compliance with Netram separation of powers (AGENTS.md §33), <strong>facilities cannot be self-approved</strong>. Submission places the record in <strong>Draft</strong> state for formal inspection and approval by the District Social Welfare Office.
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            padding: "0.9rem 1.15rem",
            marginBottom: "1.75rem",
            display: "flex",
            gap: "0.85rem",
            alignItems: "flex-start",
          }}
        >
          <IconShieldCheck width={20} height={20} style={{ color: "#1d4ed8", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "0.82rem", color: "#1e3a8a", lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: "0.15rem", fontWeight: 700 }}>
              System Administrator Mode &mdash; State-Wide Oversight
            </strong>
            Authenticated as System Administrator ({userEmail}). State-wide enrollment scope across all jurisdictions, schemes, and facility classifications.
          </div>
        </div>
      )}

      {/* Status Banners */}
      {error && (
        <div
          className="error-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
          }}
        >
          <IconAlertTriangle width={18} height={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "0.85rem 1rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          <IconCheck width={18} height={18} style={{ color: "#16a34a" }} />
          <span>{success}</span>
        </div>
      )}

      {/* Comprehensive Registration Form */}
      <form onSubmit={handleSubmit}>
        {/* Card 1: Facility Identity */}
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <div className="section-eyebrow">SECTION 1 OF 5</div>
              <h3>Facility Identity & Classification</h3>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                background: "var(--bg-subtle)",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              PRIMARY IDENTIFIER
            </span>
          </div>

          <div className="form-card-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="facility-name">
                Official Facility / Project Name *
              </label>
              <input
                id="facility-name"
                type="text"
                placeholder="e.g. Sambalpur SC/ST Model Residential Hostel & Skill Centre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={3}
                maxLength={200}
                required
                disabled={busy}
                style={{ fontSize: "0.95rem", fontWeight: 600 }}
              />
              <span className="form-helper">
                Official name as sanctioned in government order (min 3 characters, max 200)
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="classification-type">
                Project Classification Type *
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
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: isInstitutionAdmin ? "not-allowed" : "default",
                }}
              >
                <option value="institution">Institution / NGO Facility (Grant-in-Aid / Society)</option>
                <option value="authority_project">Authority Infrastructure Project (Direct Govt. Run)</option>
                <option value="other">Other Sanctioned Welfare Initiative</option>
              </select>
              <span className="form-helper">
                {isInstitutionAdmin
                  ? "Operating Agency Scope: Strictly locked to Institution / NGO Facility (§33)"
                  : "Defines statutory hierarchy: NGO-managed (institution) vs Direct Govt-run (authority_project)"}
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="facility-category">
                Specific Welfare Category
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
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                }}
              >
                {FACILITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="form-helper">Statutory facility purpose and beneficiary profile</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="sanction-ref">
                Government Sanction Order Reference
              </label>
              <input
                id="sanction-ref"
                type="text"
                placeholder="e.g. DOSJE/OD/2026/F-1049 or SANCTION/OR/SC-402"
                value={sanctionRef}
                onChange={(e) => setSanctionRef(e.target.value)}
                maxLength={100}
                disabled={busy}
              />
              <span className="form-helper">Official sanction letter or grant order code</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="sanction-date">
                Sanction / Inception Date
              </label>
              <input
                id="sanction-date"
                type="date"
                value={sanctionDate}
                onChange={(e) => setSanctionDate(e.target.value)}
                disabled={busy}
              />
              <span className="form-helper">Date of formal departmental sanction</span>
            </div>
          </div>
        </div>

        {/* Card 2: Administrative Jurisdiction & Geographic Location */}
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <div className="section-eyebrow">SECTION 2 OF 5</div>
              <h3>Administrative Jurisdiction & Geographical Location</h3>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                background: "var(--bg-subtle)",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              BOUNDARIES (§16, §17)
            </span>
          </div>

          <div className="form-card-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="state-fixed">
                State Jurisdiction
              </label>
              <input
                id="state-fixed"
                type="text"
                value="Odisha (OD)"
                disabled
                style={{
                  background: "var(--bg-subtle)",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              />
              <span className="form-helper">Jurisdiction state authority (Department of Social Justice)</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="district-select">
                District Jurisdiction *
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
                  fontFamily: "inherit",
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
              <span className="form-helper">
                Enforces district-level access control & officer jurisdiction boundaries
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="block-input">
                Block / Tehsil / Municipality
              </label>
              <input
                id="block-input"
                type="text"
                placeholder="e.g. Bhubaneswar Urban (BMC) / Barabati Tehsil"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                maxLength={100}
                disabled={busy}
              />
              <span className="form-helper">Administrative subdivision or urban local body</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="pincode-input">
                Postal PIN Code
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
              <span className="form-helper">6-digit Indian postal code</span>
            </div>

            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="address-input">
                Physical Campus Street Address & Landmark
              </label>
              <input
                id="address-input"
                type="text"
                placeholder="e.g. Plot 42, Vani Vihar Campus, Near Main Library, Saheed Nagar"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={250}
                disabled={busy}
              />
              <span className="form-helper">Complete street address for mobile navigation & field visits</span>
            </div>

            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="coordinates-input">
                Geographical Coordinates (Latitude, Longitude)
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
              <span className="form-helper">
                Supports geofenced evidence capture validation & CCTV alignment (AGENTS.md §40)
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Implementing Organisation & Personnel */}
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <div className="section-eyebrow">SECTION 3 OF 5</div>
              <h3>Implementing Agency & Facility In-Charge</h3>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                background: "var(--bg-subtle)",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              OPERATING ENTITY
            </span>
          </div>

          <div className="form-card-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="org-select">
                Implementing Agency / Society / Directorate
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
                  fontFamily: "inherit",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                {type === "authority_project" && (
                  <option value="">(Direct Departmental Directorate &mdash; State/District Unit)</option>
                )}
                {ORGANISATIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} [{o.code}] &mdash; {o.category}
                  </option>
                ))}
              </select>
              <span className="form-helper">
                {type === "authority_project" && !organisationId
                  ? "Direct Department Initiative: Operated under direct Authority Directorate jurisdiction (no external NGO required)"
                  : "Registered non-governmental organization, autonomous trust, or implementing society"}
              </span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="incharge-name">
                Superintendent / Facility In-Charge
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
              <span className="form-helper">Designated administrative officer / head of facility</span>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="incharge-phone">
                In-Charge Contact Mobile
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
              <span className="form-helper">Official contact number for inspection notices & alerts</span>
            </div>

            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="incharge-email">
                In-Charge Institutional Email
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
              <span className="form-helper">Receives statutory audit notes & inspection reports</span>
            </div>
          </div>
        </div>

        {/* Card 4: Programme Linkages & Schemes */}
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <div className="section-eyebrow">SECTION 4 OF 5</div>
              <h3>Sanctioned Welfare Programmes & Schemes</h3>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                background: "var(--bg-subtle)",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              FUNDING LINKAGES
            </span>
          </div>

          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.75rem" }}>
            Select all approved welfare programmes and inspection drives associated with this facility:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1rem" }}>
            {PROGRAMMES.map((prog) => {
              const isChecked = selectedProgrammes.includes(prog.id);
              return (
                <label
                  key={prog.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "6px",
                    border: `1px solid ${isChecked ? "var(--color-navy-light)" : "var(--color-border-subtle)"}`,
                    background: isChecked ? "#f0f7ff" : "var(--bg-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
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
                    <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      Scheme Code: {prog.code}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Card 5: Operational Capacity & Narrative Scope */}
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <div className="section-eyebrow">SECTION 5 OF 5</div>
              <h3>Capacity, Operational Scope & Mission Details</h3>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                background: "var(--bg-subtle)",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
              }}
            >
              DOSSIER SPECIFICATION
            </span>
          </div>

          <div className="form-card-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="capacity-input">
                Sanctioned Beneficiary / Bed Capacity
              </label>
              <input
                id="capacity-input"
                type="number"
                placeholder="e.g. 120"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min={1}
                max={5000}
                disabled={busy}
              />
              <span className="form-helper">Approved resident student or patient intake limit</span>
            </div>

            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="operational-notes">
                Operational Mandate & Baseline Infrastructure Notes
              </label>
              <textarea
                id="operational-notes"
                placeholder="Provide detailed information regarding facility infrastructure, target demographic, hostel blocks, security provisions, CCTV coverage, and statutory conditions..."
                value={operationalNotes}
                onChange={(e) => setOperationalNotes(e.target.value)}
                rows={4}
                maxLength={1200}
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-subtle)", marginTop: 2 }}>
                <span>Recorded in official dossier and verified during inspection audits</span>
                <span>{operationalNotes.length} / 1200 characters</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pre-Submission Verification Summary */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "8px",
            padding: "1rem 1.25rem",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
            fontSize: "0.82rem",
          }}
        >
          <div>
            <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
              Selected Jurisdiction
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 600, color: "var(--color-navy-brand)" }}>
              <IconMapPin width={14} height={14} /> {selectedDistrict?.name} District ({selectedDistrict?.code})
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
              Operating Agency / Directorate
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 600, color: "var(--color-navy-brand)" }}>
              <IconBuilding width={14} height={14} />{" "}
              {selectedOrg ? selectedOrg.name : "(Direct Departmental Facility — No External NGO)"}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
              Enrolled By
            </span>
            <span style={{ fontWeight: 600, color: "var(--color-navy-brand)" }}>
              {userEmail} {isAuthority ? "(Authority Officer)" : isInstitutionAdmin ? "(Operating Agency)" : "(System Admin)"}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 600 }}>
              Initial Status
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontWeight: 700, color: "var(--action-green)" }}>
              <IconShieldCheck width={14} height={14} /> Draft (Pending Verification)
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 0",
            borderTop: "1px solid var(--color-border-subtle)",
            marginTop: "1rem",
            marginBottom: "3rem",
          }}
        >
          <Link
            href="/projects"
            className="btn-secondary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.55rem 1rem",
              fontSize: "0.85rem",
            }}
          >
            Discard & Return
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="submit"
              disabled={busy || !canCreate || name.trim().length < 3}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.55rem 1.25rem",
                fontSize: "0.88rem",
                fontWeight: 700,
                opacity: busy || !canCreate || name.trim().length < 3 ? 0.65 : 1,
              }}
            >
              <IconCheck width={16} height={16} />
              <span>{busy ? "Registering in Registry…" : "Register Facility in Netram Registry"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
