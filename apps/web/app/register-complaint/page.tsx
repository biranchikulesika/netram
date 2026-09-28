"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Complaint } from "@netram/types";
import styles from "./complaint.module.css";

interface FacilityRef {
  id: string;
  code: string;
  name: string;
}

function assertAllowedAttachment(file: File): string | null {
  const allowed = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  if (!allowed.has(file.type)) {
    return `'${file.name}' is not supported. Only photos, videos, PDFs and office documents can be attached.`;
  }
  if (file.size > 100 * 1024 * 1024) {
    return `'${file.name}' exceeds the 100 MB size limit.`;
  }
  return null;
}

const MAX_ATTACHMENTS = 5;

function fileKind(file: File): string {
  if (file.type.startsWith("image/")) return "IMG";
  if (file.type.startsWith("video/")) return "VID";
  if (file.type === "application/pdf") return "PDF";
  return "DOC";
}

function RegisterComplaintContent() {
  const [facilities, setFacilities] = useState<FacilityRef[]>([]);
  const [facilitiesError, setFacilitiesError] = useState(false);
  const [facilityQuery, setFacilityQuery] = useState("");
  const [facilityOpen, setFacilityOpen] = useState(false);
  const facilityBox = useRef<HTMLDivElement | null>(null);

  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [complainantName, setComplainantName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Complaint | null>(null);
  const [copied, setCopied] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 2 only opens once both contact fields carry a value.
  const section1Done = complainantName.trim() !== "" && contactInfo.trim() !== "";

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/projects/registry");
        if (!res.ok) throw new Error("registry unavailable");
        const data = (await res.json()) as FacilityRef[];
        setFacilities(data);
        if (data.length === 1) setProjectId(data[0]!.id);
      } catch {
        setFacilitiesError(true);
      }
    })();
  }, []);

  // Close the suggestion list on an outside click.
  useEffect(() => {
    if (!facilityOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!facilityBox.current?.contains(e.target as Node)) setFacilityOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [facilityOpen]);

  const selectedFacility = facilities.find((f) => f.id === projectId);
  const facilityMatches = facilityQuery.trim()
    ? facilities.filter((f) =>
        `${f.name} ${f.code}`.toLowerCase().includes(facilityQuery.trim().toLowerCase()),
      )
    : facilities;

  const pickFacility = (f: FacilityRef) => {
    setProjectId(f.id);
    setFacilityQuery("");
    setFacilityOpen(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const picked = Array.from(files).filter((file) => {
      const problem = assertAllowedAttachment(file);
      if (problem) {
        setError(problem);
        return false;
      }
      return true;
    });
    if (picked.length > 0) {
      setAttachments((prev) =>
        [...prev, ...picked].slice(0, MAX_ATTACHMENTS),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("projectId", projectId);
    form.append("description", description);
    form.append("complainantName", complainantName.trim());
    form.append("contactInfo", contactInfo.trim());
    for (const file of attachments) form.append("files", file, file.name);

    try {
      const res = await fetch("/api/complaints/register", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Grievance filing service unavailable (status ${res.status}).`);
      }

      setResult((await res.json()) as Complaint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to file grievance");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!result?.trackingCode) return;
    void navigator.clipboard.writeText(result.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={styles.masthead}>
        <a
          href="https://socialjustice.gov.in"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.mastheadLink}
        >
          <Image
            src="/National-Emblem-1.svg"
            alt="Department of Social Justice & Empowerment logo"
            width={72}
            height={72}
            className={styles.emblem}
          />
          <div className={styles.mastheadName}>
            <strong>Department of Social Justice and Empowerment</strong>
            <span>Government of India</span>
          </div>
        </a>
        <a
          href="https://sih.gov.in"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.mastheadEnd}
        >
          <Image
            src="/sih-logo.png"
            alt="Smart India Hackathon"
            width={208}
            height={96}
            className={styles.sihLogo}
          />
        </a>
      </div>

      <div className={styles.wrapper}>
        <div className={styles.heading}>
        <h1>
          <span className={styles.saffron}>Netram</span>{" "}
          <span className={styles.navy}>Citizen Grievance Portal</span>
        </h1>
        <p>File a public grievance against a monitored facility for statutory review</p>
      </div>

      <div className={styles.card}>
        {facilitiesError ? (
          <div className={styles.error}>
            Unable to load the facility registry. Please retry shortly or contact the district authority.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {step === 1 ? (
            <fieldset className={styles.section} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <legend className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Your details</span>
              </legend>

              <div className={styles.field}>
                <input
                  id="complainantName"
                  type="text"
                  className={styles.input}
                  value={complainantName}
                  onChange={(e) => setComplainantName(e.target.value)}
                  maxLength={200}
                  required
                  aria-label="Your name"
                  placeholder="Your name"
                />
              </div>
              <div className={styles.field} style={{ marginTop: "0.9rem" }}>
                <input
                  id="contactInfo"
                  type="text"
                  className={styles.input}
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  maxLength={300}
                  required
                  aria-label="Phone or email"
                  placeholder="Phone or email"
                />
              </div>
              <button
                type="button"
                className={styles.continue}
                disabled={!section1Done}
                style={{ marginTop: "1rem" }}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </fieldset>
            ) : (
            <>
              <div className={styles.summary}>
                <div className={styles.summaryText}>
                  <span className={styles.summaryLabel}>Filing as</span>
                  <span className={styles.summaryName}>{complainantName.trim()}</span>
                  <span className={styles.summaryContact}>{contactInfo.trim()}</span>
                </div>
                <button type="button" className={styles.linkBtn} onClick={() => setStep(1)}>
                  Edit details
                </button>
              </div>

            <fieldset className={styles.section} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <legend className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Your grievance</span>
              </legend>

              <div className={styles.field} ref={facilityBox}>
                <label className={styles.label} htmlFor="projectId">
                  Monitored facility *
                </label>
                <input
                  id="projectId"
                  type="text"
                  role="combobox"
                  aria-expanded={facilityOpen}
                  aria-controls="facility-list"
                  aria-autocomplete="list"
                  autoComplete="off"
                  className={styles.input}
                  value={facilityOpen ? facilityQuery : (selectedFacility?.name ?? "")}
                  onChange={(e) => {
                    setFacilityQuery(e.target.value);
                    setFacilityOpen(true);
                  }}
                  onFocus={() => {
                    setFacilityOpen(true);
                    setFacilityQuery("");
                  }}
                  onBlur={() => !projectId && setProjectId("")}
                  required
                  placeholder={
                    facilities.length === 0 ? "Loading facilities…" : "Search facility by name or code"
                  }
                />
                {selectedFacility && !facilityOpen && (
                  <div className={styles.hint}>{selectedFacility.code}</div>
                )}

                {facilityOpen && (
                  <ul className={styles.suggest} id="facility-list" role="listbox">
                    {facilityMatches.length === 0 && <li className={styles.suggestEmpty}>No matching facility</li>}
                    {facilityMatches.map((f) => (
                      <li key={f.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={f.id === projectId}
                          className={`${styles.suggestItem}${f.id === projectId ? ` ${styles.suggestItemOn}` : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickFacility(f)}
                        >
                          <span className={styles.suggestName}>{f.name}</span>
                          <span className={styles.suggestCode}>{f.code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="description">
                  Grievance description *
                </label>
                <textarea
                  id="description"
                  className={`${styles.input} ${styles.textarea}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={10}
                  maxLength={8000}
                  rows={6}
                  placeholder="Describe the concern observed at the facility."
                />
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="files" style={{ marginBottom: 0 }}>
                    Supporting evidence <em>optional</em>
                  </label>
                  <span className={styles.counter}>
                    {attachments.length} of {MAX_ATTACHMENTS} added
                  </span>
                </div>

                <label
                  className={`${styles.drop}${attachments.length >= MAX_ATTACHMENTS ? ` ${styles.dropFull}` : ""}`}
                  htmlFor="files"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
                  </svg>
                  <span>
                    {attachments.length >= MAX_ATTACHMENTS ? (
                      <>Attachment limit reached &mdash; remove one to add another</>
                    ) : (
                      <>
                        <strong>Choose files</strong> or drag them here
                      </>
                    )}
                  </span>
                  <span className={styles.dropHint}>
                    Images, video, PDF, documents &middot; 100 MB max each
                  </span>
                  <input
                    id="files"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.txt,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => handleFiles(e.target.files)}
                    className={styles.fileInput}
                    disabled={attachments.length >= MAX_ATTACHMENTS}
                  />
                </label>

                {attachments.length > 0 && (
                  <ul className={styles.files}>
                    {attachments.map((f, idx) => (
                      <li key={idx} className={styles.fileRow}>
                        <span className={styles.fileBadge}>{fileKind(f)}</span>
                        <span className={styles.fileMeta}>
                          <span className={styles.fileName}>{f.name}</span>
                          <span className={styles.fileSize}>
                            {(f.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${f.name}`}
                          title={`Remove ${f.name}`}
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className={styles.fileRemove}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            aria-hidden="true"
                          >
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label
                htmlFor="declaration"
                className={`${styles.declaration}${declared ? ` ${styles.declarationDone}` : ""}`}
                style={{ marginTop: "0.4rem" }}
              >
                <input
                  id="declaration"
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  style={{ accentColor: "#137e3a" }}
                />
                <span>
                  I declare that the information above is true and correct to the best of my knowledge,
                  and that I am the complainant or authorised to file on their behalf.
                </span>
              </label>

              {error && <div className={styles.error}>{error}</div>}

              <button type="submit" className={styles.submit} disabled={isLoading || !declared}>
                {isLoading ? "Filing Grievance…" : "Submit Grievance"}
              </button>
            </fieldset>
            </>
          )}
          </form>
        )}
      </div>

      {result && (
        <div className={styles.receipt}>
          <div className={styles.receiptTop}>
            <div>
              <div className={styles.receiptKicker}>Grievance filed successfully</div>
              <div className={styles.trackingRow}>
                <span className={styles.trackingCode}>{result.trackingCode}</span>
                <button type="button" onClick={handleCopyCode} className={styles.copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className={styles.ledger}>Registered in public ledger</div>
          </div>

          <p className={styles.receiptBody}>
            Your grievance regarding <strong>{result.projectName}</strong> ({result.projectCode}) has
            been logged for district authority examination. Keep this tracking code to check status.
          </p>

          <div className={styles.privacy}>
            Complainant identity and contact details stay confidential and are omitted from public
            verification views.
          </div>
        </div>
      )}

      <div className={styles.crossLinks}>
        <Link href="/" className={styles.crossBtn}>Home</Link>
        <Link href="/login" className={styles.crossBtn}>Authority Login</Link>
      </div>
      </div>
    </>
  );
}

export default function RegisterComplaintPage() {
  return (
    <main>
      <RegisterComplaintContent />
    </main>
  );
}